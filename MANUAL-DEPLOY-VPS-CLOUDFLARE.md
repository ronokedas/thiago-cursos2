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

    # Streaming protegido por Range: não deixe o Nginx criar buffer em disco.
    location ^~ /api/stream/video/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_max_temp_file_size 0;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

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

Em **Rules → Cache Rules**, crie uma regra para o caminho
`/api/stream/*` com ação **Bypass cache**. Isso mantém tickets e respostas
HTTP Range privados, enquanto o navegador continua carregando o buffer do
vídeo localmente.

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
sudo bash ./scripts/backup-full.sh /opt/backups
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

## 10. Backup completo e mudança de VPS

O backup completo inclui o banco PostgreSQL, administradores, alunos, cursos,
tópicos, aulas, progresso, auditoria, configurações, PDFs, materiais, vídeos,
o JSON de compatibilidade e o `.env`. O `.env` contém senhas e a
`APP_ENCRYPTION_KEY`; o pacote não é criptografado, portanto deve ser tratado
como arquivo secreto e mantido com permissão `600`.

Na VPS antiga, execute:

~~~
cd /opt/aulas-online
sudo bash ./scripts/backup-full.sh /opt/backups
ls -lh /opt/backups/mentoria-backup-*
~~~

Baixe para um local seguro o arquivo `.tar.gz` e o arquivo correspondente
`.tar.gz.sha256`.

Se estiver usando o SSH do Google Cloud pelo navegador:

1. Clique em **Fazer download do arquivo**.
2. Informe `/opt/backups/mentoria-backup-DATA.tar.gz` e salve no computador.
3. Repita o processo para `/opt/backups/mentoria-backup-DATA.tar.gz.sha256`.

Também é possível baixar os arquivos pelo terminal do seu computador usando
`scp`:

~~~
scp usuario@IP_DA_VPS:/opt/backups/mentoria-backup-DATA.tar.gz .
scp usuario@IP_DA_VPS:/opt/backups/mentoria-backup-DATA.tar.gz.sha256 .
~~~

Na VPS nova, instale o sistema normalmente, clone a branch `main` e crie o
`.env` inicial para que o Docker consiga subir. Depois envie os dois arquivos
para a VPS nova. Pelo terminal do seu computador:

~~~
sudo mkdir -p /opt/backups
sudo chown -R "$USER":"$USER" /opt/backups
scp mentoria-backup-DATA.tar.gz usuario@IP_NOVA_VPS:/opt/backups/
scp mentoria-backup-DATA.tar.gz.sha256 usuario@IP_NOVA_VPS:/opt/backups/
~~~

Se estiver usando o SSH do Google Cloud na nova VPS:

1. Clique em **Fazer upload do arquivo**.
2. Selecione `mentoria-backup-DATA.tar.gz` no computador.
3. Repita para `mentoria-backup-DATA.tar.gz.sha256`.
4. Mova os arquivos enviados para `/opt/backups`:

~~~
sudo mkdir -p /opt/backups
sudo mv ~/mentoria-backup-DATA.tar.gz /opt/backups/
sudo mv ~/mentoria-backup-DATA.tar.gz.sha256 /opt/backups/
sudo chmod 600 /opt/backups/mentoria-backup-DATA.tar.gz*
~~~

O local inicial do upload pode variar conforme o usuário do SSH. Se os
arquivos não estiverem em `~`, localize-os antes de mover:

~~~
find /home -maxdepth 3 -type f -name 'mentoria-backup-DATA*' 2>/dev/null
~~~

Na nova VPS, restaure com:

~~~
cd /opt/aulas-online
sudo bash ./scripts/restore-full.sh /opt/backups/mentoria-backup-DATA.tar.gz
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
curl -I http://127.0.0.1:3000
~~~

O script valida o checksum, preserva o `.env` anterior, restaura o banco e os
volumes pelo serviço `app`, reconstrói os containers e verifica o healthcheck.
Ele não depende do nome físico dos volumes Docker e não usa `down -v`.

Depois da restauração, configure o Nginx, gere um novo certificado Origin no
Cloudflare, aponte o DNS para o novo IP e valide login, alunos, vídeos, PDFs,
progresso e SMTP. O certificado privado da VPS antiga não é incluído no backup.

## 11. Otimizar vídeos para reprodução

Vídeos novos são otimizados automaticamente no upload: o sistema mantém a
qualidade original e move os metadados do MP4 para o início do arquivo, o que
permite começar a carregar antes de baixar o vídeo inteiro. Use MP4 com vídeo
H.264 e áudio AAC.

Após atualizar o sistema na VPS, otimize uma vez os vídeos que já existiam:

~~~
cd /opt/aulas-online
sudo bash ./scripts/backup-full.sh /opt/backups
sudo bash ./scripts/optimize-existing-videos.sh --dry-run
sudo bash ./scripts/optimize-existing-videos.sh
~~~

O script pausa somente o app, exige espaço livre equivalente ao maior vídeo e
só substitui cada arquivo após validar a cópia otimizada. Para aplicar a nova
configuração Nginx depois do `git pull`:

~~~
sudo nginx -t
sudo systemctl reload nginx
~~~

Se houver problema, restaure o backup criado antes da otimização com
`restore-full.sh`. Nunca use `docker compose down -v`.

## 12. Backup diário

~~~
sudo mkdir -p /opt/backups
sudo crontab -e
~~~

Adicione:

~~~
0 3 * * * cd /opt/aulas-online && sudo bash ./scripts/backup-full.sh /opt/backups >> /var/log/aulas-online-backup.log 2>&1
~~~

Copie os backups para outro servidor ou storage e teste periodicamente a restauração com `scripts/restore-full.sh`.

## 13. Diagnóstico

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

## 14. Checklist final

- [ ] DNS aponta para o VPS e está proxied.
- [ ] Cloudflare está em Full (strict).
- [ ] Portas 80/443 liberadas; 3000/5432 não estão públicas.
- [ ] .env tem senhas fortes e APP_ENCRYPTION_KEY.
- [ ] App e PostgreSQL estão saudáveis.
- [ ] Login do administrador funciona.
- [ ] SMTP foi testado em Configurações.
- [ ] Upload, streaming e progresso funcionam.
- [ ] Backup e restauração foram testados.

## 15. Mídias complementares por aula

No painel **Cursos & Vídeos**, crie ou edite a aula. Além do vídeo principal, use
**Vídeos curtos — Operando na prática** para enviar quantos clipes MP4 forem
necessários e **Exercícios de imagem** para cada par de imagem sem correção e
imagem com correção.

- A imagem sem correção fica disponível para download desde o início da aula.
- Vídeos práticos e imagens com correção só são liberados quando o aluno chega
  ao término real do vídeo principal; marcar a aula como concluída ou atingir
  90% não libera esse material.
- Arquivos continuam privados nos volumes Docker e são incluídos no backup
  completo. Não exponha `/app/data` pelo Nginx.
- Após atualizar o sistema, mantenha a regra Cloudflare de **Bypass cache** para
  `/api/stream/*`; ela é indispensável para os tickets protegidos dos clipes.
- A imagem corrigida é mostrada sem botão de download e com marca d'água. Isso
  reduz vazamentos, mas nenhuma aplicação web consegue impedir capturas de tela.


cd /opt/aulas-online

sudo bash ./scripts/backup-full.sh /opt/backups

sudo git fetch origin
sudo git switch main
sudo git pull --ff-only origin main

sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml up --build -d

sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
