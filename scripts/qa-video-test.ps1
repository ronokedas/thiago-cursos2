$ErrorActionPreference = 'Stop'
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('mecanica-video-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$video = Join-Path $tmp 'qa.mp4'

try {
  Add-Type -AssemblyName System.Net.Http
  ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=blue:s=320x180:d=1 -c:v libx264 -pix_fmt yuv420p -movflags +faststart $video
  $adminBody = @{ email = 'admin@mecanica.com'; password = 'Admin@Mecanica2026!' } | ConvertTo-Json
  $admin = Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body $adminBody
  $headers = @{ Authorization = "Bearer $($admin.token)" }
  $course = Invoke-RestMethod http://localhost:3000/api/admin/courses -Headers $headers
  $module = Invoke-RestMethod http://localhost:3000/api/admin/modules -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ courseId = $course.course.id; title = 'QA Vídeo'; releaseType = 'IMMEDIATE'; releaseDays = 0 } | ConvertTo-Json)
  $topic = Invoke-RestMethod http://localhost:3000/api/admin/topics -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ moduleId = $module.module.id; title = 'QA Tópico' } | ConvertTo-Json)
  $lesson = Invoke-RestMethod http://localhost:3000/api/admin/lessons -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ topicId = $topic.topic.id; moduleId = $module.module.id; title = 'QA Aula'; durationSeconds = 1; isFreePreview = $true } | ConvertTo-Json)
  $client = [System.Net.Http.HttpClient]::new()
  $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $admin.token)
  $multipart = [System.Net.Http.MultipartFormDataContent]::new()
  $fileStream = [IO.File]::OpenRead($video)
  $fileContent = [System.Net.Http.StreamContent]::new($fileStream)
  $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('video/mp4')
  $multipart.Add($fileContent, 'video', 'qa.mp4')
  $uploadResponse = $client.PostAsync("http://localhost:3000/api/admin/lessons/$($lesson.lesson.id)/upload-video", $multipart).GetAwaiter().GetResult()
  if (-not $uploadResponse.IsSuccessStatusCode) { throw "Upload retornou HTTP $($uploadResponse.StatusCode)." }
  $upload = $uploadResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
  $fileStream.Dispose(); $multipart.Dispose(); $client.Dispose()

  $studentBody = @{ email = 'aluno@mecanica.com'; password = 'Aluno@Mecanica2026!' } | ConvertTo-Json
  $student = Invoke-RestMethod http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body $studentBody
  $studentHeaders = @{ Authorization = "Bearer $($student.token)" }
  $ticket = Invoke-RestMethod "http://localhost:3000/api/stream/ticket/$($lesson.lesson.id)" -Headers $studentHeaders
  $streamHeadersFile = Join-Path $tmp 'headers.txt'
  curl.exe -sS -D $streamHeadersFile -o (Join-Path $tmp 'stream.bin') -H "Authorization: Bearer $($student.token)" -H 'Range: bytes=0-15' "http://localhost:3000$($ticket.streamUrl)" | Out-Null
  $streamHeaders = Get-Content $streamHeadersFile -Raw
  if ($streamHeaders -notmatch 'HTTP/\S+ 206') { throw "Streaming não retornou HTTP 206. Cabeçalhos: $streamHeaders" }
  Write-Host "PASS: upload confirmado ($($upload.lesson.sizeBytes) bytes)"
  Write-Host 'PASS: streaming HTTP 206 confirmado'
}
finally {
  if ($module -and $module.module.id) { Invoke-RestMethod "http://localhost:3000/api/admin/modules/$($module.module.id)" -Method Delete -Headers $headers | Out-Null }
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
