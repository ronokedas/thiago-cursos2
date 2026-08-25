$ErrorActionPreference = 'Stop'

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "FAIL: $Message" }
  Write-Host "PASS: $Message" -ForegroundColor Green
}

$health = Invoke-RestMethod http://localhost:3000/api/health
Assert-True ($health.status -eq 'ok') 'healthcheck da aplicação'

$adminBody = @{ email = 'admin@mecanica.com'; password = 'Admin@Mecanica2026!' } | ConvertTo-Json
$admin = Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body $adminBody
$adminHeaders = @{ Authorization = "Bearer $($admin.token)" }
$metrics = Invoke-RestMethod http://localhost:3000/api/admin/metrics -Headers $adminHeaders
Assert-True ($metrics.totalStudents -ge 1) 'seed do administrador e aluno'
Assert-True ($metrics.totalLessons -ge 1) 'seed de conteúdo'

$studentBody = @{ email = 'aluno@mecanica.com'; password = 'Aluno@Mecanica2026!' } | ConvertTo-Json
$student = Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body $studentBody
$studentHeaders = @{ Authorization = "Bearer $($student.token)" }
$course = Invoke-RestMethod http://localhost:3000/api/student/course -Headers $studentHeaders
$lesson = $course.modules[0].topics[0].lessons[0]
$ticket = Invoke-RestMethod "http://localhost:3000/api/stream/ticket/$($lesson.id)" -Headers $studentHeaders
Assert-True ($ticket.token.Length -gt 20) 'ticket de streaming autenticado'

Write-Host 'Smoke test concluído.' -ForegroundColor Cyan
