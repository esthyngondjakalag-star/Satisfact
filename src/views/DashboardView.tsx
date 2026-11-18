import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ClipboardList,
  MessageSquareWarning,
  RotateCcw,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  DonutDistributionChart,
  HorizontalScoreBars,
  LineEvolutionChart,
} from '../components/Charts';
import { computeDashboardAnalytics, type DashboardFilters } from '../lib/analytics';
import type {
  Beneficiary,
  Claim,
  Company,
  Evaluation,
  Invitation,
  NavSection,
  Prestation,
  Questionnaire,
  Trainer,
} from '../types';

export function DashboardView({
  company,
  beneficiaries,
  prestations,
  trainers,
  questionnaires,
  invitations,
  evaluations,
  claims,
  onNavigate,
}: {
  company: Company;
  beneficiaries: Beneficiary[];
  prestations: Prestation[];
  trainers: Trainer[];
  questionnaires: Questionnaire[];
  invitations: Invitation[];
  evaluations: Evaluation[];
  claims: Claim[];
  onNavigate: (sec: NavSection) => void;
}) {
  const [filters, setFilters] = useState<DashboardFilters>({
    period: 'all',
    prestationId: 'all',
    certification: 'all',
    trainerId: 'all',
    status: 'all',
  });

  const analytics = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        filters,
        company.settings.minTrainerSampleSize
      ),
    [beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims, filters, company.settings.minTrainerSampleSize]
  );

  const certifications = useMemo(
    () => Array.from(new Set(prestations.map((p) => p.certificationName).filter(Boolean))),
    [prestations]
  );

  const { kpis, charts, trainerMetrics } = analytics;

  const rankedTrainers = useMemo(
    () =>
      trainerMetrics
        .filter((tm) => tm.overallAvg !== null)
        .sort((a, b) => (b.overallAvg || 0) - (a.overallAvg || 0))
        .map((tm) => ({
          label: tm.trainer.name,
          value: tm.overallAvg || 0,
          subtitle: tm.isReliableSample ? `n=${tm.respondentsCount}` : `n=${tm.respondentsCount} · indicatif`,
          color: tm.isReliableSample ? '#16834B' : '#8B9299',
        })),
    [trainerMetrics]
  );

  const resetFilters = () =>
    setFilters({
      period: 'all',
      prestationId: 'all',
      certification: 'all',
      trainerId: 'all',
      status: 'all',
    });

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#27313B]">Tableau de bord qualité après-prestation</h1>
            <p className="text-xs text-[#8B9299] mt-0.5">
              Indicateurs calculés en temps réel à partir des évaluations, invitations et réclamations enregistrées.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#27313B] border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filters.period}
            onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value as DashboardFilters['period'] }))}
            className="px-3 py-2 text-xs bg-[#F9FAFB] border border-gray-200 rounded-lg text-[#27313B]"
          >
            <option value="all">Période : Toutes les données</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="365d">12 derniers mois</option>
            <option value="custom">Période personnalisée</option>
          </select>

          <select
            value={filters.prestationId}
            onChange={(e) => setFilters((f) => ({ ...f, prestationId: e.target.value }))}
            className="px-3 py-2 text-xs bg-[#F9FAFB] border border-gray-200 rounded-lg text-[#27313B]"
          >
            <option value="all">Prestation : Toutes</option>
            {prestations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <select
            value={filters.certification}
            onChange={(e) => setFilters((f) => ({ ...f, certification: e.target.value }))}
            className="px-3 py-2 text-xs bg-[#F9FAFB] border border-gray-200 rounded-lg text-[#27313B]"
          >
            <option value="all">Certification : Toutes</option>
            {certifications.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filters.trainerId}
            onChange={(e) => setFilters((f) => ({ ...f, trainerId: e.target.value }))}
            className="px-3 py-2 text-xs bg-[#F9FAFB] border border-gray-200 rounded-lg text-[#27313B]"
          >
            <option value="all">Formateur : Tous</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 text-xs bg-[#F9FAFB] border border-gray-200 rounded-lg text-[#27313B]"
          >
            <option value="all">Statut suivi : Tous</option>
            <option value="À enquêter">À enquêter</option>
            <option value="Enquête envoyée">Enquête envoyée</option>
            <option value="Suivi en cours">Suivi en cours</option>
            <option value="Clôturée">Clôturée</option>
          </select>
        </div>

        {filters.period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="text-xs text-[#8B9299] flex items-center gap-2">
              Du
              <input
                type="date"
                value={filters.customStart || ''}
                onChange={(e) => setFilters((f) => ({ ...f, customStart: e.target.value }))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-[#27313B]"
              />
            </label>
            <label className="text-xs text-[#8B9299] flex items-center gap-2">
              Au
              <input
                type="date"
                value={filters.customEnd || ''}
                onChange={(e) => setFilters((f) => ({ ...f, customEnd: e.target.value }))}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-[#27313B]"
              />
            </label>
          </div>
        )}
      </div>

      {/* Empty state if brand new production company */}
      {prestations.length === 0 && evaluations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center space-y-3">
          <h2 className="text-base font-bold text-[#27313B]">Votre espace production est prêt</h2>
          <p className="text-xs text-[#8B9299] max-w-lg mx-auto">
            Aucune donnée fictive n’est mélangée à votre entreprise. Commencez par importer vos bénéficiaires et prestations réalisées, ou créez votre premier questionnaire post-formation.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('beneficiaries')}
              className="px-4 py-2 bg-[#16834B] text-white text-xs font-semibold rounded-lg hover:bg-[#126b3d]"
            >
              Importer bénéficiaires (Excel/CSV)
            </button>
            <button
              type="button"
              onClick={() => onNavigate('prestations')}
              className="px-4 py-2 border border-gray-200 text-[#27313B] text-xs font-semibold rounded-lg hover:bg-gray-50"
            >
              Ajouter une prestation réalisée
            </button>
          </div>
        </div>
      ) : null}

      {/* Primary KPI Grid (All 11 Indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#8B9299]">
            <span>Score global de satisfaction</span>
            <Award className="w-4 h-4 text-[#16834B]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#27313B] tabular-nums">
              {kpis.globalSatisfaction !== null ? `${kpis.globalSatisfaction.toFixed(2)}/5` : '—'}
            </span>
            {kpis.satisfactionDelta !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                  kpis.satisfactionDelta >= 0 ? 'text-[#16834B]' : 'text-red-600'
                }`}
              >
                {kpis.satisfactionDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {kpis.satisfactionDelta >= 0 ? '+' : ''}
                {kpis.satisfactionDelta}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#8B9299] mt-1 tabular-nums">
            {kpis.npsValue !== null ? `NPS : ${kpis.npsValue > 0 ? `+${kpis.npsValue}` : kpis.npsValue}` : 'NPS en attente de réponses'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#8B9299]">
            <span>Note moyenne des formateurs</span>
            <Users className="w-4 h-4 text-[#16834B]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#27313B] tabular-nums">
            {kpis.avgTrainerScore !== null ? `${kpis.avgTrainerScore.toFixed(2)}/5` : '—'}
          </div>
          <div className="text-[11px] text-[#8B9299] mt-1 tabular-nums">
            {kpis.totalBeneficiariesEvaluated} bénéficiaires évalués · {kpis.totalPrestationsFollowed} prestations
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#8B9299]">
            <span>Taux de participation</span>
            <Send className="w-4 h-4 text-[#16834B]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#27313B] tabular-nums">{kpis.participationRate}%</div>
          <div className="text-[11px] text-[#8B9299] mt-1 tabular-nums">
            {kpis.responsesReceived} réponses reçues / {kpis.surveysSent} enquêtes envoyées
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-[#8B9299]">
            <span>Réclamations & résolution</span>
            <MessageSquareWarning className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#27313B] tabular-nums">{kpis.claimsCount}</span>
            <span className="text-xs font-semibold text-[#16834B] tabular-nums">
              {kpis.claimResolutionRate}% résolues
            </span>
          </div>
          <div className="text-[11px] text-[#8B9299] mt-1 tabular-nums">
            {kpis.negativeCount} retour(s) négatif(s) ·{' '}
            {kpis.avgResolutionHours !== null ? `Délai moy. ${kpis.avgResolutionHours}h` : 'Aucun délai calculé'}
          </div>
        </div>
      </div>

      {/* Compact Secondary Indicator Strip covering remaining metrics */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
        <div>
          <span className="text-[#8B9299] block">Bénéficiaires évalués</span>
          <span className="font-bold text-sm text-[#27313B] tabular-nums">{kpis.totalBeneficiariesEvaluated}</span>
        </div>
        <div>
          <span className="text-[#8B9299] block">Prestations suivies</span>
          <span className="font-bold text-sm text-[#27313B] tabular-nums">{kpis.totalPrestationsFollowed}</span>
        </div>
        <div>
          <span className="text-[#8B9299] block">Enquêtes envoyées</span>
          <span className="font-bold text-sm text-[#27313B] tabular-nums">{kpis.surveysSent}</span>
        </div>
        <div>
          <span className="text-[#8B9299] block">Réponses reçues</span>
          <span className="font-bold text-sm text-[#27313B] tabular-nums">{kpis.responsesReceived}</span>
        </div>
        <div>
          <span className="text-[#8B9299] block">Retours négatifs</span>
          <span className="font-bold text-sm text-red-600 tabular-nums">{kpis.negativeCount}</span>
        </div>
        <div>
          <span className="text-[#8B9299] block">Évolution satisfaction</span>
          <span className="font-bold text-sm text-[#16834B] tabular-nums">
            {kpis.satisfactionDelta !== null
              ? `${kpis.satisfactionDelta >= 0 ? '+' : ''}${kpis.satisfactionDelta} pts`
              : kpis.globalSatisfaction !== null
              ? `${kpis.globalSatisfaction}/5`
              : '—'}
          </span>
        </div>
      </div>

      {/* Row 1 Charts: Evolution Curve + Sentiment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#27313B]">Courbe d’évolution de la satisfaction</h2>
              <p className="text-xs text-[#8B9299]">Moyenne mensuelle des évaluations reçues (sur 5)</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('evaluations')}
              className="text-xs font-semibold text-[#16834B] hover:underline"
            >
              Voir les évaluations
            </button>
          </div>
          <LineEvolutionChart data={charts.evolutionSeries} />
        </div>

        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-[#27313B]">Répartition des avis bénéficiaires</h2>
          <p className="text-xs text-[#8B9299] mb-4">Positifs (≥4/5), neutres (3–3,9/5) et négatifs (&lt;3/5)</p>
          <DonutDistributionChart
            centerValue={filteredCountLabel(kpis.responsesReceived)}
            centerLabel="avis"
            segments={[
              { label: 'Avis positifs', value: kpis.positiveCount, color: '#16834B' },
              { label: 'Avis neutres', value: kpis.neutralCount, color: '#D97706' },
              { label: 'Avis négatifs', value: kpis.negativeCount, color: '#DC2626' },
            ]}
          />
        </div>
      </div>

      {/* Row 2 Charts: Trainer Performance + Satisfaction by Type & Certification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#27313B]">Performances des formateurs</h2>
            <button
              type="button"
              onClick={() => onNavigate('trainers')}
              className="text-xs font-semibold text-[#16834B] hover:underline"
            >
              Comparer
            </button>
          </div>
          <HorizontalScoreBars items={rankedTrainers} max={5} unit="/5" />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-[#27313B] mb-4">Satisfaction par type de formation</h2>
          <HorizontalScoreBars
            items={charts.byTrainingType.map((t) => ({
              label: t.label,
              value: t.score,
              subtitle: `n=${t.count}`,
            }))}
            max={5}
            unit="/5"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-[#27313B] mb-4">Satisfaction par certification</h2>
          <HorizontalScoreBars
            items={charts.byCertification.map((c) => ({
              label: c.label,
              value: c.score,
              subtitle: `n=${c.count}`,
            }))}
            max={5}
            unit="/5"
            emptyLabel="Aucune évaluation de certification sur cette sélection"
          />
        </div>
      </div>

      {/* Row 3 Charts: Response Rate by Session + Claims by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#27313B]">Taux de réponse aux enquêtes par prestation</h2>
            <button
              type="button"
              onClick={() => onNavigate('invitations')}
              className="text-xs font-semibold text-[#16834B] hover:underline"
            >
              Relancer
            </button>
          </div>
          <HorizontalScoreBars
            items={charts.responseRateByPrestation.map((r) => ({
              label: r.label,
              value: r.score,
              subtitle: `${r.responded}/${r.count}`,
            }))}
            max={100}
            unit="%"
          />
        </div>

        <div className="lg:col-span-6 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#27313B]">Répartition des réclamations par catégorie</h2>
            <button
              type="button"
              onClick={() => onNavigate('claims')}
              className="text-xs font-semibold text-[#16834B] hover:underline"
            >
              Traiter
            </button>
          </div>
          <DonutDistributionChart
            centerValue={kpis.claimsCount}
            centerLabel="dossiers"
            emptyLabel="Aucune réclamation sur la période"
            segments={charts.claimsByCategory.map((c, idx) => {
              const palette = ['#DC2626', '#D97706', '#27313B', '#16834B', '#4B9CD3', '#8B9299'];
              return { label: c.label, value: c.count, color: palette[idx % palette.length] };
            })}
          />
        </div>
      </div>

      {/* Quick Actionable Alerts Summary */}
      {(analytics.filteredClaims.some((c) => c.status === 'Nouvelle' || c.priority === 'Urgente') ||
        trainerMetrics.some((t) => !t.isReliableSample && t.respondentsCount > 0)) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[#27313B] space-y-1">
              <div className="font-semibold">Points d’attention qualité</div>
              <div className="text-[#8B9299]">
                {analytics.filteredClaims.filter((c) => c.status !== 'Clôturée' && c.status !== 'Résolue').length}{' '}
                réclamation(s) active(s) à traiter ·{' '}
                {trainerMetrics.filter((t) => !t.isReliableSample && t.respondentsCount > 0).length} formateur(s) avec
                échantillon insuffisant (&lt; {company.settings.minTrainerSampleSize} réponses).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('claims')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#27313B] text-white text-xs font-semibold rounded-lg hover:opacity-90"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Ouvrir les réclamations</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#E8F5ED] text-[#16834B] text-xs font-semibold rounded-lg hover:bg-[#d8efe1]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Rapport direction</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function filteredCountLabel(n: number) {
  return n;
}
