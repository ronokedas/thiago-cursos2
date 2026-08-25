<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4dab9d5c-71cc-414d-849c-7c8d0254d1fe

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Run with Docker

The production container exposes the platform at `http://localhost:3000`.
The current application stores its database in `data/database.json`; Docker
keeps it persistent in the `aulas_online_data` volume.

```bash
docker compose up --build -d
docker compose ps
```

To stop the application without deleting its data:

```bash
docker compose down
```

The first start automatically creates the administrator, a demo student and
the sample course.

For production, copy `.env.example` to `.env`, fill the PostgreSQL, domain,
initial password and SMTP values, and use the VPS files in `deploy/`.
PostgreSQL is intentionally not exposed on the host network.

PostgreSQL is exposed only inside the Compose network. The application uses:
`postgres://mecanica:mecanica_dev@postgres:5432/mecanica`.

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
