import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, LogOut, MessageSquareWarning, Send } from 'lucide-react';
import { FormaCareLogo } from '../components/BrandMark';
import { apiRequest } from '../lib/api';
import { PublicSurveyView } from './PublicSurveyView';
import type { Company, User } from '../types';

interface PortalData {
  invitations: {
    id: string;
    code: string;
    token: string;
    prestationId: string;
    prestationTitle: string;
    realizedAt: string;
    trainerName: string;
    questionnaireTitle: string;
    status: string;
    respondedAt: string | null;
    expiresAt: string | null;
  }[];
  prestations: {
    id: string;
    title: string;
    type: string;
    certification_name: string;
    realized_at: string;
    session_code: string;
    trainer_name: string;
  }[];
  claims: {
    id: string;
    code: string;
    category: string;
    description: string;
    priority: string;
    status: string;
    resolution_summary: string;
    post_resolution_satisfied: number | null;
    post_resolution_comment: string;
    received_at: string;
    resolved_at: string | null;
    prestation_title: string;
  }[];
  claimCategories: string[];
  canViewClaims: boolean;
}

export function BeneficiaryPortalView({
  user,
  company,
  onLogout,
}: {
  user: User;
  company: Company;
  onLogout: () => void;
}) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSurveyToken, setActiveSurveyToken] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimPrestationId, setClaimPrestationId] = useState('');
  const [claimCategory, setClaimCategory] = useState('');
  const [claimPriority, setClaimPriority] = useState('Normale');
  const [claimDescription, setClaimDescription] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadPortal = () => {
    setLoading(true);
    apiRequest<PortalData>('/api/beneficiary/portal')
      .then((res) => {
        setData(res);
        if (res.prestations[0] && !claimPrestationId) setClaimPrestationId(res.prestations[0].id);
        if (res.claimCategories[0] && !claimCategory) setClaimCategory(res.claimCategories[0]);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPortal();
  }, []);

  if (activeSurveyToken) {
    return (
      <PublicSurveyView
        token={activeSurveyToken}
        onClose={() => {
          setActiveSurveyToken(null);
          loadPortal();
        }}
      />
    );
  }

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest<{ code: string }>('/api/beneficiary/claims', {
        method: 'POST',
        body: JSON.stringify({
          prestationId: claimPrestationId,
          category: claimCategory,
          priority: claimPriority,
          description: claimDescription,
        }),
      });
      setShowClaimModal(false);
      setClaimDescription('');
      setFeedback(`Réclamation ${res.code} enregistrée et transmise à l’équipe qualité.`);
      loadPortal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVerifyClaim = async (claimId: string, satisfied: boolean) => {
    try {
      await apiRequest(`/api/beneficiary/claims/${claimId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ satisfied }),
      });
      setFeedback(satisfied ? 'Clôture confirmée, merci pour votre retour.' : 'Votre réclamation a été réouverte pour suivi.');
      loadPortal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FormaCareLogo size={30} />
            <div>
              <div className="text-sm font-bold text-[#27313B]">{company.name.replace(' (DÉMO)', '')}</div>
              <div className="text-xs text-[#8B9299]">Espace Bénéficiaire · {user.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#27313B] border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {feedback && (
          <div className="p-3.5 rounded-xl bg-[#E8F5ED] border border-[#16834B]/30 text-xs font-medium text-[#16834B] flex items-center justify-between">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback('')} className="underline ml-4">
              Fermer
            </button>
          </div>
        )}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#27313B]">Vos enquêtes et demandes après-prestation</h1>
            <p className="text-xs text-[#8B9299] mt-0.5">
              Cet espace privé donne accès uniquement à vos propres questionnaires et réclamations.
            </p>
          </div>
          {data && data.prestations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#16834B] hover:bg-[#126b3d] text-white text-xs font-semibold rounded-lg"
            >
              <MessageSquareWarning className="w-4 h-4" />
              <span>Déposer une réclamation</span>
            </button>
          )}
        </div>

        {loading || !data ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-[#8B9299]">
            Chargement de votre espace...
          </div>
        ) : (
          <>
            {/* Surveys */}
            <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#16834B]" />
                <h2 className="text-sm font-bold text-[#27313B]">Questionnaires reçus</h2>
              </div>
              {data.invitations.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8B9299]">Aucune enquête attribuée à votre compte.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.invitations.map((inv) => {
                    const isDone = inv.status === 'Répondue';
                    return (
                      <div key={inv.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#27313B]">{inv.prestationTitle}</div>
                          <div className="text-xs text-[#8B9299] mt-0.5">
                            {inv.questionnaireTitle} · Formateur : {inv.trainerName} · {new Date(inv.realizedAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                              isDone
                                ? 'bg-[#E8F5ED] text-[#16834B]'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {inv.status}
                          </span>
                          {!isDone && inv.status !== 'Expirée' && (
                            <button
                              type="button"
                              onClick={() => setActiveSurveyToken(inv.token)}
                              className="px-3.5 py-1.5 bg-[#16834B] hover:bg-[#126b3d] text-white text-xs font-semibold rounded-lg"
                            >
                              Répondre
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Claims */}
            {data.canViewClaims && (
              <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <MessageSquareWarning className="w-4 h-4 text-[#16834B]" />
                  <h2 className="text-sm font-bold text-[#27313B]">Suivi de vos réclamations</h2>
                </div>
                {data.claims.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8B9299]">Vous n’avez déposé aucune réclamation.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {data.claims.map((cl) => (
                      <div key={cl.id} className="p-5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-[#27313B]">
                            <span className="font-mono text-xs text-[#8B9299] mr-2">{cl.code}</span>
                            {cl.category} · {cl.prestation_title}
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 text-[#27313B]">
                            {cl.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#27313B] leading-relaxed">{cl.description}</p>
                        {cl.resolution_summary && (
                          <div className="p-3 rounded-lg bg-[#E8F5ED]/60 border border-[#16834B]/20 text-xs text-[#27313B]">
                            <strong className="text-[#16834B]">Réponse / Solution apportée :</strong> {cl.resolution_summary}
                          </div>
                        )}
                        {cl.status === 'Résolue' && cl.post_resolution_satisfied === null && (
                          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-medium text-[#27313B]">La solution apportée vous satisfait-elle ?</span>
                            <button
                              type="button"
                              onClick={() => handleVerifyClaim(cl.id, true)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#16834B] text-white font-semibold rounded-lg"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Oui, clôturer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerifyClaim(cl.id, false)}
                              className="px-3 py-1.5 border border-gray-200 text-[#27313B] font-semibold rounded-lg hover:bg-gray-50"
                            >
                              Non, réouvrir
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitClaim} className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-[#27313B]">Déposer une réclamation</h3>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Prestation concernée</label>
              <select
                value={claimPrestationId}
                onChange={(e) => setClaimPrestationId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {data?.prestations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({new Date(p.realized_at).toLocaleDateString('fr-FR')})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Catégorie</label>
                <select
                  value={claimCategory}
                  onChange={(e) => setClaimCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  {data?.claimCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Priorité</label>
                <select
                  value={claimPriority}
                  onChange={(e) => setClaimPriority(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="Basse">Basse</option>
                  <option value="Normale">Normale</option>
                  <option value="Haute">Haute</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Description</label>
              <textarea
                rows={4}
                required
                value={claimDescription}
                onChange={(e) => setClaimDescription(e.target.value)}
                placeholder="Décrivez votre réclamation..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClaimModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#27313B] border border-gray-200 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Envoyer</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
