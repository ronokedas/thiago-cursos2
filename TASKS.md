# TAREFAS DE IMPLEMENTAÇÃO — TASKS.md

**Projeto:** Mentoria A Mecânica (Trader Thiago) — Plataforma Privada de Cursos Online  
**Status Atual:** Em Execução

---

## 📋 Checklist de Tarefas por Fases

### Fase 1: Arquitetura e Planejamento
- [x] **T1.1** Realizar auditoria técnica do repositório base.
- [x] **T1.2** Criar documento `ARCHITECTURE.md`.
- [x] **T1.3** Criar documento `PLAN.md`.
- [x] **T1.4** Criar documento `TASKS.md`.
- [x] **T1.5** Atualizar metadados do projeto em `metadata.json`.

---

### Fase 2: Backend, Banco de Dados e Autenticação
- [ ] **T2.1** Configurar `server.ts` unificado com Vite middleware, parsing de cookies e JSON, e tratamento centralizado de erros.
- [ ] **T2.2** Criar camada de banco de dados (`server/db.ts` / `server/schema.ts`) com inicialização automática, tabelas relacionais, integridade referencial e persistência em arquivo / container.
- [ ] **T2.3** Criar rotinas de Seed com dados iniciais:
  - Super Admin inicial seguro.
  - Curso "Mentoria A Mecânica - Trader Thiago".
  - Módulos (Módulo 1: Boas-vindas [Imediato], Módulo 2: Fundamentos da Análise Gráfica [7 dias], Módulo 3: Estratégias Avançadas [7 dias]).
  - Tópicos e Aulas demonstrativas com vídeos protegidos.
  - Configurações do Sistema.
- [ ] **T2.4** Implementar serviço de autenticação (`server/auth.ts`):
  - Hashing seguro de senhas.
  - Criação e verificação de sessões únicas no banco.
  - Invalidação automática da sessão anterior ao realizar novo login.
  - Rota de `POST /api/auth/login`.
  - Rota de `POST /api/auth/logout`.
  - Rota de `GET /api/auth/me` (com heartbeat de sessão).
  - Rota de `POST /api/auth/change-password` (primeiro acesso e redefinição).
  - Rota de `POST /api/auth/forgot-password` e `POST /api/auth/reset-password`.

---

### Fase 3: Motor de Regras de Acesso e Streaming Protegido
- [ ] **T3.1** Criar motor centralizado de autorização (`server/accessControl.ts`):
  - Função `canUserAccessLesson(userId, lessonId)`.
  - Validação de status do aluno (Ativo, Suspenso, Expirado).
  - Validação de validade da conta (Data de expiração).
  - Verificação de Exceções Manuais (`ALLOW` ou `DENY`).
  - Cálculo dinâmico da regra de 7 dias com base em `start_date` do aluno.
- [ ] **T3.2** Implementar serviço de streaming protegido (`server/stream.ts`):
  - Emissão de ticket temporário de streaming de 60 segundos vinculado a User/IP.
  - Endpoint de reprodução com streaming de vídeo HTTP 206 (Byte Ranges).
  - Bloqueio de acesso direto a arquivos de vídeo em disco sem token válido.

---

### Fase 4: API do Painel Administrativo
- [ ] **T4.1** Implementar rotas de Gestão de Alunos (`/api/admin/users`):
  - Listagem com filtros por status, busca por nome/email e paginação.
  - Cadastro de novo aluno com opção de senha aleatória ou link.
  - Edição de dados, extensão ou alteração de validade.
  - Alteração de status (Ativar, Suspender, Bloquear, Expirar).
  - Liberação Manual Total ("Liberar todo conteúdo") e Restauração de Regras.
  - Liberação individual por módulo/aula (`ALLOW` / `DENY`).
  - Encerramento forçado de sessão ativa de um aluno.
- [ ] **T4.2** Implementar rotas de Gestão de Cursos e Conteúdo (`/api/admin/courses`, `/api/admin/modules`, `/api/admin/topics`, `/api/admin/lessons`):
  - CRUD e ordenação de módulos com configuração de regra de liberação (`IMMEDIATE`, `AFTER_DAYS`, `FIXED_DATE`, `MANUAL`).
  - CRUD de tópicos e aulas com upload de vídeos, thumbnails e materiais em PDF.
