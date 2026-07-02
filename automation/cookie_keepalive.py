from datetime import datetime, timezone

def keep_alive():
    print(f"[{datetime.now(timezone.utc).isoformat()}Z] Keepalive DESATIVADO: visitar ML com cookies sem proposito entrega fingerprint e causa bloqueio global (monitor-telegram best practice)")

if __name__ == "__main__":
    keep_alive()
