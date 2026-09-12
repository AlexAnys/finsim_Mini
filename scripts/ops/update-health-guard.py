#!/usr/bin/env python3
"""Upgrade the existing host guard without replacing its recovery policy or state."""
from pathlib import Path
import os
import shutil


def upgrade(path):
    path = Path(path)
    if not path.exists():
        return 'No existing host guard; container readiness remains enabled.'
    source = path.read_text()
    legacy = 'URL="https://finsim.anlanai.cn/login"'
    ready = 'URL="https://finsim.anlanai.cn/api/health/ready"'
    if legacy not in source and ready not in source:
        raise ValueError('Unrecognized health guard URL; preserve custom guard for review')
    updated = source.replace(legacy, ready).replace('公网 /login', '公网 /api/health/ready')
    updated = updated.replace(
        'docker compose -f "$COMPOSE_FILE" up -d',
        'docker compose --project-directory /opt/finsim --env-file /opt/finsim/.env '
        '-f "$COMPOSE_FILE" -p finsim up -d --no-recreate')
    updated = updated.replace('docker compose -f "$CADDY_COMPOSE" up -d',
                              'docker compose -f "$CADDY_COMPOSE" up -d --no-recreate')
    if updated == source:
        return 'Existing host guard already checks readiness.'
    backup = path.with_name(path.name + '.before-readiness')
    if not backup.exists():
        shutil.copy2(str(path), str(backup))
        backup.chmod(0o600)
    pending = path.with_name(path.name + '.readiness-next')
    try:
        pending.write_text(updated)
        pending.chmod(path.stat().st_mode & 0o777)
        os.replace(str(pending), str(path))
    finally:
        if pending.exists():
            pending.unlink()
    return 'Existing host guard upgraded to database readiness; recovery policy retained.'


if __name__ == '__main__':
    print(upgrade('/opt/finsim-health-guard/health-guard.sh'))
