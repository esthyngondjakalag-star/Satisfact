import React, { useState } from 'react';
import { Eye, X } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import type { Evaluation, Questionnaire } from '../types';

export function EvaluationsView({
  evaluations,
  questionnaires,
}: {
  evaluations: Evaluation[];
  questionnaires: Questionnaire[];
}) {
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [selected, setSelected] = useState<Evaluation | null>(null);

  const filtered = evaluations.filter((e) => (sentimentFilter === 'all' ? true : e.sentiment === sentimentFilter));
  const questionMap = new Map(questionnaires.flatMap((q) => q.questions).map((q) => [q.id, q]));

  const sentimentBadge = (s: string) => {
    if (s === 'positif') return 'bg-[#E8F5ED] text-[#16834B]';
    if (s === 'neutre') return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[#27313B]">Évaluations reçues</h1>
        <p className="text-xs text-[#8B9299] mt-0.5">
          Consultez l’ensemble des retours bénéficiaires, avec distinction claire entre réponses identifiées et réponses anonymes.
        </p>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(e) => e.id}
        searchPlaceholder="Rechercher par prestation, formateur, commentaire..."
        searchFilter={(e, q) =>
          `${e.prestationTitle} ${e.trainerName} ${e.beneficiaryName} ${e.generalComment}`.toLowerCase().includes(q)
        }
        headerExtra={
          <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
            {['all', 'positif', 'neutre', 'négatif'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSentimentFilter(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  sentimentFilter === s ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299] hover:text-[#27313B]'
                }`}
              >
                {s === 'all' ? 'Toutes' : s}
              </button>
            ))}
          </div>
        }
        emptyTitle="Aucune évaluation enregistrée"
        emptyDescription="Les réponses soumises via vos enquêtes et QR codes apparaîtront ici."
        onRowClick={setSelected}
        columns={[
          {
            key: 'submittedAt',
            label: 'Date',
            sortable: true,
            sortValue: (e) => e.submittedAt,
            render: (e) => (
              <span className="text-xs font-mono text-[#8B9299]">
                {new Date(e.submittedAt).toLocaleDateString('fr-FR')}
              </span>
            ),
          },
          {
            key: 'prestation',
            label: 'Prestation & Formateur',
            sortable: true,
            sortValue: (e) => e.prestationTitle || '',
            render: (e) => (
              <div>
                <div className="font-semibold text-[#27313B]">{e.prestationTitle}</div>
                <div className="text-xs text-[#8B9299]">{e.trainerName}</div>
              </div>
            ),
          },
          {
            key: 'participant',
            label: 'Répondant',
            render: (e) => (
              <span className={`text-xs ${e.isAnonymous ? 'italic text-[#8B9299]' : 'font-medium text-[#27313B]'}`}>
                {e.beneficiaryName}
              </span>
            ),
          },
          {
            key: 'overallScore',
            label: 'Note globale',
            align: 'right',
            sortable: true,
            sortValue: (e) => e.overallScore,
            render: (e) => <span className="font-mono text-xs font-bold text-[#27313B]">{e.overallScore.toFixed(2)}/5</span>,
          },
          {
            key: 'trainerScore',
            label: 'Note formateur',
            align: 'right',
            sortable: true,
            sortValue: (e) => e.trainerScore,
            render: (e) => <span className="font-mono text-xs text-[#27313B]">{e.trainerScore.toFixed(2)}/5</span>,
          },
          {
            key: 'sentiment',
            label: 'Sentiment',
            render: (e) => (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md capitalize ${sentimentBadge(e.sentiment)}`}>
                {e.sentiment}
              </span>
            ),
          },
          {
            key: 'detail',
            label: 'Détail',
            align: 'right',
            render: (e) => (
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelected(e);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#16834B] hover:underline"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ouvrir</span>
              </button>
            ),
          },
        ]}
      />

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 space-y-5 border-l border-gray-200">
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div>
                <div className="text-xs text-[#8B9299]">
                  {selected.isAnonymous ? 'Réponse anonyme' : `Participant : ${selected.beneficiaryName}`} ·{' '}
                  {new Date(selected.submittedAt).toLocaleDateString('fr-FR')}
                </div>
                <h2 className="text-base font-bold text-[#27313B] mt-1">{selected.prestationTitle}</h2>
                <div className="text-xs text-[#8B9299]">Formateur : {selected.trainerName}</div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F9FAFB] border border-gray-200 text-center">
              <div>
                <span className="text-[11px] text-[#8B9299] block">Satisfaction globale</span>
                <span className="font-mono font-bold text-base text-[#16834B]">{selected.overallScore}/5</span>
              </div>
              <div>
                <span className="text-[11px] text-[#8B9299] block">Note formateur</span>
                <span className="font-mono font-bold text-base text-[#27313B]">{selected.trainerScore}/5</span>
              </div>
              <div>
                <span className="text-[11px] text-[#8B9299] block">NPS</span>
                <span className="font-mono font-bold text-base text-[#27313B]">
                  {selected.npsScore !== null ? `${selected.npsScore}/10` : '—'}
                </span>
              </div>
            </div>

            {selected.generalComment && (
              <div className="p-4 rounded-xl bg-[#E8F5ED]/50 border border-[#16834B]/20 text-xs text-[#27313B] space-y-1">
                <div className="font-bold text-[#16834B]">Commentaire général</div>
                <p className="leading-relaxed">« {selected.generalComment} »</p>
              </div>
            )}

            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[#27313B]">Détail des réponses</h3>
              {Object.entries(selected.answers || {}).map(([qId, ans]) => {
                const q = questionMap.get(qId);
                return (
                  <div key={qId} className="p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                    <div className="text-[#8B9299]">{q?.label || qId}</div>
                    <div className="font-semibold text-[#27313B]">
                      Réponse :{' '}
                      {typeof ans.value === 'boolean'
                        ? ans.value
                          ? 'Oui'
                          : 'Non'
                        : Array.isArray(ans.value)
                        ? ans.value.join(', ')
                        : String(ans.value)}
                    </div>
                    {ans.comment && <div className="text-[#8B9299]">Note : {ans.comment}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
