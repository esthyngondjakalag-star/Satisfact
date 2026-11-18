import React, { useMemo, useState } from 'react';
import { AlertCircle, Award, Plus, X } from 'lucide-react';
import { TrainerAvatar } from '../components/BrandMark';
import { HorizontalScoreBars, LineEvolutionChart, TrainerMultiComparisonChart } from '../components/Charts';
import { computeDashboardAnalytics, type TrainerMetrics } from '../lib/analytics';
import { apiRequest } from '../lib/api';
import type { Beneficiary, Claim, Company, Evaluation, Invitation, Prestation, Questionnaire, Trainer } from '../types';

export function TrainersView({
  company,
  beneficiaries,
  prestations,
  trainers,
  questionnaires,
  invitations,
  evaluations,
  claims,
  canManageTrainers,
  onReload,
}: {
  company: Company;
  beneficiaries: Beneficiary[];
  prestations: Prestation[];
  trainers: Trainer[];
  questionnaires: Questionnaire[];
  invitations: Invitation[];
  evaluations: Evaluation[];
  claims: Claim[];
  canManageTrainers: boolean;
  onReload: () => Promise<void>;
}) {
  const [period, setPeriod] = useState<'all' | '30d' | '90d' | '365d'>('all');
  const [prestationId, setPrestationId] = useState('all');
  const [compareIds, setCompareIds] = useState<string[]>(() => trainers.slice(0, 3).map((t) => t.id));
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerMetrics | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add trainer form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const minSample = company.settings.minTrainerSampleSize || 3;

  const analytics = useMemo(
    () =>
      computeDashboardAnalytics(
        { beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims },
        { period, prestationId, certification: 'all', trainerId: 'all', status: 'all' },
        minSample
      ),
    [beneficiaries, prestations, trainers, questionnaires, invitations, evaluations, claims, period, prestationId, minSample]
  );

  // Leaderboard: reliable samples ranked first by score, insufficient samples separated/flagged
  const sortedLeaderboard = useMemo(() => {
    return [...analytics.trainerMetrics].sort((a, b) => {
      if (a.isReliableSample !== b.isReliableSample) return a.isReliableSample ? -1 : 1;
      return (b.overallAvg ?? -1) - (a.overallAvg ?? -1);
    });
  }, [analytics.trainerMetrics]);

  const comparedTrainers = analytics.trainerMetrics
    .filter((tm) => compareIds.includes(tm.trainer.id))
    .map((tm) => ({
      id: tm.trainer.id,
      name: tm.trainer.name,
      pedagogie: tm.pedagogie,
      maitrise: tm.maitrise,
      communication: tm.communication,
      disponibilite: tm.disponibilite,
      satisfaction: tm.satisfaction,
      respondentsCount: tm.respondentsCount,
    }));

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const handleCreateTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('/api/trainers', {
        method: 'POST',
        body: JSON.stringify({ name, email, specialty, bio, photoUrl }),
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setSpecialty('');
      setBio('');
      setPhotoUrl('');
      await onReload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Évaluation individuelle des formateurs et encadreurs</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Classement objectif calculé uniquement à partir des réponses réelles (seuil de fiabilité : n ≥ {minSample} répondants).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg"
          >
            <option value="all">Toutes périodes</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="365d">12 derniers mois</option>
          </select>
          <select
            value={prestationId}
            onChange={(e) => setPrestationId(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg max-w-[220px]"
          >
            <option value="all">Toutes les formations</option>
            {prestations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {canManageTrainers && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] hover:bg-[#126b3d] text-white rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un formateur</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Leaderboard */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#16834B]" />
            <h2 className="text-sm font-bold text-[#27313B]">Classement dynamique et fiabilité d’échantillon</h2>
          </div>
          <span className="text-xs text-[#8B9299]">Cliquez sur un formateur pour ouvrir sa fiche complète</span>
        </div>

        {sortedLeaderboard.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8B9299]">Aucun formateur enregistré pour votre organisme.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-gray-200 text-xs font-semibold text-[#8B9299]">
                  <th className="px-4 py-2.5">Rang</th>
                  <th className="px-4 py-2.5">Formateur</th>
                  <th className="px-4 py-2.5 text-right">Sessions</th>
                  <th className="px-4 py-2.5 text-right">Répondants</th>
                  <th className="px-4 py-2.5 text-right">Pédagogie</th>
                  <th className="px-4 py-2.5 text-right">Maîtrise</th>
                  <th className="px-4 py-2.5 text-right">Note globale</th>
                  <th className="px-4 py-2.5">Fiabilité</th>
                  <th className="px-4 py-2.5 text-right">Comparer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLeaderboard.map((tm, idx) => (
                  <tr
                    key={tm.trainer.id}
                    onClick={() => setSelectedTrainer(tm)}
                    className="cursor-pointer hover:bg-[#E8F5ED]/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#8B9299]">
                      {tm.isReliableSample ? `#${idx + 1}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TrainerAvatar name={tm.trainer.name} photoUrl={tm.trainer.photoUrl} sizeClass="w-9 h-9" />
                        <div>
                          <div className="font-semibold text-[#27313B]">{tm.trainer.name}</div>
                          <div className="text-xs text-[#8B9299]">{tm.trainer.specialty}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">{tm.sessionsCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                      {tm.respondentsCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {tm.pedagogie !== null ? `${tm.pedagogie.toFixed(2)}/5` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {tm.maitrise !== null ? `${tm.maitrise.toFixed(2)}/5` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-[#16834B] tabular-nums">
                      {tm.overallAvg !== null ? `${tm.overallAvg.toFixed(2)}/5` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {tm.respondentsCount === 0 ? (
                        <span className="text-xs text-[#8B9299]">Aucune réponse</span>
                      ) : tm.isReliableSample ? (
                        <span className="text-xs font-semibold text-[#16834B] bg-[#E8F5ED] px-2 py-0.5 rounded-md">
                          Échantillon fiable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                          <AlertCircle className="w-3 h-3" />
                          <span>Indicatif (n &lt; {minSample})</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={compareIds.includes(tm.trainer.id)}
                        onChange={() => toggleCompare(tm.trainer.id)}
                        className="accent-[#16834B] w-4 h-4 cursor-pointer"
                        aria-label={`Comparer ${tm.trainer.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-trainer Comparison Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#27313B]">Comparaison multicritères des formateurs</h2>
            <p className="text-xs text-[#8B9299]">
              Cochez jusqu’à 4 formateurs dans le tableau ci-dessus pour comparer pédagogie, maîtrise technique, communication, disponibilité et satisfaction générale.
            </p>
          </div>
        </div>
        <TrainerMultiComparisonChart trainers={comparedTrainers} />
      </div>

      {/* Detailed Trainer Drawer */}
      {selectedTrainer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6 space-y-6 border-l border-gray-200">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <TrainerAvatar
                  name={selectedTrainer.trainer.name}
                  photoUrl={selectedTrainer.trainer.photoUrl}
                  sizeClass="w-14 h-14"
                />
                <div>
                  <h2 className="text-lg font-bold text-[#27313B]">{selectedTrainer.trainer.name}</h2>
                  <div className="text-xs font-medium text-[#16834B]">{selectedTrainer.trainer.specialty}</div>
                  <div className="text-xs text-[#8B9299] mt-0.5">{selectedTrainer.trainer.email}</div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedTrainer(null)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedTrainer.trainer.bio && (
              <p className="text-xs text-[#27313B] leading-relaxed bg-[#F9FAFB] p-3.5 rounded-xl border border-gray-200">
                {selectedTrainer.trainer.bio}
              </p>
            )}

            {!selectedTrainer.isReliableSample && selectedTrainer.respondentsCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Attention : uniquement {selectedTrainer.respondentsCount} réponse(s) collectée(s). Ces notes sont fournies à titre purement indicatif tant que le seuil de {minSample} répondants n’est pas atteint.
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center p-4 bg-[#F9FAFB] rounded-xl border border-gray-200">
              <div>
                <span className="text-[11px] text-[#8B9299] block">Note moyenne globale</span>
                <span className="font-mono text-xl font-bold text-[#16834B]">
                  {selectedTrainer.overallAvg !== null ? `${selectedTrainer.overallAvg}/5` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#8B9299] block">Sessions encadrées</span>
                <span className="font-mono text-xl font-bold text-[#27313B]">{selectedTrainer.sessionsCount}</span>
              </div>
              <div>
                <span className="text-[11px] text-[#8B9299] block">Répondants</span>
                <span className="font-mono text-xl font-bold text-[#27313B]">{selectedTrainer.respondentsCount}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#27313B] mb-3">Notes détaillées par critère</h3>
              <HorizontalScoreBars
                max={5}
                unit="/5"
                items={[
                  { label: 'Pédagogie & accompagnement', value: selectedTrainer.pedagogie ?? 0 },
                  { label: 'Maîtrise technique du sujet', value: selectedTrainer.maitrise ?? 0 },
                  { label: 'Clarté de communication', value: selectedTrainer.communication ?? 0 },
                  { label: 'Disponibilité & ponctualité', value: selectedTrainer.disponibilite ?? 0 },
                  { label: 'Satisfaction générale des sessions', value: selectedTrainer.satisfaction ?? 0 },
                ].filter((i) => i.value > 0)}
              />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#27313B] mb-2">Évolution des performances dans le temps</h3>
              <LineEvolutionChart data={selectedTrainer.evolution} height={160} emptyLabel="Pas assez d’historique" />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#27313B] mb-2">
                Commentaires des bénéficiaires ({selectedTrainer.comments.length})
              </h3>
              {selectedTrainer.comments.length === 0 ? (
                <p className="text-xs text-[#8B9299]">Aucun commentaire enregistré.</p>
              ) : (
                <div className="space-y-2.5">
                  {selectedTrainer.comments.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-xl border border-gray-200 text-xs space-y-1">
                      <div className="flex justify-between text-[#8B9299]">
                        <span>{c.prestationTitle}</span>
                        <span className="font-mono font-bold text-[#16834B]">{c.score}/5</span>
                      </div>
                      <p className="text-[#27313B]">« {c.comment} »</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Trainer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTrainer} className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#27313B]">Nouveau formateur / encadreur</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-[#8B9299]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="p-2.5 rounded-lg bg-red-50 text-xs text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Nom complet *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Spécialité *</label>
              <input required value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">URL Photo facultative</label>
              <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Biographie / présentation</label>
              <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
