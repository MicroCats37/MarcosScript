import sqlite3
import os

db_path = 'marcosscript.db'
if not os.path.exists(db_path):
    print(f"Database {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Events ---")
cursor.execute("SELECT id, name, is_active FROM events")
for row in cursor.fetchall():
    print(row)

print("\n--- Photos ---")
cursor.execute("SELECT id, event_id, filename, status FROM photo_states")
for row in cursor.fetchall():
    print(row)

conn.close()
