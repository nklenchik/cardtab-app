#!/usr/bin/env python3
"""Nightly card photo cleanup (v50.69), run by the backup workflow after the copies are made.

A person's own card photo lives at up/<user>/<photo>/{list,detail} in the card-tab-art bucket, and their entries point at it.
When someone replaces a photo or deletes the entry it belonged to, the old photo is no longer used. This finds those photos and
removes them once they have gone unused for 30 days in a row (so Undo, an entry deleted by mistake, or a device that hasn't
synced yet are all safe). Shared card pictures (art/c/...) are never touched, and photos waiting in the admin review queue stay.

Usage: photo-cleanup.py <restored sqlite db> <state file in/out> <today YYYY-MM-DD>
Reads the bucket listing from stdin (rclone lsf -R --files-only r2:card-tab-art/up), prints the photo folders to remove
(one "user/photo" per line) on stdout, and rewrites the state file (photo -> first night it was seen unused)."""
import json, re, sqlite3, sys
from datetime import date, timedelta

GRACE = 30
db, state_path, today_s = sys.argv[1], sys.argv[2], sys.argv[3]
today = date.fromisoformat(today_s)
REF = re.compile(r'/up/([\w-]+)/([\w-]+)/')

con = sqlite3.connect(db)
used = set()
# entries in use, plus entries deleted in the last 30 days (they can still come back)
cutoff = (today - timedelta(days=GRACE)).isoformat()
for uid, data, deleted, updated in con.execute('SELECT user_id, data, deleted, updated_at FROM entries'):
    if deleted and (updated or '') < cutoff:
        continue
    for u, p in REF.findall(data or ''):
        used.add(u + '/' + p)
# photos waiting for review stay until they're approved or rejected
try:
    for uid, pid in con.execute("SELECT user_id, id FROM art_uploads WHERE status='pending'"):
        used.add(uid + '/' + pid)
except sqlite3.Error:
    pass

stored = set()
rows = con.execute('SELECT COUNT(*) FROM entries').fetchone()[0]
for line in sys.stdin:
    parts = line.strip().split('/')
    if len(parts) >= 3:
        stored.add(parts[0] + '/' + parts[1])

if stored and not rows:
    sys.exit('the restored database has no entries, so nothing is removed tonight')
try:
    state = json.load(open(state_path))
except Exception:
    state = {}
nxt, remove = {}, []
for key in sorted(stored - used):
    first = state.get(key, today_s)
    if (today - date.fromisoformat(first)).days >= GRACE:
        remove.append(key)
    else:
        nxt[key] = first
json.dump(nxt, open(state_path, 'w'), separators=(',', ':'))
print('\n'.join(remove))
print(f'photos: {len(stored)} stored, {len(stored & used)} in use, {len(nxt)} waiting out the 30 days, {len(remove)} to remove', file=sys.stderr)
