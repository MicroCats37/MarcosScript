"""Find processed frames with Drive links."""
import sqlite3

conn = sqlite3.connect('db/marcosscript.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cursor.fetchall()]
print(f"Tables: {tables}")

# Check events table
cursor.execute("SELECT id, name FROM events LIMIT 3")
print(f"\nEvents:")
for r in cursor.fetchall():
    print(f"  ID {r[0]}: {r[1]}")

# Check photo_states table
cursor.execute("SELECT id, event_id, filename FROM photo_states LIMIT 3")
print(f"\nPhoto states:")
for r in cursor.fetchall():
    print(f"  ID {r[0]}, Event {r[1]}: {r[2]}")

# Check processed_frames
cursor.execute("SELECT id, photo_state_id, frame_filename, drive_web_view_link FROM processed_frames LIMIT 3")
print(f"\nProcessed frames:")
for r in cursor.fetchall():
    print(f"  ID {r[0]}, PhotoState {r[1]}: {r[2]}, Link: {r[3]}")

conn.close()
