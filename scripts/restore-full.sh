#!/usr/bin/env bash
set -Eeuo pipefail

# Restores a package created by backup-full.sh into the current installation.
# Run from the repository root, normally as: sudo bash ./scripts/restore-full.sh /path/mentoria-backup-DATA.tar.gz

PACKAGE="${1:?Informe o caminho do pacote mentoria-backup-*.tar.gz}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(sudo docker compose --env-file "$PROJECT_DIR/.env" -f "$PROJECT_DIR/deploy/docker-compose.vps.yml")
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mentoria-restore.XXXXXX")"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
APP_STARTED=0

cleanup() {
  rm -rf "$WORK_DIR"
}
restart_app() {
  if [[ "$APP_STARTED" == "1" ]]; then
    "${COMPOSE[@]}" up -d app >/dev/null 2>&1 || true
  fi
}
on_exit() {
  restart_app
  cleanup
}
trap on_exit EXIT

if [[ ! -f "$PACKAGE" ]]; then
  echo "Erro: pacote não encontrado: $PACKAGE" >&2
  exit 1
fi

CHECKSUM_FILE="$PACKAGE.sha256"
if [[ -f "$CHECKSUM_FILE" ]]; then
  (cd "$(dirname "$PACKAGE")" && sha256sum -c "$(basename "$CHECKSUM_FILE")")
else
  echo "Aviso: checksum não encontrado ao lado do pacote; a estrutura será validada." >&2
fi

tar -tzf "$PACKAGE" >/dev/null
tar -xzf "$PACKAGE" -C "$WORK_DIR"
for required in MANIFEST.txt database.dump data.tar.gz env.production; do
  [[ -f "$WORK_DIR/$required" ]] || { echo "Erro: pacote incompleto; falta $required." >&2; exit 1; }
done

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "Erro: clone o projeto e crie uma instalação inicial antes da restauração." >&2
  exit 1
fi

cp -p "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.before-restore-$STAMP"
chmod 600 "$PROJECT_DIR/.env.before-restore-$STAMP"
cp -p "$WORK_DIR/env.production" "$PROJECT_DIR/.env"
chmod 600 "$PROJECT_DIR/.env"

# Recreate the compose command after restoring the production environment.
COMPOSE=(sudo docker compose --env-file "$PROJECT_DIR/.env" -f "$PROJECT_DIR/deploy/docker-compose.vps.yml")

echo "Parando o app e iniciando somente o PostgreSQL..."
"${COMPOSE[@]}" stop app
"${COMPOSE[@]}" up -d postgres

POSTGRES_ID="$("${COMPOSE[@]}" ps -q postgres)"
for attempt in $(seq 1 60); do
  status="$(sudo docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' "$POSTGRES_ID" 2>/dev/null || true)"
  [[ "$status" == "healthy" ]] && break
  [[ "$attempt" == "60" ]] && { echo "Erro: PostgreSQL não ficou saudável." >&2; exit 1; }
  sleep 2
done

echo "Restaurando o banco..."
cat "$WORK_DIR/database.dump" | "${COMPOSE[@]}" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner'

echo "Restaurando arquivos, materiais e vídeos nos volumes do Compose..."
"${COMPOSE[@]}" run --rm --no-deps --entrypoint tar app xzf - -C /app/data < "$WORK_DIR/data.tar.gz"

echo "Reconstruindo e iniciando o app..."
"${COMPOSE[@]}" up --build -d
APP_STARTED=1

for attempt in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then break; fi
  [[ "$attempt" == "60" ]] && { echo "Erro: o app não respondeu ao healthcheck." >&2; exit 1; }
  sleep 2
done

echo "Restauração concluída com sucesso."
echo "Manifesto restaurado:"
grep -E '^(created_at_utc|repository_commit|database_summary)=' "$WORK_DIR/MANIFEST.txt" || true
echo "O .env anterior foi preservado em: $PROJECT_DIR/.env.before-restore-$STAMP"
