export type UserRole = 'admin' | 'quality_manager' | 'beneficiary';

export type QuestionType =
  | 'scale_5'
  | 'scale_10'
  | 'stars'
  | 'single_choice'
  | 'multiple_choice'
  | 'open_text'
  | 'yes_no'
  | 'nps';

export type EvaluationCategoryId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface QuestionItem {
  id: string;
  categoryId: EvaluationCategoryId;
  categoryLabel: string;
  label: string;
  type: QuestionType;
  required: boolean;
  weight: number;
  commentMode: 'none' | 'optional' | 'required';
  options?: string[];
  trainerDimension?: 'pedagogie' | 'maitrise' | 'communication' | 'disponibilite' | 'satisfaction';
}

export interface CompanySettings {
  allowAnonymous: boolean;
  minTrainerSampleSize: number;
  gdprConsentText: string;
  beneficiaryCanViewClaims: boolean;
  autoInviteDelayHours: number;
  autoReminderDays: number;
  lowSatisfactionThreshold: number;
  urgentClaimAlert: boolean;
  periodicReportCadence: 'Hebdomadaire' | 'Mensuelle' | 'Trimestrielle';
  defaultLanguage: 'fr' | 'en';
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  domains: string[];
  trainingTypes: string[];
  certificationTypes: string[];
  claimCategories: string[];
  settings: CompanySettings;
  createdAt: string;
}

export interface UserPermissions {
  canManageQuestionnaires: boolean;
  canExportReports: boolean;
  canManageTrainers: boolean;
  canManageClaims: boolean;
  canImportData: boolean;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermissions;
  isActive: boolean;
  beneficiaryId?: string | null;
  createdAt: string;
}

export interface Trainer {
  id: string;
  companyId: string;
  name: string;
  email: string;
  specialty: string;
  bio: string;
  photoUrl: string;
  active: boolean;
  createdAt: string;
}

export interface Beneficiary {
  id: string;
  companyId: string;
  uniqueCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  createdAt: string;
  prestationCount?: number;
  evaluationCount?: number;
  lastScore?: number | null;
}

export type FollowUpStatus =
  | 'À enquêter'
  | 'Enquête envoyée'
  | 'Suivi en cours'
  | 'Clôturée';

export interface Prestation {
  id: string;
  companyId: string;
  title: string;
  domain: string;
  type: string;
  certificationName: string;
  realizedAt: string;
  trainerId: string;
  trainerName?: string;
  durationHours: number;
  sessionCode: string;
  followUpStatus: FollowUpStatus;
  beneficiaryIds: string[];
  createdAt: string;
}

export interface Questionnaire {
  id: string;
  companyId: string;
  title: string;
  description: string;
  targetType: string;
  allowAnonymous: boolean;
  active: boolean;
  categories: EvaluationCategoryId[];
  questions: QuestionItem[];
  createdAt: string;
}

export type InvitationStatus =
  | 'À envoyer'
  | 'Envoyée'
  | 'Ouverte'
  | 'En attente de réponse'
  | 'Répondue'
  | 'Expirée';

export interface Invitation {
  id: string;
  companyId: string;
  code: string;
  token: string;
  prestationId: string;
  prestationTitle?: string;
  questionnaireId: string;
  questionnaireTitle?: string;
  beneficiaryId: string | null;
  beneficiaryName?: string;
  beneficiaryEmail?: string;
  beneficiaryPhone?: string;
  channel: 'email' | 'whatsapp' | 'sms' | 'link';
  status: InvitationStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  respondedAt: string | null;
  expiresAt: string | null;
  allowAnonymous: boolean;
  reminderCount: number;
  lastReminderAt: string | null;
  createdAt: string;
}

export interface EvaluationAnswer {
  value: string | number | boolean | string[];
  normalizedScore?: number | null;
  comment?: string;
}

export interface Evaluation {
  id: string;
  companyId: string;
  invitationId: string | null;
  prestationId: string;
  prestationTitle?: string;
  prestationType?: string;
  certificationName?: string;
  questionnaireId: string;
  beneficiaryId: string | null;
  beneficiaryName?: string;
  isAnonymous: boolean;
  trainerId: string;
  trainerName?: string;
  overallScore: number;
  trainerScore: number;
  npsScore: number | null;
  sentiment: 'positif' | 'neutre' | 'négatif';
  gdprConsent: boolean;
  answers: Record<string, EvaluationAnswer>;
  generalComment: string;
  submittedAt: string;
}

export type ClaimPriority = 'Basse' | 'Normale' | 'Haute' | 'Urgente';
export type ClaimStatus =
  | 'Nouvelle'
  | 'En cours de traitement'
  | 'En attente'
  | 'Résolue'
  | 'Clôturée';

export interface ClaimAction {
  id: string;
  claimId: string;
  userId: string;
  userName: string;
  actionType: 'created' | 'status_change' | 'assignment' | 'internal_note' | 'resolution' | 'verification';
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface Claim {
  id: string;
  companyId: string;
  code: string;
  prestationId: string;
  prestationTitle?: string;
  beneficiaryId: string | null;
  beneficiaryName?: string;
  evaluationId: string | null;
  category: string;
  description: string;
  priority: ClaimPriority;
  status: ClaimStatus;
  assignedToUserId: string | null;
  assignedToName?: string;
  resolutionSummary: string;
  postResolutionSatisfied: boolean | null;
  postResolutionComment: string;
  receivedAt: string;
  resolvedAt: string | null;
  dueAt: string;
  actions?: ClaimAction[];
}

export interface AppNotification {
  id: string;
  companyId: string;
  type:
    | 'new_claim'
    | 'urgent_claim'
    | 'low_satisfaction'
    | 'claim_resolved'
    | 'pending_reminder'
    | 'periodic_report'
    | 'prestation_ready';
  title: string;
  message: string;
  linkSection: string;
  linkId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export type NavSection =
  | 'dashboard'
  | 'beneficiaries'
  | 'prestations'
  | 'questionnaires'
  | 'invitations'
  | 'evaluations'
  | 'trainers'
  | 'claims'
  | 'analytics'
  | 'reports'
  | 'users'
  | 'settings';
