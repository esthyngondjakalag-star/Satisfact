import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, Star } from 'lucide-react';
import { FormaCareLogo, TrainerAvatar } from '../components/BrandMark';
import { apiRequest } from '../lib/api';
import { DEFAULT_CLAIM_CATEGORIES } from '../constants/standards';
import type { EvaluationAnswer, QuestionItem } from '../types';

interface PublicSurveyData {
  invitation: {
    id: string;
    code: string;
    token: string;
    allowAnonymous: boolean;
    status: string;
    expiresAt: string | null;
  };
  company: {
    id: string;
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    gdprConsentText: string;
    allowAnonymous: boolean;
  };
  prestation: {
    id: string;
    title: string;
    type: string;
    certificationName: string;
    realizedAt: string;
    sessionCode: string;
    trainerName: string;
    trainerSpecialty: string;
    trainerPhoto: string;
  };
  questionnaire: {
    id: string;
    title: string;
    description: string;
    allowAnonymous: boolean;
    questions: QuestionItem[];
  };
  beneficiary: { id: string; name: string; companyName: string } | null;
}

export function PublicSurveyView({
  token,
  onClose,
}: {
  token: string;
  onClose?: () => void;
}) {
  const [data, setData] = useState<PublicSurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, EvaluationAnswer>>({});
  const [generalComment, setGeneralComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [fileClaim, setFileClaim] = useState(false);
  const [claimCategory, setClaimCategory] = useState(DEFAULT_CLAIM_CATEGORIES[0]);
  const [claimDescription, setClaimDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ overallScore: number; sentiment: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiRequest<PublicSurveyData>(`/api/public/survey/${encodeURIComponent(token)}`)
      .then((res) => {
        setData(res);
        setIsAnonymous(!res.beneficiary && (res.invitation.allowAnonymous || res.questionnaire.allowAnonymous));
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const setAnswerValue = (qId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...(prev[qId] || {}), value },
    }));
  };

  const setAnswerComment = (qId: string, comment: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...(prev[qId] || { value: '' }), comment },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ overallScore: number; sentiment: string }>(
        `/api/public/survey/${encodeURIComponent(token)}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({
            answers,
            generalComment,
            isAnonymous,
            gdprConsent,
            fileClaim,
            claimCategory,
            claimDescription,
          }),
        }
      );
      setSubmittedResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center text-sm text-[#8B9299]">
          Chargement de votre questionnaire d’évaluation...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-lg font-bold text-[#27313B]">Enquête indisponible</h1>
          <p className="text-sm text-[#8B9299]">{error}</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-[#27313B] text-white rounded-lg hover:opacity-90"
            >
              Retour à l’application
            </button>
          )}
        </div>
      </div>
    );
  }

  if (submittedResult) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-lg w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#E8F5ED] text-[#16834B] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-[#27313B]">Merci pour votre évaluation !</h1>
          <p className="text-sm text-[#8B9299]">
            Votre retour a bien été enregistré pour la prestation <strong>{data?.prestation.title}</strong>. Ce lien unique est désormais clôturé afin de garantir l’intégrité des résultats.
          </p>
          <div className="p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-xs text-[#27313B] flex justify-around">
            <div>
              <span className="text-[#8B9299] block">Score enregistré</span>
              <span className="font-mono font-bold text-base tabular-nums">{submittedResult.overallScore} / 5</span>
            </div>
            <div>
              <span className="text-[#8B9299] block">Mode</span>
              <span className="font-semibold text-base">{isAnonymous ? 'Anonyme' : 'Identifié'}</span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#16834B] text-white text-xs font-semibold rounded-lg hover:bg-[#126b3d]"
            >
              Retourner à FormaCare
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Group questions by category
  const categoriesOrder: string[] = [];
  const grouped = new Map<string, QuestionItem[]>();
  for (const q of data.questionnaire.questions) {
    if (!grouped.has(q.categoryLabel)) {
      grouped.set(q.categoryLabel, []);
      categoriesOrder.push(q.categoryLabel);
    }
    grouped.get(q.categoryLabel)!.push(q);
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#27313B] hover:text-[#16834B]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quitter l’aperçu / revenir</span>
          </button>
        )}

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {data.company.logoUrl ? (
                <img src={data.company.logoUrl} alt={data.company.name} className="h-9 w-auto object-contain" />
              ) : (
                <FormaCareLogo size={32} />
              )}
              <div>
                <div className="text-sm font-bold text-[#27313B]">{data.company.name.replace(' (DÉMO)', '')}</div>
                <div className="text-xs text-[#8B9299]">Évaluation qualité après-prestation · {data.invitation.code}</div>
              </div>
            </div>
            <div className="text-xs text-[#8B9299] font-mono">
              {new Date(data.prestation.realizedAt).toLocaleDateString('fr-FR')}
            </div>
          </div>

          <div className="mt-6">
            <h1 className="text-xl sm:text-2xl font-bold text-[#27313B]">{data.questionnaire.title}</h1>
            <p className="text-sm text-[#8B9299] mt-1">{data.questionnaire.description}</p>

            <div className="mt-5 p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-[#8B9299]">Prestation évaluée</div>
                <div className="text-sm font-semibold text-[#27313B] mt-0.5">{data.prestation.title}</div>
                <div className="text-xs text-[#8B9299] mt-0.5">
                  {data.prestation.type}
                  {data.prestation.sessionCode ? ` · Session ${data.prestation.sessionCode}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TrainerAvatar name={data.prestation.trainerName} photoUrl={data.prestation.trainerPhoto} />
                <div>
                  <div className="text-xs text-[#8B9299]">Formateur / Encadreur</div>
                  <div className="text-sm font-semibold text-[#27313B]">{data.prestation.trainerName}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {categoriesOrder.map((catLabel) => (
            <div key={catLabel} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
              <h2 className="text-base font-bold text-[#16834B] pb-3 border-b border-gray-100">{catLabel}</h2>
              {grouped.get(catLabel)!.map((q) => {
                const currentVal = answers[q.id]?.value;
                return (
                  <div key={q.id} className="space-y-2.5">
                    <label className="block text-sm font-medium text-[#27313B]">
                      {q.label}
                      {q.required && <span className="text-red-600 ml-1">*</span>}
                    </label>

                    {q.type === 'stars' && (
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswerValue(q.id, n)}
                            className={`p-2 rounded-lg border transition-colors ${
                              Number(currentVal || 0) >= n
                                ? 'bg-[#E8F5ED] border-[#16834B] text-[#16834B]'
                                : 'border-gray-200 text-gray-300 hover:border-gray-300'
                            }`}
                            aria-label={`${n} étoile(s)`}
                          >
                            <Star className="w-5 h-5 fill-current" />
                          </button>
                        ))}
                        {currentVal && (
                          <span className="text-xs font-mono font-semibold text-[#27313B] ml-2">{currentVal}/5</span>
                        )}
                      </div>
                    )}

                    {q.type === 'scale_5' && (
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswerValue(q.id, n)}
                            className={`w-11 h-10 rounded-lg text-sm font-semibold font-mono border transition-colors ${
                              currentVal === n
                                ? 'bg-[#16834B] text-white border-[#16834B]'
                                : 'bg-white text-[#27313B] border-gray-200 hover:bg-[#E8F5ED]/60'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'scale_10' && (
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswerValue(q.id, n)}
                            className={`w-9 h-9 rounded-lg text-xs font-semibold font-mono border transition-colors ${
                              currentVal === n
                                ? 'bg-[#16834B] text-white border-[#16834B]'
                                : 'bg-white text-[#27313B] border-gray-200 hover:bg-[#E8F5ED]/60'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'nps' && (
                      <div>
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setAnswerValue(q.id, n)}
                              className={`w-9 h-9 rounded-lg text-xs font-semibold font-mono border transition-colors ${
                                currentVal === n
                                  ? 'bg-[#16834B] text-white border-[#16834B]'
                                  : 'bg-white text-[#27313B] border-gray-200 hover:bg-[#E8F5ED]/60'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-between text-[11px] text-[#8B9299] mt-1">
                          <span>0 · Pas du tout probable</span>
                          <span>10 · Extrêmement probable</span>
                        </div>
                      </div>
                    )}

                    {q.type === 'yes_no' && (
                      <div className="flex gap-3">
                        {[
                          { label: 'Oui', val: true },
                          { label: 'Non', val: false },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setAnswerValue(q.id, opt.val)}
                            className={`px-5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                              currentVal === opt.val
                                ? 'bg-[#16834B] text-white border-[#16834B]'
                                : 'bg-white text-[#27313B] border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'single_choice' && (
                      <div className="space-y-2">
                        {(q.options || []).map((opt) => (
                          <label key={opt} className="flex items-center gap-2.5 text-sm text-[#27313B] cursor-pointer">
                            <input
                              type="radio"
                              name={q.id}
                              checked={currentVal === opt}
                              onChange={() => setAnswerValue(q.id, opt)}
                              className="accent-[#16834B]"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === 'multiple_choice' && (
                      <div className="space-y-2">
                        {(q.options || []).map((opt) => {
                          const arr = Array.isArray(currentVal) ? currentVal : [];
                          const checked = arr.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2.5 text-sm text-[#27313B] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked ? arr.filter((x) => x !== opt) : [...arr, opt];
                                  setAnswerValue(q.id, next);
                                }}
                                className="accent-[#16834B]"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'open_text' && (
                      <textarea
                        rows={3}
                        value={String(currentVal || '')}
                        onChange={(e) => setAnswerValue(q.id, e.target.value)}
                        placeholder="Votre réponse détaillée..."
                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                      />
                    )}

                    {q.commentMode !== 'none' && (
                      <input
                        type="text"
                        required={q.commentMode === 'required'}
                        value={answers[q.id]?.comment || ''}
                        onChange={(e) => setAnswerComment(q.id, e.target.value)}
                        placeholder={
                          q.commentMode === 'required'
                            ? 'Commentaire obligatoire pour justifier votre note...'
                            : 'Commentaire facultatif...'
                        }
                        className="w-full px-3 py-2 text-xs bg-[#F9FAFB] border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* General comment + Optional claim + Anonymity + GDPR */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#27313B] mb-1.5">
                Commentaire général sur votre expérience
              </label>
              <textarea
                rows={3}
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
                placeholder="Partagez librement ce qui a bien fonctionné ou ce qui pourrait être amélioré..."
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
              />
            </div>

            <div className="pt-3 border-t border-gray-100">
              <label className="flex items-center gap-2.5 text-sm font-medium text-[#27313B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={fileClaim}
                  onChange={(e) => setFileClaim(e.target.checked)}
                  className="accent-[#16834B]"
                />
                <span>Je souhaite également signaler un incident ou déposer une réclamation formelle</span>
              </label>

              {fileClaim && (
                <div className="mt-3 p-4 bg-[#F9FAFB] border border-gray-200 rounded-xl space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#27313B] mb-1">Catégorie de réclamation</label>
                    <select
                      value={claimCategory}
                      onChange={(e) => setClaimCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                    >
                      {DEFAULT_CLAIM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#27313B] mb-1">Description détaillée</label>
                    <textarea
                      rows={3}
                      required={fileClaim}
                      value={claimDescription}
                      onChange={(e) => setClaimDescription(e.target.value)}
                      placeholder="Décrivez précisément le dysfonctionnement constaté..."
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#16834B]"
                    />
                  </div>
                </div>
              )}
            </div>

            {(data.company.allowAnonymous && (data.questionnaire.allowAnonymous || data.invitation.allowAnonymous)) && (
              <div className="pt-3 border-t border-gray-100">
                <label className="flex items-center gap-2.5 text-xs text-[#27313B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="accent-[#16834B]"
                  />
                  <span>Soumettre cette évaluation de manière anonyme (mon identité ne sera pas rattachée à ma réponse)</span>
                </label>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <label className="flex items-start gap-2.5 text-xs text-[#27313B] cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={gdprConsent}
                  onChange={(e) => setGdprConsent(e.target.checked)}
                  className="accent-[#16834B] mt-0.5"
                />
                <span>{data.company.gdprConsentText}</span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#8B9299] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Transmission sécurisée</span>
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#16834B] hover:bg-[#126b3d] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {submitting ? 'Envoi en cours...' : 'Envoyer mon évaluation'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
