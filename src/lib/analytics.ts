import type {
  Beneficiary,
  Claim,
  Evaluation,
  Invitation,
  Prestation,
  Questionnaire,
  Trainer,
} from '../types';

export interface DashboardFilters {
  period: 'all' | '30d' | '90d' | '365d' | 'custom';
  customStart?: string;
  customEnd?: string;
  prestationId: string;
  certification: string;
  trainerId: string;
  status: string;
}

export function isWithinPeriod(
  isoDate: string,
  period: DashboardFilters['period'],
  customStart?: string,
  customEnd?: string,
  offsetDays = 0
): boolean {
  if (period === 'all') return true;
  const d = new Date(isoDate).getTime();
  if (Number.isNaN(d)) return false;

  const now = Date.now() - offsetDays * 86400 * 1000;
  if (period === '30d') return d >= now - 30 * 86400 * 1000 && d <= now;
  if (period === '90d') return d >= now - 90 * 86400 * 1000 && d <= now;
  if (period === '365d') return d >= now - 365 * 86400 * 1000 && d <= now;
  if (period === 'custom') {
    const start = customStart ? new Date(customStart).getTime() : 0;
    const end = customEnd ? new Date(customEnd).getTime() + 86400 * 1000 - 1 : Infinity;
    return d >= start && d <= end;
  }
  return true;
}

export interface TrainerMetrics {
  trainer: Trainer;
  sessionsCount: number;
  respondentsCount: number;
  isReliableSample: boolean;
  overallAvg: number | null;
  pedagogie: number | null;
  maitrise: number | null;
  communication: number | null;
  disponibilite: number | null;
  satisfaction: number | null;
  evolution: { label: string; score: number; count: number }[];
  comments: { id: string; score: number; comment: string; prestationTitle: string; submittedAt: string }[];
}

