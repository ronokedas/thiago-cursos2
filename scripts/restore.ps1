param(
  [Parameter(Mandatory=$true)][string]$DatabaseDump,
  [string]$VideosArchive
)

$ErrorActionPreference = 'Stop'
Get-Content -Raw $DatabaseDump | docker compose exec -T postgres psql -U mecanica -d mecanica
if ($VideosArchive) {
  docker run --rm -v aulas-online_aulas_online_videos:/target -v "${PWD}:/backup" alpine sh -c "tar xzf /backup/$([IO.Path]::GetFileName($VideosArchive)) -C /target"
}
Write-Host "Restauração concluída. Reinicie o app se necessário."
