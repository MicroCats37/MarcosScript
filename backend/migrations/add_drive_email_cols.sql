-- Migration: Add Drive upload and EmailSend columns to existing SQLite DB
-- This is only needed for existing databases; fresh DBs get these via create_all
--
-- Run with: sqlite3 db/marcosscript.db < backend/migrations/add_drive_email_cols.sql

-- ProcessedFrame: add Drive metadata columns
ALTER TABLE processed_frames ADD COLUMN drive_file_id TEXT;
ALTER TABLE processed_frames ADD COLUMN drive_web_view_link TEXT;
ALTER TABLE processed_frames ADD COLUMN drive_uploaded_at TIMESTAMP;
ALTER TABLE processed_frames ADD COLUMN drive_upload_error TEXT;

-- EmailSend: new table
CREATE TABLE IF NOT EXISTS email_sends (
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
);

-- EmailSendItem: new table
CREATE TABLE IF NOT EXISTS email_send_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_send_id INTEGER NOT NULL,
    processed_frame_id INTEGER NOT NULL,
    drive_link TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMP,
    FOREIGN KEY (email_send_id) REFERENCES email_sends(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_frame_id) REFERENCES processed_frames(id) ON DELETE CASCADE
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_email_sends_event_id ON email_sends(event_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_send_items_email_send_id ON email_send_items(email_send_id);