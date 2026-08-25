import { readDb, writeDb, User, Course, Module, Topic, Lesson } from './db.js';
import { hashPassword } from './auth.js';
import { logAudit } from './audit.js';

export function seedDatabase(): void {
  const db = readDb();

  // 1. Seed Super Admin if not exists
  let admin = db.users.find(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN');
  if (!admin) {
    const adminUser: User = {
      id: 'usr_admin_master',
      name: 'Trader Thiago — Administrador',
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@mecanica.com',
      passwordHash: hashPassword(process.env.INITIAL_ADMIN_PASSWORD || 'Admin@Mecanica2026!'),
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      firstAccessAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      forcePasswordChange: false,
      notes: 'Super Administrador Fundador da Plataforma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.users.push(adminUser);
    admin = adminUser;
  }

  // 2. Seed Demo Student if not exists
  let demoStudent = db.users.find(u => u.email === 'aluno@mecanica.com');
  if (!demoStudent) {
    const now = new Date();
    // Start date 2 days ago so we can demonstrate the 7-day rule (5 days remaining)
    const startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const studentUser: User = {
      id: 'usr_aluno_demo',
      name: 'João Silva',
      email: 'aluno@mecanica.com',
      passwordHash: hashPassword('Aluno@Mecanica2026!'),
      role: 'STUDENT',
      status: 'ACTIVE',
      startDate: startDate.toISOString(),
      expirationDate: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      firstAccessAt: startDate.toISOString(),
      lastAccessAt: now.toISOString(),
      forcePasswordChange: false,
      notes: 'Aluno Teste Oficial — Acesso de 12 Meses',
      createdAt: startDate.toISOString(),
      updatedAt: now.toISOString(),
    };
    db.users.push(studentUser);
    demoStudent = studentUser;
  }

  // 3. Seed Main Course if not exists
  if (db.courses.length === 0) {
    const course: Course = {
      id: 'crs_mecanica_master',
      title: 'Mentoria A Mecânica — Trader Thiago',
      description: 'Método comprovado de leitura institucional, Price Action objetivo, gestão de risco e consistência real no mercado financeiro.',
      thumbnailUrl: '/logo-mecanica.jpg',
      status: 'PUBLISHED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.courses.push(course);

    // Module 1: Boas-Vindas (IMMEDIATE)
    const mod1: Module = {
      id: 'mod_1_boas_vindas',
      courseId: course.id,
      title: 'Módulo 1: Boas-Vindas & Alinhamento Estratégico',
      description: 'Apresentação do método, alinhamento de expectativas e configuração da rotina operacional.',
      position: 1,
      releaseType: 'IMMEDIATE',
      releaseDays: 0,
      releaseDate: null,
      status: 'PUBLISHED',
    };
    db.modules.push(mod1);

    const topic1: Topic = {
      id: 'top_1_intro',
      moduleId: mod1.id,
      title: 'Introdução & Configuração de Plataforma',
      description: 'Primeiros passos e mindset',
      position: 1,
    };
    db.topics.push(topic1);

    const lesson1: Lesson = {
      id: 'les_1_bem_vindo',
      topicId: topic1.id,
      moduleId: mod1.id,
      courseId: course.id,
      title: 'Aula 01: Bem-vindo à Mecânica — Mentalidade & Disciplina',
      description: 'Entenda os 4 pilares fundamentais: Estratégia, Disciplina, Consistência e Resultados.',
      position: 1,
      durationSeconds: 840,
      videoFileName: null,
      videoProvider: 'LOCAL_SECURE',
      supplementaryMaterials: [
        {
          id: 'mat_1',
          title: 'Manual de Boas-Vindas e Regras da Mentoria (PDF)',
          type: 'PDF',
          url: '#',
          sizeBytes: 2450000,
        },
      ],
      releaseType: 'INHERIT',
      releaseDays: 0,
      releaseDate: null,
      isFreePreview: false,
      status: 'PUBLISHED',
    };

    const lesson2: Lesson = {
      id: 'les_2_gestao_risco',
      topicId: topic1.id,
      moduleId: mod1.id,
      courseId: course.id,
      title: 'Aula 02: Gestão de Risco Blindada & Planilha Operacional',
      description: 'Como calcular seu lote máximo, limite diário de perda e proteção de capital.',
      position: 2,
      durationSeconds: 1120,
      videoFileName: null,
      videoProvider: 'LOCAL_SECURE',
      supplementaryMaterials: [
        {
          id: 'mat_2',
          title: 'Planilha de Gestão de Risco Mecânica (Excel/PDF)',
          type: 'DOCUMENT',
          url: '#',
          sizeBytes: 1150000,
        },
      ],
      releaseType: 'INHERIT',
      releaseDays: 0,
      releaseDate: null,
      isFreePreview: false,
      status: 'PUBLISHED',
    };
    db.lessons.push(lesson1, lesson2);

    // Module 2: Leitura Institucional (AFTER_DAYS = 7)
    const mod2: Module = {
      id: 'mod_2_leitura_institucional',
      courseId: course.id,
      title: 'Módulo 2: Leitura Institucional & Candlesticks de Alta Precisão',
      description: 'Descubra onde os grandes players deixam rastros e aprenda a identificar absorções.',
      position: 2,
      releaseType: 'AFTER_DAYS',
      releaseDays: 7,
      releaseDate: null,
      status: 'PUBLISHED',
    };
    db.modules.push(mod2);

    const topic2: Topic = {
      id: 'top_2_candlesticks',
      moduleId: mod2.id,
      title: 'Análise de Candlesticks & Fluxo',
      description: 'Padrões de agressão e rejeição',
      position: 1,
    };
    db.topics.push(topic2);

    const lesson3: Lesson = {
      id: 'les_3_padroes_reversao',
      topicId: topic2.id,
      moduleId: mod2.id,
      courseId: course.id,
      title: 'Aula 03: Padrões de Reversão e Absorção Institucional',
      description: 'Como identificar exaustão de movimento e gatilhos de entrada com risco/retorno assimétrico.',
      position: 1,
      durationSeconds: 1450,
      videoFileName: null,
      videoProvider: 'LOCAL_SECURE',
      supplementaryMaterials: [],
      releaseType: 'INHERIT',
      releaseDays: 7,
      releaseDate: null,
      isFreePreview: false,
      status: 'PUBLISHED',
    };

    const lesson4: Lesson = {
      id: 'les_4_quebra_estrutura',
      topicId: topic2.id,
      moduleId: mod2.id,
      courseId: course.id,
      title: 'Aula 04: Estrutura de Mercado: Quebra de Estrutura & Liquidez',
      description: 'Mapeamento de máximas e mínimas relevantes para nunca mais ser estopado por violinada.',
      position: 2,
      durationSeconds: 1680,
      videoFileName: null,
      videoProvider: 'LOCAL_SECURE',
      supplementaryMaterials: [],
      releaseType: 'INHERIT',
      releaseDays: 7,
      releaseDate: null,
      isFreePreview: false,
      status: 'PUBLISHED',
    };
    db.lessons.push(lesson3, lesson4);

    // Module 3: Setups Operacionais (AFTER_DAYS = 7)
    const mod3: Module = {
      id: 'mod_3_setups_operacionais',
      courseId: course.id,
      title: 'Módulo 3: Setups Operacionais de Alta Assertividade',
      description: 'Regras objetivas de entrada, posicionamento de stop e alvos parciais.',
      position: 3,
      releaseType: 'AFTER_DAYS',
      releaseDays: 7,
      releaseDate: null,
      status: 'PUBLISHED',
    };
    db.modules.push(mod3);

    const topic3: Topic = {
      id: 'top_3_execucao',
      moduleId: mod3.id,
      title: 'Estratégias Práticas de Entrada',
      description: 'Operações ao vivo e replays comentados',
      position: 1,
    };
    db.topics.push(topic3);

    const lesson5: Lesson = {
      id: 'les_5_setup_rejeicao',
      topicId: topic3.id,
      moduleId: mod3.id,
      courseId: course.id,
      title: 'Aula 05: Setup 1 — Entrada por Rejeição de Topo/Fundo',
      description: 'O gatilho exato para antecipar viradas de tendência com stop curto e alvo 3x.',
      position: 1,
      durationSeconds: 1820,
      videoFileName: null,
      videoProvider: 'LOCAL_SECURE',
      supplementaryMaterials: [],
      releaseType: 'INHERIT',
      releaseDays: 7,
      releaseDate: null,
      isFreePreview: false,
      status: 'PUBLISHED',
    };

    const lesson6: Lesson = {
      id: 'les_6_setup_medias',
      topicId: topic3.id,
      moduleId: mod3.id,
      courseId: course.id,
      title: 'Aula 06: Setup 2 — Operando as Aberturas com Médias Móveis',
      description: 'Como aproveitar a volatilidade inicial do pregão com segurança técnica.',
      position: 2,
      durationSeconds: 1950,
      videoFileName: null,
      videoProvider: 'LOCAL_SECURE',
      supplementaryMaterials: [],
      releaseType: 'INHERIT',
      releaseDays: 7,
      releaseDate: null,
      isFreePreview: false,
      status: 'PUBLISHED',
    };
    db.lessons.push(lesson5, lesson6);
  }

  writeDb(db);
  console.log('Database initialized and seeded successfully.');
}
