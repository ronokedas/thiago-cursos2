# Manual simples: backup, GitHub e atualização da VPS

> O backup contém banco de dados, usuários, vídeos, materiais, imagens privadas, anotações e o arquivo `.env`. Por conter senhas e dados de alunos, ele **não deve ser enviado ao GitHub**. Envie-o diretamente para a VPS ou guarde-o em armazenamento privado.

## 1. Gerar backup completo local

Na pasta local do projeto, no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-full.ps1
```

O arquivo será criado em `backups\mentoria-backup-DATA-HORA.tar.gz`, com um arquivo `.sha256` ao lado para conferência.

## 2. Enviar código ao GitHub

O backup fica ignorado pelo Git para não expor banco, senhas ou dados de alunos.

```powershell
git status
git add .
git commit -m "Atualiza plataforma"
git push origin main
```

Se sua branch principal tiver outro nome, troque `main` pelo nome correto.

## 3. Atualizar o código na VPS sem apagar dados

No console SSH do Google Cloud, entre na pasta onde o projeto foi clonado e execute:

```bash
cd /opt/aulas-online
sudo bash ./scripts/backup-full.sh /opt/backups

# Corrige apenas as permissões internas do Git se algum comando anterior
# tiver sido executado com sudo. Banco e arquivos da plataforma não mudam.
sudo chown -R "$USER":"$USER" .git

# Atualiza o código sem descartar alterações locais.
git fetch origin main
git merge --ff-only origin/main
git log -1 --oneline

sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml up -d --build

# A aplicação leva alguns segundos para iniciar.
sleep 20
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

Esse procedimento faz antes um backup da VPS e atualiza somente o código. Banco, alunos, vídeos, materiais, imagens e anotações existentes continuam preservados nos volumes Docker.

Se o comando `git merge --ff-only origin/main` apresentar erro, não use `git reset --hard`. Veja primeiro as alterações locais com:

```bash
git status --short
```

### 3.1. Recriar containers depois de alterar apenas o `.env`

Se você modificou somente as variáveis do `.env` (por exemplo, SMTP), não precisa baixar o código novamente. Execute:

```bash
cd /opt/aulas-online
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml up -d --force-recreate
```

Se também houve alteração de código, use `--build`:

```bash
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml up -d --build --force-recreate
```

Os volumes Docker não são removidos; banco, vídeos, materiais, imagens e anotações continuam preservados.

## 4. Restaurar o backup local na VPS (somente se quiser substituir todos os dados da VPS)

Primeiro, no computador local, envie o pacote para a VPS. Substitua `USUARIO`, `IP_DA_VPS` e o nome real do arquivo:

```powershell
scp .\backups\mentoria-backup-DATA-HORA.tar.gz USUARIO@IP_DA_VPS:/tmp/
scp .\backups\mentoria-backup-DATA-HORA.tar.gz.sha256 USUARIO@IP_DA_VPS:/tmp/
```

Depois, no console SSH da VPS:

```bash
cd /caminho/do/projeto
sudo bash ./scripts/restore-full.sh /tmp/mentoria-backup-DATA-HORA.tar.gz
sudo docker compose --env-file .env -f deploy/docker-compose.vps.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

> Atenção: a restauração substitui o banco e os arquivos atualmente existentes na VPS pelo conteúdo do backup local.
