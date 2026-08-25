param(
  [string]$OutputDirectory = "./backups"
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dbFile = Join-Path $OutputDirectory "mecanica-$stamp.sql"

docker compose exec -T postgres pg_dump -U mecanica -d mecanica --clean --if-exists | Out-File -Encoding utf8 $dbFile
docker run --rm -v aulas-online_aulas_online_videos:/source -v "${OutputDirectory}:/backup" alpine tar czf "/backup/videos-$stamp.tar.gz" -C /source .
Write-Host "Backup criado em $OutputDirectory"