export function computeDashboardAnalytics(
  data: {
    beneficiaries: Beneficiary[];
    prestations: Prestation[];
    trainers: Trainer[];
    questionnaires: Questionnaire[];
    invitations: Invitation[];
    evaluations: Evaluation[];
    claims: Claim[];
  },
  filters: DashboardFilters,
  minTrainerSampleSize = 3
) {
  const filteredPrestations = data.prestations.filter((p) => {
    if (!isWithinPeriod(p.realizedAt, filters.period, filters.customStart, filters.customEnd)) return false;
    if (filters.prestationId !== 'all' && p.id !== filters.prestationId) return false;
    if (filters.certification !== 'all' && p.certificationName !== filters.certification) return false;
    if (filters.trainerId !== 'all' && p.trainerId !== filters.trainerId) return false;
    if (filters.status !== 'all' && p.followUpStatus !== filters.status) return false;
    return true;
  });

  const matchingPrsIds = new Set(filteredPrestations.map((p) => p.id));

  const filteredInvitations = data.invitations.filter((i) => {
    if (!matchingPrsIds.has(i.prestationId)) return false;
    return true;
  });

  const filteredEvaluations = data.evaluations.filter((e) => {
    if (!matchingPrsIds.has(e.prestationId)) return false;
    if (!isWithinPeriod(e.submittedAt, filters.period, filters.customStart, filters.customEnd)) return false;
    return true;
  });

  const filteredClaims = data.claims.filter((c) => {
    if (!matchingPrsIds.has(c.prestationId)) return false;
    return true;
  });

  // Previous period delta for satisfaction evolution
  const prevOffset = filters.period === '30d' ? 30 : filters.period === '90d' ? 90 : filters.period === '365d' ? 365 : 0;
  let satisfactionDelta: number | null = null;
  if (prevOffset > 0) {
    const prevEvals = data.evaluations.filter((e) =>
      isWithinPeriod(e.submittedAt, filters.period, filters.customStart, filters.customEnd, prevOffset)
    );
    if (prevEvals.length > 0 && filteredEvaluations.length > 0) {
      const curAvg = filteredEvaluations.reduce((s, e) => s + e.overallScore, 0) / filteredEvaluations.length;
      const prevAvg = prevEvals.reduce((s, e) => s + e.overallScore, 0) / prevEvals.length;
      satisfactionDelta = Number((curAvg - prevAvg).toFixed(2));
    }
  }

  // Unique evaluated beneficiaries (non-anonymous identified + anonymous count)
  const uniqueBenSet = new Set<string>();
  let anonResponses = 0;
  for (const e of filteredEvaluations) {
    if (e.beneficiaryId) uniqueBenSet.add(e.beneficiaryId);
    else anonResponses++;
  }
  const totalBeneficiariesEvaluated = uniqueBenSet.size + anonResponses;

  const sentInvitations = filteredInvitations.filter((i) => i.status !== 'À envoyer');
  const respondedInvitations = filteredInvitations.filter((i) => i.status === 'Répondue');
  const participationRate =
    sentInvitations.length > 0
      ? Number(((respondedInvitations.length / sentInvitations.length) * 100).toFixed(1))
      : 0;

  const globalSatisfaction =
    filteredEvaluations.length > 0
      ? Number(
          (filteredEvaluations.reduce((sum, e) => sum + e.overallScore, 0) / filteredEvaluations.length).toFixed(2)
        )
      : null;

  const avgTrainerScore =
    filteredEvaluations.length > 0
      ? Number(
          (filteredEvaluations.reduce((sum, e) => sum + e.trainerScore, 0) / filteredEvaluations.length).toFixed(2)
        )
      : null;

  const resolvedClaims = filteredClaims.filter((c) => c.status === 'Résolue' || c.status === 'Clôturée');
  const claimResolutionRate =
    filteredClaims.length > 0 ? Number(((resolvedClaims.length / filteredClaims.length) * 100).toFixed(1)) : 100;

  // Average claim resolution delay in hours
  const resolvedWithDuration = resolvedClaims.filter((c) => c.resolvedAt && c.receivedAt);
  const avgResolutionHours =
    resolvedWithDuration.length > 0
      ? Number(
          (
            resolvedWithDuration.reduce(
              (sum, c) => sum + Math.max(1, (new Date(c.resolvedAt!).getTime() - new Date(c.receivedAt).getTime()) / 3600000),
              0
            ) / resolvedWithDuration.length
          ).toFixed(1)
        )
      : null;

  const negativeCount = filteredEvaluations.filter((e) => e.sentiment === 'négatif').length;
  const neutralCount = filteredEvaluations.filter((e) => e.sentiment === 'neutre').length;
  const positiveCount = filteredEvaluations.filter((e) => e.sentiment === 'positif').length;

  // NPS calculation
  const npsEvals = filteredEvaluations.filter((e) => e.npsScore !== null && e.npsScore !== undefined);
  let npsValue: number | null = null;
  if (npsEvals.length > 0) {
    const promoters = npsEvals.filter((e) => (e.npsScore ?? 0) >= 9).length;
    const detractors = npsEvals.filter((e) => (e.npsScore ?? 0) <= 6).length;
    npsValue = Math.round(((promoters - detractors) / npsEvals.length) * 100);
  }

  // Monthly / chronological satisfaction curve
  const monthBuckets = new Map<string, { sum: number; count: number; sortKey: string }>();
  for (const e of filteredEvaluations) {
    const d = new Date(e.submittedAt);
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    const prev = monthBuckets.get(sortKey) || { sum: 0, count: 0, sortKey };
    prev.sum += e.overallScore;
    prev.count += 1;
    monthBuckets.set(sortKey, { ...prev, sortKey });
    void label;
  }
  const evolutionSeries = Array.from(monthBuckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      });
      return {
        label,
        score: Number((v.sum / v.count).toFixed(2)),
        count: v.count,
      };
    });

  // Satisfaction by Training Type
  const typeMap = new Map<string, { sum: number; count: number }>();
  for (const e of filteredEvaluations) {
    const prs = data.prestations.find((p) => p.id === e.prestationId);
    const tName = prs?.type || 'Autre';
    const cur = typeMap.get(tName) || { sum: 0, count: 0 };
    cur.sum += e.overallScore;
    cur.count += 1;
    typeMap.set(tName, cur);
  }
  const byTrainingType = Array.from(typeMap.entries()).map(([label, v]) => ({
    label,
    score: Number((v.sum / v.count).toFixed(2)),
    count: v.count,
  }));

  // Satisfaction by Certification
  const certMap = new Map<string, { sum: number; count: number }>();
  for (const e of filteredEvaluations) {
    const prs = data.prestations.find((p) => p.id === e.prestationId);
    if (prs?.certificationName) {
      const cur = certMap.get(prs.certificationName) || { sum: 0, count: 0 };
      cur.sum += e.overallScore;
      cur.count += 1;
      certMap.set(prs.certificationName, cur);
    }
  }
  const byCertification = Array.from(certMap.entries()).map(([label, v]) => ({
    label,
    score: Number((v.sum / v.count).toFixed(2)),
    count: v.count,
  }));

  // Response rate per prestation (latest 6)
  const responseRateByPrestation = filteredPrestations.slice(0, 6).map((p) => {
    const sent = filteredInvitations.filter((i) => i.prestationId === p.id && i.status !== 'À envoyer').length;
    const resp = filteredInvitations.filter((i) => i.prestationId === p.id && i.status === 'Répondue').length;
    return {
      label: p.title.length > 28 ? `${p.title.slice(0, 26)}…` : p.title,
      score: sent > 0 ? Math.round((resp / sent) * 100) : 0,
      count: sent,
      responded: resp,
    };
  });

  // Claims by category
  const claimCatMap = new Map<string, number>();
  for (const c of filteredClaims) {
    claimCatMap.set(c.category, (claimCatMap.get(c.category) || 0) + 1);
  }
  const claimsByCategory = Array.from(claimCatMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Trainer metrics & rankings
  const allQuestions = data.questionnaires.flatMap((q) => q.questions);
  const questionById = new Map(allQuestions.map((q) => [q.id, q]));

  const trainerMetrics: TrainerMetrics[] = data.trainers.map((trainer) => {
    const tPrs = filteredPrestations.filter((p) => p.trainerId === trainer.id);
    const tEvals = filteredEvaluations.filter((e) => e.trainerId === trainer.id);
    const respondentsCount = tEvals.length;
    const isReliableSample = respondentsCount >= minTrainerSampleSize;

    const dimScores: Record<string, number[]> = {
      pedagogie: [],
      maitrise: [],
      communication: [],
      disponibilite: [],
      satisfaction: [],
    };

    for (const ev of tEvals) {
      dimScores.satisfaction.push(ev.overallScore);
      for (const [qId, ans] of Object.entries(ev.answers || {})) {
        const q = questionById.get(qId);
        if (q?.trainerDimension && ans.normalizedScore !== null && ans.normalizedScore !== undefined) {
          dimScores[q.trainerDimension].push(ans.normalizedScore);
        }
      }
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null;

    // Monthly evolution for trainer
    const tBuckets = new Map<string, { sum: number; count: number }>();
    for (const ev of tEvals) {
      const d = new Date(ev.submittedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = tBuckets.get(key) || { sum: 0, count: 0 };
      cur.sum += ev.trainerScore;
      cur.count += 1;
      tBuckets.set(key, cur);
    }
    const evolution = Array.from(tBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        return {
          label: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
          score: Number((v.sum / v.count).toFixed(2)),
          count: v.count,
        };
      });

    return {
      trainer,
      sessionsCount: tPrs.length,
      respondentsCount,
      isReliableSample,
      overallAvg: tEvals.length > 0 ? avg(tEvals.map((e) => e.trainerScore)) : null,
      pedagogie: avg(dimScores.pedagogie) ?? (tEvals.length > 0 ? avg(tEvals.map((e) => e.trainerScore)) : null),
      maitrise: avg(dimScores.maitrise) ?? (tEvals.length > 0 ? avg(tEvals.map((e) => e.trainerScore)) : null),
      communication: avg(dimScores.communication) ?? (tEvals.length > 0 ? avg(tEvals.map((e) => e.trainerScore)) : null),
      disponibilite: avg(dimScores.disponibilite) ?? (tEvals.length > 0 ? avg(tEvals.map((e) => e.trainerScore)) : null),
      satisfaction: avg(dimScores.satisfaction),
      evolution,
      comments: tEvals
        .filter((e) => e.generalComment)
        .map((e) => ({
          id: e.id,
          score: e.trainerScore,
          comment: e.generalComment,
          prestationTitle: e.prestationTitle || '',
          submittedAt: e.submittedAt,
        })),
    };
  });

  // Criteria averages across all evaluations
  const criteriaStatsMap = new Map<string, { label: string; category: string; sum: number; count: number }>();
  for (const ev of filteredEvaluations) {
    for (const [qId, ans] of Object.entries(ev.answers || {})) {
      if (ans.normalizedScore === null || ans.normalizedScore === undefined) continue;
      const q = questionById.get(qId);
      if (!q) continue;
      const cur = criteriaStatsMap.get(qId) || { label: q.label, category: q.categoryLabel, sum: 0, count: 0 };
      cur.sum += ans.normalizedScore;
      cur.count += 1;
      criteriaStatsMap.set(qId, cur);
    }
  }
  const criteriaScores = Array.from(criteriaStatsMap.entries())
    .map(([id, v]) => ({
      id,
      label: v.label,
      category: v.category,
      avgScore: Number((v.sum / v.count).toFixed(2)),
      count: v.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // Prestation satisfaction summary
  const prestationScores = filteredPrestations.map((p) => {
    const pEvals = filteredEvaluations.filter((e) => e.prestationId === p.id);
    const avg = pEvals.length > 0 ? Number((pEvals.reduce((s, e) => s + e.overallScore, 0) / pEvals.length).toFixed(2)) : null;
    const pClaims = filteredClaims.filter((c) => c.prestationId === p.id).length;
    return {
      prestation: p,
      responseCount: pEvals.length,
      avgScore: avg,
      claimsCount: pClaims,
    };
  });

  return {
    kpis: {
      totalBeneficiariesEvaluated,
      totalPrestationsFollowed: filteredPrestations.length,
      surveysSent: sentInvitations.length,
      responsesReceived: respondedInvitations.length,
      participationRate,
      globalSatisfaction,
      avgTrainerScore,
      claimsCount: filteredClaims.length,
      claimResolutionRate,
      avgResolutionHours,
      negativeCount,
      neutralCount,
      positiveCount,
      satisfactionDelta,
      npsValue,
    },
    charts: {
      evolutionSeries,
      byTrainingType,
      byCertification,
      responseRateByPrestation,
      claimsByCategory,
    },
    trainerMetrics,
    criteriaScores,
    prestationScores,
    filteredEvaluations,
    filteredClaims,
    filteredPrestations,
    filteredInvitations,
  };
}
