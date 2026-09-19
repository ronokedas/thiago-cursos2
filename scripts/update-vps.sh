#!/usr/bin/env bash
# ==============================================================================
# Script Inteligente de Atualização — Mentoria A Mecânica (Trader Thiago)
# Uso: sudo bash ./scripts/update-vps.sh
# Ou via 1-liner direto do GitHub:
# sudo curl -fsSL https://raw.githubusercontent.com/ronokedas/thiago-cursos2/main/scripts/update-vps.sh | sudo bash
# ==============================================================================

set -Eeuo pipefail

# 1. Garantir privilégios de superusuário (root)
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo -e "\033[1;31m[ERRO] Este script deve ser executado como superusuário (root ou sudo).\033[0m" >&2
  echo -e "Execute: \033[1;33msudo bash $0\033[0m" >&2
  exit 1
fi

echo -e "\033[1;36m"
echo "======================================================================"
echo " 🚀 INICIANDO ATUALIZAÇÃO INTELIGENTE DA VPS — AULAS ONLINE"
echo "======================================================================"
echo -e "\033[0m"

# 2. Localizar diretório raiz do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
PROJECT_DIR=""

if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/../package.json" && -f "$SCRIPT_DIR/../deploy/docker-compose.vps.yml" ]]; then
  PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [[ -d "/opt/aulas-online" && -f "/opt/aulas-online/package.json" ]]; then
  PROJECT_DIR="/opt/aulas-online"
elif [[ -f "./package.json" && -f "./deploy/docker-compose.vps.yml" ]]; then
  PROJECT_DIR="$(pwd)"
fi

if [[ -z "$PROJECT_DIR" || ! -d "$PROJECT_DIR" ]]; then
  echo -e "\033[1;31m[ERRO] Não foi possível localizar o diretório do projeto (/opt/aulas-online).\033[0m" >&2
  echo "Certifique-se de que o repositório está clonado em /opt/aulas-online." >&2
  exit 1
fi

echo -e "\033[1;34m[INFO]\033[0m Diretório do projeto: \033[1;37m$PROJECT_DIR\033[0m"
cd "$PROJECT_DIR"

# 3. Validar arquivo .env
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo -e "\033[1;31m[ERRO] Arquivo .env não encontrado em $PROJECT_DIR/.env\033[0m" >&2
  echo "Crie o arquivo .env a partir do .env.example antes de atualizar." >&2
  exit 1
fi

chmod 600 "$PROJECT_DIR/.env"

# 4. Configurar permissão de segurança do Git para evitar erro "dubious ownership"
git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true

# 5. Backup preventivo automático antes de atualizar (se o script de backup existir)
if [[ -f "$PROJECT_DIR/scripts/backup-full.sh" ]]; then
  echo -e "\n\033[1;33m[1/5] Gerando backup preventivo de segurança antes da atualização...\033[0m"
  mkdir -p /opt/backups
  bash "$PROJECT_DIR/scripts/backup-full.sh" /opt/backups || {
    echo -e "\033[1;33m[AVISO] Backup prévio retornou código não-zero, mas prosseguindo com cuidado...\033[0m"
  }
else
  echo -e "\n\033[1;33m[1/5] Pulando backup preventivo (script backup-full.sh não encontrado).\033[0m"
fi

# 6. Atualizar repositório a partir do GitHub
echo -e "\n\033[1;33m[2/5] Buscando e sincronizando últimas atualizações do GitHub...\033[0m"

# Salva qualquer alteração local não commitada para não travar o pull
if ! git diff --quiet || ! git diff --cached --quiet; then
  STASH_TAG="auto-stash-$(date +%s)"
  echo -e "\033[1;33m[AVISO] Alterações locais detectadas. Salvando em stash seguro ($STASH_TAG)...\033[0m"
  git stash push -u -m "$STASH_TAG" || true
fi

# Fetch e Switch para main
git fetch origin main --tags
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo "")"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  git switch main || git checkout main
fi

git pull --ff-only origin main

LATEST_COMMIT="$(git log -1 --pretty=format:'%h - %s (%cr)')"
echo -e "\033[1;32m✓ Código atualizado para o commit:\033[0m $LATEST_COMMIT"

# 7. Identificar Docker Compose
COMPOSE_CMD=()
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo -e "\033[1;31m[ERRO] Docker Compose não está instalado ou não foi encontrado no PATH.\033[0m" >&2
  exit 1
fi

COMPOSE_FILE="$PROJECT_DIR/deploy/docker-compose.vps.yml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
  COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
fi

echo -e "\n\033[1;33m[3/5] Reconstruindo imagens e reiniciando containers em produção...\033[0m"
"${COMPOSE_CMD[@]}" --env-file "$PROJECT_DIR/.env" -f "$COMPOSE_FILE" up --build -d

# 8. Teste de Saúde (Healthcheck) da Aplicação
echo -e "\n\033[1;33m[4/5] Aguardando aplicação inicializar e validando healthcheck...\033[0m"
HEALTH_URL="http://127.0.0.1:3000/api/health"
HEALTH_OK=false

for i in {1..30}; do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTH_OK=true
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

if [[ "$HEALTH_OK" = true ]]; then
  echo -e "\033[1;32m✓ Healthcheck OK! Servidor respondendo normalmente em http://127.0.0.1:3000/api/health\033[0m"
else
  echo -e "\033[1;31m[ALERTA] O servidor demorou para responder. Verificando logs dos containers:\033[0m"
  "${COMPOSE_CMD[@]}" --env-file "$PROJECT_DIR/.env" -f "$COMPOSE_FILE" logs --tail=50 app || true
fi

# 9. Limpar imagens antigas e liberando espaço em disco
echo -e "\n\033[1;33m[5/5] Limpando imagens Docker órfãs antigas para poupar espaço em disco...\033[0m"
docker image prune -f || true

# 10. Status final
echo -e "\n\033[1;36m======================================================================\033[0m"
echo -e "\033[1;32m 🎉 ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!\033[0m"
echo -e "\033[1;36m======================================================================\033[0m"

"${COMPOSE_CMD[@]}" --env-file "$PROJECT_DIR/.env" -f "$COMPOSE_FILE" ps

APP_URL="$(grep -E '^APP_URL=' "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "http://localhost:3000")"
echo -e "\nSua plataforma está ativa e atualizada em: \033[1;32m$APP_URL\033[0m\n"
