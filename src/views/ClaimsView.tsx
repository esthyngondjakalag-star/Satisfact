import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Plus, Send, X } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { apiRequest } from '../lib/api';
import type { Beneficiary, Claim, ClaimPriority, ClaimStatus, Company, Prestation, User } from '../types';

export function ClaimsView({
  company,
  claims,
  prestations,
  beneficiaries,
  staffUsers,
  onReload,
}: {
  company: Company;
  claims: Claim[];
  prestations: Prestation[];
  beneficiaries: Beneficiary[];
  staffUsers: User[];
  onReload: () => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form
  const [prestationId, setPrestationId] = useState(prestations[0]?.id || '');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [category, setCategory] = useState(company.claimCategories[0] || 'Insatisfaction générale');
  const [priority, setPriority] = useState<ClaimPriority>('Normale');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail update state
  const [internalNote, setInternalNote] = useState('');
  const [noteIsInternal, setNoteIsInternal] = useState(true);
  const [resolutionText, setResolutionText] = useState('');
  const [postComment, setPostComment] = useState('');

  const metrics = useMemo(() => {
    const total = claims.length;
    const resolved = claims.filter((c) => c.status === 'Résolue' || c.status === 'Clôturée');
    const rate = total > 0 ? Math.round((resolved.length / total) * 100) : 100;
    const overdue = claims.filter(
      (c) =>
        c.status !== 'Résolue' &&
        c.status !== 'Clôturée' &&
        new Date(c.dueAt).getTime() < Date.now()
    ).length;

    const withDur = resolved.filter((c) => c.resolvedAt && c.receivedAt);
    const avgHours =
      withDur.length > 0
        ? (
            withDur.reduce(
              (sum, c) => sum + Math.max(1, (new Date(c.resolvedAt!).getTime() - new Date(c.receivedAt).getTime()) / 3600000),
              0
            ) / withDur.length
          ).toFixed(1)
        : null;
    return { total, resolvedCount: resolved.length, rate, overdue, avgHours };
  }, [claims]);

  const filtered = claims.filter((c) => (statusFilter === 'all' ? true : c.status === statusFilter));

  const openClaimDetail = (c: Claim) => {
    setSelectedClaim(c);
    setResolutionText(c.resolutionSummary || '');
    setPostComment(c.postResolutionComment || '');
  };

  // Keep selected claim synced after reload
  const activeClaim = selectedClaim ? claims.find((c) => c.id === selectedClaim.id) || selectedClaim : null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('/api/claims', {
        method: 'POST',
        body: JSON.stringify({
          prestationId: prestationId || prestations[0]?.id,
          beneficiaryId: beneficiaryId || null,
          category,
          priority,
          assignedToUserId: assignedToUserId || null,
          description,
        }),
      });
      setShowCreateModal(false);
      setDescription('');
      await onReload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateClaim = async (patch: Record<string, any>) => {
    if (!activeClaim) return;
    await apiRequest(`/api/claims/${activeClaim.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await onReload();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClaim || !internalNote.trim()) return;
    await apiRequest(`/api/claims/${activeClaim.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content: internalNote, isInternal: noteIsInternal }),
    });
    setInternalNote('');
    await onReload();
  };

  const priorityStyle = (p: ClaimPriority) => {
    if (p === 'Urgente') return 'bg-red-50 text-red-700';
    if (p === 'Haute') return 'bg-amber-50 text-amber-700';
    if (p === 'Normale') return 'bg-blue-50 text-blue-700';
    return 'bg-gray-100 text-[#8B9299]';
  };

  const statusStyle = (s: ClaimStatus) => {
    if (s === 'Clôturée' || s === 'Résolue') return 'bg-[#E8F5ED] text-[#16834B]';
    if (s === 'En cours de traitement') return 'bg-blue-50 text-blue-700';
    if (s === 'En attente') return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Réclamations et gestion des insatisfactions</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Affectez, tracez, résolvez et vérifiez la satisfaction post-résolution avec suivi des délais cibles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!prestationId && prestations[0]) setPrestationId(prestations[0].id);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] hover:bg-[#126b3d] text-white rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Enregistrer une réclamation</span>
        </button>
      </div>

      {/* SLA & Resolution KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-[#8B9299]">Total réclamations</div>
          <div className="text-2xl font-bold text-[#27313B] mt-1 tabular-nums">{metrics.total}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-[#8B9299]">Taux de résolution</div>
          <div className="text-2xl font-bold text-[#16834B] mt-1 tabular-nums">{metrics.rate}%</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-[#8B9299] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Délai moyen de résolution</span>
          </div>
          <div className="text-2xl font-bold text-[#27313B] mt-1 tabular-nums">
            {metrics.avgHours ? `${metrics.avgHours} h` : '—'}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-[#8B9299] flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Dossiers en retard (SLA)</span>
          </div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${metrics.overdue > 0 ? 'text-red-600' : 'text-[#16834B]'}`}>
            {metrics.overdue}
          </div>
        </div>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(c) => c.id}
        searchPlaceholder="Rechercher par code, catégorie, bénéficiaire, prestation..."
        searchFilter={(c, q) =>
          `${c.code} ${c.category} ${c.beneficiaryName} ${c.prestationTitle} ${c.description}`.toLowerCase().includes(q)
        }
        headerExtra={
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
            {['all', 'Nouvelle', 'En cours de traitement', 'En attente', 'Résolue', 'Clôturée'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299] hover:text-[#27313B]'
                }`}
              >
                {st === 'all' ? 'Toutes' : st}
              </button>
            ))}
          </div>
        }
        emptyTitle="Aucune réclamation enregistrée"
        emptyDescription="Les réclamations soumises par les bénéficiaires ou saisies par l’équipe qualité apparaîtront ici."
        onRowClick={openClaimDetail}
        columns={[
          {
            key: 'code',
            label: 'Dossier',
            sortable: true,
            sortValue: (c) => c.code,
            render: (c) => {
              const isOverdue =
                c.status !== 'Résolue' && c.status !== 'Clôturée' && new Date(c.dueAt).getTime() < Date.now();
              return (
                <div>
                  <div className="font-mono text-xs font-bold text-[#27313B]">{c.code}</div>
                  {isOverdue && <div className="text-[10px] font-semibold text-red-600">Délai dépassé</div>}
                </div>
              );
            },
          },
          {
            key: 'category',
            label: 'Catégorie & Prestation',
            render: (c) => (
              <div>
                <div className="font-semibold text-[#27313B]">{c.category}</div>
                <div className="text-xs text-[#8B9299]">
                  {c.prestationTitle} · {c.beneficiaryName}
                </div>
              </div>
            ),
          },
          {
            key: 'priority',
            label: 'Priorité',
            render: (c) => (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${priorityStyle(c.priority)}`}>
                {c.priority}
              </span>
            ),
          },
          {
            key: 'assigned',
            label: 'Responsable',
            render: (c) => <span className="text-xs text-[#27313B]">{c.assignedToName}</span>,
          },
          {
            key: 'receivedAt',
            label: 'Réception',
            sortable: true,
            sortValue: (c) => c.receivedAt,
            render: (c) => (
              <span className="font-mono text-xs text-[#8B9299]">
                {new Date(c.receivedAt).toLocaleDateString('fr-FR')}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Statut',
            render: (c) => (
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${statusStyle(c.status)}`}>
                {c.status}
              </span>
            ),
          },
        ]}
      />

      {/* Claim Treatment Drawer */}
      {activeClaim && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6 space-y-6 border-l border-gray-200">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#8B9299]">
                  <span>{activeClaim.code}</span>
                  <span>·</span>
                  <span>Reçue le {new Date(activeClaim.receivedAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <h2 className="text-lg font-bold text-[#27313B] mt-1">{activeClaim.category}</h2>
                <div className="text-xs text-[#8B9299]">
                  {activeClaim.prestationTitle} · Bénéficiaire : {activeClaim.beneficiaryName}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedClaim(null)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 text-sm text-[#27313B] leading-relaxed">
              {activeClaim.description}
            </div>

            {/* Workflow Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#8B9299] mb-1">Statut</label>
                <select
                  value={activeClaim.status}
                  onChange={(e) => handleUpdateClaim({ status: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-white"
                >
                  <option value="Nouvelle">Nouvelle</option>
                  <option value="En cours de traitement">En cours de traitement</option>
                  <option value="En attente">En attente</option>
                  <option value="Résolue">Résolue</option>
                  <option value="Clôturée">Clôturée</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#8B9299] mb-1">Priorité</label>
                <select
                  value={activeClaim.priority}
                  onChange={(e) => handleUpdateClaim({ priority: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-white"
                >
                  <option value="Basse">Basse</option>
                  <option value="Normale">Normale</option>
                  <option value="Haute">Haute</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#8B9299] mb-1">Responsable affecté</label>
                <select
                  value={activeClaim.assignedToUserId || ''}
                  onChange={(e) => handleUpdateClaim({ assignedToUserId: e.target.value || null })}
                  className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg bg-white"
                >
                  <option value="">Non affectée</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Solution & Post-resolution verification */}
            <div className="p-4 rounded-xl border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold text-[#27313B]">Solution apportée et clôture</h3>
              <textarea
                rows={3}
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Décrivez l’action corrective mise en place pour résoudre cette réclamation..."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
              />
              <div className="flex flex-wrap justify-between items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateClaim({ resolutionSummary: resolutionText, status: 'Résolue' })}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Enregistrer la solution et marquer Résolue</span>
                </button>
              </div>

              {(activeClaim.status === 'Résolue' || activeClaim.status === 'Clôturée') && (
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="text-xs font-semibold text-[#27313B]">
                    Vérification de satisfaction après résolution
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateClaim({
                          postResolutionSatisfied: true,
                          postResolutionComment: postComment,
                          status: 'Clôturée',
                        })
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                        activeClaim.postResolutionSatisfied === true
                          ? 'bg-[#E8F5ED] border-[#16834B] text-[#16834B]'
                          : 'border-gray-200 text-[#27313B]'
                      }`}
                    >
                      Bénéficiaire satisfait (Clôturer)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateClaim({
                          postResolutionSatisfied: false,
                          postResolutionComment: postComment,
                          status: 'En cours de traitement',
                        })
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                        activeClaim.postResolutionSatisfied === false
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'border-gray-200 text-[#27313B]'
                      }`}
                    >
                      Insatisfait (Réouvrir)
                    </button>
                  </div>
                  <input
                    value={postComment}
                    onChange={(e) => setPostComment(e.target.value)}
                    placeholder="Commentaire de vérification post-résolution..."
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Internal Comments & Chronological Action History */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#27313B]">Historique chronologique & notes internes</h3>
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={2}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Ajouter un commentaire interne ou suivi d’action..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-[#8B9299] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noteIsInternal}
                      onChange={(e) => setNoteIsInternal(e.target.checked)}
                      className="accent-[#16834B]"
                    />
                    <span>Note interne (non visible par le bénéficiaire)</span>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#27313B] text-white rounded-lg"
                  >
                    <Send className="w-3 h-3" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </form>

              <div className="space-y-2 pt-2">
                {(activeClaim.actions || []).map((act) => (
                  <div key={act.id} className="p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[#8B9299]">
                      <span className="font-semibold text-[#27313B]">
                        {act.userName}{' '}
                        {act.isInternal && (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded ml-1">
                            Interne
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[11px]">
                        {new Date(act.createdAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[#27313B]">{act.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Claim Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#27313B]">Enregistrer une réclamation</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-[#8B9299]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="p-2.5 rounded-lg bg-red-50 text-xs text-red-700">{error}</div>}
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Prestation concernée *</label>
              <select
                required
                value={prestationId}
                onChange={(e) => setPrestationId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {prestations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Bénéficiaire (optionnel)</label>
                <select
                  value={beneficiaryId}
                  onChange={(e) => setBeneficiaryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">Signalement anonyme</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.firstName} {b.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Catégorie *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  {company.claimCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Priorité</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ClaimPriority)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="Basse">Basse</option>
                  <option value="Normale">Normale</option>
                  <option value="Haute">Haute</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Affecter à</label>
                <select
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">À affecter plus tard</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Description détaillée *</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg">
                Annuler
              </button>
              <button type="submit" disabled={saving || prestations.length === 0} className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
