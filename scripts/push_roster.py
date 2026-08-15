#!/usr/bin/env python3
"""Push out/roster_clean.csv to the backend's Roster tab via the
import_roster action (Code.gs). Requires API_URL and ADMIN_KEY in .env.

The backend replaces every data row in the Roster tab but preserves
pass_sent_email / pass_sent_sms stamps for tokens that already had them.

Usage: python3 scripts/push_roster.py [out/roster_clean.csv]
"""
import csv
import json
import re
import sys
import urllib.request
from pathlib import Path


def env():
    vals = {}
    for line in Path('.env').read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            vals[k] = v
    return vals


def main(csv_path):
    cfg = env()
    url, key = cfg['API_URL'], cfg.get('ADMIN_KEY')
    if not key:
        sys.exit('ADMIN_KEY missing from .env')

    with open(csv_path) as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit(f'no rows in {csv_path}')

    # Leading apostrophe forces text — otherwise Sheets coerces "07:00" into
    # a time value and the API serializes it as "1899-12-30T07:00:00.000Z".
    for r in rows:
        for col in ('shift_start', 'shift_end'):
            # "07:00", "7AM", "1 PM", "1:00 PM" — Sheets coerces them all
            if re.fullmatch(r'\d{1,2}(:\d{2})?\s*(AM|PM)?', r.get(col, ''),
                            re.IGNORECASE):
                r[col] = "'" + r[col]

    body = json.dumps({'action': 'import_roster', 'key': key, 'rows': rows})
    # text/plain: a CORS "simple request" — Apps Script can't answer preflights.
    req = urllib.request.Request(
        url, data=body.encode(), headers={'Content-Type': 'text/plain'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read())
    print(json.dumps(result))
    if result.get('imported') != len(rows):
        sys.exit(f'FAILED: sent {len(rows)} rows, response: {result}')
    print(f'OK: Roster tab now has {result["imported"]} volunteers '
          f'(was {result["previous"]})')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'out/roster_clean.csv')
