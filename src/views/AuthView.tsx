import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { FormaCareLogo } from '../components/BrandMark';
import { apiRequest } from '../lib/api';
import type { Company, User } from '../types';

interface DemoAccount {
  email: string;
  name: string;
  role: string;
  company_name: string;
  company_id: string;
}

export function AuthView({
  onAuthenticated,
}: {
  onAuthenticated: (payload: { token: string; user: User; company: Company }) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@horizon-formation.fr');
  const [password, setPassword] = useState('FormaCare2026!');
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    apiRequest<{ accounts: DemoAccount[] }>('/api/auth/demo-accounts')
      .then((res) => setDemoAccounts(res.accounts || []))
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User; company: Company }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onAuthenticated(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User; company: Company }>('/api/auth/register-company', {
        method: 'POST',
        body: JSON.stringify({ companyName, adminName, email, password }),
      });
      onAuthenticated(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (acc: DemoAccount) => {
    setError('');
    setLoading(true);
    const pwd = acc.email.includes('certipro') ? 'CertiPro2026!' : 'FormaCare2026!';
    try {
      const res = await apiRequest<{ token: string; user: User; company: Company }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: acc.email, password: pwd }),
      });
      onAuthenticated(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = (role: string) => {
    if (role === 'admin') return 'Administrateur';
    if (role === 'quality_manager') return 'Gestionnaire qualité';
    return 'Bénéficiaire';
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left presentation panel */}
        <div className="lg:col-span-5 bg-[#27313B] text-white rounded-2xl p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <FormaCareLogo size={36} />
              <span className="text-xl font-bold tracking-tight">FormaCare</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-8 leading-tight">
              Le pilotage qualité après-prestation pour organismes de formation.
            </h1>
            <p className="text-sm text-gray-300 mt-3 leading-relaxed">
              Measure satisfaction. Improve quality. Build trust. Centralisez les retours bénéficiaires, évaluez vos formateurs objectivement et traitez les réclamations dans des espaces multi-entreprises cloisonnés.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-gray-200">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                <span>Enquêtes post-formation & certification multicanales</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                <span>Évaluation transparente des formateurs avec contrôle d’échantillon</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                <span>Suivi des réclamations, SLA et reporting direction PDF / Excel</span>
              </li>
            </ul>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 text-xs text-gray-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#4ADE80] shrink-0" />
            <span>Isolation stricte des données par organisme et contrôle d’accès RBAC</span>
          </div>
        </div>

        {/* Right auth & demo workspace panel */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg w-fit">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'login' ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299] hover:text-[#27313B]'
                }`}
              >
                Connexion entreprise
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setEmail('');
                  setPassword('');
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'register' ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299] hover:text-[#27313B]'
                }`}
              >
                Créer un espace production
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#27313B] mb-1.5">Email professionnel</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@organisme.fr"
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#27313B] mb-1.5">Mot de passe</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#16834B] hover:bg-[#126b3d] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Lock className="w-4 h-4" />
                  <span>{loading ? 'Connexion en cours...' : 'Accéder à mon espace'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <p className="text-xs text-[#8B9299]">
                  Démarrez un espace entreprise vierge (aucune donnée fictive pré-remplie) pour importer vos propres bénéficiaires et prestations.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#27313B] mb-1.5">Nom de l’organisme</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex. Académie Qualité Plus"
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#27313B] mb-1.5">Nom de l’administrateur</label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Ex. Claire Laurent"
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#27313B] mb-1.5">Email administrateur</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="direction@organisme.fr"
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#27313B] mb-1.5">Mot de passe (min. 6 car.)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-[#16834B] hover:bg-[#126b3d] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{loading ? 'Création de l’espace...' : 'Créer mon espace entreprise'}</span>
                </button>
              </form>
            )}
          </div>

          {demoAccounts.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[#27313B]">
                  Accès rapides de démonstration (données isolées par organisme)
                </h2>
                <span className="text-[11px] text-[#8B9299]">Données démo séparées</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loading}
                    onClick={() => quickLogin(acc)}
                    className="text-left p-3 rounded-lg border border-gray-200 hover:border-[#16834B] hover:bg-[#E8F5ED]/40 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#27313B] truncate flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#16834B] shrink-0" />
                        <span>{acc.name}</span>
                      </div>
                      <div className="text-[11px] text-[#8B9299] truncate mt-0.5">
                        {roleLabel(acc.role)} · {acc.company_name.replace(' (DÉMO)', '')}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#8B9299] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
