# PLANO DE DESENVOLVIMENTO — PLATAFORMA DE MEMBROS

**Projeto:** Mentoria A Mecânica (Trader Thiago) — Plataforma Privada de Cursos Online  
**Versão:** 1.0.0  
**Data:** 24/08/2026

---

## 1. Visão Geral e Diretrizes

Este plano detalha o roteiro de desenvolvimento estruturado da plataforma de cursos fechada e área de membros, focando na integridade da segurança, proteção de vídeos, controle de sessão única, liberação progressiva de 7 dias e painel administrativo completo.

---

## 2. Fases de Execução

### FASE 1: Arquitetura, Documentação e Auditoria Base
- [x] Auditoria técnica do repositório inicial.
- [x] Criação dos documentos `ARCHITECTURE.md`, `PLAN.md` e `TASKS.md`.
- [x] Definição dos contratos de API, esquemas de dados e regras de segurança.

### FASE 2: Fundação Backend, Banco de Dados e Autenticação
- [ ] Implementação da camada de banco de dados com migrações e seeds iniciais (Super Admin e configurações).
- [ ] Sistema de Autenticação baseado em sessão única com cookies HttpOnly seguros.
- [ ] Middleware de proteção de rotas (Admin vs. Aluno) e invalidação de sessões concorrentes.
- [ ] Rotas de Login, Primeiro Acesso (Troca Obrigatória de Senha), Recuperação de Senha e Logout.

### FASE 3: Gestão de Cursos, Módulos, Tópicos e Aulas (Painel Admin)
- [ ] CRUD completo de Cursos com status (Publicado/Rascunho).
- [ ] CRUD de Módulos com controle de ordem e regra de liberação (`IMMEDIATE`, `AFTER_DAYS=7`, `FIXED_DATE`, `MANUAL`).
- [ ] CRUD de Tópicos e Aulas com upload/associação de vídeos e materiais complementares.
- [ ] Reordenação visual e persistente dos itens.

### FASE 4: Gestão de Alunos, Validade e Liberação de Conteúdo
- [ ] Cadastro manual de alunos pelo administrador (com geração automática de senha forte ou link de ativação).
- [ ] Configuração de validade (padrão 12 meses, data customizada, vitalício).
- [ ] Status do Aluno: Ativo, Suspenso, Expirado, Bloqueado.
- [ ] Sistema de Liberação Individual / Exceções Manuais (`ALLOW` / `DENY`).
- [ ] Botão de Liberação Total Imediata e Botão de Restauração de Regras Normais.

### FASE 5: Motor de Vídeos, Streaming Seguro e Player com Marca D'Água
- [ ] Endpoint de streaming seguro com suporte a HTTP 206 (Range requests / chunks) e tickets de streaming efêmeros.
- [ ] Bloqueio absoluto de acesso direto a arquivos de vídeo físicos.
- [ ] Player próprio customizado em HTML5/React com controles modernos (velocidade, progresso, fullscreen).
- [ ] Marca d'água dinâmica e flutuante com dados da conta (Nome, Email Mascarado, IP, ID) em canvas/overlay protegido.
- [ ] Salvamento automático de progresso do aluno (tempo assistido, percentual, última posição e conclusão aos 90%).

### FASE 6: Área do Aluno (Dashboard, Navegação e Experiência do Usuário)
- [ ] Dashboard moderno com dados reais: Validade do acesso, dias restantes, % de progresso geral e "Continuar assistindo".
- [ ] Navegação estruturada em Módulos -> Tópicos -> Aulas com indicação visual de status (Concluída, Em Andamento, Bloqueada).
- [ ] Tela de aula com player, notas da aula, materiais para download, botões Próxima/Anterior e marcação de conclusão.
- [ ] Bloqueio elegante para conteúdos não liberados (com contador de dias restantes para liberação de 7 dias).

### FASE 7: Auditoria, Sessões Ativas, Alertas e Configurações
- [ ] Central de Segurança no Admin: listagem de sessões ativas com opção de encerrar remotamente.
- [ ] Registro detalhado de logs de auditoria (quem fez, o que fez, IP, data e alterações).
- [ ] Painel de Configurações da Plataforma (regras de liberação, período de reembolso, termos de uso e identidade visual).
- [ ] Notificações e avisos administrativos internos.

### FASE 8: Docker, Testes de Aceitação e Preparação para VPS Linux
- [ ] Criação de Dockerfile e docker-compose.yml para desenvolvimento e produção.
- [ ] Suíte de testes automatizados cobrindo os 15 critérios de aceitação fundamentais.
- [ ] Guia de implantação em VPS Linux com Nginx, SSL e rotinas de backup.

---

## 3. Critérios de Aceitação Obrigatórios

1. **Cadastro e Primeiro Acesso:** Admin cria aluno -> Aluno recebe credenciais -> Obrigatoriedade de troca de senha no primeiro login.
2. **Dashboard do Aluno:** Exibe validade real, contagem de dias, % de progresso e atalho para continuar de onde parou.
3. **Regra de 7 Dias:** Aluno no dia 2 não acessa aulas com regra `AFTER_DAYS=7`; ao completar 7 dias a partir de `start_date`, o conteúdo desbloqueia automaticamente.
4. **Liberação Manual:** Admin clica em "Liberar todo conteúdo" -> Aluno tem acesso imediato mesmo antes dos 7 dias.
5. **Restauração de Regras:** Admin reverte exceção manual -> Aluno volta a respeitar a contagem de 7 dias.
6. **Controle de Validade:** Conta vencida não acessa vídeos e exibe mensagem de contato com suporte.
7. **Sessão Única Concorrente:** Login no dispositivo B encerra imediatamente a sessão no dispositivo A.
8. **Proteção de Vídeos:** Tentativa de download direto de URL pública é bloqueada; player consome stream autenticado via token efêmero.
9. **Marca D'Água Dinâmica:** Nome do aluno e dados da sessão flutuam sobre o player inclusive em modo tela cheia.
10. **Progresso Real:** Retorno à aula posiciona o vídeo exatamente nos segundos onde o aluno parou; conclusão aos 90%.
