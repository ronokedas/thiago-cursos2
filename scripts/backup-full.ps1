param(
  [string]$OutputDirectory = '.\backups'
)

$ErrorActionPreference = 'Stop'

function Invoke-Docker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Falha ao executar: docker $($Arguments -join ' ')" }
}

$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupDir = [System.IO.Path]::GetFullPath((Join-Path $projectDir $OutputDirectory))
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$workDir = Join-Path $backupDir "mentoria-backup-$stamp"
$packageName = "mentoria-backup-$stamp.tar.gz"
$packagePath = Join-Path $backupDir $packageName

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

Push-Location $projectDir
try {
  $appId = (& docker compose ps -q app).Trim()
  if (-not $appId) { throw 'O container da aplicação não está em execução. Execute docker compose up -d antes do backup.' }
  $mounts = ((& docker inspect $appId | ConvertFrom-Json)[0]).Mounts
  $dataVolume = ($mounts | Where-Object Destination -eq '/app/data').Name
  $videosVolume = ($mounts | Where-Object Destination -eq '/app/data/videos').Name
  if (-not $dataVolume -or -not $videosVolume) { throw 'Não foi possível localizar os volumes de dados da aplicação.' }

  Write-Host 'Parando apenas a aplicação para garantir consistência dos arquivos...'
  Invoke-Docker @('compose', 'stop', 'app')
  try {
    Write-Host 'Gerando backup do PostgreSQL...'
    $databaseSql = & docker compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists'
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o backup do PostgreSQL.' }
    [System.IO.File]::WriteAllText((Join-Path $workDir 'database.sql'), [string]$databaseSql, [System.Text.UTF8Encoding]::new($false))

    Write-Host 'Copiando dados, vídeos, materiais e imagens privadas...'
    Invoke-Docker @('run', '--rm', '-v', "${dataVolume}:/source:ro", '-v', "${workDir}:/backup", 'alpine', 'tar', 'czf', '/backup/data.tar.gz', '-C', '/source', '.')
    Invoke-Docker @('run', '--rm', '-v', "${videosVolume}:/source:ro", '-v', "${workDir}:/backup", 'alpine', 'tar', 'czf', '/backup/videos.tar.gz', '-C', '/source', '.')
    Copy-Item '.env' (Join-Path $workDir 'env.production')
    @(
      'Mentoria A Mecânica - backup completo local'
      "created_at_local=$stamp"
      "git_commit=$(& git rev-parse HEAD 2>$null)"
      'database_file=database.sql'
      'data_archive=data.tar.gz'
      'videos_archive=videos.tar.gz'
      'warning=Contém banco e segredos. Não envie este arquivo ao GitHub.'
    ) | Set-Content -Encoding utf8 (Join-Path $workDir 'MANIFEST.txt')

    Invoke-Docker @('run', '--rm', '-v', "${backupDir}:/backup", 'alpine', 'tar', 'czf', "/backup/$packageName", '-C', "/backup/mentoria-backup-$stamp", 'MANIFEST.txt', 'database.sql', 'data.tar.gz', 'videos.tar.gz', 'env.production')
    Get-FileHash -Algorithm SHA256 $packagePath | ForEach-Object { "$($_.Hash.ToLower())  $packageName" } | Set-Content -Encoding ascii "$packagePath.sha256"
  } finally {
    Invoke-Docker @('compose', 'up', '-d', 'app')
  }
} finally {
  Pop-Location
  if (Test-Path $workDir) { Remove-Item -Recurse -Force $workDir }
}

Write-Host "Backup completo criado: $packagePath"
Write-Host "Checksum criado: $packagePath.sha256"
