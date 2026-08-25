# ARQUITETURA DO SISTEMA — PLATAFORMA DE MEMBROS & VIDEOAULAS

**Projeto:** Mentoria A Mecânica (Trader Thiago) — Plataforma Privada de Cursos Online  
**Data:** 24/08/2026  
**Status:** Fase 1 — Planejamento e Arquitetura

---

## 1. Auditoria do Estado Inicial do Projeto

| Componente | Estado Atual | Diagnóstico / Necessidade |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite 6 + Tailwind CSS v4 + Motion + Lucide React | Base moderna, sem rotas ou componentes de membros criados. |
| **Backend** | Express 4.21 instalado | Necessário unificar servidor Full-Stack com Vite middleware, rotas `/api/*`, autenticação e streaming seguro. |
| **Banco de Dados** | Nenhum configurado inicialmente | Necessário camada de persistência relacional/estruturada com suporte a migrações e sementes (seeds), compatível com Docker (local & VPS). |
| **Autenticação** | Inexistente | Implementar sessões criptografadas com tokens seguros, cookies `HttpOnly`, `SameSite=Lax`, e regra de **1 sessão ativa por usuário**. |
| **Controle de Conteúdo** | Inexistente | Implementar motor centralizado de autorização: regra de 7 dias para liberação progressiva, exceções manuais (ALLOW/DENY), e expiração de acessos. |
| **Vídeos & Player** | Inexistente | Criar player customizado HTML5 com proteção de URL privada (rotas de streaming protegidas via token efêmero com range request 206) e Watermark dinâmico flutuante anti-vazamento. |

---

## 2. Visão Geral da Arquitetura Proposta

