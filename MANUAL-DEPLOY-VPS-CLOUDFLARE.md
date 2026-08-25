# Manual de instalação no VPS

Sistema: Mentoria A Mecânica
Domínio: thiago-trader.4dtech.com.br
Repositório: https://github.com/ronokedas/thiago-cursos2.git

## 1. DNS no Cloudflare

Em DNS → Records crie um registro A:

- Nome: thiago-trader
- Conteúdo: IP público do VPS
- Proxy: Proxied

Em SSL/TLS → Overview, prefira **Full (strict)**. O modo Flexible também é
possível, mas envia Cloudflare → VPS sem criptografia e exige a configuração
alternativa descrita abaixo.

## 2. Preparar o Ubuntu

Use Ubuntu 22.04 ou 24.04, com pelo menos 2 vCPUs, 4 GB de RAM e espaço suficiente para os vídeos.

~~~
ssh USUARIO_DA_VPS@IP_DO_VPS
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git ufw unattended-upgrades openssl
~~~

## 3. Instalar Docker

~~~
sudo apt remove -y docker.io docker-compose docker-doc podman-docker containerd runc || true
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo ${VERSION_CODENAME}) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
docker --version
docker compose version
~~~

## 4. Firewall

~~~
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
~~~

Não abra as portas 3000 e 5432. O app fica em 127.0.0.1:3000 e o PostgreSQL somente dentro da rede Docker.

## 5. Clonar o projeto

~~~
sudo mkdir -p /opt/aulas-online
sudo chown -R "$USER":"$USER" /opt/aulas-online
git clone https://github.com/ronokedas/thiago-cursos2.git /opt/aulas-online
cd /opt/aulas-online
git switch main
git log -1 --oneline
~~~

## 6. Criar o ambiente de produção

~~~
cd /opt/aulas-online
cp .env.example .env
chmod 600 .env
nano .env
~~~

Preencha os campos com valores reais:

~~~
NODE_ENV=production
APP_URL=https://thiago-trader.4dtech.com.br
PORT=3000
TRUST_PROXY=true
APP_ENCRYPTION_KEY=COLOQUE_UMA_CHAVE_LONGA_ALEATORIA

POSTGRES_DB=mecanica
POSTGRES_USER=mecanica
POSTGRES_PASSWORD=COLOQUE_UMA_SENHA_FORTE
DATABASE_URL=postgres://mecanica:COLOQUE_UMA_SENHA_FORTE@postgres:5432/mecanica

INITIAL_ADMIN_EMAIL=seu-email-administrador@seudominio.com
INITIAL_ADMIN_PASSWORD=COLOQUE_UMA_SENHA_FORTE

SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=suporte@seudominio.com
SMTP_PASSWORD=SENHA_DO_SMTP
SMTP_FROM="Mentoria A Mecânica <suporte@seudominio.com>"

DEV_LOG_RESET_TOKEN=false
~~~

Gere o segredo de criptografia com:

~~~
openssl rand -base64 48
~~~

Nunca publique o arquivo .env. Preserve APP_ENCRYPTION_KEY depois de salvar uma senha SMTP pelo painel. DATABASE_URL deve usar a mesma senha de POSTGRES_PASSWORD.

## 7. HTTPS com certificado Origin do Cloudflare (recomendado)

No Cloudflare, abra SSL/TLS → Origin Server → Create Certificate. Selecione RSA e o host thiago-trader.4dtech.com.br.

No VPS, salve o certificado e a chave:

~~~
sudo mkdir -p /etc/ssl/cloudflare/thiago-trader
sudo nano /etc/ssl/cloudflare/thiago-trader/origin.pem
sudo chmod 644 /etc/ssl/cloudflare/thiago-trader/origin.pem
sudo nano /etc/ssl/cloudflare/thiago-trader/origin.key
sudo chmod 600 /etc/ssl/cloudflare/thiago-trader/origin.key
~~~

Instale o Nginx:

~~~
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/thiago-trader
~~~

Cole:

~~~
server {
    listen 80;
    server_name thiago-trader.4dtech.com.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name thiago-trader.4dtech.com.br;
    ssl_certificate /etc/ssl/cloudflare/thiago-trader/origin.pem;
    ssl_certificate_key /etc/ssl/cloudflare/thiago-trader/origin.key;
    client_max_body_size 1G;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
    }
}
~~~

Ative o site:

~~~
sudo ln -s /etc/nginx/sites-available/thiago-trader /etc/nginx/sites-enabled/thiago-trader
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
~~~

### Alternativa: Cloudflare Flexible sem certificado no VPS

Se escolher **Flexible**, não instale certificado Origin. Use somente este
bloco no Nginx, sem redirecionar a porta 80 para HTTPS:

~~~
server {
    listen 80;
    server_name thiago-trader.4dtech.com.br;
    client_max_body_size 1G;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
    }
}
~~~

Nesse modo, remova o bloco `listen 443 ssl` e não use redirecionamento da porta
80 para HTTPS. O endereço público continuará HTTPS no Cloudflare, mas a conexão
entre Cloudflare e VPS ficará em HTTP. Para uso real, Full (strict) é mais seguro.

## 8. Subir a aplicação

O parâmetro --env-file é necessário para o Compose interpolar corretamente o arquivo de VPS:

~~~
cd /opt/aulas-online
docker compose --env-file .env -f deploy/docker-compose.vps.yml up --build -d
docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
curl -I https://thiago-trader.4dtech.com.br
~~~

Acesse https://thiago-trader.4dtech.com.br, entre com o administrador definido no .env, troque a senha e configure o SMTP em Configurações.

## 9. Atualizar depois

Faça backup antes de atualizar:

~~~
cd /opt/aulas-online
bash ./scripts/backup.sh
git fetch origin
git switch main
git pull --ff-only origin main
docker compose --env-file .env -f deploy/docker-compose.vps.yml up --build -d
docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
~~~

Nunca use docker compose down -v, pois isso pode remover volumes persistentes.

## 10. Backup diário

~~~
mkdir -p /opt/backups
crontab -e
~~~

Adicione:

~~~
0 3 * * * cd /opt/aulas-online && bash ./scripts/backup.sh >> /var/log/aulas-online-backup.log 2>&1
~~~

Copie os backups para outro servidor ou storage e teste periodicamente a restauração com scripts/restore.sh.

## 11. Diagnóstico

~~~
docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
docker compose --env-file .env -f deploy/docker-compose.vps.yml logs --tail=200 app
docker compose --env-file .env -f deploy/docker-compose.vps.yml logs --tail=200 postgres
journalctl -u nginx --no-pager -n 100
df -h
~~~

- Cloudflare 525/526: confira certificado, chave, permissões, nginx -t e Full (strict).
- PostgreSQL: confira POSTGRES_PASSWORD e DATABASE_URL; um volume existente mantém a senha inicial.
- Upload: confirme client_max_body_size 1G e espaço livre.

## 12. Checklist final

- [ ] DNS aponta para o VPS e está proxied.
- [ ] Cloudflare está em Full (strict).
- [ ] Portas 80/443 liberadas; 3000/5432 fechadas.
- [ ] .env tem senhas fortes e APP_ENCRYPTION_KEY.
- [ ] App e PostgreSQL estão saudáveis.
- [ ] Login do administrador funciona.
- [ ] SMTP foi testado em Configurações.
- [ ] Upload, streaming e progresso funcionam.
- [ ] Backup e restauração foram testados.
