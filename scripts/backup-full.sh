#!/usr/bin/env bash
set -Eeuo pipefail

# Creates one portable, unencrypted migration package.
# Run from the repository root, normally as: sudo bash ./scripts/backup-full.sh /opt/backups

BACKUP_DIR="${1:-/opt/backups}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(sudo docker compose --env-file "$PROJECT_DIR/.env" -f "$PROJECT_DIR/deploy/docker-compose.vps.yml")
STAMP="$(date -u +%Y%m%d-%H%M%S)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mentoria-backup.XXXXXX")"
PACKAGE="$BACKUP_DIR/mentoria-backup-$STAMP.tar.gz"

cleanup() {
  rm -rf "$WORK_DIR"
}
restart_app() {
  "${COMPOSE[@]}" up -d app >/dev/null 2>&1 || true
}
on_exit() {
  restart_app
  cleanup
}
trap on_exit EXIT

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "Erro: arquivo $PROJECT_DIR/.env não encontrado." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "Parando temporariamente o app para copiar os arquivos com consistência..."
"${COMPOSE[@]}" stop app

echo "Gerando dump completo do PostgreSQL..."
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$WORK_DIR/database.dump"

echo "Copiando banco de compatibilidade, PDFs, materiais e vídeos..."
"${COMPOSE[@]}" run --rm --no-deps --entrypoint tar app czf - -C /app/data . > "$WORK_DIR/data.tar.gz"

cp -p "$PROJECT_DIR/.env" "$WORK_DIR/env.production"
chmod 600 "$WORK_DIR/env.production"

GIT_COMMIT="$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo unavailable)"
GIT_BRANCH="$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo unavailable)"
DB_SUMMARY="$(${COMPOSE[@]} exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"SELECT COALESCE(jsonb_array_length(payload->'users'),0)||' users, '||COALESCE(jsonb_array_length(payload->'courses'),0)||' courses, '||COALESCE(jsonb_array_length(payload->'lessons'),0)||' lessons, '||COALESCE(jsonb_array_length(payload->'lessonProgress'),0)||' progress records' FROM app_state WHERE id='main';\"" 2>/dev/null || echo unavailable)"

cat > "$WORK_DIR/MANIFEST.txt" <<EOF
Mentoria A Mecânica - backup completo
created_at_utc=$STAMP
repository_commit=$GIT_COMMIT
repository_branch=$GIT_BRANCH
database_dump=database.dump
data_archive=data.tar.gz
environment_file=env.production
database_summary=$DB_SUMMARY
warning=Este pacote contém segredos sem criptografia. Armazene-o em local privado.
EOF

tar -czf "$PACKAGE" -C "$WORK_DIR" MANIFEST.txt database.dump data.tar.gz env.production
chmod 600 "$PACKAGE"
sha256sum "$PACKAGE" > "$PACKAGE.sha256"
chmod 600 "$PACKAGE.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'mentoria-backup-*.tar.gz' -o -name 'mentoria-backup-*.tar.gz.sha256' \) -mtime +14 -delete

trap - EXIT
restart_app
cleanup

echo "Backup completo criado: $PACKAGE"
echo "Checksum criado: $PACKAGE.sha256"
echo "O app foi iniciado novamente. O pacote contém banco, usuários, conteúdo, arquivos, vídeos e .env."
