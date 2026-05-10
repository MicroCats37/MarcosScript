"""SQLite migration runner for MarcosScript.

Handles schema evolution for existing databases without destroying data.
Ensures columns and tables added in new migrations exist on startup.

All migrations are idempotent — safe to run multiple times.
"""
import logging
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from backend.database import engine

logger = logging.getLogger(__name__)


def _table_exists(conn, table_name: str) -> bool:
    """Check if a table exists in SQLite."""
    result = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name}
    )
    return result.fetchone() is not None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    """Check if a column exists in a SQLite table."""
    try:
        result = conn.execute(
            text(f"PRAGMA table_info({table_name})")
        )
        columns = [row[1] for row in result.fetchall()]
        return column_name in columns
    except OperationalError:
        return False


def _add_column_if_missing(conn, table: str, column: str, col_type: str) -> bool:
    """Add a column if it doesn't exist. Returns True if added, False if already existed."""
    if not _column_exists(conn, table, column):
        logger.info(f"Adding missing column {table}.{column}")
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        # No explicit commit here — caller manages the transaction via engine.begin()
        return True
    return False


def run_migrations():
    """Run all required migrations idempotently.

    Called at app startup to ensure the DB schema is up to date.
    Uses CREATE TABLE IF NOT EXISTS and conditional ALTER TABLE
    to be safe for existing databases with data.
    """
    logger.info("Running SQLite migrations...")
    
    with engine.begin() as conn:
        # 1. ProcessedFrame: add Drive metadata columns (nullable)
        _add_column_if_missing(conn, "processed_frames", "drive_file_id", "TEXT")
        _add_column_if_missing(conn, "processed_frames", "drive_web_view_link", "TEXT")
        _add_column_if_missing(conn, "processed_frames", "drive_uploaded_at", "TIMESTAMP")
        _add_column_if_missing(conn, "processed_frames", "drive_upload_error", "TEXT")

        # 2. EmailSend table
        if not _table_exists(conn, "email_sends"):
            logger.info("Creating email_sends table")
            conn.execute(text("""
                CREATE TABLE email_sends (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id INTEGER NOT NULL,
                    cip TEXT,
                    recipient_email TEXT NOT NULL,
                    recipient_name TEXT,
                    subject TEXT NOT NULL,
                    body_template TEXT,
                    html INTEGER DEFAULT 1,
                    status TEXT DEFAULT 'pending',
                    noti_response TEXT,
                    error_message TEXT,
                    usuario_creacion TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
                )
            """))
            logger.info("Created email_sends table")

        # 3. EmailSendItem table
        if not _table_exists(conn, "email_send_items"):
            logger.info("Creating email_send_items table")
            conn.execute(text("""
                CREATE TABLE email_send_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_send_id INTEGER NOT NULL,
                    processed_frame_id INTEGER NOT NULL,
                    drive_link TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    sent_at TIMESTAMP,
                    FOREIGN KEY (email_send_id) REFERENCES email_sends(id) ON DELETE CASCADE,
                    FOREIGN KEY (processed_frame_id) REFERENCES processed_frames(id) ON DELETE CASCADE
                )
            """))
            logger.info("Created email_send_items table")

        # 4. Indexes (CREATE INDEX IF NOT EXISTS is idempotent)
        for index_sql in [
            "CREATE INDEX IF NOT EXISTS idx_email_sends_event_id ON email_sends(event_id)",
            "CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status)",
            "CREATE INDEX IF NOT EXISTS idx_email_send_items_email_send_id ON email_send_items(email_send_id)",
        ]:
            conn.execute(text(index_sql))
        # Indexes are committed automatically when the context exits

    logger.info("SQLite migrations complete.")


if __name__ == "__main__":
    # Allow running migrations manually: python -m backend.migrations
    logging.basicConfig(level=logging.INFO)
    run_migrations()
    print("Migrations applied successfully.")