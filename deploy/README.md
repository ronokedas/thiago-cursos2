# Deploy em VPS

1. Instale Docker, Docker Compose, Nginx e Certbot na VPS.
2. Copie `.env.example` para `.env` e preencha domínio, PostgreSQL, secrets e SMTP.
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

8. Configure renovação automática do Certbot e execute `npm run backup` diariamente via cron.