```
+-----------------------------------------------------------------------------------+
|                              CLIENT (Browser / Mobile)                            |
|  - Área do Aluno (Dashboard, Curso, Player com Watermark Dinâmico, Progresso)     |
|  - Painel Administrativo (Gestão Alunos, Cursos, Aulas, Vídeos, Sessões, Logs)    |
+-----------------------------------------------------------------------------------+
                                       |
                   HTTP/HTTPS Requests (Cookies HttpOnly)
                                       |
+-----------------------------------------------------------------------------------+
|                        BACKEND (Node.js + Express + TypeScript)                   |
|                                                                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  |  Auth & Session    |  | Authorization Engine |  | Video Streaming Engine    |  |
|  |  - Single Session  |  | - 7-Day Rule (Days)  |  | - Private Chunked Stream  |  |
|  |  - Device Tracking |  | - Manual Overrides   |  | - Ephemeral Tokens (206)  |  |
|  |  - Password Policy |  | - Expiration Checker |  | - Anti-Hotlink Validation |  |
|  +--------------------+  +----------------------+  +---------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Audit & Security Layer (Rate Limiter, Audit Log, Threat Risk Score, CSRF)   |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                       |
+-----------------------------------------------------------------------------------+
|                           STORAGE & PERSISTENCE LAYER                             |
|  - Relational Database (Users, Courses, Modules, Lessons, Progress, Sessions, Logs)|
|  - Private Media Storage (`/storage/videos/` - nunca servido publicamente direto)  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Modelo de Dados e Entidades

### 3.1. Esquema Relacional

1. **`users`**
   - `id` (TEXT, PK, UUIDv4)
   - `name` (TEXT)
   - `email` (TEXT, UNIQUE, LOWERCASE)
   - `password_hash` (TEXT, Argon2/PBKDF2/Bcrypt)
   - `role` (TEXT: `SUPER_ADMIN`, `ADMIN`, `STUDENT`)
   - `status` (TEXT: `ACTIVE`, `SUSPENDED`, `EXPIRED`, `BLOCKED`)
   - `start_date` (TIMESTAMP - referência para a regra de liberação progressiva)
   - `expiration_date` (TIMESTAMP)
   - `first_access_at` (TIMESTAMP, NULLABLE)
   - `last_access_at` (TIMESTAMP, NULLABLE)
   - `force_password_change` (BOOLEAN, default true para primeiro acesso)
   - `notes` (TEXT)
   - `created_at`, `updated_at`

2. **`sessions`**
   - `id` (TEXT, PK)
   - `user_id` (TEXT, FK -> users.id)
   - `token_hash` (TEXT, SHA-256)
   - `ip_address` (TEXT)
   - `user_agent` (TEXT)
   - `device_info` (TEXT)
   - `is_active` (BOOLEAN)
   - `created_at`, `last_activity_at`, `expires_at`, `revoked_at`

3. **`courses`**
   - `id` (TEXT, PK)
   - `title` (TEXT)
   - `description` (TEXT)
   - `thumbnail_url` (TEXT)
   - `status` (TEXT: `PUBLISHED`, `DRAFT`, `ARCHIVED`)
   - `created_at`, `updated_at`

4. **`modules`**
   - `id` (TEXT, PK)
   - `course_id` (TEXT, FK -> courses.id)
   - `title` (TEXT)
   - `description` (TEXT)
   - `position` (INTEGER)
   - `release_type` (TEXT: `IMMEDIATE`, `AFTER_DAYS`, `FIXED_DATE`, `MANUAL`)
   - `release_days` (INTEGER, default 0 ou 7)
   - `release_date` (TIMESTAMP, NULLABLE)
   - `status` (TEXT: `PUBLISHED`, `DRAFT`)

5. **`topics`**
   - `id` (TEXT, PK)
   - `module_id` (TEXT, FK -> modules.id)
   - `title` (TEXT)
   - `description` (TEXT)
   - `position` (INTEGER)

6. **`lessons`**
   - `id` (TEXT, PK)
   - `topic_id` (TEXT, FK -> topics.id)
   - `title` (TEXT)
   - `description` (TEXT)
   - `position` (INTEGER)
   - `duration_seconds` (INTEGER)
   - `video_storage_path` (TEXT - arquivo privado no disco/storage)
   - `video_provider` (TEXT: `LOCAL_SECURE`, `CLOUDFLARE_STREAM`, `MUX`, `EXTERNAL_HLS`)
   - `video_playback_id` (TEXT)
   - `supplementary_materials` (JSON - links, arquivos PDF)
   - `release_type` (TEXT: `INHERIT`, `IMMEDIATE`, `AFTER_DAYS`, `FIXED_DATE`, `MANUAL`)
   - `release_days` (INTEGER)
   - `release_date` (TIMESTAMP, NULLABLE)
   - `is_free_preview` (BOOLEAN)
   - `status` (TEXT: `PUBLISHED`, `DRAFT`)

7. **`user_content_overrides`** (Exceções Manuais)
   - `id` (TEXT, PK)
   - `user_id` (TEXT, FK -> users.id)
   - `content_type` (TEXT: `COURSE`, `MODULE`, `LESSON`)
   - `content_id` (TEXT)
   - `action` (TEXT: `ALLOW`, `DENY`)
   - `reason` (TEXT)
   - `granted_by` (TEXT, FK -> users.id)
   - `created_at`

8. **`lesson_progress`**
   - `id` (TEXT, PK)
   - `user_id` (TEXT, FK -> users.id)
   - `lesson_id` (TEXT, FK -> lessons.id)
   - `progress_percent` (NUMERIC)
   - `last_position_seconds` (INTEGER)
   - `is_completed` (BOOLEAN)
   - `watched_seconds` (INTEGER)
   - `access_count` (INTEGER)
   - `last_watched_at` (TIMESTAMP)

9. **`audit_logs`**
   - `id` (TEXT, PK)
   - `actor_id` (TEXT)
   - `actor_name` (TEXT)
   - `action` (TEXT)
   - `entity_type` (TEXT)
   - `entity_id` (TEXT)
   - `details` (JSON)
   - `ip_address` (TEXT)
   - `user_agent` (TEXT)
   - `created_at` (TIMESTAMP)

10. **`system_settings`**
    - `id` (TEXT, PK)
    - `platform_name` (TEXT)
    - `support_email` (TEXT)
    - `default_access_months` (INTEGER, default 12)
    - `progressive_release_days` (INTEGER, default 7)
    - `completion_threshold_percent` (INTEGER, default 90)
    - `single_session_policy` (TEXT: `TERMINATE_OLD_LOGIN`, `BLOCK_NEW_LOGIN`)
    - `watermark_enabled` (BOOLEAN, default true)
    - `watermark_interval_seconds` (INTEGER, default 15)

---

## 4. Mecanismos de Segurança e Autorização

### 4.1. Controle Centralizado de Acesso (`canUserAccessLesson`)
Para qualquer requisição de aula ou fragmento de vídeo:
1. **Validação de Sessão:** O token da sessão está ativo no banco e corresponde à última sessão gerada para o `user_id`? Se não -> 401 Unauthenticated.
2. **Status do Usuário:** O usuário está com status `ACTIVE`? Se `SUSPENDED` ou `BLOCKED` -> 403 Forbidden.
3. **Validade do Acesso:** `now() <= user.expiration_date`? Se expirou -> 403 Expired.
4. **Exceção Manual (Override):**
   - Se existe registro `DENY` para o usuário -> 403 Bloqueio Manual.
   - Se existe registro `ALLOW` para o usuário -> Acesso Permitido Imediatamente.
5. **Regra de Liberação Progressiva (7 dias):**
   - Se `release_type == 'IMMEDIATE'` -> Acesso Permitido.
   - Se `release_type == 'AFTER_DAYS'`:
     `data_liberacao = user.start_date + dias_configurados (ex: 7 dias)`.
     Se `now() >= data_liberacao` -> Acesso Permitido.
     Se `now() < data_liberacao` -> 403 Bloqueado temporariamente (retorna data prevista).

### 4.2. Segurança e Streaming de Vídeo
- **Nunca expor o arquivo físico direto em pasta pública.**
- O player requisita um token assinado efêmero de streaming (`GET /api/stream/ticket/:lessonId`).
- O servidor valida `canUserAccessLesson`. Se autorizado, gera um `stream_token` temporário (válido por 60 segundos) vinculado ao IP, UserID e LessonID.
- O endpoint de streaming (`GET /api/stream/video/:token`) entrega os bytes via HTTP 206 (Partial Content / Byte Ranges), validando que o token e a sessão continuam ativos.

### 4.3. Marca D'Água Dinâmica Anti-Vazamento
- Renderizada na camada interna do player (DOM Canvas/SVG dentro do container fullscreen).
- Conteúdo dinâmico com identificação clara:
  `Nome do Aluno • E-mail Mascarado • ID da Conta • IP • Timestamp`
- Reposicionamento suave e randômico a cada X segundos para impedir cortes fáceis de tela e desestimular vazamentos.
- Aviso de integridade e direitos autorais visível.

### 4.4. Controle de Sessão Única (Single Active Session)
- Cada login gera um identificador único de sessão `sessionId` salvo no banco de dados.
- O `sessionId` anterior é imediatamente revogado (`is_active = false, revoked_at = now()`).
- O middleware de autenticação verifica o `sessionId` em cada requisição de API / heartbeat.
- Se a sessão for revogada por um novo login, o cliente anterior recebe código `401_SESSION_TERMINATED` e é redirecionado com aviso claro: *"Sua conta foi conectada em outro dispositivo."*

---

## 5. Estratégia de Deploy e Infraestrutura

- **Desenvolvimento Local:** Node.js 20+ / Docker Compose com volumes mapeados.
- **Produção VPS Linux:** Docker Compose com Nginx reverse proxy, SSL Certbot, compressão e cache estático para assets do Vite, e proxy seguro para o backend Node/Express.
- **Variáveis de Ambiente:** Configuradas via `.env` seguro (chaves de criptografia, portas, storage de mídia).
