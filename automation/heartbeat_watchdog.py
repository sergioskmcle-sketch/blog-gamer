#!/usr/bin/env python3
import os
import time
import subprocess
import sys
import logging
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).parent.resolve()
HEARTBEAT_FILE = BASE / 'heartbeat.txt'
LOG_FILE = BASE / 'logs' / 'watchdog.log'
SERVICE_NAME = 'blog-gamer.service'
TIMEOUT_SEC = 300
CRITICAL_TIMEOUT_SEC = 600
SERVICE_GRACE_SEC = 120

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(str(LOG_FILE)),
        logging.StreamHandler(sys.stdout),
    ],
)


def log(msg, level='info'):
    getattr(logging, level, logging.info)(msg)


def read_heartbeat():
    if not HEARTBEAT_FILE.exists():
        return None
    try:
        return float(HEARTBEAT_FILE.read_text().strip())
    except (ValueError, OSError):
        return None


def get_service_start_time():
    try:
        r = subprocess.run(
            ['systemctl', 'show', SERVICE_NAME, '--property=ActiveEnterTimestamp', '--value'],
            capture_output=True, text=True, timeout=10
        )
        if r.returncode == 0 and r.stdout.strip():
            return datetime.strptime(r.stdout.strip(), '%a %Y-%m-%d %H:%M:%S %Z')
    except Exception:
        pass
    return None


def service_started_recently(grace=SERVICE_GRACE_SEC):
    start = get_service_start_time()
    if start is None:
        return False
    elapsed = (datetime.now() - start).total_seconds()
    return elapsed < grace


def restart_service():
    log(f'Reiniciando {SERVICE_NAME}...', 'warning')
    result = subprocess.run(
        ['sudo', 'systemctl', 'restart', SERVICE_NAME],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode == 0:
        log(f'{SERVICE_NAME} reiniciado com sucesso')
    else:
        log(f'Falha ao reiniciar {SERVICE_NAME}: {result.stderr[:300]}', 'error')


def check_vm_alive():
    log('VM pode estar offline - tentando ping...', 'critical')
    result = subprocess.run(
        ['ping', '-c', '2', '-W', '5', '35.237.81.192'],
        capture_output=True, text=True, timeout=12
    )
    if result.returncode == 0:
        log('VM respondeu ping - apenas o processo travou')
    else:
        log('VM NAO respondeu ping!', 'critical')


def main():
    os.makedirs(BASE / 'logs', exist_ok=True)
    hb = read_heartbeat()
    now = time.time()

    if hb is None:
        if service_started_recently():
            log('heartbeat.txt ausente mas service acabou de iniciar - aguardando')
            return
        log(f'heartbeat.txt nao encontrado - reiniciando {SERVICE_NAME}')
        restart_service()
        return

    elapsed = now - hb

    if elapsed > CRITICAL_TIMEOUT_SEC:
        log(f'Heartbeat parado ha {elapsed:.0f}s (> {CRITICAL_TIMEOUT_SEC}s)')
        check_vm_alive()
        restart_service()
    elif elapsed > TIMEOUT_SEC:
        log(f'Heartbeat parado ha {elapsed:.0f}s (> {TIMEOUT_SEC}s) - reiniciando')
        restart_service()
    else:
        log(f'Heartbeat OK - {elapsed:.0f}s atras')


if __name__ == '__main__':
    main()
