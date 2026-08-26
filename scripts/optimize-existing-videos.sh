#!/usr/bin/env bash
set -Eeuo pipefail

# Rewrites existing compatible MP4 files with fast-start metadata, without
# recoding. Run after deploying the image that contains FFmpeg.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(sudo docker compose --env-file "$PROJECT_DIR/.env" -f "$PROJECT_DIR/deploy/docker-compose.vps.yml")
MODE="${1:-}"

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "Erro: arquivo .env não encontrado em $PROJECT_DIR." >&2
  exit 1
fi

on_exit() { "${COMPOSE[@]}" up -d app >/dev/null 2>&1 || true; }
trap on_exit EXIT

echo "Parando temporariamente o app enquanto os vídeos são otimizados..."
"${COMPOSE[@]}" stop app

"${COMPOSE[@]}" run --rm --no-deps -e OPTIMIZE_DRY_RUN="$MODE" --entrypoint sh app -ceu '
  video_dir=/app/data/videos
  largest=0
  for file in "$video_dir"/*.mp4; do
    [ -f "$file" ] || continue
    size=$(wc -c < "$file")
    [ "$size" -gt "$largest" ] && largest=$size
  done
  available=$(df -Pk "$video_dir" | awk "NR==2 {print \$4 * 1024}")
  if [ "$largest" -gt 0 ] && [ "$available" -lt "$largest" ]; then
    echo "Erro: espaço livre insuficiente. É necessário ao menos o tamanho do maior vídeo para a cópia temporária." >&2
    exit 1
  fi
  for file in "$video_dir"/*.mp4; do
    [ -f "$file" ] || continue
    if ! ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$file" | grep -qx h264; then
      echo "Ignorado (não é H.264): $(basename "$file")" >&2
      continue
    fi
    if [ "$OPTIMIZE_DRY_RUN" = "--dry-run" ]; then
      echo "Validado: $(basename "$file")"
      continue
    fi
    temp="$file.faststart.tmp.mp4"
    backup="$file.before-faststart.bak"
    rm -f "$temp" "$backup"
    echo "Otimizando: $(basename "$file")"
    ffmpeg -y -v error -i "$file" -map 0 -c copy -movflags +faststart "$temp"
    ffprobe -v error "$temp" >/dev/null
    mv "$file" "$backup"
    if mv "$temp" "$file"; then
      rm -f "$backup"
    else
      mv "$backup" "$file"
      exit 1
    fi
  done
'

echo "Otimização concluída. O app será iniciado novamente."
