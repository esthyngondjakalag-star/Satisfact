import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import db, { initSchema, hashPassword, verifyPassword } from './src/db/database.ts';
import {
  seedDemoDataIfEmpty,
  DEFAULT_CLAIM_CATEGORIES,
  DEFAULT_COMPANY_SETTINGS,
  QUESTION_BANK,
} from './src/db/seed.ts';
import type { UserRole, QuestionItem, EvaluationAnswer } from './src/types.ts';

initSchema();
seedDemoDataIfEmpty();

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'formacare-dev-hmac-secret-2026';

interface AuthContext {
  userId: string;
  companyId: string;
  role: UserRole;
  name: string;
  email: string;
  beneficiaryId: string | null;
  permissions: Record<string, boolean>;
}

interface AuthedRequest extends Request {
  auth?: AuthContext;
}

function signToken(payload: { userId: string; companyId: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): { userId: string; companyId: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.userId || !parsed.companyId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function logAudit(
  companyId: string,
  userId: string,
  userName: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string
): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs (id, company_id, user_id, user_name, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uid('aud'), companyId, userId, userName, action, entityType, entityId, details, new Date().toISOString());
  } catch {
    // Audit logging should never crash primary business transactions
  }
}

function createNotification(
  companyId: string,
  type: string,
  title: string,
  message: string,
  linkSection: string,
  linkId: string | null = null
): void {
  db.prepare(
    `INSERT INTO notifications (id, company_id, type, title, message, link_section, link_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(uid('ntf'), companyId, type, title, message, linkSection, linkId, new Date().toISOString());
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentification requise.' });
    return;
  }
  const verified = verifyToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Session expirée ou invalide.' });
    return;
  }
  const user = db
    .prepare('SELECT id, company_id, name, email, role, permissions_json, is_active, beneficiary_id FROM users WHERE id = ? AND company_id = ?')
    .get(verified.userId, verified.companyId) as any;
  if (!user || !user.is_active) {
    res.status(403).json({ error: 'Compte inactif ou introuvable.' });
    return;
  }
  req.auth = {
    userId: user.id,
    companyId: user.company_id,
    role: user.role,
    name: user.name,
    email: user.email,
    beneficiaryId: user.beneficiary_id || null,
    permissions: JSON.parse(user.permissions_json || '{}'),
  };
  next();
}

function requireStaff(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth || (req.auth.role !== 'admin' && req.auth.role !== 'quality_manager')) {
    res.status(403).json({ error: 'Accès réservé à l’équipe qualité et aux administrateurs.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    return;
  }
  next();
}

function formatCompanyRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isDemo: Boolean(row.is_demo),
    logoUrl: row.logo_url,
    email: row.email,
    phone: row.phone,
    address: row.address,
    website: row.website,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    domains: JSON.parse(row.domains_json || '[]'),
    trainingTypes: JSON.parse(row.training_types_json || '[]'),
    certificationTypes: JSON.parse(row.certification_types_json || '[]'),
    claimCategories: JSON.parse(row.claim_categories_json || '[]'),
    settings: { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(row.settings_json || '{}') },
    createdAt: row.created_at,
  };
}

function formatUserRow(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    email: row.email,
    role: row.role,
    permissions: JSON.parse(row.permissions_json || '{}'),
    isActive: Boolean(row.is_active),
    beneficiaryId: row.beneficiary_id || null,
    createdAt: row.created_at,
  };
}

function normalizeAnswerScore(q: QuestionItem, val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (q.type === 'scale_5' || q.type === 'stars') {
    const n = Number(val);
    return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null;
  }
  if (q.type === 'scale_10') {
    const n = Number(val);
    return Number.isFinite(n) ? Math.min(5, Math.max(0.5, n / 2)) : null;
  }
  if (q.type === 'nps') {
    const n = Number(val);
    return Number.isFinite(n) ? Math.min(5, Math.max(0, n / 2)) : null;
  }
  if (q.type === 'yes_no') {
    return val === true || val === 'Oui' || val === 'yes' ? 5 : 2;
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'FormaCare' });
  });

  // Public demo selector metadata (clearly marked as Demo Accounts)
  app.get('/api/auth/demo-accounts', (_req, res) => {
    const companies = db.prepare('SELECT id, name, slug, is_demo FROM companies WHERE is_demo = 1 ORDER BY created_at ASC').all() as any[];
    const accounts = db
      .prepare(
        `SELECT u.email, u.name, u.role, c.name as company_name, c.id as company_id
         FROM users u JOIN companies c ON u.company_id = c.id
         WHERE c.is_demo = 1 AND u.is_active = 1
         ORDER BY c.created_at ASC, u.role ASC`
      )
      .all() as any[];
    res.json({ companies, accounts });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis.' });
      return;
    }
    const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email) as any;
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Identifiants incorrects.' });
      return;
    }
    if (!user.is_active) {
      res.status(403).json({ error: 'Ce compte utilisateur est désactivé.' });
      return;
    }
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(user.company_id) as any;
    const token = signToken({
      userId: user.id,
      companyId: user.company_id,
      exp: Date.now() + 7 * 24 * 3600 * 1000,
    });
    logAudit(user.company_id, user.id, user.name, 'USER_LOGIN', 'user', user.id, `Connexion (${user.role})`);
    res.json({
      token,
      user: formatUserRow(user),
      company: formatCompanyRow(company),
    });
  });

  // Register a brand new clean production company workspace (ZERO fake data!)
  app.post('/api/auth/register-company', (req, res) => {
    const companyName = String(req.body?.companyName || '').trim();
    const adminName = String(req.body?.adminName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!companyName || !adminName || !email || password.length < 6) {
      res.status(400).json({ error: 'Veuillez renseigner tous les champs (mot de passe min. 6 caractères).' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
      return;
    }
    const companyId = uid('comp');
    const userId = uid('usr');
    const slugBase = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${slugBase || 'entreprise'}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();

    const adminPerm = JSON.stringify({
      canManageQuestionnaires: true,
      canExportReports: true,
      canManageTrainers: true,
      canManageClaims: true,
      canImportData: true,
    });

    db.prepare(
      `INSERT INTO companies (id, name, slug, is_demo, logo_url, email, phone, address, website, primary_color, secondary_color, domains_json, training_types_json, certification_types_json, claim_categories_json, settings_json, created_at)
       VALUES (?, ?, ?, 0, '', ?, '', '', '', '#16834B', '#E8F5ED', ?, ?, ?, ?, ?, ?)`
    ).run(
      companyId,
      companyName,
      slug,
      email,
      JSON.stringify(['Formation continue', 'Certification métier']),
      JSON.stringify(['Formation professionnelle', 'Certification', 'Atelier']),
      JSON.stringify(['Certification professionnelle']),
      JSON.stringify(DEFAULT_CLAIM_CATEGORIES),
      JSON.stringify(DEFAULT_COMPANY_SETTINGS),
      now
    );

    db.prepare(
      `INSERT INTO users (id, company_id, name, email, password_hash, role, permissions_json, is_active, beneficiary_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'admin', ?, 1, NULL, ?)`
    ).run(userId, companyId, adminName, email, hashPassword(password), adminPerm, now);

    // Create 1 blank starter questionnaire template structure so admin can immediately edit or add, with 0 fake evaluations
    db.prepare(
      `INSERT INTO questionnaires (id, company_id, title, description, target_type, allow_anonymous, active, categories_json, questions_json, created_at)
       VALUES (?, ?, 'Questionnaire Post-Prestation Standard', 'Modèle de base prêt à personnaliser pour vos formations et certifications.', 'Mixte', 1, 1, ?, ?, ?)`
    ).run(
      uid('qst'),
      companyId,
      JSON.stringify(['A', 'B', 'C', 'D', 'F']),
      JSON.stringify(QUESTION_BANK.filter((q) => q.categoryId !== 'E')),
      now
    );

    logAudit(companyId, userId, adminName, 'COMPANY_CREATED', 'company', companyId, `Création de l’espace production ${companyName}`);

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const token = signToken({
      userId,
      companyId,
      exp: Date.now() + 7 * 24 * 3600 * 1000,
    });
    res.status(201).json({
      token,
      user: formatUserRow(user),
      company: formatCompanyRow(company),
    });
  });

  // Current session info
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth!.userId) as any;
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.auth!.companyId) as any;
    res.json({
      user: formatUserRow(user),
      company: formatCompanyRow(company),
    });
  });

  // ---------------- PUBLIC TOKEN-BASED SURVEY PORTAL ----------------
  app.get('/api/public/survey/:token', (req, res) => {
    const token = String(req.params.token || '').trim();
    const inv = db.prepare('SELECT * FROM invitations WHERE token = ?').get(token) as any;
    if (!inv) {
      res.status(404).json({ error: 'Lien d’enquête introuvable ou invalide.' });
      return;
    }
    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now() && inv.status !== 'Répondue') {
      db.prepare("UPDATE invitations SET status = 'Expirée' WHERE id = ?").run(inv.id);
      inv.status = 'Expirée';
    }
    if (inv.status === 'Expirée') {
      res.status(410).json({ error: 'Cette invitation d’enquête a expiré.', status: 'Expirée' });
      return;
    }
    if (inv.status === 'Répondue') {
      res.status(409).json({ error: 'Une évaluation a déjà été soumise via ce lien unique.', status: 'Répondue' });
      return;
    }

    // Mark as opened if previously pending/sent
    if (inv.status === 'À envoyer' || inv.status === 'Envoyée' || inv.status === 'En attente de réponse') {
      db.prepare("UPDATE invitations SET status = 'Ouverte', opened_at = COALESCE(opened_at, ?) WHERE id = ?").run(
        new Date().toISOString(),
        inv.id
      );
    }

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(inv.company_id) as any;
    const prestation = db
      .prepare(
        `SELECT p.*, t.name as trainer_name, t.specialty as trainer_specialty, t.photo_url as trainer_photo
         FROM prestations p JOIN trainers t ON p.trainer_id = t.id WHERE p.id = ?`
      )
      .get(inv.prestation_id) as any;
    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(inv.questionnaire_id) as any;
    const beneficiary = inv.beneficiary_id
      ? (db.prepare('SELECT id, first_name, last_name, company_name FROM beneficiaries WHERE id = ?').get(inv.beneficiary_id) as any)
      : null;

    res.json({
      invitation: {
        id: inv.id,
        code: inv.code,
        token: inv.token,
        allowAnonymous: Boolean(inv.allow_anonymous),
        status: inv.status,
        expiresAt: inv.expires_at,
      },
      company: {
        id: company.id,
        name: company.name,
        logoUrl: company.logo_url,
        primaryColor: company.primary_color,
        secondaryColor: company.secondary_color,
        gdprConsentText: JSON.parse(company.settings_json || '{}').gdprConsentText || DEFAULT_COMPANY_SETTINGS.gdprConsentText,
        allowAnonymous: Boolean(JSON.parse(company.settings_json || '{}').allowAnonymous ?? true),
      },
      prestation: {
        id: prestation.id,
        title: prestation.title,
        type: prestation.type,
        certificationName: prestation.certification_name,
        realizedAt: prestation.realized_at,
        sessionCode: prestation.session_code,
        trainerName: prestation.trainer_name,
        trainerSpecialty: prestation.trainer_specialty,
        trainerPhoto: prestation.trainer_photo,
      },
      questionnaire: {
        id: questionnaire.id,
        title: questionnaire.title,
        description: questionnaire.description,
        allowAnonymous: Boolean(questionnaire.allow_anonymous),
        questions: JSON.parse(questionnaire.questions_json || '[]'),
      },
      beneficiary: beneficiary
        ? { id: beneficiary.id, name: `${beneficiary.first_name} ${beneficiary.last_name}`, companyName: beneficiary.company_name }
        : null,
    });
  });

  app.post('/api/public/survey/:token/submit', (req, res) => {
    const token = String(req.params.token || '').trim();
    const inv = db.prepare('SELECT * FROM invitations WHERE token = ?').get(token) as any;
    if (!inv) {
      res.status(404).json({ error: 'Invitation introuvable.' });
      return;
    }
    if (inv.status === 'Répondue') {
      res.status(409).json({ error: 'Soumission multiple refusée : cette enquête a déjà été complétée.' });
      return;
    }
    if (inv.status === 'Expirée' || (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now())) {
      res.status(410).json({ error: 'Cette enquête est expirée.' });
      return;
    }

    const gdprConsent = Boolean(req.body?.gdprConsent);
    if (!gdprConsent) {
      res.status(400).json({ error: 'Le consentement RGPD est obligatoire pour enregistrer votre évaluation.' });
      return;
    }

    const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE id = ?').get(inv.questionnaire_id) as any;
    const prestation = db.prepare('SELECT * FROM prestations WHERE id = ?').get(inv.prestation_id) as any;
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(inv.company_id) as any;
    const settings = { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(company.settings_json || '{}') };
    const questions: QuestionItem[] = JSON.parse(questionnaire.questions_json || '[]');
    const rawAnswers = (req.body?.answers || {}) as Record<string, EvaluationAnswer>;
    const generalComment = String(req.body?.generalComment || '').trim();
    const requestedAnonymous = Boolean(req.body?.isAnonymous);
    const isAnonymous = (!inv.beneficiary_id || requestedAnonymous) && Boolean(questionnaire.allow_anonymous || inv.allow_anonymous);

    // Validate required questions and required comments
    for (const q of questions) {
      const ans = rawAnswers[q.id];
      const val = ans?.value;
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (q.required && isEmpty) {
        res.status(400).json({ error: `Veuillez répondre à la question obligatoire : "${q.label}"` });
        return;
      }
      if (q.commentMode === 'required' && !String(ans?.comment || '').trim()) {
        res.status(400).json({ error: `Un commentaire justificatif est requis pour : "${q.label}"` });
        return;
      }
    }

    // Calculate weighted overallScore & trainerScore & NPS
    let overallWeightedSum = 0;
    let overallWeightTotal = 0;
    let trainerWeightedSum = 0;
    let trainerWeightTotal = 0;
    let npsScore: number | null = null;
    const processedAnswers: Record<string, EvaluationAnswer> = {};

    for (const q of questions) {
      const ans = rawAnswers[q.id];
      if (!ans) continue;
      const norm = normalizeAnswerScore(q, ans.value);
      processedAnswers[q.id] = {
        value: ans.value,
        normalizedScore: norm,
        comment: ans.comment ? String(ans.comment).trim() : undefined,
      };
      if (q.type === 'nps' && ans.value !== undefined && ans.value !== '') {
        const n = Number(ans.value);
        if (Number.isFinite(n)) npsScore = Math.min(10, Math.max(0, Math.round(n)));
      }
      if (norm !== null && q.weight > 0) {
        overallWeightedSum += norm * q.weight;
        overallWeightTotal += q.weight;
        if (q.categoryId === 'B' || q.trainerDimension) {
          trainerWeightedSum += norm * q.weight;
          trainerWeightTotal += q.weight;
        }
      }
    }

    const overallScore = overallWeightTotal > 0 ? Number((overallWeightedSum / overallWeightTotal).toFixed(2)) : 4.0;
    const trainerScore = trainerWeightTotal > 0 ? Number((trainerWeightedSum / trainerWeightTotal).toFixed(2)) : overallScore;
    const sentiment = overallScore >= 4.0 ? 'positif' : overallScore >= 3.0 ? 'neutre' : 'négatif';

    const now = new Date().toISOString();
    const evalId = uid('ev');

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO evaluations (id, company_id, invitation_id, prestation_id, questionnaire_id, beneficiary_id, is_anonymous, trainer_id, overall_score, trainer_score, nps_score, sentiment, gdpr_consent, answers_json, general_comment, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).run(
        evalId,
        inv.company_id,
        inv.id,
        inv.prestation_id,
        inv.questionnaire_id,
        isAnonymous ? null : inv.beneficiary_id,
        isAnonymous ? 1 : 0,
        prestation.trainer_id,
        overallScore,
        trainerScore,
        npsScore,
        sentiment,
        JSON.stringify(processedAnswers),
        generalComment,
        now
      );

      db.prepare("UPDATE invitations SET status = 'Répondue', responded_at = ? WHERE id = ?").run(now, inv.id);
      db.prepare("UPDATE prestations SET follow_up_status = 'Suivi en cours' WHERE id = ? AND follow_up_status IN ('À enquêter', 'Enquête envoyée')").run(
        inv.prestation_id
      );

      if (overallScore < Number(settings.lowSatisfactionThreshold || 3.2)) {
        createNotification(
          inv.company_id,
          'low_satisfaction',
          'Alerte satisfaction basse détectée',
          `Une évaluation de ${overallScore}/5 a été soumise sur "${prestation.title}".`,
          'evaluations',
          evalId
        );
      }

      // Optional automatic claim creation if beneficiary requested follow-up complaint on submission
      const fileClaim = Boolean(req.body?.fileClaim);
      const claimCategory = String(req.body?.claimCategory || 'Insatisfaction générale');
      const claimDescription = String(req.body?.claimDescription || '').trim();
      if (fileClaim && claimDescription) {
        const claimId = uid('clm');
        const claimCount = (
          db.prepare('SELECT COUNT(*) as cnt FROM claims WHERE company_id = ?').get(inv.company_id) as { cnt: number }
        ).cnt;
        const claimCode = `REC-${new Date().getFullYear()}-${String(claimCount + 1).padStart(3, '0')}`;
        const priority = overallScore < 2.5 ? 'Urgente' : 'Haute';
        const dueAt = new Date(Date.now() + 2 * 86400 * 1000).toISOString();
        db.prepare(
          `INSERT INTO claims (id, company_id, code, prestation_id, beneficiary_id, evaluation_id, category, description, priority, status, assigned_to_user_id, resolution_summary, received_at, due_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Nouvelle', NULL, '', ?, ?)`
        ).run(
          claimId,
          inv.company_id,
          claimCode,
          inv.prestation_id,
          isAnonymous ? null : inv.beneficiary_id,
          evalId,
          claimCategory,
          claimDescription,
          priority,
          now,
          dueAt
        );
        db.prepare(
          `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
           VALUES (?, ?, ?, 'beneficiary', 'Bénéficiaire', 'created', ?, 0, ?)`
        ).run(uid('act'), claimId, inv.company_id, `Réclamation déposée suite à l’évaluation (${claimCategory}).`, now);

        createNotification(
          inv.company_id,
          priority === 'Urgente' ? 'urgent_claim' : 'new_claim',
          `Nouvelle réclamation (${claimCode})`,
          `Déposée lors de l'évaluation de "${prestation.title}".`,
          'claims',
          claimId
        );
      }
    });

    tx();
    res.status(201).json({
      success: true,
      evaluationId: evalId,
      overallScore,
      sentiment,
    });
  });

  // ---------------- BENEFICIARY PORTAL (ROLE: beneficiary) ----------------
  app.get('/api/beneficiary/portal', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    if (auth.role !== 'beneficiary') {
      res.status(403).json({ error: 'Route réservée à l’espace bénéficiaire.' });
      return;
    }
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(auth.companyId) as any;
    const settings = { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(company.settings_json || '{}') };

    const benId = auth.beneficiaryId;
    if (!benId) {
      res.json({ invitations: [], prestations: [], claims: [], canViewClaims: settings.beneficiaryCanViewClaims });
      return;
    }

    const invitations = db
      .prepare(
        `SELECT i.*, p.title as prestation_title, p.realized_at, t.name as trainer_name, q.title as questionnaire_title
         FROM invitations i
         JOIN prestations p ON i.prestation_id = p.id
         JOIN trainers t ON p.trainer_id = t.id
         JOIN questionnaires q ON i.questionnaire_id = q.id
         WHERE i.company_id = ? AND i.beneficiary_id = ?
         ORDER BY i.created_at DESC`
      )
      .all(auth.companyId, benId)
      .map((r: any) => ({
        id: r.id,
        code: r.code,
        token: r.token,
        prestationId: r.prestation_id,
        prestationTitle: r.prestation_title,
        realizedAt: r.realized_at,
        trainerName: r.trainer_name,
        questionnaireTitle: r.questionnaire_title,
        status: r.status,
        respondedAt: r.responded_at,
        expiresAt: r.expires_at,
      }));

    const prestations = db
      .prepare(
        `SELECT p.id, p.title, p.type, p.certification_name, p.realized_at, p.session_code, t.name as trainer_name
         FROM prestations p
         JOIN prestation_beneficiaries pb ON p.id = pb.prestation_id
         JOIN trainers t ON p.trainer_id = t.id
         WHERE p.company_id = ? AND pb.beneficiary_id = ?
         ORDER BY p.realized_at DESC`
      )
      .all(auth.companyId, benId);

    const claims = settings.beneficiaryCanViewClaims
      ? db
          .prepare(
            `SELECT c.id, c.code, c.category, c.description, c.priority, c.status, c.resolution_summary, c.post_resolution_satisfied, c.post_resolution_comment, c.received_at, c.resolved_at, p.title as prestation_title
             FROM claims c
             JOIN prestations p ON c.prestation_id = p.id
             WHERE c.company_id = ? AND c.beneficiary_id = ?
             ORDER BY c.received_at DESC`
          )
          .all(auth.companyId, benId)
      : [];

    res.json({
      invitations,
      prestations,
      claims,
      claimCategories: JSON.parse(company.claim_categories_json || '[]'),
      canViewClaims: Boolean(settings.beneficiaryCanViewClaims),
    });
  });

  app.post('/api/beneficiary/claims', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    if (auth.role !== 'beneficiary' || !auth.beneficiaryId) {
      res.status(403).json({ error: 'Accès non autorisé.' });
      return;
    }
    const prestationId = String(req.body?.prestationId || '');
    const category = String(req.body?.category || '');
    const description = String(req.body?.description || '').trim();
    const priority = String(req.body?.priority || 'Normale');
    if (!prestationId || !category || description.length < 10) {
      res.status(400).json({ error: 'Veuillez sélectionner une prestation, une catégorie et décrire votre demande (min. 10 caractères).' });
      return;
    }
    const link = db
      .prepare('SELECT 1 FROM prestation_beneficiaries WHERE company_id = ? AND prestation_id = ? AND beneficiary_id = ?')
      .get(auth.companyId, prestationId, auth.beneficiaryId);
    if (!link) {
      res.status(403).json({ error: 'Prestation non associée à votre profil.' });
      return;
    }
    const claimId = uid('clm');
    const claimCount = (db.prepare('SELECT COUNT(*) as cnt FROM claims WHERE company_id = ?').get(auth.companyId) as { cnt: number }).cnt;
    const code = `REC-${new Date().getFullYear()}-${String(claimCount + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const dueAt = new Date(Date.now() + 3 * 86400 * 1000).toISOString();

    db.prepare(
      `INSERT INTO claims (id, company_id, code, prestation_id, beneficiary_id, evaluation_id, category, description, priority, status, assigned_to_user_id, resolution_summary, received_at, due_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'Nouvelle', NULL, '', ?, ?)`
    ).run(claimId, auth.companyId, code, prestationId, auth.beneficiaryId, category, description, priority, now, dueAt);

    db.prepare(
      `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, 'created', ?, 0, ?)`
    ).run(uid('act'), claimId, auth.companyId, auth.userId, auth.name, `Réclamation déposée depuis l’Espace Bénéficiaire (${category}).`, now);

    createNotification(
      auth.companyId,
      priority === 'Urgente' ? 'urgent_claim' : 'new_claim',
      `Nouvelle réclamation (${code})`,
      `${auth.name} a déposé une réclamation (${category}).`,
      'claims',
      claimId
    );
    logAudit(auth.companyId, auth.userId, auth.name, 'CLAIM_CREATED', 'claim', claimId, code);
    res.status(201).json({ id: claimId, code });
  });

  app.post('/api/beneficiary/claims/:id/verify', requireAuth, (req: AuthedRequest, res) => {
    const auth = req.auth!;
    if (auth.role !== 'beneficiary' || !auth.beneficiaryId) {
      res.status(403).json({ error: 'Accès non autorisé.' });
      return;
    }
    const claim = db
      .prepare('SELECT * FROM claims WHERE id = ? AND company_id = ? AND beneficiary_id = ?')
      .get(req.params.id, auth.companyId, auth.beneficiaryId) as any;
    if (!claim) {
      res.status(404).json({ error: 'Réclamation introuvable.' });
      return;
    }
    const satisfied = Boolean(req.body?.satisfied);
    const comment = String(req.body?.comment || '').trim();
    const now = new Date().toISOString();
    const nextStatus = satisfied ? 'Clôturée' : 'En cours de traitement';

    db.prepare(
      `UPDATE claims SET post_resolution_satisfied = ?, post_resolution_comment = ?, status = ? WHERE id = ?`
    ).run(satisfied ? 1 : 0, comment, nextStatus, claim.id);

    db.prepare(
      `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, 'verification', ?, 0, ?)`
    ).run(
      uid('act'),
      claim.id,
      auth.companyId,
      auth.userId,
      auth.name,
      `Vérification après résolution : ${satisfied ? 'Satisfait (clôture confirmée)' : 'Insatisfait (réouverture demandée)'}${comment ? ` — "${comment}"` : ''}`,
      now
    );

    res.json({ success: true, status: nextStatus });
  });

  // ---------------- STAFF ROUTES (ADMIN & QUALITY MANAGER) ----------------
  // Beneficiaries
  app.get('/api/beneficiaries', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const rows = db
      .prepare(
        `SELECT b.*,
          (SELECT COUNT(*) FROM prestation_beneficiaries pb WHERE pb.beneficiary_id = b.id AND pb.company_id = b.company_id) as prestation_count,
          (SELECT COUNT(*) FROM evaluations e WHERE e.beneficiary_id = b.id AND e.company_id = b.company_id) as evaluation_count,
          (SELECT overall_score FROM evaluations e WHERE e.beneficiary_id = b.id AND e.company_id = b.company_id ORDER BY e.submitted_at DESC LIMIT 1) as last_score
         FROM beneficiaries b
         WHERE b.company_id = ?
         ORDER BY b.created_at DESC`
      )
      .all(companyId) as any[];

    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        uniqueCode: r.unique_code,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        phone: r.phone,
        companyName: r.company_name,
        createdAt: r.created_at,
        prestationCount: r.prestation_count,
        evaluationCount: r.evaluation_count,
        lastScore: r.last_score,
      }))
    );
  });

  app.post('/api/beneficiaries', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const companyName = String(req.body?.companyName || '').trim();

    if (!firstName || !lastName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Prénom, nom et email valide sont obligatoires.' });
      return;
    }
    const dup = db.prepare('SELECT id FROM beneficiaries WHERE company_id = ? AND lower(email) = ?').get(companyId, email);
    if (dup) {
      res.status(409).json({ error: 'Un bénéficiaire avec cet email existe déjà dans votre entreprise.' });
      return;
    }
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM beneficiaries WHERE company_id = ?').get(companyId) as { cnt: number }).cnt;
    const id = uid('ben');
    const uniqueCode = `BEN-${1001 + count}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO beneficiaries (id, company_id, unique_code, first_name, last_name, email, phone, company_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, companyId, uniqueCode, firstName, lastName, email, phone, companyName, now);

    logAudit(companyId, req.auth!.userId, req.auth!.name, 'BENEFICIARY_CREATED', 'beneficiary', id, `${firstName} ${lastName} (${email})`);
    res.status(201).json({
      id,
      companyId,
      uniqueCode,
      firstName,
      lastName,
      email,
      phone,
      companyName,
      createdAt: now,
      prestationCount: 0,
      evaluationCount: 0,
      lastScore: null,
    });
  });

  app.put('/api/beneficiaries/:id', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const firstName = String(req.body?.firstName || '').trim();
    const lastName = String(req.body?.lastName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const companyName = String(req.body?.companyName || '').trim();
    if (!firstName || !lastName || !email) {
      res.status(400).json({ error: 'Champs requis manquants.' });
      return;
    }
    const result = db
      .prepare(
        `UPDATE beneficiaries SET first_name = ?, last_name = ?, email = ?, phone = ?, company_name = ?
         WHERE id = ? AND company_id = ?`
      )
      .run(firstName, lastName, email, phone, companyName, req.params.id, companyId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Bénéficiaire introuvable.' });
      return;
    }
    res.json({ success: true });
  });

  app.get('/api/beneficiaries/:id/history', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const benId = req.params.id;
    const prestations = db
      .prepare(
        `SELECT p.*, t.name as trainer_name
         FROM prestations p
         JOIN prestation_beneficiaries pb ON p.id = pb.prestation_id
         JOIN trainers t ON p.trainer_id = t.id
         WHERE pb.beneficiary_id = ? AND p.company_id = ?
         ORDER BY p.realized_at DESC`
      )
      .all(benId, companyId);
    const evaluations = db
      .prepare(
        `SELECT e.*, p.title as prestation_title
         FROM evaluations e
         JOIN prestations p ON e.prestation_id = p.id
         WHERE e.beneficiary_id = ? AND e.company_id = ? AND e.is_anonymous = 0
         ORDER BY e.submitted_at DESC`
      )
      .all(benId, companyId);
    const claims = db
      .prepare(
        `SELECT c.*, p.title as prestation_title
         FROM claims c
         JOIN prestations p ON c.prestation_id = p.id
         WHERE c.beneficiary_id = ? AND c.company_id = ?
         ORDER BY c.received_at DESC`
      )
      .all(benId, companyId);
    res.json({ prestations, evaluations, claims });
  });

  // Batch Excel/CSV Import for Beneficiaries & Prestations
  app.post('/api/beneficiaries/import', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    if (req.auth!.role === 'quality_manager' && req.auth!.permissions.canImportData === false) {
      res.status(403).json({ error: "Vous n'avez pas la permission d'importer des données." });
      return;
    }
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      res.status(400).json({ error: 'Aucune ligne à importer.' });
      return;
    }
    const duplicateMode = req.body?.duplicateMode === 'update' ? 'update' : 'skip';
    const now = new Date().toISOString();

    let importedBeneficiaries = 0;
    let updatedBeneficiaries = 0;
    let importedPrestations = 0;
    let linkedCount = 0;
    let duplicatesSkipped = 0;
    const errors: Array<{ rowNumber: number; email: string; reason: string }> = [];

    const existingTrainers = db.prepare('SELECT id, name FROM trainers WHERE company_id = ?').all(companyId) as any[];
    let defaultTrainerId = existingTrainers[0]?.id;

    const tx = db.transaction(() => {
      let benCounter = (db.prepare('SELECT COUNT(*) as cnt FROM beneficiaries WHERE company_id = ?').get(companyId) as { cnt: number }).cnt;

      rows.forEach((row: any, idx: number) => {
        const rowNum = idx + 1;
        const firstName = String(row.firstName || '').trim();
        const lastName = String(row.lastName || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const phone = String(row.phone || '').trim();
        const companyName = String(row.companyName || '').trim();
        const prestationTitle = String(row.prestationTitle || '').trim();
        const domain = String(row.domain || 'Formation continue').trim();
        const type = String(row.type || 'Formation professionnelle').trim();
        const realizedAtRaw = String(row.realizedAt || '').trim();
        const trainerName = String(row.trainerName || '').trim();
        const durationHours = Number(row.durationHours || 7);
        const sessionCode = String(row.sessionCode || '').trim();

        if (!firstName || !lastName) {
          errors.push({ rowNumber: rowNum, email, reason: 'Nom ou prénom manquant' });
          return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({ rowNumber: rowNum, email: email || '(vide)', reason: 'Adresse email absente ou invalide' });
          return;
        }

        let ben = db.prepare('SELECT id FROM beneficiaries WHERE company_id = ? AND lower(email) = ?').get(companyId, email) as any;
        if (ben) {
          if (duplicateMode === 'update') {
            db.prepare('UPDATE beneficiaries SET first_name = ?, last_name = ?, phone = ?, company_name = ? WHERE id = ?').run(
              firstName,
              lastName,
              phone,
              companyName,
              ben.id
            );
            updatedBeneficiaries++;
          } else {
            duplicatesSkipped++;
          }
        } else {
          benCounter++;
          const benId = uid('ben');
          db.prepare(
            `INSERT INTO beneficiaries (id, company_id, unique_code, first_name, last_name, email, phone, company_name, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(benId, companyId, `BEN-${1000 + benCounter}`, firstName, lastName, email, phone, companyName, now);
          ben = { id: benId };
          importedBeneficiaries++;
        }

        // Optional prestation linked in row
        if (prestationTitle) {
          let trainerId = defaultTrainerId;
          if (trainerName) {
            const matched = existingTrainers.find((t) => t.name.toLowerCase() === trainerName.toLowerCase());
            if (matched) {
              trainerId = matched.id;
            } else {
              const newTrnId = uid('trn');
              db.prepare(
                `INSERT INTO trainers (id, company_id, name, email, specialty, bio, photo_url, active, created_at)
                 VALUES (?, ?, ?, '', ?, '', '', 1, ?)`
              ).run(newTrnId, companyId, trainerName, domain, now);
              existingTrainers.push({ id: newTrnId, name: trainerName });
              trainerId = newTrnId;
            }
          }
          if (!trainerId) {
            const newTrnId = uid('trn');
            db.prepare(
              `INSERT INTO trainers (id, company_id, name, email, specialty, bio, photo_url, active, created_at)
               VALUES (?, ?, 'Formateur Référent', '', ?, '', '', 1, ?)`
            ).run(newTrnId, companyId, domain, now);
            existingTrainers.push({ id: newTrnId, name: 'Formateur Référent' });
            trainerId = newTrnId;
            defaultTrainerId = newTrnId;
          }

          let realizedAtIso = now;
          if (realizedAtRaw) {
            const d = new Date(realizedAtRaw);
            if (!Number.isNaN(d.getTime())) {
              realizedAtIso = d.toISOString();
            } else {
              errors.push({ rowNumber: rowNum, email, reason: `Format de date invalide ("${realizedAtRaw}")` });
              return;
            }
          }

          const existingPrs = db
            .prepare(
              `SELECT id FROM prestations WHERE company_id = ? AND lower(title) = ? AND lower(session_code) = ?`
            )
            .get(companyId, prestationTitle.toLowerCase(), sessionCode.toLowerCase()) as any;

          let prsId = existingPrs?.id;
          if (!prsId) {
            prsId = uid('prs');
            db.prepare(
              `INSERT INTO prestations (id, company_id, title, domain, type, certification_name, realized_at, trainer_id, duration_hours, session_code, follow_up_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'À enquêter', ?)`
            ).run(
              prsId,
              companyId,
              prestationTitle,
              domain,
              type,
              type.toLowerCase().includes('certif') ? prestationTitle : '',
              realizedAtIso,
              trainerId,
              Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 7,
              sessionCode || `IMP-${new Date().getFullYear()}`,
              now
            );
            importedPrestations++;
          }

          const alreadyLinked = db
            .prepare('SELECT 1 FROM prestation_beneficiaries WHERE prestation_id = ? AND beneficiary_id = ?')
            .get(prsId, ben.id);
          if (!alreadyLinked) {
            db.prepare(
              `INSERT INTO prestation_beneficiaries (prestation_id, beneficiary_id, company_id) VALUES (?, ?, ?)`
            ).run(prsId, ben.id, companyId);
            linkedCount++;
          }
        }
      });
    });

    tx();
    logAudit(
      companyId,
      req.auth!.userId,
      req.auth!.name,
      'DATA_IMPORT',
      'beneficiary',
      companyId,
      `Import: ${importedBeneficiaries} bénéficiaires, ${importedPrestations} prestations, ${errors.length} erreurs`
    );

    res.json({
      totalRows: rows.length,
      importedBeneficiaries,
      updatedBeneficiaries,
      importedPrestations,
      linkedCount,
      duplicatesSkipped,
      rejectedCount: errors.length,
      errors,
    });
  });

  // Prestations
  app.get('/api/prestations', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const rows = db
      .prepare(
        `SELECT p.*, t.name as trainer_name
         FROM prestations p
         LEFT JOIN trainers t ON p.trainer_id = t.id
         WHERE p.company_id = ?
         ORDER BY p.realized_at DESC`
      )
      .all(companyId) as any[];

    const links = db
      .prepare('SELECT prestation_id, beneficiary_id FROM prestation_beneficiaries WHERE company_id = ?')
      .all(companyId) as any[];
    const linkMap = new Map<string, string[]>();
    for (const l of links) {
      const arr = linkMap.get(l.prestation_id) || [];
      arr.push(l.beneficiary_id);
      linkMap.set(l.prestation_id, arr);
    }

    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        title: r.title,
        domain: r.domain,
        type: r.type,
        certificationName: r.certification_name,
        realizedAt: r.realized_at,
        trainerId: r.trainer_id,
        trainerName: r.trainer_name || 'Non assigné',
        durationHours: r.duration_hours,
        sessionCode: r.session_code,
        followUpStatus: r.follow_up_status,
        beneficiaryIds: linkMap.get(r.id) || [],
        createdAt: r.created_at,
      }))
    );
  });

  app.post('/api/prestations', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const title = String(req.body?.title || '').trim();
    const domain = String(req.body?.domain || '').trim();
    const type = String(req.body?.type || 'Formation professionnelle').trim();
    const certificationName = String(req.body?.certificationName || '').trim();
    const realizedAt = String(req.body?.realizedAt || new Date().toISOString());
    const trainerId = String(req.body?.trainerId || '');
    const durationHours = Number(req.body?.durationHours || 7);
    const sessionCode = String(req.body?.sessionCode || '').trim();
    const beneficiaryIds: string[] = Array.isArray(req.body?.beneficiaryIds) ? req.body.beneficiaryIds : [];

    if (!title || !domain || !trainerId) {
      res.status(400).json({ error: 'Intitulé, domaine et formateur sont obligatoires.' });
      return;
    }

    const id = uid('prs');
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO prestations (id, company_id, title, domain, type, certification_name, realized_at, trainer_id, duration_hours, session_code, follow_up_status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'À enquêter', ?)`
      ).run(id, companyId, title, domain, type, certificationName, realizedAt, trainerId, durationHours, sessionCode, now);

      for (const bId of beneficiaryIds) {
        db.prepare(
          `INSERT OR IGNORE INTO prestation_beneficiaries (prestation_id, beneficiary_id, company_id) VALUES (?, ?, ?)`
        ).run(id, bId, companyId);
      }
      createNotification(
        companyId,
        'prestation_ready',
        'Prestation prête pour le suivi après-prestation',
        `"${title}" (${sessionCode || 'Session'}) enregistrée : vous pouvez générer les invitations.`,
        'invitations',
        id
      );
    });
    tx();
    logAudit(companyId, req.auth!.userId, req.auth!.name, 'PRESTATION_CREATED', 'prestation', id, title);
    res.status(201).json({ id });
  });

  app.patch('/api/prestations/:id/status', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const status = String(req.body?.followUpStatus || '');
    const allowed = ['À enquêter', 'Enquête envoyée', 'Suivi en cours', 'Clôturée'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: 'Statut de suivi invalide.' });
      return;
    }
    db.prepare('UPDATE prestations SET follow_up_status = ? WHERE id = ? AND company_id = ?').run(status, req.params.id, companyId);
    res.json({ success: true });
  });

  // Trainers & Evaluation Metrics
  app.get('/api/trainers', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const trainers = db.prepare('SELECT * FROM trainers WHERE company_id = ? ORDER BY name ASC').all(companyId) as any[];
    res.json(
      trainers.map((t) => ({
        id: t.id,
        companyId: t.company_id,
        name: t.name,
        email: t.email,
        specialty: t.specialty,
        bio: t.bio,
        photoUrl: t.photo_url,
        active: Boolean(t.active),
        createdAt: t.created_at,
      }))
    );
  });

  app.post('/api/trainers', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    if (req.auth!.role === 'quality_manager' && req.auth!.permissions.canManageTrainers === false) {
      res.status(403).json({ error: "Vous n'avez pas la permission de gérer les formateurs." });
      return;
    }
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const specialty = String(req.body?.specialty || '').trim();
    const bio = String(req.body?.bio || '').trim();
    const photoUrl = String(req.body?.photoUrl || '').trim();
    if (!name || !specialty) {
      res.status(400).json({ error: 'Nom et spécialité obligatoires.' });
      return;
    }
    const id = uid('trn');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO trainers (id, company_id, name, email, specialty, bio, photo_url, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(id, companyId, name, email, specialty, bio, photoUrl, now);
    logAudit(companyId, req.auth!.userId, req.auth!.name, 'TRAINER_CREATED', 'trainer', id, name);
    res.status(201).json({ id, companyId, name, email, specialty, bio, photoUrl, active: true, createdAt: now });
  });

  // Questionnaires
  app.get('/api/questionnaires', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const rows = db.prepare('SELECT * FROM questionnaires WHERE company_id = ? ORDER BY created_at DESC').all(companyId) as any[];
    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        title: r.title,
        description: r.description,
        targetType: r.target_type,
        allowAnonymous: Boolean(r.allow_anonymous),
        active: Boolean(r.active),
        categories: JSON.parse(r.categories_json || '[]'),
        questions: JSON.parse(r.questions_json || '[]'),
        createdAt: r.created_at,
      }))
    );
  });

  app.post('/api/questionnaires', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    if (req.auth!.role === 'quality_manager' && req.auth!.permissions.canManageQuestionnaires === false) {
      res.status(403).json({ error: "Permission insuffisante pour créer un questionnaire." });
      return;
    }
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const targetType = String(req.body?.targetType || 'Mixte');
    const allowAnonymous = req.body?.allowAnonymous !== false;
    const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];

    if (!title || questions.length === 0) {
      res.status(400).json({ error: 'Titre et au moins une question requis.' });
      return;
    }
    const id = uid('qst');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO questionnaires (id, company_id, title, description, target_type, allow_anonymous, active, categories_json, questions_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ).run(id, companyId, title, description, targetType, allowAnonymous ? 1 : 0, JSON.stringify(categories), JSON.stringify(questions), now);

    logAudit(companyId, req.auth!.userId, req.auth!.name, 'QUESTIONNAIRE_CREATED', 'questionnaire', id, title);
    res.status(201).json({ id });
  });

  app.put('/api/questionnaires/:id', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    if (req.auth!.role === 'quality_manager' && req.auth!.permissions.canManageQuestionnaires === false) {
      res.status(403).json({ error: 'Permission insuffisante.' });
      return;
    }
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const targetType = String(req.body?.targetType || 'Mixte');
    const allowAnonymous = req.body?.allowAnonymous !== false;
    const active = req.body?.active !== false;
    const categories = Array.isArray(req.body?.categories) ? req.body.categories : [];
    const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (!title || questions.length === 0) {
      res.status(400).json({ error: 'Titre et questions requis.' });
      return;
    }
    db.prepare(
      `UPDATE questionnaires SET title = ?, description = ?, target_type = ?, allow_anonymous = ?, active = ?, categories_json = ?, questions_json = ?
       WHERE id = ? AND company_id = ?`
    ).run(
      title,
      description,
      targetType,
      allowAnonymous ? 1 : 0,
      active ? 1 : 0,
      JSON.stringify(categories),
      JSON.stringify(questions),
      req.params.id,
      companyId
    );
    res.json({ success: true });
  });

  // Invitations
  app.get('/api/invitations', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const rows = db
      .prepare(
        `SELECT i.*, p.title as prestation_title, q.title as questionnaire_title,
          b.first_name as ben_first, b.last_name as ben_last, b.email as ben_email, b.phone as ben_phone
         FROM invitations i
         LEFT JOIN prestations p ON i.prestation_id = p.id
         LEFT JOIN questionnaires q ON i.questionnaire_id = q.id
         LEFT JOIN beneficiaries b ON i.beneficiary_id = b.id
         WHERE i.company_id = ?
         ORDER BY i.created_at DESC`
      )
      .all(companyId) as any[];

    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        code: r.code,
        token: r.token,
        prestationId: r.prestation_id,
        prestationTitle: r.prestation_title || 'Prestation',
        questionnaireId: r.questionnaire_id,
        questionnaireTitle: r.questionnaire_title || 'Questionnaire',
        beneficiaryId: r.beneficiary_id,
        beneficiaryName: r.ben_first ? `${r.ben_first} ${r.ben_last}` : 'Lien anonyme / ouvert',
        beneficiaryEmail: r.ben_email || '',
        beneficiaryPhone: r.ben_phone || '',
        channel: r.channel,
        status: r.status,
        scheduledAt: r.scheduled_at,
        sentAt: r.sent_at,
        openedAt: r.opened_at,
        respondedAt: r.responded_at,
        expiresAt: r.expires_at,
        allowAnonymous: Boolean(r.allow_anonymous),
        reminderCount: r.reminder_count,
        lastReminderAt: r.last_reminder_at,
        createdAt: r.created_at,
      }))
    );
  });

  app.post('/api/invitations', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const prestationId = String(req.body?.prestationId || '');
    const questionnaireId = String(req.body?.questionnaireId || '');
    const beneficiaryIds: (string | null)[] = Array.isArray(req.body?.beneficiaryIds)
      ? req.body.beneficiaryIds
      : [null];
    const channel = String(req.body?.channel || 'email');
    const allowAnonymous = Boolean(req.body?.allowAnonymous);
    const sendNow = req.body?.sendNow !== false;
    const scheduledAt = req.body?.scheduledAt ? String(req.body.scheduledAt) : null;
    const expiresInDays = Number(req.body?.expiresInDays || 30);

    if (!prestationId || !questionnaireId) {
      res.status(400).json({ error: 'Prestation et questionnaire requis.' });
      return;
    }

    const now = new Date().toISOString();
    const expiresAt = expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86400 * 1000).toISOString() : null;
    let count = (db.prepare('SELECT COUNT(*) as cnt FROM invitations WHERE company_id = ?').get(companyId) as { cnt: number }).cnt;
    const created: any[] = [];

    const tx = db.transaction(() => {
      for (const bId of beneficiaryIds) {
        count++;
        const id = uid('inv');
        const code = `INV-${4000 + count}`;
        const token = `fc-${crypto.randomBytes(8).toString('hex')}`;
        const status = sendNow && !scheduledAt ? 'Envoyée' : 'À envoyer';
        const sentAt = sendNow && !scheduledAt ? now : null;
        db.prepare(
          `INSERT INTO invitations (id, company_id, code, token, prestation_id, questionnaire_id, beneficiary_id, channel, status, scheduled_at, sent_at, opened_at, responded_at, expires_at, allow_anonymous, reminder_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 0, ?)`
        ).run(id, companyId, code, token, prestationId, questionnaireId, bId || null, channel, status, scheduledAt, sentAt, expiresAt, allowAnonymous ? 1 : 0, now);
        created.push({ id, code, token, status });
      }
      if (sendNow && !scheduledAt) {
        db.prepare("UPDATE prestations SET follow_up_status = 'Enquête envoyée' WHERE id = ? AND company_id = ? AND follow_up_status = 'À enquêter'").run(
          prestationId,
          companyId
        );
      }
    });
    tx();
    logAudit(companyId, req.auth!.userId, req.auth!.name, 'INVITATIONS_GENERATED', 'invitation', prestationId, `${created.length} invitation(s) via ${channel}`);
    res.status(201).json({ created });
  });

  app.patch('/api/invitations/:id/action', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const action = String(req.body?.action || '');
    const inv = db.prepare('SELECT * FROM invitations WHERE id = ? AND company_id = ?').get(req.params.id, companyId) as any;
    if (!inv) {
      res.status(404).json({ error: 'Invitation introuvable.' });
      return;
    }
    const now = new Date().toISOString();
    if (action === 'send') {
      db.prepare("UPDATE invitations SET status = 'Envoyée', sent_at = COALESCE(sent_at, ?) WHERE id = ?").run(now, inv.id);
      db.prepare("UPDATE prestations SET follow_up_status = 'Enquête envoyée' WHERE id = ? AND follow_up_status = 'À enquêter'").run(
        inv.prestation_id
      );
    } else if (action === 'remind') {
      if (inv.status === 'Répondue' || inv.status === 'Expirée') {
        res.status(400).json({ error: 'Impossible de relancer une invitation déjà répondue ou expirée.' });
        return;
      }
      db.prepare("UPDATE invitations SET status = 'En attente de réponse', reminder_count = reminder_count + 1, last_reminder_at = ? WHERE id = ?").run(
        now,
        inv.id
      );
    } else if (action === 'expire') {
      db.prepare("UPDATE invitations SET status = 'Expirée' WHERE id = ?").run(inv.id);
    }
    res.json({ success: true });
  });

  // Evaluations
  app.get('/api/evaluations', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const rows = db
      .prepare(
        `SELECT e.*, p.title as prestation_title, p.type as prestation_type, p.certification_name,
          t.name as trainer_name, b.first_name as ben_first, b.last_name as ben_last
         FROM evaluations e
         JOIN prestations p ON e.prestation_id = p.id
         JOIN trainers t ON e.trainer_id = t.id
         LEFT JOIN beneficiaries b ON e.beneficiary_id = b.id
         WHERE e.company_id = ?
         ORDER BY e.submitted_at DESC`
      )
      .all(companyId) as any[];

    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        invitationId: r.invitation_id,
        prestationId: r.prestation_id,
        prestationTitle: r.prestation_title,
        prestationType: r.prestation_type,
        certificationName: r.certification_name,
        questionnaireId: r.questionnaire_id,
        beneficiaryId: r.is_anonymous ? null : r.beneficiary_id,
        beneficiaryName: r.is_anonymous ? 'Participant anonyme' : r.ben_first ? `${r.ben_first} ${r.ben_last}` : 'Participant identifié',
        isAnonymous: Boolean(r.is_anonymous),
        trainerId: r.trainer_id,
        trainerName: r.trainer_name,
        overallScore: r.overall_score,
        trainerScore: r.trainer_score,
        npsScore: r.nps_score,
        sentiment: r.sentiment,
        gdprConsent: Boolean(r.gdpr_consent),
        answers: JSON.parse(r.answers_json || '{}'),
        generalComment: r.general_comment,
        submittedAt: r.submitted_at,
      }))
    );
  });

  // Claims & Actions
  app.get('/api/claims', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const rows = db
      .prepare(
        `SELECT c.*, p.title as prestation_title, b.first_name as ben_first, b.last_name as ben_last, u.name as assigned_name
         FROM claims c
         JOIN prestations p ON c.prestation_id = p.id
         LEFT JOIN beneficiaries b ON c.beneficiary_id = b.id
         LEFT JOIN users u ON c.assigned_to_user_id = u.id
         WHERE c.company_id = ?
         ORDER BY c.received_at DESC`
      )
      .all(companyId) as any[];

    const actions = db
      .prepare('SELECT * FROM claim_actions WHERE company_id = ? ORDER BY created_at ASC')
      .all(companyId) as any[];
    const actMap = new Map<string, any[]>();
    for (const a of actions) {
      const list = actMap.get(a.claim_id) || [];
      list.push({
        id: a.id,
        claimId: a.claim_id,
        userId: a.user_id,
        userName: a.user_name,
        actionType: a.action_type,
        content: a.content,
        isInternal: Boolean(a.is_internal),
        createdAt: a.created_at,
      });
      actMap.set(a.claim_id, list);
    }

    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        code: r.code,
        prestationId: r.prestation_id,
        prestationTitle: r.prestation_title,
        beneficiaryId: r.beneficiary_id,
        beneficiaryName: r.ben_first ? `${r.ben_first} ${r.ben_last}` : 'Signalement anonyme',
        evaluationId: r.evaluation_id,
        category: r.category,
        description: r.description,
        priority: r.priority,
        status: r.status,
        assignedToUserId: r.assigned_to_user_id,
        assignedToName: r.assigned_name || 'Non affectée',
        resolutionSummary: r.resolution_summary,
        postResolutionSatisfied: r.post_resolution_satisfied === null ? null : Boolean(r.post_resolution_satisfied),
        postResolutionComment: r.post_resolution_comment,
        receivedAt: r.received_at,
        resolvedAt: r.resolved_at,
        dueAt: r.due_at,
        actions: actMap.get(r.id) || [],
      }))
    );
  });

  app.post('/api/claims', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const prestationId = String(req.body?.prestationId || '');
    const beneficiaryId = req.body?.beneficiaryId ? String(req.body.beneficiaryId) : null;
    const category = String(req.body?.category || '');
    const description = String(req.body?.description || '').trim();
    const priority = String(req.body?.priority || 'Normale');
    const assignedToUserId = req.body?.assignedToUserId ? String(req.body.assignedToUserId) : null;

    if (!prestationId || !category || !description) {
      res.status(400).json({ error: 'Prestation, catégorie et description obligatoires.' });
      return;
    }

    const id = uid('clm');
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM claims WHERE company_id = ?').get(companyId) as { cnt: number }).cnt;
    const code = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const slaDays = priority === 'Urgente' ? 1 : priority === 'Haute' ? 2 : 5;
    const dueAt = new Date(Date.now() + slaDays * 86400 * 1000).toISOString();

    db.prepare(
      `INSERT INTO claims (id, company_id, code, prestation_id, beneficiary_id, evaluation_id, category, description, priority, status, assigned_to_user_id, resolution_summary, received_at, due_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'Nouvelle', ?, '', ?, ?)`
    ).run(id, companyId, code, prestationId, beneficiaryId, category, description, priority, assignedToUserId, now, dueAt);

    db.prepare(
      `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, 'created', ?, 0, ?)`
    ).run(uid('act'), id, companyId, req.auth!.userId, req.auth!.name, `Réclamation enregistrée (${category} · Priorité ${priority}).`, now);

    createNotification(
      companyId,
      priority === 'Urgente' ? 'urgent_claim' : 'new_claim',
      `Nouvelle réclamation (${code})`,
      `${category} — Priorité ${priority}.`,
      'claims',
      id
    );
    logAudit(companyId, req.auth!.userId, req.auth!.name, 'CLAIM_CREATED', 'claim', id, code);
    res.status(201).json({ id, code });
  });

  app.patch('/api/claims/:id', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const claim = db.prepare('SELECT * FROM claims WHERE id = ? AND company_id = ?').get(req.params.id, companyId) as any;
    if (!claim) {
      res.status(404).json({ error: 'Réclamation introuvable.' });
      return;
    }

    const now = new Date().toISOString();
    const nextStatus = req.body?.status ? String(req.body.status) : claim.status;
    const nextPriority = req.body?.priority ? String(req.body.priority) : claim.priority;
    const nextAssigned = req.body?.assignedToUserId !== undefined ? (req.body.assignedToUserId || null) : claim.assigned_to_user_id;
    const resolutionSummary = req.body?.resolutionSummary !== undefined ? String(req.body.resolutionSummary) : claim.resolution_summary;
    const postResolutionSatisfied =
      req.body?.postResolutionSatisfied !== undefined
        ? req.body.postResolutionSatisfied === null
          ? null
          : req.body.postResolutionSatisfied
          ? 1
          : 0
        : claim.post_resolution_satisfied;
    const postResolutionComment =
      req.body?.postResolutionComment !== undefined ? String(req.body.postResolutionComment) : claim.post_resolution_comment;

    const resolvedAt =
      (nextStatus === 'Résolue' || nextStatus === 'Clôturée') && !claim.resolved_at ? now : claim.resolved_at;

    db.prepare(
      `UPDATE claims
       SET status = ?, priority = ?, assigned_to_user_id = ?, resolution_summary = ?, post_resolution_satisfied = ?, post_resolution_comment = ?, resolved_at = ?
       WHERE id = ? AND company_id = ?`
    ).run(
      nextStatus,
      nextPriority,
      nextAssigned,
      resolutionSummary,
      postResolutionSatisfied,
      postResolutionComment,
      resolvedAt,
      claim.id,
      companyId
    );

    if (nextStatus !== claim.status) {
      db.prepare(
        `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
      ).run(
        uid('act'),
        claim.id,
        companyId,
        req.auth!.userId,
        req.auth!.name,
        nextStatus === 'Résolue' || nextStatus === 'Clôturée' ? 'resolution' : 'status_change',
        `Statut modifié : "${claim.status}" -> "${nextStatus}".${resolutionSummary && nextStatus === 'Résolue' ? ` Solution : ${resolutionSummary}` : ''}`,
        now
      );
      if (nextStatus === 'Résolue') {
        createNotification(
          companyId,
          'claim_resolved',
          `Réclamation ${claim.code} résolue`,
          `Traitée par ${req.auth!.name}. Vérification de satisfaction post-résolution prête.`,
          'claims',
          claim.id
        );
      }
    }

    if (nextAssigned !== claim.assigned_to_user_id) {
      const assignee = nextAssigned
        ? (db.prepare('SELECT name FROM users WHERE id = ?').get(nextAssigned) as any)?.name || 'Gestionnaire'
        : 'Non affectée';
      db.prepare(
        `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
         VALUES (?, ?, ?, ?, ?, 'assignment', ?, 1, ?)`
      ).run(uid('act'), claim.id, companyId, req.auth!.userId, req.auth!.name, `Affectée à : ${assignee}.`, now);
    }

    logAudit(companyId, req.auth!.userId, req.auth!.name, 'CLAIM_UPDATED', 'claim', claim.id, `${claim.code} -> ${nextStatus}`);
    res.json({ success: true });
  });

  app.post('/api/claims/:id/notes', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const claim = db.prepare('SELECT id FROM claims WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
    if (!claim) {
      res.status(404).json({ error: 'Réclamation introuvable.' });
      return;
    }
    const content = String(req.body?.content || '').trim();
    const isInternal = req.body?.isInternal !== false;
    if (!content) {
      res.status(400).json({ error: 'Le commentaire ne peut pas être vide.' });
      return;
    }
    const id = uid('act');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO claim_actions (id, claim_id, company_id, user_id, user_name, action_type, content, is_internal, created_at)
       VALUES (?, ?, ?, ?, ?, 'internal_note', ?, ?, ?)`
    ).run(id, req.params.id, companyId, req.auth!.userId, req.auth!.name, content, isInternal ? 1 : 0, now);
    res.status(201).json({ id, createdAt: now });
  });

  // Notifications & Automation Runner
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE company_id = ? ORDER BY created_at DESC LIMIT 40')
      .all(req.auth!.companyId) as any[];
    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        type: r.type,
        title: r.title,
        message: r.message,
        linkSection: r.link_section,
        linkId: r.link_id,
        isRead: Boolean(r.is_read),
        createdAt: r.created_at,
      }))
    );
  });

  app.patch('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE company_id = ?').run(req.auth!.companyId);
    res.json({ success: true });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND company_id = ?').run(req.params.id, req.auth!.companyId);
    res.json({ success: true });
  });

  app.post('/api/automations/run', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const company = db.prepare('SELECT settings_json FROM companies WHERE id = ?').get(companyId) as any;
    const settings = { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(company.settings_json || '{}') };
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() - Number(settings.autoReminderDays || 4) * 86400 * 1000).toISOString();

    // 1. Trigger reminders for unanswered invitations older than autoReminderDays
    const pendingInvs = db
      .prepare(
        `SELECT id FROM invitations WHERE company_id = ? AND status IN ('Envoyée', 'Ouverte') AND sent_at IS NOT NULL AND sent_at < ?`
      )
      .all(companyId, reminderCutoff) as any[];

    for (const inv of pendingInvs) {
      db.prepare("UPDATE invitations SET status = 'En attente de réponse', reminder_count = reminder_count + 1, last_reminder_at = ? WHERE id = ?").run(
        now.toISOString(),
        inv.id
      );
    }
    if (pendingInvs.length > 0) {
      createNotification(
        companyId,
        'pending_reminder',
        'Relances automatiques déclenchées',
        `${pendingInvs.length} invitation(s) sans réponse après ${settings.autoReminderDays} jours ont été relancées.`,
        'invitations'
      );
    }

    // 2. Check overdue unhandled claims
    const overdueClaims = db
      .prepare(
        `SELECT id, code FROM claims WHERE company_id = ? AND status IN ('Nouvelle', 'En cours de traitement', 'En attente') AND due_at < ?`
      )
      .all(companyId, now.toISOString()) as any[];
    if (overdueClaims.length > 0 && settings.urgentClaimAlert) {
      createNotification(
        companyId,
        'urgent_claim',
        'Alerte délai réclamations',
        `${overdueClaims.length} réclamation(s) dépassent leur échéance cible (${overdueClaims.map((c) => c.code).join(', ')}).`,
        'claims',
        overdueClaims[0].id
      );
    }

    logAudit(
      companyId,
      req.auth!.userId,
      req.auth!.name,
      'AUTOMATIONS_EXECUTED',
      'company',
      companyId,
      `${pendingInvs.length} relance(s), ${overdueClaims.length} alerte(s) délai`
    );

    res.json({
      remindersTriggered: pendingInvs.length,
      overdueClaimsFlagged: overdueClaims.length,
    });
  });

  // Users & Audit Logs
  app.get('/api/users', requireAuth, requireStaff, (req: AuthedRequest, res) => {
    const rows = db.prepare('SELECT * FROM users WHERE company_id = ? ORDER BY created_at DESC').all(req.auth!.companyId) as any[];
    res.json(rows.map(formatUserRow));
  });

  app.post('/api/users', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = String(req.body?.role || 'quality_manager') as UserRole;
    const beneficiaryId = req.body?.beneficiaryId ? String(req.body.beneficiaryId) : null;
    const permissions = req.body?.permissions || {
      canManageQuestionnaires: role !== 'beneficiary',
      canExportReports: role !== 'beneficiary',
      canManageTrainers: role === 'admin',
      canManageClaims: role !== 'beneficiary',
      canImportData: role !== 'beneficiary',
    };

    if (!name || !email || password.length < 6) {
      res.status(400).json({ error: 'Nom, email et mot de passe (min. 6 caractères) requis.' });
      return;
    }
    if (db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email)) {
      res.status(409).json({ error: 'Cet email est déjà utilisé.' });
      return;
    }

    const id = uid('usr');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, company_id, name, email, password_hash, role, permissions_json, is_active, beneficiary_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(id, companyId, name, email, hashPassword(password), role, JSON.stringify(permissions), beneficiaryId, now);

    logAudit(companyId, req.auth!.userId, req.auth!.name, 'USER_CREATED', 'user', id, `${name} (${role})`);
    res.status(201).json({ id });
  });

  app.patch('/api/users/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const existing = db.prepare('SELECT * FROM users WHERE id = ? AND company_id = ?').get(req.params.id, companyId) as any;
    if (!existing) {
      res.status(404).json({ error: 'Utilisateur introuvable.' });
      return;
    }
    const role = req.body?.role ? String(req.body.role) : existing.role;
    const isActive = req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : existing.is_active;
    const permissions = req.body?.permissions ? JSON.stringify(req.body.permissions) : existing.permissions_json;

    db.prepare('UPDATE users SET role = ?, is_active = ?, permissions_json = ? WHERE id = ? AND company_id = ?').run(
      role,
      isActive,
      permissions,
      req.params.id,
      companyId
    );
    logAudit(companyId, req.auth!.userId, req.auth!.name, 'USER_UPDATED', 'user', req.params.id, `Rôle: ${role}, Actif: ${Boolean(isActive)}`);
    res.json({ success: true });
  });

  app.get('/api/audit-logs', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM audit_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(req.auth!.companyId) as any[];
    res.json(
      rows.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        userId: r.user_id,
        userName: r.user_name,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        details: r.details,
        createdAt: r.created_at,
      }))
    );
  });

  // Company Settings & Full Backup
  app.get('/api/company', requireAuth, (req: AuthedRequest, res) => {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.auth!.companyId) as any;
    res.json(formatCompanyRow(company));
  });

  app.put('/api/company', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const b = req.body || {};
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    const currentSettings = { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(existing.settings_json || '{}') };

    db.prepare(
      `UPDATE companies
       SET name = ?, logo_url = ?, email = ?, phone = ?, address = ?, website = ?, primary_color = ?, secondary_color = ?,
           domains_json = ?, training_types_json = ?, certification_types_json = ?, claim_categories_json = ?, settings_json = ?
       WHERE id = ?`
    ).run(
      String(b.name || existing.name),
      b.logoUrl !== undefined ? String(b.logoUrl) : existing.logo_url,
      b.email !== undefined ? String(b.email) : existing.email,
      b.phone !== undefined ? String(b.phone) : existing.phone,
      b.address !== undefined ? String(b.address) : existing.address,
      b.website !== undefined ? String(b.website) : existing.website,
      b.primaryColor || existing.primary_color,
      b.secondaryColor || existing.secondary_color,
      JSON.stringify(b.domains ?? JSON.parse(existing.domains_json || '[]')),
      JSON.stringify(b.trainingTypes ?? JSON.parse(existing.training_types_json || '[]')),
      JSON.stringify(b.certificationTypes ?? JSON.parse(existing.certification_types_json || '[]')),
      JSON.stringify(b.claimCategories ?? JSON.parse(existing.claim_categories_json || '[]')),
      JSON.stringify({ ...currentSettings, ...(b.settings || {}) }),
      companyId
    );

    logAudit(companyId, req.auth!.userId, req.auth!.name, 'COMPANY_SETTINGS_UPDATED', 'company', companyId, 'Mise à jour des paramètres entreprise');
    const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    res.json(formatCompanyRow(updated));
  });

  app.get('/api/company/backup', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const company = formatCompanyRow(db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId));
    const backup = {
      exportedAt: new Date().toISOString(),
      platform: 'FormaCare',
      company,
      trainers: db.prepare('SELECT * FROM trainers WHERE company_id = ?').all(companyId),
      beneficiaries: db.prepare('SELECT * FROM beneficiaries WHERE company_id = ?').all(companyId),
      prestations: db.prepare('SELECT * FROM prestations WHERE company_id = ?').all(companyId),
      questionnaires: db.prepare('SELECT * FROM questionnaires WHERE company_id = ?').all(companyId),
      invitations: db.prepare('SELECT * FROM invitations WHERE company_id = ?').all(companyId),
      evaluations: db.prepare('SELECT * FROM evaluations WHERE company_id = ?').all(companyId),
      claims: db.prepare('SELECT * FROM claims WHERE company_id = ?').all(companyId),
      claimActions: db.prepare('SELECT * FROM claim_actions WHERE company_id = ?').all(companyId),
      auditLogs: db.prepare('SELECT * FROM audit_logs WHERE company_id = ?').all(companyId),
    };
    logAudit(companyId, req.auth!.userId, req.auth!.name, 'BACKUP_EXPORTED', 'company', companyId, 'Sauvegarde JSON complète téléchargée');
    res.setHeader('Content-Disposition', `attachment; filename="formacare-backup-${company.slug}.json"`);
    res.json(backup);
  });

  // ---------------- SERVER-SIDE GEMINI AI ASSISTANCE (OPTIONAL) ----------------
  app.post('/api/ai/analyze', requireAuth, requireStaff, async (req: AuthedRequest, res) => {
    const companyId = req.auth!.companyId;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        error: "Clé API Gemini non configurée côté serveur (GEMINI_API_KEY). Configurez la variable dans Settings > Secrets pour activer l'assistant analytique.",
      });
      return;
    }

    const evaluations = db
      .prepare(
        `SELECT e.overall_score, e.trainer_score, e.sentiment, e.general_comment, e.submitted_at, p.title as prestation_title, t.name as trainer_name
         FROM evaluations e
         JOIN prestations p ON e.prestation_id = p.id
         JOIN trainers t ON e.trainer_id = t.id
         WHERE e.company_id = ?
         ORDER BY e.submitted_at DESC LIMIT 60`
      )
      .all(companyId) as any[];

    const claims = db
      .prepare(
        `SELECT c.code, c.category, c.priority, c.status, c.description, p.title as prestation_title
         FROM claims c
         JOIN prestations p ON c.prestation_id = p.id
         WHERE c.company_id = ?
         ORDER BY c.received_at DESC LIMIT 40`
      )
      .all(companyId) as any[];

    if (evaluations.length === 0 && claims.length === 0) {
      res.status(400).json({
        error: "Aucune évaluation ni réclamation enregistrée pour le moment : l'analyse IA ne peut s'appuyer que sur des données réelles.",
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptPayload = {
        evaluationsCount: evaluations.length,
        evaluations: evaluations.map((e) => ({
          prestation: e.prestation_title,
          trainer: e.trainer_name,
          overallScore: e.overall_score,
          trainerScore: e.trainer_score,
          sentiment: e.sentiment,
          comment: e.general_comment,
        })),
        claimsCount: claims.length,
        claims: claims.map((c) => ({
          code: c.code,
          category: c.category,
          priority: c.priority,
          status: c.status,
          prestation: c.prestation_title,
          description: c.description,
        })),
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyse uniquement les données réelles ci-dessous issues de la plateforme de suivi après-prestation FormaCare. Réponds en français professionnel.\n\nDONNÉES RÉELLES:\n${JSON.stringify(promptPayload)}`,
        config: {
          systemInstruction:
            "Tu es un expert en qualité de la formation professionnelle (Qualiopi / ISO 21001). RÈGLES STRICTES: 1) N'invente jamais de chiffres, de commentaires ou de statistiques absentes des données fournies. 2) Ne prends jamais de décision disciplinaire concernant un formateur; formule uniquement des pistes d'accompagnement ou d'amélioration pédagogique constructives et factuelles. 3) Appuie chaque constat sur les données observées.",
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING, description: 'Synthèse factuelle des retours et du niveau de qualité.' },
              recurringThemes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Thèmes récurrents identifiés dans les commentaires et réclamations.',
              },
              dissatisfactionSignals: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Signaux faibles ou critiques d'insatisfaction détectés.",
              },
              improvementRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Pistes d'amélioration concrètes et mesurables pour l'organisme.",
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      logAudit(companyId, req.auth!.userId, req.auth!.name, 'AI_ANALYSIS_GENERATED', 'analytics', companyId, 'Synthèse qualitative Gemini générée');
      res.json(parsed);
    } catch (err: any) {
      console.error('Gemini analysis error:', err);
      res.status(502).json({
        error: err?.message || "Erreur lors de l'appel au service Gemini. Vérifiez la configuration de la clé API.",
      });
    }
  });

  // Vite dev middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FormaCare SaaS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
