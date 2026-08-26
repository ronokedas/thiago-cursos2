# Manual de instalação no VPS

Sistema: Mentoria A Mecânica
Domínio: thiago-trader.4dtech.com.br
Repositório: https://github.com/ronokedas/thiago-cursos2.git

## 1. DNS no Cloudflare

Em DNS → Records crie um registro A:

- Nome: thiago-trader
- Conteúdo: IP público do VPS
- Proxy: Proxied

Em SSL/TLS → Overview, selecione **Full (strict)**. O tráfego entre Cloudflare
e VPS também será criptografado.

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
sudo docker --version
sudo docker compose version
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

### Firewall da Google Cloud

Além do UFW, a regra de rede da Google Cloud precisa permitir TCP na porta 80.
No Console Google Cloud, abra **VPC network → Firewall → Create firewall rule**
e configure:

- Name: `allow-http-thiago`
- Direction: `Ingress`
- Action: `Allow`
- Targets: todas as instâncias da rede, ou a tag de rede da VM
- Source IPv4 ranges: `0.0.0.0/0`
- Protocols and ports: `tcp:80,443`

Salve a regra e confirme que ela se aplica à VM `thiagocursos-20260825-212701`.
No modo Full (strict), as portas 80 e 443 precisam estar liberadas na origem.

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

## 7. HTTPS com certificado Origin do Cloudflare

No Cloudflare, abra **SSL/TLS → Origin Server → Create Certificate**. Selecione
RSA, inclua `4dtech.com.br` e `*.4dtech.com.br` e escolha uma validade longa.

Salve o Origin Certificate e a Private Key no VPS:

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
    listen 443 ssl;
    server_name thiago-trader.4dtech.com.br;
    ssl_certificate /etc/ssl/cloudflare/thiago-trader/origin.pem;
    ssl_certificate_key /etc/ssl/cloudflare/thiago-trader/origin.key;
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

Ative o site:

~~~
sudo ln -sfn /etc/nginx/sites-available/thiago-trader /etc/nginx/sites-enabled/thiago-trader
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
~~~

No Cloudflare, em **SSL/TLS → Overview**, selecione **Full (strict)**.
O certificado Origin não deve ser enviado ao GitHub.

## 8. Subir a aplicação

O parâmetro --env-file é necessário para o Compose interpolar corretamente o arquivo de VPS:

~~~
cd /opt/aulas-online
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml up --build -d
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
curl -I https://thiago-trader.4dtech.com.br
~~~

O resultado esperado é `HTTP 200` ou uma resposta normal da aplicação. Se o
Cloudflare mostrar `521` ou `526`, confirme o certificado, o modo Full (strict)
e as regras de firewall da Google Cloud para as portas 80 e 443.

Acesse https://thiago-trader.4dtech.com.br, entre com o administrador definido no .env, troque a senha e configure o SMTP em Configurações.

## 9. Atualizar depois

Sempre que uma nova versão for publicada na branch `main`, use este roteiro
direto no SSH da VPS. Você pode executar os comandos estando em qualquer
diretório; o primeiro `cd` leva até a instalação correta:

~~~
cd /opt/aulas-online
sudo bash ./scripts/backup.sh
sudo git fetch origin
sudo git switch main
sudo git pull --ff-only origin main
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml up --build -d
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
~~~

Se o Git informar que existem alterações locais, não use `reset` sem confirmar
antes. Verifique o que mudou com:

~~~
cd /opt/aulas-online
sudo git status
sudo git diff
~~~

Após a atualização, confira se os serviços estão saudáveis e veja os últimos
logs da aplicação:

~~~
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml logs --tail=100 app
curl -I https://thiago-trader.4dtech.com.br
~~~

O esperado é o container `app` como `healthy` e uma resposta HTTP normal do
domínio. O arquivo `.env` e os volumes de dados não são substituídos pelo
`git pull`; eles permanecem na VPS.

Nunca use `sudo docker compose down -v`, pois isso pode remover volumes persistentes.

## 10. Backup diário

~~~
sudo mkdir -p /opt/backups
sudo crontab -e
~~~

Adicione:

~~~
0 3 * * * cd /opt/aulas-online && sudo bash ./scripts/backup.sh >> /var/log/aulas-online-backup.log 2>&1
~~~

Copie os backups para outro servidor ou storage e teste periodicamente a restauração com scripts/restore.sh.

## 11. Diagnóstico

~~~
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml logs --tail=200 app
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml logs --tail=200 postgres
sudo journalctl -u nginx --no-pager -n 100
df -h
~~~

- Erro do Cloudflare: confira o DNS proxied, o Nginx, o certificado e o modo Full (strict).
- PostgreSQL: confira POSTGRES_PASSWORD e DATABASE_URL; um volume existente mantém a senha inicial.
- Upload: confirme client_max_body_size 1G e espaço livre.

## 12. Checklist final

- [ ] DNS aponta para o VPS e está proxied.
- [ ] Cloudflare está em Full (strict).
- [ ] Portas 80/443 liberadas; 3000/5432 não estão públicas.
- [ ] .env tem senhas fortes e APP_ENCRYPTION_KEY.
- [ ] App e PostgreSQL estão saudáveis.
- [ ] Login do administrador funciona.
- [ ] SMTP foi testado em Configurações.
- [ ] Upload, streaming e progresso funcionam.
- [ ] Backup e restauração foram testados.
