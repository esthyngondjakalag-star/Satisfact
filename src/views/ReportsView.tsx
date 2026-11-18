import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { FormaCareLogo } from '../components/BrandMark';
import { HorizontalScoreBars, LineEvolutionChart } from '../components/Charts';
import { computeDashboardAnalytics } from '../lib/analytics';
import type { Beneficiary, Claim, Company, Evaluation, Invitation, Prestation, Questionnaire, Trainer } from '../types';

type ReportType =
  | 'general'
  | 'by_training'
  | 'by_certification'
  | 'by_trainer'
  | 'claims'
  | 'evolution'
  | 'participation'
  | 'comparative';

const REPORT_LABELS: Record<ReportType, string> = {
  general: 'Rapport général de satisfaction',
  by_training: 'Rapport par formation',
  by_certification: 'Rapport par certification',
  by_trainer: 'Rapport individuel par formateur',
  claims: 'Rapport des réclamations',
  evolution: 'Rapport d’évolution de la satisfaction',
  participation: 'Rapport de participation aux enquêtes',
  comparative: 'Rapport comparatif entre périodes',
};

export function ReportsView({
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
  const [reportType, setReportType] = useState<ReportType>('general');
  const [period, setPeriod] = useState<'all' | '30d' | '90d' | '365d'>('all');
  const [selectedTrainerId, setSelectedTrainerId] = useState(trainers[0]?.id || 'all');
  const [selectedPrestationId, setSelectedPrestationId] = useState('all');

  const analytics = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        {
          period,
          prestationId: reportType === 'by_training' && selectedPrestationId !== 'all' ? selectedPrestationId : 'all',
          certification: 'all',
          trainerId: reportType === 'by_trainer' && selectedTrainerId !== 'all' ? selectedTrainerId : 'all',
          status: 'all',
        },
        company.settings.minTrainerSampleSize
      ),
    [
      beneficiaries,
      prestations,
      trainers,
      questionnaires,
      invitations,
      evaluations,
      claims,
      period,
      reportType,
      selectedPrestationId,
      selectedTrainerId,
      company.settings.minTrainerSampleSize,
    ]
  );

  const comp30 = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        { period: '30d', prestationId: 'all', certification: 'all', trainerId: 'all', status: 'all' },
        company.settings.minTrainerSampleSize
      ),
    [beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims, company.settings.minTrainerSampleSize]
  );

  const comp90 = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        { period: '90d', prestationId: 'all', certification: 'all', trainerId: 'all', status: 'all' },
        company.settings.minTrainerSampleSize
      ),
    [beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims, company.settings.minTrainerSampleSize]
  );

  // Build tabular dataset & recommendations based on real metrics
  const { tableHeaders, tableRows, recommendations, executiveSummary } = useMemo(() => {
    const k = analytics.kpis;
    const recs: string[] = [];
    if (k.participationRate < 70 && k.surveysSent > 0) {
      recs.push(
        `Renforcer les relances automatiques : le taux de participation actuel est de ${k.participationRate}% (${k.responsesReceived}/${k.surveysSent}).`
      );
    }
    const lowCrit = analytics.criteriaScores[analytics.criteriaScores.length - 1];
    if (lowCrit && lowCrit.avgScore < 4.0) {
      recs.push(
        `Prioriser un plan d'action sur le critère "${lowCrit.label}" (moyenne ${lowCrit.avgScore}/5 sur ${lowCrit.count} avis).`
      );
    }
    const openClaims = analytics.filteredClaims.filter((c) => c.status !== 'Résolue' && c.status !== 'Clôturée');
    if (openClaims.length > 0) {
      recs.push(`Traiter les ${openClaims.length} réclamation(s) active(s) afin d'améliorer le taux de résolution (${k.claimResolutionRate}%).`);
    }
    if (recs.length === 0) {
      recs.push('Maintenir le niveau de suivi qualité actuel et continuer la collecte systématique après chaque session.');
    }

    const summary = `Sur la sélection (${REPORT_LABELS[reportType]}), l'organisme enregistre ${k.responsesReceived} évaluation(s) sur ${k.surveysSent} enquête(s) envoyée(s) (${k.participationRate}% de participation), avec une satisfaction globale de ${k.globalSatisfaction ?? '—'}/5 et ${k.claimsCount} réclamation(s) (${k.claimResolutionRate}% résolues).`;

    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (reportType === 'general' || reportType === 'by_training') {
      headers = ['Prestation', 'Type', 'Formateur', 'Date', 'Réponses', 'Note moyenne /5', 'Réclamations'];
      rows = analytics.prestationScores.map((ps) => [
        ps.prestation.title,
        ps.prestation.type,
        ps.prestation.trainerName || '',
        new Date(ps.prestation.realizedAt).toLocaleDateString('fr-FR'),
        ps.responseCount,
        ps.avgScore !== null ? ps.avgScore.toFixed(2) : '—',
        ps.claimsCount,
      ]);
    } else if (reportType === 'by_certification') {
      headers = ['Certification', 'Nb évaluations', 'Score moyen /5'];
      rows = analytics.charts.byCertification.map((c) => [c.label, c.count, c.score.toFixed(2)]);
    } else if (reportType === 'by_trainer') {
      headers = ['Formateur', 'Spécialité', 'Sessions', 'Répondants', 'Pédagogie', 'Maîtrise', 'Moyenne /5', 'Fiabilité'];
      rows = analytics.trainerMetrics
        .filter((tm) => selectedTrainerId === 'all' || tm.trainer.id === selectedTrainerId)
        .map((tm) => [
          tm.trainer.name,
          tm.trainer.specialty,
          tm.sessionsCount,
          tm.respondentsCount,
          tm.pedagogie ?? '—',
          tm.maitrise ?? '—',
          tm.overallAvg ?? '—',
          tm.isReliableSample ? 'Fiable' : `Indicatif (<${company.settings.minTrainerSampleSize})`,
        ]);
    } else if (reportType === 'claims') {
      headers = ['Code', 'Prestation', 'Catégorie', 'Priorité', 'Statut', 'Responsable', 'Date réception'];
      rows = analytics.filteredClaims.map((c) => [
        c.code,
        c.prestationTitle || '',
        c.category,
        c.priority,
        c.status,
        c.assignedToName || '',
        new Date(c.receivedAt).toLocaleDateString('fr-FR'),
      ]);
    } else if (reportType === 'evolution') {
      headers = ['Mois', 'Nb réponses', 'Score moyen /5'];
      rows = analytics.charts.evolutionSeries.map((e) => [e.label, e.count, e.score.toFixed(2)]);
    } else if (reportType === 'participation') {
      headers = ['Prestation', 'Envoyées', 'Répondues', 'Taux de réponse (%)'];
      rows = analytics.charts.responseRateByPrestation.map((r) => [r.label, r.count, r.responded, `${r.score}%`]);
    } else if (reportType === 'comparative') {
      headers = ['Indicateur', '30 derniers jours', '90 derniers jours', 'Total historique'];
      rows = [
        ['Satisfaction globale (/5)', comp30.kpis.globalSatisfaction ?? '—', comp90.kpis.globalSatisfaction ?? '—', analytics.kpis.globalSatisfaction ?? '—'],
        ['Note formateurs (/5)', comp30.kpis.avgTrainerScore ?? '—', comp90.kpis.avgTrainerScore ?? '—', analytics.kpis.avgTrainerScore ?? '—'],
        ['Taux de participation (%)', `${comp30.kpis.participationRate}%`, `${comp90.kpis.participationRate}%`, `${analytics.kpis.participationRate}%`],
        ['Réclamations', comp30.kpis.claimsCount, comp90.kpis.claimsCount, analytics.kpis.claimsCount],
        ['Taux résolution (%)', `${comp30.kpis.claimResolutionRate}%`, `${comp90.kpis.claimResolutionRate}%`, `${analytics.kpis.claimResolutionRate}%`],
      ];
    }

    return { tableHeaders: headers, tableRows: rows, recommendations: recs, executiveSummary: summary };
  }, [analytics, comp30, comp90, reportType, selectedTrainerId, company.settings.minTrainerSampleSize]);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(22, 131, 75);
    doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`${company.name.replace(' (DÉMO)', '')} — FormaCare`, 14, 10);
    doc.setFontSize(10);
    doc.text(`${REPORT_LABELS[reportType]} · Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 17);

    doc.setTextColor(39, 49, 59);
    doc.setFontSize(10);
    const splitSummary = doc.splitTextToSize(executiveSummary, 182);
    doc.text(splitSummary, 14, 30);

    autoTable(doc, {
      startY: 34 + splitSummary.length * 5,
      head: [tableHeaders],
      body: tableRows,
      headStyles: { fillColor: [22, 131, 75], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [39, 49, 59] },
      alternateRowStyles: { fillColor: [243, 244, 246] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(10);
    doc.setTextColor(22, 131, 75);
    doc.text('Recommandations qualité fondées sur les données :', 14, finalY + 10);
    doc.setTextColor(39, 49, 59);
    doc.setFontSize(9);
    recommendations.forEach((rec, i) => {
      const lines = doc.splitTextToSize(`• ${rec}`, 182);
      doc.text(lines, 14, finalY + 16 + i * 7);
    });

    doc.save(`formacare-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportExcel = () => {
    const aoa = [
      [company.name.replace(' (DÉMO)', ''), REPORT_LABELS[reportType]],
      ['Date export', new Date().toLocaleDateString('fr-FR')],
      ['Synthèse', executiveSummary],
      [],
      tableHeaders,
      ...tableRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
    XLSX.writeFile(wb, `formacare-${reportType}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCsv = () => {
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [tableHeaders.map(escape).join(';'), ...tableRows.map((r) => r.map(escape).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formacare-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Centre de rapports et exportations</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Produisez des rapports direction prêts à diffuser (PDF, Excel, CSV, Impression) avec indicateurs et recommandations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg hover:bg-[#126b3d]"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exporter PDF</span>
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-[#27313B] rounded-lg hover:bg-gray-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#16834B]" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-[#27313B] rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-[#27313B] rounded-lg hover:bg-gray-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* Report Configuration Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <div>
          <label className="block text-[11px] font-semibold text-[#8B9299] mb-1">Type de rapport</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-[#F9FAFB]"
          >
            {(Object.keys(REPORT_LABELS) as ReportType[]).map((rt) => (
              <option key={rt} value={rt}>
                {REPORT_LABELS[rt]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#8B9299] mb-1">Période analysée</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-[#F9FAFB]"
          >
            <option value="all">Historique complet</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="365d">12 derniers mois</option>
          </select>
        </div>

        {reportType === 'by_trainer' ? (
          <div>
            <label className="block text-[11px] font-semibold text-[#8B9299] mb-1">Formateur</label>
            <select
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-[#F9FAFB]"
            >
              <option value="all">Tous les formateurs</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : reportType === 'by_training' ? (
          <div>
            <label className="block text-[11px] font-semibold text-[#8B9299] mb-1">Formation ciblée</label>
            <select
              value={selectedPrestationId}
              onChange={(e) => setSelectedPrestationId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-[#F9FAFB]"
            >
              <option value="all">Toutes les formations</option>
              {prestations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-end text-xs text-[#8B9299] pb-2">
            Personnalisation automatique avec le logo et les données de {company.name.replace(' (DÉMO)', '')}.
          </div>
        )}
      </div>

      {/* Printable Executive Report Sheet */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt={company.name} className="h-10 w-auto object-contain" />
            ) : (
              <FormaCareLogo size={36} />
            )}
            <div>
              <div className="text-base font-bold text-[#27313B]">{company.name.replace(' (DÉMO)', '')}</div>
              <div className="text-xs text-[#8B9299]">{REPORT_LABELS[reportType]}</div>
            </div>
          </div>
          <div className="text-right text-xs text-[#8B9299] font-mono">
            <div>Édité le {new Date().toLocaleDateString('fr-FR')}</div>
            <div>FormaCare Quality Management</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-xs text-[#27313B] leading-relaxed">
          <strong className="text-[#16834B] block mb-1">Synthèse exécutive</strong>
          {executiveSummary}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl border border-gray-200">
            <span className="text-[11px] text-[#8B9299] block">Satisfaction globale</span>
            <span className="font-mono text-lg font-bold text-[#16834B]">
              {analytics.kpis.globalSatisfaction !== null ? `${analytics.kpis.globalSatisfaction}/5` : '—'}
            </span>
          </div>
          <div className="p-3.5 rounded-xl border border-gray-200">
            <span className="text-[11px] text-[#8B9299] block">Participation</span>
            <span className="font-mono text-lg font-bold text-[#27313B]">{analytics.kpis.participationRate}%</span>
          </div>
          <div className="p-3.5 rounded-xl border border-gray-200">
            <span className="text-[11px] text-[#8B9299] block">Note formateurs</span>
            <span className="font-mono text-lg font-bold text-[#27313B]">
              {analytics.kpis.avgTrainerScore !== null ? `${analytics.kpis.avgTrainerScore}/5` : '—'}
            </span>
          </div>
          <div className="p-3.5 rounded-xl border border-gray-200">
            <span className="text-[11px] text-[#8B9299] block">Résolution réclamations</span>
            <span className="font-mono text-lg font-bold text-[#27313B]">{analytics.kpis.claimResolutionRate}%</span>
          </div>
        </div>

        {reportType === 'evolution' ? (
          <LineEvolutionChart data={analytics.charts.evolutionSeries} />
        ) : (
          <HorizontalScoreBars
            items={analytics.charts.byTrainingType.map((t) => ({
              label: t.label,
              value: t.score,
              subtitle: `n=${t.count}`,
            }))}
          />
        )}

        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-gray-200 text-[#8B9299] font-semibold">
                {tableHeaders.map((h) => (
                  <th key={h} className="px-4 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={tableHeaders.length} className="px-4 py-6 text-center text-[#8B9299]">
                    Aucune donnée disponible pour ce rapport.
                  </td>
                </tr>
              ) : (
                tableRows.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 text-[#27313B] tabular-nums">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 rounded-xl bg-[#E8F5ED]/60 border border-[#16834B]/20 space-y-1.5 text-xs">
          <div className="font-bold text-[#16834B]">Recommandations fondées sur les données</div>
          <ul className="list-disc pl-5 space-y-1 text-[#27313B]">
            {recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
