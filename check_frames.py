"""Check processed frames in database."""
import sqlite3

conn = sqlite3.connect('backend/db/marcosscript.db')
cursor = conn.cursor()

cursor.execute('SELECT id, photo_state_id, frame_filename, output_filename, drive_web_view_link, drive_upload_error FROM processed_frames ORDER BY id DESC LIMIT 5')
print("Recent processed frames:")
for r in cursor.fetchall():
    print(f"  ID {r[0]}: photo_state={r[1]}, frame={r[2]}, output={r[3]}")
    print(f"    drive_link: {r[4]}")
    print(f"    error: {r[5]}")

conn.close()
