<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Mentoria A Mecânica

Plataforma de cursos com PostgreSQL, painel administrativo, SMTP configurável,
vídeos protegidos e progresso dos alunos.

View your app in AI Studio: https://ai.studio/apps/4dab9d5c-71cc-414d-849c-7c8d0254d1fe

## Run Locally

**Pré-requisitos:** Docker Desktop e Docker Compose.


Para desenvolvimento sem Docker, instale as dependências com `npm install` e
execute `npm run dev`.

## Run with Docker

The production container exposes the platform at `http://localhost:3000`.
O banco oficial é PostgreSQL. O banco e os vídeos são persistidos em volumes
Docker separados.

```bash
docker compose up --build -d
docker compose ps
```

To stop the application without deleting its data:

```bash
docker compose down
```

O primeiro start cria o administrador, aluno demonstrativo e curso de exemplo
usando as credenciais definidas no `.env`.

For production, copy `.env.example` to `.env`, fill the PostgreSQL, domain,
initial password and SMTP values, and use the VPS files in `deploy/`.
PostgreSQL is intentionally not exposed on the host network.

PostgreSQL fica disponível apenas dentro da rede Compose. Em produção, defina
`APP_ENCRYPTION_KEY` com uma chave forte e mantenha o `.env` fora do Git.

Após entrar como `SUPER_ADMIN`, a aba Configurações permite criar outros
administradores e configurar/testar o SMTP sem reiniciar a aplicação. A senha
SMTP é armazenada cifrada e nunca é retornada pela API. Se não houver SMTP salvo
no painel, as variáveis `SMTP_*` do `.env` continuam sendo usadas.

Backups of the database and private videos:

```powershell
./scripts/backup.ps1
```

Restore with:

```powershell
./scripts/restore.ps1 -DatabaseDump ./backups/mecanica-YYYYMMDD-HHMMSS.sql -VideosArchive ./backups/videos-YYYYMMDD-HHMMSS.tar.gz
```

Smoke test do ambiente em execução:

```powershell
npm run test:smoke
```

Teste de upload e streaming MP4:

```powershell
npm run test:video
```

Production deployment documentation is available in [deploy/README.md](C:\aulas-online\deploy\README.md).