- [ ] **T4.3** Implementar rotas de Central de Segurança e Auditoria (`/api/admin/sessions`, `/api/admin/audit-logs`, `/api/admin/settings`):
  - Visualização de sessões ativas no sistema com IP, dispositivo e horário.
  - Visualização dos logs de auditoria com filtro por ação e ator.
  - Configurações gerais da plataforma (período de 7 dias, validade padrão, etc.).

---

### Fase 5: Interface do Usuário (Frontend - Área do Aluno)
- [ ] **T5.1** Criar tela de Login profissional e responsiva com identidade visual "A Mecânica" (paleta ouro, grafite e preto profundo).
- [ ] **T5.2** Criar tela de Primeiro Acesso com indicador de força da nova senha e confirmação.
- [ ] **T5.3** Criar tela de Recuperação de Senha com fluxo por token.
- [ ] **T5.4** Criar Dashboard do Aluno:
  - Header com dados do aluno, validade do acesso e dias restantes.
  - Barra de progresso geral do curso.
  - Card "Continuar estudando" (leva direto à última aula em andamento).
  - Lista de módulos com status (Liberado, Bloqueado com contagem de dias restantes, Concluído).
- [ ] **T5.5** Criar Tela de Visualização da Aula:
  - Player próprio integrado em HTML5/React com controles customizados.
  - Marca d'água dinâmica e flutuante sobre o vídeo com dados do aluno (Nome, Email Mascarado, IP, ID).
  - Transição de posicionamento anti-corte da marca d'água a cada 15 segundos.
  - Sincronização em tempo real de progresso (a cada 5 segundos) e marcação de conclusão aos 90%.
  - Sidebar retrátil com lista de módulos, tópicos e aulas.
  - Materiais complementares para download e descrição da aula.
  - Navegação entre aula anterior e próxima aula.
  - Tela amigável de bloqueio caso a aula ainda esteja dentro do período de carência dos 7 dias.

---

### Fase 6: Interface do Usuário (Frontend - Painel Administrativo)
- [ ] **T6.1** Layout administrativo com Sidebar moderna, menu responsivo (desktop e mobile drawer), e métricas em tempo real.
- [ ] **T6.2** Módulo de Gestão de Alunos:
  - Tabela com filtros, busca instantânea, badges de status e progresso.
  - Modal/Drawer de cadastro de aluno com geração automática de senha forte e máscara de campos.
  - Perfil detalhado do aluno com visualização de sessões, progresso individual e controle de exceções manuais.
- [ ] **T6.3** Módulo de Gestão de Conteúdo:
  - Editor hierárquico Curso -> Módulos -> Tópicos -> Aulas.
  - Configuração visual da regra de 7 dias e liberação progressiva por módulo.
  - Modal de upload de vídeo com barra de progresso e processamento.
- [ ] **T6.4** Módulo de Sessões e Segurança:
  - Tabela de sessões ativas com dispositivo, IP, horário de login e botão de desconexão forçada.
  - Visualização de logs de auditoria detalhados.
- [ ] **T6.5** Módulo de Configurações da Plataforma:
  - Ajuste de parâmetros globais (duração padrão de acesso, dias de liberação progressiva, % de conclusão).

---

### Fase 7: Docker, Infraestrutura e VPS Linux
- [ ] **T7.1** Criar `Dockerfile` multi-stage otimizado para Node.js / TypeScript / Vite.
- [ ] **T7.2** Criar `docker-compose.yml` para ambiente local e produção com volumes para banco de dados e armazenamento privado de vídeos.
- [ ] **T7.3** Criar configuração de Nginx para VPS Linux com proxy reverso e proteção de headers de segurança.
- [ ] **T7.4** Criar script de backup e restauração do banco de dados e mídias.

---

### Fase 8: Testes Automatizados e Validação dos Critérios de Aceitação
- [ ] **T8.1** Criar suíte de testes de integração e validação para:
  - Autenticação e restrição de sessão única.
  - Regra de liberação progressiva de 7 dias.
  - Liberação manual imediata pelo administrador.
  - Bloqueio de acesso a contas expiradas ou suspensas.
  - Proteção de rotas de streaming e tokens temporários.
- [ ] **T8.2** Validação final completa de todos os 15 testes de aceitação.
