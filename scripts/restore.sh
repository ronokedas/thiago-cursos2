#!/usr/bin/env bash
set -euo pipefail

DB_DUMP="${1:?Informe o arquivo SQL}"
VIDEO_ARCHIVE="${2:-}"
docker compose -f deploy/docker-compose.vps.yml exec -T postgres psql -U "${POSTGRES_USER:-mecanica}" -d "${POSTGRES_DB:-mecanica}" < "$DB_DUMP"
if [[ -n "$VIDEO_ARCHIVE" ]]; then
  docker run --rm -v aulas-online_videos:/target -v "$(realpath "$(dirname "$VIDEO_ARCHIVE")"):/backup" alpine tar xzf "/backup/$(basename "$VIDEO_ARCHIVE")" -C /target
fi
echo "Restauração concluída"
