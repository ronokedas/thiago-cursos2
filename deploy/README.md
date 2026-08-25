# Deploy em VPS

1. Instale Docker, Docker Compose, Nginx e Certbot na VPS.
2. Copie `.env.example` para `.env` e preencha domínio, PostgreSQL,
   `APP_ENCRYPTION_KEY`, credenciais iniciais e SMTP.
3. Aponte o DNS `A` do domínio para o IP da VPS.
4. Gere o certificado inicial:

```bash
sudo certbot certonly --standalone -d seu-dominio.com
```

5. Substitua `${DOMAIN}` em `nginx.conf.template`, copie o resultado para `/etc/nginx/sites-available/mecanica` e ative o site.
6. Valide e recarregue o Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

7. Suba a aplicação:

```bash
docker compose -f deploy/docker-compose.vps.yml up --build -d
```

8. Configure a renovação automática do Certbot e execute o backup diário:

```bash
pwsh ./scripts/backup.ps1
```

O backup inclui PostgreSQL e vídeos. Teste a restauração em uma máquina
separada com `scripts/restore.ps1` antes de liberar o sistema para alunos.

Depois do primeiro login, troque a senha inicial do `SUPER_ADMIN`. Preserve o
segredo `APP_ENCRYPTION_KEY`: sem ele, senhas SMTP já cifradas não podem ser
decifradas.
