import React, { useState } from 'react';
import { Plus, Send, X } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { apiRequest } from '../lib/api';
import type { Beneficiary, Company, FollowUpStatus, NavSection, Prestation, Trainer } from '../types';

export function PrestationsView({
  company,
  prestations,
  trainers,
  beneficiaries,
  onReload,
  onNavigate,
}: {
  company: Company;
  prestations: Prestation[];
  trainers: Trainer[];
  beneficiaries: Beneficiary[];
  onReload: () => Promise<void>;
  onNavigate: (sec: NavSection) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState(company.domains[0] || 'Management & Leadership');
  const [type, setType] = useState(company.trainingTypes[0] || 'Formation professionnelle');
  const [certificationName, setCertificationName] = useState('');
  const [realizedAt, setRealizedAt] = useState(new Date().toISOString().slice(0, 10));
  const [trainerId, setTrainerId] = useState(trainers[0]?.id || '');
  const [durationHours, setDurationHours] = useState(14);
  const [sessionCode, setSessionCode] = useState('');
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = prestations.filter((p) => (statusFilter === 'all' ? true : p.followUpStatus === statusFilter));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('/api/prestations', {
        method: 'POST',
        body: JSON.stringify({
          title,
          domain,
          type,
          certificationName,
          realizedAt: new Date(realizedAt).toISOString(),
          trainerId: trainerId || trainers[0]?.id,
          durationHours,
          sessionCode,
          beneficiaryIds: selectedBeneficiaries,
        }),
      });
      setShowModal(false);
      setTitle('');
      setSessionCode('');
      setSelectedBeneficiaries([]);
      await onReload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, followUpStatus: FollowUpStatus) => {
    await apiRequest(`/api/prestations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ followUpStatus }),
    });
    await onReload();
  };

  const toggleBen = (id: string) => {
    setSelectedBeneficiaries((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Prestations réalisées</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Formations et certifications clôturées prêtes pour la collecte des évaluations et le suivi qualité.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!trainerId && trainers[0]) setTrainerId(trainers[0].id);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] hover:bg-[#126b3d] text-white rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Enregistrer une prestation réalisée</span>
        </button>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(p) => p.id}
        searchPlaceholder="Rechercher par intitulé, session, formateur..."
        searchFilter={(p, q) =>
          `${p.title} ${p.domain} ${p.type} ${p.certificationName} ${p.sessionCode} ${p.trainerName}`.toLowerCase().includes(q)
        }
        headerExtra={
          <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
            {['all', 'À enquêter', 'Enquête envoyée', 'Suivi en cours', 'Clôturée'].map((st) => (
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
        emptyTitle="Aucune prestation réalisée enregistrée"
        emptyDescription="Enregistrez une formation ou certification terminée (ou importez via Excel/CSV) pour démarrer le suivi."
        columns={[
          {
            key: 'title',
            label: 'Prestation',
            sortable: true,
            sortValue: (p) => p.title,
            render: (p) => (
              <div>
                <div className="font-semibold text-[#27313B]">{p.title}</div>
                <div className="text-xs text-[#8B9299]">
                  {p.type}
                  {p.certificationName ? ` · ${p.certificationName}` : ''} · {p.domain}
                </div>
              </div>
            ),
          },
          {
            key: 'session',
            label: 'Session',
            render: (p) => <span className="font-mono text-xs text-[#8B9299]">{p.sessionCode || '—'}</span>,
          },
          {
            key: 'trainer',
            label: 'Formateur',
            sortable: true,
            sortValue: (p) => p.trainerName || '',
            render: (p) => <span className="text-xs font-medium text-[#27313B]">{p.trainerName}</span>,
          },
          {
            key: 'realizedAt',
            label: 'Date réalisation',
            sortable: true,
            sortValue: (p) => p.realizedAt,
            render: (p) => (
              <span className="text-xs font-mono text-[#8B9299]">
                {new Date(p.realizedAt).toLocaleDateString('fr-FR')}
              </span>
            ),
          },
          {
            key: 'participants',
            label: 'Participants',
            align: 'right',
            render: (p) => <span className="font-mono text-xs font-semibold">{p.beneficiaryIds.length}</span>,
          },
          {
            key: 'status',
            label: 'Statut du suivi',
            render: (p) => (
              <select
                value={p.followUpStatus}
                onChange={(e) => handleStatusChange(p.id, e.target.value as FollowUpStatus)}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 bg-white text-[#27313B]"
              >
                <option value="À enquêter">À enquêter</option>
                <option value="Enquête envoyée">Enquête envoyée</option>
                <option value="Suivi en cours">Suivi en cours</option>
                <option value="Clôturée">Clôturée</option>
              </select>
            ),
          },
          {
            key: 'action',
            label: 'Enquête',
            align: 'right',
            render: () => (
              <button
                type="button"
                onClick={() => onNavigate('invitations')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#16834B] hover:underline"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Distribuer</span>
              </button>
            ),
          },
        ]}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#27313B]">Nouvelle prestation réalisée</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="p-2.5 rounded-lg bg-red-50 text-xs text-red-700">{error}</div>}

            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Intitulé de la formation ou certification *</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Domaine *</label>
                <select value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  {company.domains.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Type de prestation *</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  {[...company.trainingTypes, 'Certification'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Certification (si applicable)</label>
                <select value={certificationName} onChange={(e) => setCertificationName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Aucune</option>
                  {company.certificationTypes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Formateur responsable *</label>
                <select required value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  {trainers.length === 0 && <option value="">Aucun formateur (créez-en un d’abord)</option>}
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Date réalisation *</label>
                <input type="date" required value={realizedAt} onChange={(e) => setRealizedAt(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Durée (h)</label>
                <input type="number" min={1} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Code session / groupe</label>
              <input value={sessionCode} onChange={(e) => setSessionCode(e.target.value)} placeholder="Ex. SES-2026-11C" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1.5">
                Associer des bénéficiaires ({selectedBeneficiaries.length} sélectionné(s))
              </label>
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {beneficiaries.length === 0 ? (
                  <div className="p-3 text-xs text-[#8B9299]">Aucun bénéficiaire disponible.</div>
                ) : (
                  beneficiaries.map((b) => (
                    <label key={b.id} className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedBeneficiaries.includes(b.id)}
                        onChange={() => toggleBen(b.id)}
                        className="accent-[#16834B]"
                      />
                      <span className="font-medium text-[#27313B]">
                        {b.firstName} {b.lastName}
                      </span>
                      <span className="text-[#8B9299]">{b.email}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg">
                Annuler
              </button>
              <button type="submit" disabled={saving || trainers.length === 0} className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg disabled:opacity-60">
                {saving ? 'Enregistrement...' : 'Enregistrer la prestation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
