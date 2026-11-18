import db, { hashPassword } from './database.ts';
import {
  DEFAULT_CLAIM_CATEGORIES,
  DEFAULT_COMPANY_SETTINGS,
  QUESTION_BANK,
} from '../constants/standards.ts';

export { DEFAULT_CLAIM_CATEGORIES, DEFAULT_COMPANY_SETTINGS, QUESTION_BANK };

export function seedDemoDataIfEmpty(): void {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM companies').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const now = new Date('2026-11-18T10:00:00.000Z');
  const daysAgo = (days: number) => {
    const d = new Date(now.getTime() - days * 86400 * 1000);
    return d.toISOString();
  };

  // Company 1: Institut Horizon Formation (Primary Demo Workspace)
  const c1Id = 'comp_horizon';
  db.prepare(
    `INSERT INTO companies (id, name, slug, is_demo, logo_url, email, phone, address, website, primary_color, secondary_color, domains_json, training_types_json, certification_types_json, claim_categories_json, settings_json, created_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, '#16834B', '#E8F5ED', ?, ?, ?, ?, ?, ?)`
  ).run(
    c1Id,
    'Institut Horizon Formation (DÉMO)',
    'institut-horizon',
    '',
    'qualite@horizon-formation.fr',
    '+33 1 42 68 55 00',
    '18 Rue de la Victoire, 75009 Paris',
    'https://horizon-formation.fr',
    JSON.stringify(['Management & Leadership', 'Cybersécurité & IT', 'Qualité ISO 9001', 'Ressources Humaines']),
    JSON.stringify(['Formation professionnelle', 'Atelier pratique', 'Accompagnement individuel']),
    JSON.stringify(['ISO 27001 Lead Implementer', 'Qualiopi Auditeur', 'PMP Project Management', 'Certification Cybersécurité ANSSI']),
    JSON.stringify(DEFAULT_CLAIM_CATEGORIES),
    JSON.stringify(DEFAULT_COMPANY_SETTINGS),
    daysAgo(140)
  );

  // Company 2: CertiPro Académie (Secondary Demo Workspace for Multi-tenant verification)
  const c2Id = 'comp_certipro';
  db.prepare(
    `INSERT INTO companies (id, name, slug, is_demo, logo_url, email, phone, address, website, primary_color, secondary_color, domains_json, training_types_json, certification_types_json, claim_categories_json, settings_json, created_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, '#16834B', '#E8F5ED', ?, ?, ?, ?, ?, ?)`
  ).run(
    c2Id,
    'CertiPro Académie (DÉMO)',
    'certipro-academie',
    '',
    'contact@certipro-academie.fr',
    '+33 4 78 12 34 56',
    '45 Cours Lafayette, 69003 Lyon',
    'https://certipro-academie.fr',
    JSON.stringify(['Finance & Audit', 'Data & IA Appliquée']),
    JSON.stringify(['Formation professionnelle', 'Certification']),
    JSON.stringify(['CFA Level I Prep', 'Certification Data Analyst']),
    JSON.stringify(DEFAULT_CLAIM_CATEGORIES),
    JSON.stringify(DEFAULT_COMPANY_SETTINGS),
    daysAgo(90)
  );

  // Trainers for Company 1 (using our 3 generated studio headshots!)
  const trainersC1 = [
    {
      id: 'trn_claire',
      name: 'Claire Dubois',
      email: 'c.dubois@horizon-formation.fr',
      specialty: 'Management & Leadership',
      bio: '14 ans d’expérience en direction opérationnelle et coaching de managers en entreprise.',
      photoUrl: '/src/assets/images/trainer_claire_dubois_1795008855268.jpg',
    },
    {
      id: 'trn_karim',
      name: 'Karim Benali',
      email: 'k.benali@horizon-formation.fr',
      specialty: 'Cybersécurité & ISO 27001',
      bio: 'Architecte sécurité certifié CISSP et ISO 27001 Lead Auditor.',
      photoUrl: '/src/assets/images/trainer_karim_benali_1795008855347.jpg',
    },
    {
      id: 'trn_sophie',
      name: 'Sophie Laurent',
      email: 's.laurent@horizon-formation.fr',
      specialty: 'Qualité ISO 9001 & Audit Qualiopi',
      bio: 'Consultante senior Qualité & Conformité, accompagnatrice d’organismes certifiés.',
      photoUrl: '/src/assets/images/trainer_sophie_laurent_1795008855408.jpg',
    },
    {
      id: 'trn_marc',
      name: 'Marc Delacroix',
      email: 'm.delacroix@horizon-formation.fr',
      specialty: 'Gestion de Projet Agile & PMP',
      bio: 'Formateur intervenant récemment intégré pour les sessions PMP intensives.',
      photoUrl: '',
    },
  ];

  for (const tr of trainersC1) {
    db.prepare(
      `INSERT INTO trainers (id, company_id, name, email, specialty, bio, photo_url, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(tr.id, c1Id, tr.name, tr.email, tr.specialty, tr.bio, tr.photoUrl, daysAgo(120));
  }

  // Trainer for Company 2
  db.prepare(
    `INSERT INTO trainers (id, company_id, name, email, specialty, bio, photo_url, active, created_at)
     VALUES ('trn_c2_luc', ?, 'Luc Moreau', 'l.moreau@certipro-academie.fr', 'Finance & Audit', 'Expert-comptable et formateur certifié.', '', 1, ?)`
  ).run(c2Id, daysAgo(80));

  // Beneficiaries for Company 1
  const benListC1 = [
    { id: 'ben_1', code: 'BEN-1001', first: 'Camille', last: 'Martin', email: 'camille.martin@nexia-group.fr', phone: '+33 6 12 34 56 01', org: 'Nexia Group' },
    { id: 'ben_2', code: 'BEN-1002', first: 'Thomas', last: 'Bernard', email: 'thomas.bernard@axone-tech.fr', phone: '+33 6 12 34 56 02', org: 'Axone Tech' },
    { id: 'ben_3', code: 'BEN-1003', first: 'Nadia', last: 'Khelifi', email: 'nadia.khelifi@veloce-conseil.fr', phone: '+33 6 12 34 56 03', org: 'Véloce Conseil' },
    { id: 'ben_4', code: 'BEN-1004', first: 'Julien', last: 'Morel', email: 'julien.morel@sogepro.fr', phone: '+33 6 12 34 56 04', org: 'SogePro' },
    { id: 'ben_5', code: 'BEN-1005', first: 'Élodie', last: 'Petit', email: 'elodie.petit@altera-sante.fr', phone: '+33 6 12 34 56 05', org: 'Altera Santé' },
    { id: 'ben_6', code: 'BEN-1006', first: 'Lucas', last: 'Roux', email: 'lucas.roux@indus-nord.fr', phone: '+33 6 12 34 56 06', org: 'IndusNord' },
    { id: 'ben_7', code: 'BEN-1007', first: 'Sarah', last: 'Lefèvre', email: 'sarah.lefevre@nexia-group.fr', phone: '+33 6 12 34 56 07', org: 'Nexia Group' },
    { id: 'ben_8', code: 'BEN-1008', first: 'Antoine', last: 'Mercier', email: 'antoine.mercier@mediapulse.fr', phone: '+33 6 12 34 56 08', org: 'MediaPulse' },
  ];

  for (const b of benListC1) {
    db.prepare(
      `INSERT INTO beneficiaries (id, company_id, unique_code, first_name, last_name, email, phone, company_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(b.id, c1Id, b.code, b.first, b.last, b.email, b.phone, b.org, daysAgo(100));
  }

  // Beneficiary for Company 2
  db.prepare(
    `INSERT INTO beneficiaries (id, company_id, unique_code, first_name, last_name, email, phone, company_name, created_at)
     VALUES ('ben_c2_1', ?, 'BEN-2001', 'Chloé', 'Garnier', 'chloe.garnier@lyon-invest.fr', '+33 6 99 88 77 66', 'Lyon Invest', ?)`
  ).run(c2Id, daysAgo(50));

  // Users (Admin, Quality Manager, Beneficiary) for Company 1 + Admin for Company 2
  const adminPerm = JSON.stringify({
    canManageQuestionnaires: true,
    canExportReports: true,
    canManageTrainers: true,
    canManageClaims: true,
    canImportData: true,
  });
  const qmPerm = JSON.stringify({
    canManageQuestionnaires: true,
    canExportReports: true,
    canManageTrainers: false,
    canManageClaims: true,
    canImportData: true,
  });
  const benPerm = JSON.stringify({
    canManageQuestionnaires: false,
    canExportReports: false,
    canManageTrainers: false,
    canManageClaims: false,
    canImportData: false,
  });

  db.prepare(
    `INSERT INTO users (id, company_id, name, email, password_hash, role, permissions_json, is_active, beneficiary_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run('usr_admin_1', c1Id, 'Hélène Vasseur', 'admin@horizon-formation.fr', hashPassword('FormaCare2026!'), 'admin', adminPerm, null, daysAgo(140));

  db.prepare(
    `INSERT INTO users (id, company_id, name, email, password_hash, role, permissions_json, is_active, beneficiary_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run('usr_qm_1', c1Id, 'Romain Chevalier', 'qualite@horizon-formation.fr', hashPassword('FormaCare2026!'), 'quality_manager', qmPerm, null, daysAgo(130));

  db.prepare(
    `INSERT INTO users (id, company_id, name, email, password_hash, role, permissions_json, is_active, beneficiary_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run('usr_ben_1', c1Id, 'Camille Martin', 'camille.martin@nexia-group.fr', hashPassword('FormaCare2026!'), 'beneficiary', benPerm, 'ben_1', daysAgo(100));

  db.prepare(
    `INSERT INTO users (id, company_id, name, email, password_hash, role, permissions_json, is_active, beneficiary_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run('usr_admin_2', c2Id, 'Damien Girard', 'admin@certipro-academie.fr', hashPassword('CertiPro2026!'), 'admin', adminPerm, null, daysAgo(90));

  // Prestations for Company 1
  const prestationsC1 = [
    {
      id: 'prs_1',
      title: 'Leadership & Management Hybride',
      domain: 'Management & Leadership',
      type: 'Formation professionnelle',
      cert: '',
      realizedAt: daysAgo(75),
      trainerId: 'trn_claire',
      duration: 14,
      session: 'SES-2026-09A',
      status: 'Clôturée',
      bens: ['ben_1', 'ben_3', 'ben_5', 'ben_7'],
    },
    {
      id: 'prs_2',
      title: 'Préparation Certification ISO 27001 Lead Implementer',
      domain: 'Cybersécurité & IT',
      type: 'Certification',
      cert: 'ISO 27001 Lead Implementer',
      realizedAt: daysAgo(45),
      trainerId: 'trn_karim',
      duration: 35,
      session: 'CERT-2026-10B',
      status: 'Suivi en cours',
      bens: ['ben_2', 'ben_4', 'ben_6', 'ben_8'],
    },
    {
      id: 'prs_3',
      title: 'Audit Qualiopi & Amélioration Continue',
      domain: 'Qualité ISO 9001',
      type: 'Certification',
      cert: 'Qualiopi Auditeur',
      realizedAt: daysAgo(22),
      trainerId: 'trn_sophie',
      duration: 21,
      session: 'CERT-2026-10C',
      status: 'Suivi en cours',
      bens: ['ben_1', 'ben_5', 'ben_7'],
    },
    {
      id: 'prs_4',
      title: 'Communication Managériale & Feedback',
      domain: 'Management & Leadership',
      type: 'Formation professionnelle',
      cert: '',
      realizedAt: daysAgo(10),
      trainerId: 'trn_claire',
      duration: 14,
      session: 'SES-2026-11A',
      status: 'Enquête envoyée',
      bens: ['ben_1', 'ben_2', 'ben_3'],
    },
    {
      id: 'prs_5',
      title: 'Bootcamp Certification PMP',
      domain: 'Management & Leadership',
      type: 'Certification',
      cert: 'PMP Project Management',
      realizedAt: daysAgo(3),
      trainerId: 'trn_marc',
      duration: 28,
      session: 'CERT-2026-11B',
      status: 'Enquête envoyée',
      bens: ['ben_4', 'ben_6'],
    },
  ];

  for (const p of prestationsC1) {
    db.prepare(
      `INSERT INTO prestations (id, company_id, title, domain, type, certification_name, realized_at, trainer_id, duration_hours, session_code, follow_up_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(p.id, c1Id, p.title, p.domain, p.type, p.cert, p.realizedAt, p.trainerId, p.duration, p.session, p.status, p.realizedAt);

    for (const bId of p.bens) {
      db.prepare(
        `INSERT INTO prestation_beneficiaries (prestation_id, beneficiary_id, company_id) VALUES (?, ?, ?)`
      ).run(p.id, bId, c1Id);
    }
  }

  // Prestation for Company 2
  db.prepare(
    `INSERT INTO prestations (id, company_id, title, domain, type, certification_name, realized_at, trainer_id, duration_hours, session_code, follow_up_status, created_at)
     VALUES ('prs_c2_1', ?, 'Analyse Financière Avancée', 'Finance & Audit', 'Certification', 'CFA Level I Prep', ?, 'trn_c2_luc', 21, 'CERT-LYON-01', 'Suivi en cours', ?)`
  ).run(c2Id, daysAgo(15), daysAgo(15));
  db.prepare(`INSERT INTO prestation_beneficiaries (prestation_id, beneficiary_id, company_id) VALUES ('prs_c2_1', 'ben_c2_1', ?)`).run(c2Id);

  // Questionnaires for Company 1
  const formationQuestions = QUESTION_BANK.filter((q) => q.categoryId !== 'E');
  const certifQuestions = QUESTION_BANK;

  db.prepare(
    `INSERT INTO questionnaires (id, company_id, title, description, target_type, allow_anonymous, active, categories_json, questions_json, created_at)
     VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`
  ).run(
    'qst_formation',
    c1Id,
    'Évaluation Post-Formation Standard (A, B, C, D, F)',
    'Questionnaire complet après réalisation d’une formation professionnelle : satisfaction, formateur, logistique et impact métier.',
    'Formation professionnelle',
    JSON.stringify(['A', 'B', 'C', 'D', 'F']),
    JSON.stringify(formationQuestions),
    daysAgo(120)
  );

  db.prepare(
    `INSERT INTO questionnaires (id, company_id, title, description, target_type, allow_anonymous, active, categories_json, questions_json, created_at)
     VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`
  ).run(
    'qst_certification',
    c1Id,
    'Évaluation Parcours Certification (A à F)',
    'Inclut les critères spécifiques à la préparation et au passage de la certification.',
    'Certification',
    JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F']),
    JSON.stringify(certifQuestions),
    daysAgo(115)
  );

  db.prepare(
    `INSERT INTO questionnaires (id, company_id, title, description, target_type, allow_anonymous, active, categories_json, questions_json, created_at)
     VALUES ('qst_c2_1', ?, 'Enquête Qualité CertiPro', 'Questionnaire post-certification Finance.', 'Certification', 1, 1, ?, ?, ?)`
  ).run(c2Id, JSON.stringify(['A', 'B', 'E']), JSON.stringify(certifQuestions.slice(0, 8)), daysAgo(60));

  // Invitations & Evaluations for Company 1 (realistic spread over 90 days)
  const evalSeeds = [
    // Session 1 - Claire (very positive)
    { inv: 'inv_1', code: 'INV-4001', tok: 'tok-horizon-1001', prs: 'prs_1', qst: 'qst_formation', ben: 'ben_1', trn: 'trn_claire', days: 72, status: 'Répondue', anon: 0, overall: 4.8, trainer: 4.9, nps: 10, comment: 'Excellente pédagogie de Claire, cas pratiques immédiatement applicables avec mon équipe.' },
    { inv: 'inv_2', code: 'INV-4002', tok: 'tok-horizon-1002', prs: 'prs_1', qst: 'qst_formation', ben: 'ben_3', trn: 'trn_claire', days: 71, status: 'Répondue', anon: 0, overall: 4.6, trainer: 4.8, nps: 9, comment: 'Animation dynamique et échanges très constructifs. Supports clairs.' },
    { inv: 'inv_3', code: 'INV-4003', tok: 'tok-horizon-1003', prs: 'prs_1', qst: 'qst_formation', ben: 'ben_5', trn: 'trn_claire', days: 70, status: 'Répondue', anon: 1, overall: 4.5, trainer: 4.7, nps: 9, comment: 'Très bonne maîtrise du sujet et écoute attentive.' },
    { inv: 'inv_4', code: 'INV-4004', tok: 'tok-horizon-1004', prs: 'prs_1', qst: 'qst_formation', ben: 'ben_7', trn: 'trn_claire', days: 69, status: 'Répondue', anon: 0, overall: 4.7, trainer: 4.8, nps: 10, comment: 'Formation structurée, rythme idéal sur 2 jours.' },

    // Session 2 - Karim (mixed + 1 negative about certification logistics & pacing)
    { inv: 'inv_5', code: 'INV-4005', tok: 'tok-horizon-2001', prs: 'prs_2', qst: 'qst_certification', ben: 'ben_2', trn: 'trn_karim', days: 42, status: 'Répondue', anon: 0, overall: 4.3, trainer: 4.6, nps: 8, comment: 'Karim maîtrise parfaitement ISO 27001. Quelques lenteurs administratives sur la convocation examen.' },
    { inv: 'inv_6', code: 'INV-4006', tok: 'tok-horizon-2002', prs: 'prs_2', qst: 'qst_certification', ben: 'ben_4', trn: 'trn_karim', days: 41, status: 'Répondue', anon: 0, overall: 2.3, trainer: 2.8, nps: 3, comment: 'Rythme beaucoup trop rapide en fin de module, manque de disponibilité pour les questions et consignes de certification floues.' },
    { inv: 'inv_7', code: 'INV-4007', tok: 'tok-horizon-2003', prs: 'prs_2', qst: 'qst_certification', ben: 'ben_6', trn: 'trn_karim', days: 40, status: 'Répondue', anon: 0, overall: 3.9, trainer: 4.2, nps: 7, comment: 'Contenu technique solide, mais les supports imprimés manquaient des schémas mis à jour.' },
    { inv: 'inv_8', code: 'INV-4008', tok: 'tok-horizon-2004', prs: 'prs_2', qst: 'qst_certification', ben: 'ben_8', trn: 'trn_karim', days: 39, status: 'Répondue', anon: 1, overall: 3.6, trainer: 4.0, nps: 7, comment: 'Bon formateur technique mais préparation à l’examen blanc trop courte.' },

    // Session 3 - Sophie (high quality)
    { inv: 'inv_9', code: 'INV-4009', tok: 'tok-horizon-3001', prs: 'prs_3', qst: 'qst_certification', ben: 'ben_1', trn: 'trn_sophie', days: 19, status: 'Répondue', anon: 0, overall: 4.7, trainer: 4.8, nps: 9, comment: 'Sophie rend les exigences Qualiopi concrètes et actionnables.' },
    { inv: 'inv_10', code: 'INV-4010', tok: 'tok-horizon-3002', prs: 'prs_3', qst: 'qst_certification', ben: 'ben_5', trn: 'trn_sophie', days: 18, status: 'Répondue', anon: 0, overall: 4.5, trainer: 4.6, nps: 9, comment: 'Accompagnement très rassurant avant le passage de l’audit blanc.' },
    { inv: 'inv_11', code: 'INV-4011', tok: 'tok-horizon-3003', prs: 'prs_3', qst: 'qst_certification', ben: 'ben_7', trn: 'trn_sophie', days: 17, status: 'Répondue', anon: 0, overall: 4.4, trainer: 4.5, nps: 8, comment: 'Exemples d’indicateurs pertinents, organisation impeccable.' },

    // Session 4 - Claire recent + pending invitations for Camille Martin (beneficiary portal demo!)
    { inv: 'inv_12', code: 'INV-4012', tok: 'tok-horizon-4001', prs: 'prs_4', qst: 'qst_formation', ben: 'ben_2', trn: 'trn_claire', days: 7, status: 'Répondue', anon: 0, overall: 4.9, trainer: 5.0, nps: 10, comment: 'Intervention remarquable, outils de feedback directement utilisables.' },
    { inv: 'inv_13', code: 'INV-4013', tok: 'tok-horizon-4002', prs: 'prs_4', qst: 'qst_formation', ben: 'ben_3', trn: 'trn_claire', days: 6, status: 'Ouverte', anon: 0, overall: 0, trainer: 0, nps: null, comment: '' },
    { inv: 'inv_14', code: 'INV-4014', tok: 'tok-horizon-4003', prs: 'prs_4', qst: 'qst_formation', ben: 'ben_1', trn: 'trn_claire', days: 6, status: 'Envoyée', anon: 0, overall: 0, trainer: 0, nps: null, comment: '' },

    // Session 5 - Marc (only 1 response so far -> triggers insufficient sample warning n < 3!)
    { inv: 'inv_15', code: 'INV-4015', tok: 'tok-horizon-5001', prs: 'prs_5', qst: 'qst_certification', ben: 'ben_4', trn: 'trn_marc', days: 2, status: 'Répondue', anon: 0, overall: 3.1, trainer: 3.3, nps: 5, comment: 'Premier retour : bon contenu mais problème de connexion visio le matin.' },
    { inv: 'inv_16', code: 'INV-4016', tok: 'tok-horizon-5002', prs: 'prs_5', qst: 'qst_certification', ben: 'ben_6', trn: 'trn_marc', days: 2, status: 'En attente de réponse', anon: 0, overall: 0, trainer: 0, nps: null, comment: '' },
  ];

  for (const e of evalSeeds) {
    const sentAt = daysAgo(e.days + 1);
    const openedAt = e.status === 'Répondue' || e.status === 'Ouverte' ? daysAgo(e.days) : null;
    const respondedAt = e.status === 'Répondue' ? daysAgo(e.days) : null;
    const expiresAt = daysAgo(e.days - 20);
    db.prepare(
      `INSERT INTO invitations (id, company_id, code, token, prestation_id, questionnaire_id, beneficiary_id, channel, status, scheduled_at, sent_at, opened_at, responded_at, expires_at, allow_anonymous, reminder_count, last_reminder_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'email', ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).run(e.inv, c1Id, e.code, e.tok, e.prs, e.qst, e.ben, e.status, sentAt, openedAt, respondedAt, expiresAt, e.anon, e.status === 'En attente de réponse' ? 1 : 0, sentAt);

    if (e.status === 'Répondue') {
      const sentiment = e.overall >= 4 ? 'positif' : e.overall >= 3 ? 'neutre' : 'négatif';
      const answers = {
        q_a1: { value: Math.round(e.overall), normalizedScore: e.overall },
        q_a2: { value: Math.min(5, Math.max(1, Math.round(e.overall))), normalizedScore: e.overall },
        q_a3: { value: Math.round(e.overall * 2), normalizedScore: e.overall },
        q_a4: { value: e.nps ?? 8, normalizedScore: (e.nps ?? 8) / 2 },
        q_b1: { value: Math.min(5, Math.max(1, Number((e.trainer + 0.1).toFixed(1)))), normalizedScore: Math.min(5, e.trainer + 0.1) },
        q_b2: { value: Math.round(e.trainer), normalizedScore: e.trainer },
        q_b3: { value: Math.round(e.trainer), normalizedScore: e.trainer },
        q_b4: { value: Math.max(1, Math.round(e.trainer - 0.1)), normalizedScore: Math.max(1, e.trainer - 0.1) },
        q_c1: { value: Math.round(e.overall), normalizedScore: e.overall },
        q_c2: { value: Math.max(1, Math.round(e.overall - 0.2)), normalizedScore: Math.max(1, e.overall - 0.2) },
        q_d1: { value: Math.round(e.overall), normalizedScore: e.overall },
        q_f1: { value: e.overall >= 3.5, normalizedScore: e.overall >= 3.5 ? 5 : 2 },
        q_f2: { value: e.comment, normalizedScore: null },
      };
      db.prepare(
        `INSERT INTO evaluations (id, company_id, invitation_id, prestation_id, questionnaire_id, beneficiary_id, is_anonymous, trainer_id, overall_score, trainer_score, nps_score, sentiment, gdpr_consent, answers_json, general_comment, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).run(
        `ev_${e.inv}`,
        c1Id,
        e.inv,
        e.prs,
        e.qst,
        e.anon ? null : e.ben,
        e.anon,
        e.trn,
        e.overall,
        e.trainer,
        e.nps,
        sentiment,
        JSON.stringify(answers),
        e.comment,
        respondedAt
      );
    }
  }

  // Company 2 invitation + evaluation
  db.prepare(
    `INSERT INTO invitations (id, company_id, code, token, prestation_id, questionnaire_id, beneficiary_id, channel, status, sent_at, responded_at, expires_at, allow_anonymous, reminder_count, created_at)
     VALUES ('inv_c2_1', ?, 'INV-9001', 'tok-certipro-9001', 'prs_c2_1', 'qst_c2_1', 'ben_c2_1', 'email', 'Répondue', ?, ?, ?, 0, 0, ?)`
  ).run(c2Id, daysAgo(14), daysAgo(12), daysAgo(-15), daysAgo(14));

  db.prepare(
    `INSERT INTO evaluations (id, company_id, invitation_id, prestation_id, questionnaire_id, beneficiary_id, is_anonymous, trainer_id, overall_score, trainer_score, nps_score, sentiment, gdpr_consent, answers_json, general_comment, submitted_at)
     VALUES ('ev_c2_1', ?, 'inv_c2_1', 'prs_c2_1', 'qst_c2_1', 'ben_c2_1', 0, 'trn_c2_luc', 4.6, 4.7, 9, 'positif', 1, '{}', 'Préparation CFA rigoureuse et claire.', ?)`
  ).run(c2Id, daysAgo(12));

  // Claims for Company 1
  const claimsC1 = [
    {
      id: 'clm_1',
      code: 'REC-2026-001',
      prs: 'prs_2',
      ben: 'ben_4',
      ev: 'ev_inv_6',
      cat: 'Problème de certification',
      desc: "Les modalités d'inscription et le lien de passage de l'examen ISO 27001 n'ont pas été communiqués 48h avant la session d'examen, générant un stress important.",
      priority: 'Urgente',
      status: 'En cours de traitement',
      assigned: 'usr_qm_1',
      res: '',
      postSat: null,
      postCom: '',
      recAt: daysAgo(5),
      resAt: null,
      dueAt: daysAgo(3), // overdue!
    },
    {
      id: 'clm_2',
      code: 'REC-2026-002',
      prs: 'prs_2',
      ben: 'ben_6',
      ev: 'ev_inv_7',
      cat: 'Supports de formation',
      desc: 'Les supports PDF fournis après le séminaire contenaient une version obsolète de la matrice de risques ISO 27001:2013 au lieu de 2022.',
      priority: 'Normale',
      status: 'Résolue',
      assigned: 'usr_qm_1',
      res: 'Envoi de la version actualisée 2022 à l’ensemble de la cohorte CERT-2026-10B et mise à jour du référentiel documentaire.',
      postSat: 1,
      postCom: 'Merci pour la réactivité, le nouveau support est complet.',
      recAt: daysAgo(35),
      resAt: daysAgo(32),
      dueAt: daysAgo(31),
    },
    {
      id: 'clm_3',
      code: 'REC-2026-003',
      prs: 'prs_1',
      ben: 'ben_1',
      ev: null,
      cat: 'Organisation défaillante',
      desc: "Attestation de fin de formation reçue avec une erreur sur l'intitulé de l'entreprise employeur.",
      priority: 'Basse',
      status: 'Clôturée',
      assigned: 'usr_admin_1',
      res: 'Attestation rééditée et transmise par email sous 24h.',
      postSat: 1,
      postCom: 'Correction parfaite.',
      recAt: daysAgo(62),
      resAt: daysAgo(61),
      dueAt: daysAgo(59),
    },
    {
      id: 'clm_4',
      code: 'REC-2026-004',
      prs: 'prs_5',
      ben: 'ben_4',
      ev: 'ev_inv_15',
      cat: 'Organisation défaillante',
      desc: "Lien de visioconférence défectueux durant les 45 premières minutes de la journée d'évaluation PMP.",
      priority: 'Haute',
      status: 'Nouvelle',
      assigned: null,
      res: '',
      postSat: null,
      postCom: '',
      recAt: daysAgo(1),
      resAt: null,
      dueAt: daysAgo(-1),
    },
  ];

  for (const cl of claimsC1) {
    db.prepare(
      `INSERT INTO claims (id, company_id, code, prestation_id, beneficiary_id, evaluation_id, category, description, priority, status, assigned_to_user_id, resolution_summary, post_resolution_satisfied, post_resolution_comment, received_at, resolved_at, due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      cl.id,
      c1Id,
      cl.code,
      cl.prs,
      cl.ben,
      cl.ev,
      cl.cat,
      cl.desc,
      cl.priority,
      cl.status,
      cl.assigned,
      cl.res,
      cl.postSat,
      cl.postCom,
      cl.recAt,
      cl.resAt,
      cl.dueAt
    );

    db.prepare(
      `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
       VALUES (?, ?, ?, 'system', 'Système FormaCare', 'created', ?, 0, ?)`
    ).run(`act_${cl.id}_1`, cl.id, c1Id, `Réclamation enregistrée (${cl.cat} · Priorité ${cl.priority}).`, cl.recAt);

    if (cl.assigned) {
      db.prepare(
        `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
         VALUES (?, ?, ?, 'usr_admin_1', 'Hélène Vasseur', 'assignment', 'Affectée au responsable qualité pour investigation.', 1, ?)`
      ).run(`act_${cl.id}_2`, cl.id, c1Id, cl.recAt);
    }

    if (cl.resAt) {
      db.prepare(
        `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
         VALUES (?, ?, ?, 'usr_qm_1', 'Romain Chevalier', 'resolution', ?, 0, ?)`
      ).run(`act_${cl.id}_3`, cl.id, c1Id, cl.res, cl.resAt);
    }
  }

  // Notifications for Company 1
  const notifs = [
    {
      id: 'ntf_1',
      type: 'urgent_claim',
      title: 'Réclamation urgente en retard de traitement',
      message: 'REC-2026-001 (Problème de certification) dépasse le délai cible de traitement.',
      sec: 'claims',
      lid: 'clm_1',
      read: 0,
      days: 1,
    },
    {
      id: 'ntf_2',
      type: 'new_claim',
      title: 'Nouvelle réclamation reçue',
      message: 'REC-2026-004 déposée par Julien Morel sur Bootcamp Certification PMP.',
      sec: 'claims',
      lid: 'clm_4',
      read: 0,
      days: 1,
    },
    {
      id: 'ntf_3',
      type: 'low_satisfaction',
      title: 'Alerte satisfaction basse détectée',
      message: 'Une évaluation de 2,3/5 a été enregistrée sur Préparation Certification ISO 27001.',
      sec: 'evaluations',
      lid: 'ev_inv_6',
      read: 0,
      days: 3,
    },
    {
      id: 'ntf_4',
      type: 'pending_reminder',
      title: 'Relances en attente',
      message: '3 bénéficiaires n’ont pas encore répondu après 4 jours sur les dernières sessions.',
      sec: 'invitations',
      lid: null,
      read: 1,
      days: 2,
    },
  ];

  for (const n of notifs) {
    db.prepare(
      `INSERT INTO notifications (id, company_id, type, title, message, link_section, link_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(n.id, c1Id, n.type, n.title, n.message, n.sec, n.lid, n.read, daysAgo(n.days));
  }

  // Audit logs
  db.prepare(
    `INSERT INTO audit_logs (id, company_id, user_id, user_name, action, entity_type, entity_id, details, created_at)
     VALUES ('aud_1', ?, 'usr_admin_1', 'Hélène Vasseur', 'CONFIGURATION_INIT', 'company', ?, 'Initialisation de l’espace de démonstration FormaCare', ?)`
  ).run(c1Id, c1Id, daysAgo(140));
  db.prepare(
    `INSERT INTO audit_logs (id, company_id, user_id, user_name, action, entity_type, entity_id, details, created_at)
     VALUES ('aud_2', ?, 'usr_qm_1', 'Romain Chevalier', 'CLAIM_RESOLVED', 'claim', 'clm_2', 'Clôture et envoi du support ISO 27001:2022', ?)`
  ).run(c1Id, daysAgo(32));
}
