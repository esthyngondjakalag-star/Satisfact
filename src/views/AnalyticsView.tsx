import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowRightLeft, Bot, ThumbsDown, TrendingDown, TrendingUp } from 'lucide-react';
import { HorizontalScoreBars } from '../components/Charts';
import { computeDashboardAnalytics } from '../lib/analytics';
import { apiRequest } from '../lib/api';
import type { Beneficiary, Claim, Company, Evaluation, Invitation, Prestation, Questionnaire, Trainer } from '../types';

interface AiAnalysisResult {
  executiveSummary: string;
  recurringThemes: string[];
  dissatisfactionSignals: string[];
  improvementRecommendations: string[];
}

export function AnalyticsView({
  company,
  beneficiaries,
  prestations,
  trainers,
  questionnaires,
  invitations,
  evaluations,
  claims,
}: {
  company: Company;
  beneficiaries: Beneficiary[];
  prestations: Prestation[];
  trainers: Trainer[];
  questionnaires: Questionnaire[];
  invitations: Invitation[];
  evaluations: Evaluation[];
  claims: Claim[];
}) {
  const [periodA, setPeriodA] = useState<'30d' | '90d' | '365d' | 'all'>('30d');
  const [periodB, setPeriodB] = useState<'90d' | '365d' | 'all'>('90d');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);

  const fullAnalytics = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        { period: 'all', prestationId: 'all', certification: 'all', trainerId: 'all', status: 'all' },
        company.settings.minTrainerSampleSize
      ),
    [beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims, company.settings.minTrainerSampleSize]
  );

  const compA = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        { period: periodA, prestationId: 'all', certification: 'all', trainerId: 'all', status: 'all' },
        company.settings.minTrainerSampleSize
      ),
    [beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims, periodA, company.settings.minTrainerSampleSize]
  );

  const compB = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        { period: periodB, prestationId: 'all', certification: 'all', trainerId: 'all', status: 'all' },
        company.settings.minTrainerSampleSize
      ),
    [beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims, periodB, company.settings.minTrainerSampleSize]
  );

  const topCriteria = fullAnalytics.criteriaScores.slice(0, 4);
  const bottomCriteria = [...fullAnalytics.criteriaScores].reverse().slice(0, 4);

  const lowSatisfactionTrainings = fullAnalytics.prestationScores.filter(
    (ps) => ps.avgScore !== null && ps.avgScore < 3.8
  );
  const trainersNeedingSupport = fullAnalytics.trainerMetrics.filter(
    (tm) => tm.overallAvg !== null && tm.overallAvg < 4.0
  );
  const negativeComments = evaluations.filter(
    (e) => e.sentiment === 'négatif' || (e.overallScore < 3.5 && e.generalComment)
  );

  const runAiAnalysis = async () => {
    setAiError('');
    setAiLoading(true);
    try {
      const res = await apiRequest<AiAnalysisResult>('/api/ai/analyze', { method: 'POST' });
      setAiResult(res);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Analyses et intelligence de satisfaction</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Détection des critères critiques, formations à faible satisfaction, signaux récurrents et comparatif temporel.
          </p>
        </div>
        <button
          type="button"
          onClick={runAiAnalysis}
          disabled={aiLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#27313B] hover:bg-[#1e262e] text-white rounded-lg disabled:opacity-60"
        >
          <Bot className="w-4 h-4 text-[#4ADE80]" />
          <span>{aiLoading ? 'Synthèse IA en cours...' : 'Assistance IA · Synthétiser les retours'}</span>
        </button>
      </div>

      {/* Optional Server-side Gemini AI Panel */}
      {aiError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}

      {aiResult && (
        <div className="bg-white border border-[#16834B]/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#16834B]">
              <Bot className="w-4 h-4" />
              <span>Synthèse qualitative assistée par IA (basée uniquement sur vos données réelles)</span>
            </div>
            <span className="text-[11px] text-[#8B9299]">Aide à la décision · Validation humaine requise</span>
          </div>
          <p className="text-xs text-[#27313B] leading-relaxed">{aiResult.executiveSummary}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-[#F9FAFB] border border-gray-200 space-y-2">
              <div className="font-bold text-[#27313B]">Thèmes récurrents</div>
              <ul className="list-disc pl-4 space-y-1 text-[#27313B]">
                {(aiResult.recurringThemes || []).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="p-3.5 rounded-lg bg-red-50/50 border border-red-100 space-y-2">
              <div className="font-bold text-red-800">Signaux d’insatisfaction</div>
              <ul className="list-disc pl-4 space-y-1 text-red-900">
                {(aiResult.dissatisfactionSignals || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="p-3.5 rounded-lg bg-[#E8F5ED]/60 border border-[#16834B]/20 space-y-2">
              <div className="font-bold text-[#16834B]">Pistes d’amélioration</div>
              <ul className="list-disc pl-4 space-y-1 text-[#27313B]">
                {(aiResult.improvementRecommendations || []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Top & Bottom Criteria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#16834B]" />
            <h2 className="text-sm font-bold text-[#27313B]">Critères les mieux notés</h2>
          </div>
          <HorizontalScoreBars
            items={topCriteria.map((c) => ({
              label: c.label,
              value: c.avgScore,
              subtitle: `n=${c.count}`,
              color: '#16834B',
            }))}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-[#27313B]">Critères les moins bien notés (axes prioritaires)</h2>
          </div>
          <HorizontalScoreBars
            items={bottomCriteria.map((c) => ({
              label: c.label,
              value: c.avgScore,
              subtitle: `n=${c.count}`,
              color: c.avgScore < 3.5 ? '#DC2626' : '#D97706',
            }))}
          />
        </div>
      </div>

      {/* Period Comparison */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#16834B]" />
            <h2 className="text-sm font-bold text-[#27313B]">Comparaison entre périodes</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <select value={periodA} onChange={(e) => setPeriodA(e.target.value as any)} className="px-2.5 py-1.5 border border-gray-200 rounded-lg">
              <option value="30d">Période A : 30 derniers jours</option>
              <option value="90d">Période A : 90 derniers jours</option>
              <option value="365d">Période A : 12 mois</option>
              <option value="all">Période A : Tout</option>
            </select>
            <span className="text-[#8B9299]">vs</span>
            <select value={periodB} onChange={(e) => setPeriodB(e.target.value as any)} className="px-2.5 py-1.5 border border-gray-200 rounded-lg">
              <option value="90d">Période B : 90 derniers jours</option>
              <option value="365d">Période B : 12 mois</option>
              <option value="all">Période B : Historique complet</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-[#F9FAFB] border border-gray-200">
            <div className="text-[#8B9299]">Satisfaction globale</div>
            <div className="mt-1 font-mono font-bold text-sm text-[#27313B]">
              {compA.kpis.globalSatisfaction ?? '—'} vs {compB.kpis.globalSatisfaction ?? '—'} /5
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F9FAFB] border border-gray-200">
            <div className="text-[#8B9299]">Participation</div>
            <div className="mt-1 font-mono font-bold text-sm text-[#27313B]">
              {compA.kpis.participationRate}% vs {compB.kpis.participationRate}%
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F9FAFB] border border-gray-200">
            <div className="text-[#8B9299]">Note formateurs</div>
            <div className="mt-1 font-mono font-bold text-sm text-[#27313B]">
              {compA.kpis.avgTrainerScore ?? '—'} vs {compB.kpis.avgTrainerScore ?? '—'} /5
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#F9FAFB] border border-gray-200">
            <div className="text-[#8B9299]">Retours négatifs</div>
            <div className="mt-1 font-mono font-bold text-sm text-[#27313B]">
              {compA.kpis.negativeCount} vs {compB.kpis.negativeCount}
            </div>
          </div>
        </div>
      </div>

      {/* Dysfunction & Support Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-[#27313B]">Formations & certifications sous le seuil de vigilance (&lt; 3,8/5)</h2>
          {lowSatisfactionTrainings.length === 0 ? (
            <p className="text-xs text-[#8B9299]">Aucune formation ne présente une moyenne inférieure à 3,8/5.</p>
          ) : (
            <div className="space-y-2">
              {lowSatisfactionTrainings.map((ps) => (
                <div key={ps.prestation.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#27313B]">{ps.prestation.title}</div>
                    <div className="text-[#8B9299]">
                      {ps.prestation.trainerName} · {ps.responseCount} réponse(s) · {ps.claimsCount} réclamation(s)
                    </div>
                  </div>
                  <span className="font-mono font-bold text-amber-800">{ps.avgScore}/5</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-xs font-bold text-[#27313B] pt-3">Encadreurs nécessitant un accompagnement pédagogique</h3>
          {trainersNeedingSupport.length === 0 ? (
            <p className="text-xs text-[#8B9299]">Tous les formateurs évalués atteignent au moins 4,0/5.</p>
          ) : (
            <div className="space-y-2">
              {trainersNeedingSupport.map((tm) => (
                <div key={tm.trainer.id} className="p-3 rounded-lg border border-gray-200 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#27313B]">{tm.trainer.name}</div>
                    <div className="text-[#8B9299]">
                      {tm.trainer.specialty} · n={tm.respondentsCount} {!tm.isReliableSample ? '(échantillon indicatif)' : ''}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-[#27313B]">{tm.overallAvg}/5</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Negative Comments & Recurring Claim Causes */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold text-[#27313B]">Commentaires critiques et motifs fréquents</h2>
            </div>
            {negativeComments.length === 0 ? (
              <p className="text-xs text-[#8B9299]">Aucun commentaire négatif enregistré.</p>
            ) : (
              <div className="space-y-2.5 max-h-52 overflow-y-auto">
                {negativeComments.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-lg border border-red-100 bg-red-50/30 text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-[#27313B]">
                      <span>{ev.prestationTitle}</span>
                      <span className="font-mono text-red-700">{ev.overallScore}/5</span>
                    </div>
                    <p className="text-[#27313B]">« {ev.generalComment} »</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-bold text-[#27313B] mb-2">Motifs de réclamation récurrents</h3>
            <HorizontalScoreBars
              max={Math.max(1, ...fullAnalytics.charts.claimsByCategory.map((c) => c.count))}
              unit=" dossier(s)"
              items={fullAnalytics.charts.claimsByCategory.map((c) => ({
                label: c.label,
                value: c.count,
                color: '#27313B',
              }))}
              emptyLabel="Aucune réclamation enregistrée"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
