import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  Briefcase,
  CheckCheck,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Play,
  Send,
  Settings,
  Star,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { FormaCareLogo } from './components/BrandMark';
import { t, type Locale } from './i18n/translations';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api';
import { AnalyticsView } from './views/AnalyticsView';
import { AuthView } from './views/AuthView';
import { BeneficiariesView } from './views/BeneficiariesView';
import { BeneficiaryPortalView } from './views/BeneficiaryPortalView';
import { ClaimsView } from './views/ClaimsView';
import { DashboardView } from './views/DashboardView';
import { EvaluationsView } from './views/EvaluationsView';
import { InvitationsView } from './views/InvitationsView';
import { PrestationsView } from './views/PrestationsView';
import { PublicSurveyView } from './views/PublicSurveyView';
import { QuestionnairesView } from './views/QuestionnairesView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { TrainersView } from './views/TrainersView';
import { UsersView } from './views/UsersView';
import type {
  AppNotification,
  Beneficiary,
  Claim,
  Company,
  Evaluation,
  Invitation,
  NavSection,
  Prestation,
  Questionnaire,
  Trainer,
  User,
} from './types';

const NAV_ITEMS: { id: NavSection; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'beneficiaries', icon: Users },
  { id: 'prestations', icon: Briefcase },
  { id: 'questionnaires', icon: ClipboardCheck },
  { id: 'invitations', icon: Send },
  { id: 'evaluations', icon: Star },
  { id: 'trainers', icon: Award },
  { id: 'claims', icon: MessageSquareWarning },
  { id: 'analytics', icon: BarChart3 },
  { id: 'reports', icon: FileBarChart2 },
  { id: 'users', icon: UserCog },
  { id: 'settings', icon: Settings },
];

