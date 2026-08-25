#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml exec -T postgres pg_dump -U "${POSTGRES_USER:-mecanica}" -d "${POSTGRES_DB:-mecanica}" --clean --if-exists > "$BACKUP_DIR/mecanica-$STAMP.sql"
sudo docker run --rm -v aulas-online_videos:/source -v "$(realpath "$BACKUP_DIR"):/backup" alpine tar czf "/backup/videos-$STAMP.tar.gz" -C /source .

find "$BACKUP_DIR" -type f -mtime +14 -delete
echo "Backup criado em $BACKUP_DIR"
