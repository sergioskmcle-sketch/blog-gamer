#!/usr/bin/env python3
import schedule
import time
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).parent.resolve()
HEARTBEAT_FILE = BASE / 'heartbeat.txt'


def write_heartbeat():
    try:
        HEARTBEAT_FILE.write_text(str(time.time()))
    except Exception:
        pass


def run_generate():
    ts = datetime.now(timezone.utc).isoformat() + 'Z'
    print(f'[{ts}] Executando generate_article.py...')
    result = subprocess.run(
        [sys.executable, 'generate_article.py'],
        capture_output=True, text=True
    )
    for line in result.stdout.strip().split('\n'):
        if line:
            print(f'  {line}')
    if result.returncode != 0:
        print(f'  ERRO: {result.stderr[:500]}')
    else:
        print(f'  OK')
    write_heartbeat()


def main():
    print(f'Scheduler iniciado em {datetime.now(timezone.utc).isoformat()}Z')
    print(f'Python: {sys.executable}')

    schedule.every().day.at('10:00').do(run_generate)
    write_heartbeat()

    run_generate()

    while True:
        schedule.run_pending()
        write_heartbeat()
        time.sleep(60)


if __name__ == '__main__':
    main()