export default function App() {
  const [publicSurveyToken, setPublicSurveyToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('survey');
  });

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [locale, setLocale] = useState<Locale>('fr');
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [previewSurveyToken, setPreviewSurveyToken] = useState<string | null>(null);

  // Workspace data
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadWorkspaceData = useCallback(async (currentUser: User) => {
    if (currentUser.role === 'beneficiary') return;
    setLoadingData(true);
    setDataError('');
    try {
      const [comp, bens, prs, trns, qsts, invs, evals, clms, usrs, notifs] = await Promise.all([
        apiRequest<Company>('/api/company'),
        apiRequest<Beneficiary[]>('/api/beneficiaries'),
        apiRequest<Prestation[]>('/api/prestations'),
        apiRequest<Trainer[]>('/api/trainers'),
        apiRequest<Questionnaire[]>('/api/questionnaires'),
        apiRequest<Invitation[]>('/api/invitations'),
        apiRequest<Evaluation[]>('/api/evaluations'),
        apiRequest<Claim[]>('/api/claims'),
        apiRequest<User[]>('/api/users'),
        apiRequest<AppNotification[]>('/api/notifications'),
      ]);
      setCompany(comp);
      setBeneficiaries(bens);
      setPrestations(prs);
      setTrainers(trns);
      setQuestionnaires(qsts);
      setInvitations(invs);
      setEvaluations(evals);
      setClaims(clms);
      setUsers(usrs);
      setNotifications(notifs);
    } catch (err: any) {
      setDataError(err.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    apiRequest<{ user: User; company: Company }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        setCompany(res.company);
        loadWorkspaceData(res.user);
      })
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => setAuthReady(true));
  }, [loadWorkspaceData]);

  const handleAuthenticated = (payload: { token: string; user: User; company: Company }) => {
    setStoredToken(payload.token);
    setUser(payload.user);
    setCompany(payload.company);
    setActiveSection('dashboard');
    loadWorkspaceData(payload.user);
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setCompany(null);
    setNotifications([]);
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleRunAutomations = async () => {
    await apiRequest('/api/automations/run', { method: 'POST' });
    if (user) await loadWorkspaceData(user);
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.isRead) {
      await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
    }
    setNotifOpen(false);
    if (NAV_ITEMS.some((item) => item.id === n.linkSection)) {
      setActiveSection(n.linkSection as NavSection);
    }
  };

  // Public survey token direct route
  if (publicSurveyToken) {
    return (
      <PublicSurveyView
        token={publicSurveyToken}
        onClose={() => {
          setPublicSurveyToken(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('survey');
          window.history.replaceState({}, '', url.toString());
        }}
      />
    );
  }

  // In-app survey test preview
  if (previewSurveyToken) {
    return (
      <PublicSurveyView
        token={previewSurveyToken}
        onClose={() => {
          setPreviewSurveyToken(null);
          if (user) loadWorkspaceData(user);
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center text-sm text-[#8B9299]">
        Initialisation de FormaCare...
      </div>
    );
  }

  if (!user || !company) {
    return <AuthView onAuthenticated={handleAuthenticated} />;
  }

  if (user.role === 'beneficiary') {
    return <BeneficiaryPortalView user={user} company={company} onLogout={handleLogout} />;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const openClaimsCount = claims.filter((c) => c.status === 'Nouvelle' || c.status === 'En cours de traitement').length;
  const staffUsers = users.filter((u) => u.role === 'admin' || u.role === 'quality_manager');
  const reload = () => loadWorkspaceData(user);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (user.role === 'quality_manager' && item.id === 'settings') return true;
    return true;
  });

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <DashboardView
            company={company}
            beneficiaries={beneficiaries}
            prestations={prestations}
            trainers={trainers}
            questionnaires={questionnaires}
            invitations={invitations}
            evaluations={evaluations}
            claims={claims}
            onNavigate={setActiveSection}
          />
        );
      case 'beneficiaries':
        return <BeneficiariesView company={company} beneficiaries={beneficiaries} onReload={reload} />;
      case 'prestations':
        return (
          <PrestationsView
            company={company}
            prestations={prestations}
            trainers={trainers}
            beneficiaries={beneficiaries}
            onReload={reload}
            onNavigate={setActiveSection}
          />
        );
      case 'questionnaires':
        return (
          <QuestionnairesView
            questionnaires={questionnaires}
            canManage={user.role === 'admin' || Boolean(user.permissions.canManageQuestionnaires)}
            onReload={reload}
          />
        );
      case 'invitations':
        return (
          <InvitationsView
            company={company}
            invitations={invitations}
            prestations={prestations}
            questionnaires={questionnaires}
            beneficiaries={beneficiaries}
            onReload={reload}
            onOpenSurveyPreview={(tok) => setPreviewSurveyToken(tok)}
          />
        );
      case 'evaluations':
        return <EvaluationsView evaluations={evaluations} questionnaires={questionnaires} />;
      case 'trainers':
        return (
          <TrainersView
            company={company}
            beneficiaries={beneficiaries}
            prestations={prestations}
            trainers={trainers}
            questionnaires={questionnaires}
            invitations={invitations}
            evaluations={evaluations}
            claims={claims}
            canManageTrainers={user.role === 'admin' || Boolean(user.permissions.canManageTrainers)}
            onReload={reload}
          />
        );
      case 'claims':
        return (
          <ClaimsView
            company={company}
            claims={claims}
            prestations={prestations}
            beneficiaries={beneficiaries}
            staffUsers={staffUsers}
            onReload={reload}
          />
        );
      case 'analytics':
        return (
          <AnalyticsView
            company={company}
            beneficiaries={beneficiaries}
            prestations={prestations}
            trainers={trainers}
            questionnaires={questionnaires}
            invitations={invitations}
            evaluations={evaluations}
            claims={claims}
          />
        );
      case 'reports':
        return (
          <ReportsView
            company={company}
            beneficiaries={beneficiaries}
            prestations={prestations}
            trainers={trainers}
            questionnaires={questionnaires}
            invitations={invitations}
            evaluations={evaluations}
            claims={claims}
          />
        );
      case 'users':
        return <UsersView currentUser={user} users={users} beneficiaries={beneficiaries} onReload={reload} />;
      case 'settings':
        return <SettingsView company={company} isAdmin={user.role === 'admin'} onReload={reload} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex text-[#27313B]">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <FormaCareLogo size={28} />
            <span className="font-display font-bold text-base tracking-tight text-[#27313B] truncate">
              FormaCare
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-[#8B9299] hover:text-[#27313B]"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#E8F5ED] text-[#16834B] font-semibold'
                    : 'text-[#27313B] hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#16834B]' : 'text-[#8B9299]'}`} />
                  <span className="truncate">{t(locale, `nav_${item.id}`)}</span>
                </span>
                {item.id === 'claims' && openClaimsCount > 0 && (
                  <span className="font-mono text-[11px] font-semibold text-amber-700">
                    {openClaimsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="text-xs font-semibold text-[#27313B] truncate">{company.name}</div>
          <div className="text-[11px] text-[#8B9299]">
            {company.isDemo ? t(locale, 'demoBadge') : t(locale, 'prodBadge')}
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-gray-200 text-[#27313B]"
              aria-label="Ouvrir la navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#27313B] truncate">
                {t(locale, `nav_${activeSection}`)}
              </div>
              <div className="text-[11px] text-[#8B9299] truncate hidden sm:block">
                {company.name} · {user.role === 'admin' ? 'Administrateur' : 'Gestionnaire qualité'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Language Switcher */}
            <div className="flex items-center p-0.5 bg-[#F3F4F6] rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLocale('fr')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  locale === 'fr' ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299]'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  locale === 'en' ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299]'
                }`}
              >
                EN
              </button>
            </div>

            {/* Notifications Center */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[#27313B]"
                aria-label="Centre de notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#16834B] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#27313B]">{t(locale, 'notifications')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunAutomations}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16834B] hover:underline"
                      >
                        <Play className="w-3 h-3" />
                        <span>{t(locale, 'runAutomations')}</span>
                      </button>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="inline-flex items-center gap-1 text-[11px] text-[#8B9299] hover:text-[#27313B]"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Tout lire</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#8B9299]">{t(locale, 'noNotifications')}</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className={`w-full text-left p-3.5 hover:bg-gray-50 transition-colors ${
                            n.isRead ? 'opacity-70' : 'bg-[#E8F5ED]/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#27313B]">
                            <span>{n.title}</span>
                            <span className="text-[10px] font-mono text-[#8B9299] shrink-0">
                              {new Date(n.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <p className="text-xs text-[#8B9299] mt-0.5">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <span className="hidden md:inline text-xs font-semibold text-[#27313B] max-w-[140px] truncate">
                {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title={t(locale, 'logout')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 text-[#27313B] whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t(locale, 'logout')}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {dataError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {dataError}
            </div>
          )}
          {loadingData && prestations.length === 0 && beneficiaries.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-xs text-[#8B9299]">
              Chargement des données de l’organisme...
            </div>
          ) : (
            renderSection()
          )}
        </main>
      </div>
    </div>
  );
}
