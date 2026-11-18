import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'formacare.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_demo INTEGER NOT NULL DEFAULT 0,
      logo_url TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      primary_color TEXT NOT NULL DEFAULT '#16834B',
      secondary_color TEXT NOT NULL DEFAULT '#E8F5ED',
      domains_json TEXT NOT NULL DEFAULT '[]',
      training_types_json TEXT NOT NULL DEFAULT '[]',
      certification_types_json TEXT NOT NULL DEFAULT '[]',
      claim_categories_json TEXT NOT NULL DEFAULT '[]',
      settings_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'quality_manager', 'beneficiary')),
      permissions_json TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      beneficiary_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trainers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      specialty TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS beneficiaries (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      unique_code TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(company_id, email),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prestations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      type TEXT NOT NULL,
      certification_name TEXT NOT NULL DEFAULT '',
      realized_at TEXT NOT NULL,
      trainer_id TEXT NOT NULL,
      duration_hours REAL NOT NULL DEFAULT 7,
      session_code TEXT NOT NULL DEFAULT '',
      follow_up_status TEXT NOT NULL DEFAULT 'À enquêter',
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (trainer_id) REFERENCES trainers(id)
    );

    CREATE TABLE IF NOT EXISTS prestation_beneficiaries (
      prestation_id TEXT NOT NULL,
      beneficiary_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      PRIMARY KEY (prestation_id, beneficiary_id),
      FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE CASCADE,
      FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS questionnaires (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL DEFAULT 'Mixte',
      allow_anonymous INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      categories_json TEXT NOT NULL DEFAULT '[]',
      questions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      prestation_id TEXT NOT NULL,
      questionnaire_id TEXT NOT NULL,
      beneficiary_id TEXT,
      channel TEXT NOT NULL DEFAULT 'email',
      status TEXT NOT NULL DEFAULT 'À envoyer',
      scheduled_at TEXT,
      sent_at TEXT,
      opened_at TEXT,
      responded_at TEXT,
      expires_at TEXT,
      allow_anonymous INTEGER NOT NULL DEFAULT 0,
      reminder_count INTEGER NOT NULL DEFAULT 0,
      last_reminder_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE CASCADE,
      FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      invitation_id TEXT,
      prestation_id TEXT NOT NULL,
      questionnaire_id TEXT NOT NULL,
      beneficiary_id TEXT,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      trainer_id TEXT NOT NULL,
      overall_score REAL NOT NULL,
      trainer_score REAL NOT NULL,
      nps_score INTEGER,
      sentiment TEXT NOT NULL,
      gdpr_consent INTEGER NOT NULL DEFAULT 1,
      answers_json TEXT NOT NULL DEFAULT '{}',
      general_comment TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE CASCADE,
      FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      code TEXT NOT NULL,
      prestation_id TEXT NOT NULL,
      beneficiary_id TEXT,
      evaluation_id TEXT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Normale',
      status TEXT NOT NULL DEFAULT 'Nouvelle',
      assigned_to_user_id TEXT,
      resolution_summary TEXT NOT NULL DEFAULT '',
      post_resolution_satisfied INTEGER,
      post_resolution_comment TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL,
      resolved_at TEXT,
      due_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (prestation_id) REFERENCES prestations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claim_actions (
      id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      content TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_section TEXT NOT NULL DEFAULT 'dashboard',
      link_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);
}

export default db;
