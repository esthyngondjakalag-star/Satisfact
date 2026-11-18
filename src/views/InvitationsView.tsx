import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { BellRing, Check, Copy, ExternalLink, Mail, Plus, QrCode, Send, X } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { apiRequest } from '../lib/api';
import type { Beneficiary, Company, Invitation, Prestation, Questionnaire } from '../types';

export function InvitationsView({
  company,
  invitations,
  prestations,
  questionnaires,
  beneficiaries,
  onReload,
  onOpenSurveyPreview,
}: {
  company: Company;
  invitations: Invitation[];
  prestations: Prestation[];
  questionnaires: Questionnaire[];
  beneficiaries: Beneficiary[];
  onReload: () => Promise<void>;
  onOpenSurveyPreview: (token: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [qrModalInv, setQrModalInv] = useState<Invitation | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form state
  const [prestationId, setPrestationId] = useState(prestations[0]?.id || '');
  const [questionnaireId, setQuestionnaireId] = useState(questionnaires[0]?.id || '');
  const [mode, setMode] = useState<'batch' | 'anonymous_link'>('batch');
  const [selectedBens, setSelectedBens] = useState<string[]>([]);
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms' | 'link'>('email');
  const [allowAnonymous, setAllowAnonymous] = useState(company.settings.allowAnonymous);
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (qrModalInv) {
      const url = `${window.location.origin}/?survey=${qrModalInv.token}`;
      QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#27313B', light: '#FFFFFF' } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    }
  }, [qrModalInv]);

  const openCreateModal = () => {
    const pId = prestationId || prestations[0]?.id || '';
    setPrestationId(pId);
    setQuestionnaireId(questionnaires[0]?.id || '');
    const p = prestations.find((pr) => pr.id === pId);
    setSelectedBens(p ? p.beneficiaryIds : []);
    setError('');
    setShowCreateModal(true);
  };

  const handlePrestationSelect = (pId: string) => {
    setPrestationId(pId);
    const p = prestations.find((pr) => pr.id === pId);
    if (p) setSelectedBens(p.beneficiaryIds);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'batch' && selectedBens.length === 0) {
      setError('Sélectionnez au moins un bénéficiaire ou choisissez le mode Lien anonyme.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          prestationId,
          questionnaireId,
          beneficiaryIds: mode === 'anonymous_link' ? [null] : selectedBens,
          channel,
          allowAnonymous: mode === 'anonymous_link' ? true : allowAnonymous,
          sendNow,
          scheduledAt: !sendNow && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          expiresInDays,
        }),
      });
      setShowCreateModal(false);
      await onReload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const triggerAction = async (id: string, action: 'send' | 'remind' | 'expire') => {
    await apiRequest(`/api/invitations/${id}/action`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
    await onReload();
  };

  const copyMessage = (inv: Invitation, template: 'link' | 'whatsapp' | 'email') => {
    const url = `${window.location.origin}/?survey=${inv.token}`;
    let text = url;
    if (template === 'whatsapp') {
      text = `Bonjour ${inv.beneficiaryName !== 'Lien anonyme / ouvert' ? inv.beneficiaryName : ''}, suite à votre participation à "${inv.prestationTitle}", merci de partager votre avis en 2 minutes via ce lien sécurisé FormaCare : ${url}`;
    } else if (template === 'email') {
      text = `Objet : Votre avis compte — ${inv.prestationTitle}\n\nBonjour,\n\nSuite à la réalisation de "${inv.prestationTitle}", l'organisme ${company.name.replace(' (DÉMO)', '')} vous invite à compléter notre questionnaire de satisfaction :\n${url}\n\nMerci pour votre contribution à notre démarche qualité.`;
    }
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(`${inv.id}_${template}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = invitations.filter((i) => (statusFilter === 'all' ? true : i.status === statusFilter));

  const statusStyle = (st: string) => {
    if (st === 'Répondue') return 'bg-[#E8F5ED] text-[#16834B]';
    if (st === 'Ouverte' || st === 'Envoyée') return 'bg-blue-50 text-blue-700';
    if (st === 'En attente de réponse') return 'bg-amber-50 text-amber-700';
    if (st === 'Expirée') return 'bg-red-50 text-red-700';
    return 'bg-gray-100 text-[#27313B]';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Enquêtes et invitations</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Générez des liens individuels, QR codes et messages WhatsApp/SMS/Email, programmez les envois et suivez les réponses.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] hover:bg-[#126b3d] text-white rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Créer des invitations</span>
        </button>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(i) => i.id}
        searchPlaceholder="Rechercher par code, bénéficiaire, prestation..."
        searchFilter={(i, q) =>
          `${i.code} ${i.beneficiaryName} ${i.prestationTitle} ${i.status}`.toLowerCase().includes(q)
        }
        headerExtra={
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
            {['all', 'À envoyer', 'Envoyée', 'Ouverte', 'En attente de réponse', 'Répondue', 'Expirée'].map((st) => (
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
        emptyTitle="Aucune invitation générée"
        emptyDescription="Sélectionnez une prestation réalisée et un questionnaire pour générer des liens individuels ou QR codes."
        columns={[
          {
            key: 'code',
            label: 'ID',
            sortable: true,
            sortValue: (i) => i.code,
            render: (i) => <span className="font-mono text-xs text-[#8B9299]">{i.code}</span>,
          },
          {
            key: 'beneficiary',
            label: 'Destinataire',
            sortable: true,
            sortValue: (i) => i.beneficiaryName || '',
            render: (i) => (
              <div>
                <div className="font-semibold text-[#27313B]">{i.beneficiaryName}</div>
                <div className="text-xs text-[#8B9299]">{i.prestationTitle}</div>
              </div>
            ),
          },
          {
            key: 'dates',
            label: 'Envoi / Réponse',
            render: (i) => (
              <div className="text-xs text-[#8B9299] font-mono">
                <div>{i.sentAt ? `Env. ${new Date(i.sentAt).toLocaleDateString('fr-FR')}` : 'Non envoyée'}</div>
                {i.respondedAt && <div className="text-[#16834B]">Rép. {new Date(i.respondedAt).toLocaleDateString('fr-FR')}</div>}
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Statut',
            sortable: true,
            sortValue: (i) => i.status,
            render: (i) => (
              <div className="space-y-0.5">
                <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-md ${statusStyle(i.status)}`}>
                  {i.status}
                </span>
                {i.reminderCount > 0 && (
                  <div className="text-[11px] text-[#8B9299]">{i.reminderCount} relance(s)</div>
                )}
              </div>
            ),
          },
          {
            key: 'share',
            label: 'Diffusion & Test',
            render: (i) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyMessage(i, 'link')}
                  title="Copier le lien individuel"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-gray-200 rounded hover:bg-gray-50"
                >
                  {copiedId === `${i.id}_link` ? <Check className="w-3 h-3 text-[#16834B]" /> : <Copy className="w-3 h-3" />}
                  <span>Lien</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyMessage(i, 'whatsapp')}
                  title="Copier message WhatsApp/SMS"
                  className="px-2 py-1 text-[11px] font-medium border border-gray-200 rounded hover:bg-gray-50"
                >
                  {copiedId === `${i.id}_whatsapp` ? 'Copié !' : 'WhatsApp/SMS'}
                </button>
                <button
                  type="button"
                  onClick={() => copyMessage(i, 'email')}
                  title="Copier modèle Email"
                  className="p-1 border border-gray-200 rounded hover:bg-gray-50"
                >
                  <Mail className="w-3.5 h-3.5 text-[#27313B]" />
                </button>
                <button
                  type="button"
                  onClick={() => setQrModalInv(i)}
                  title="Afficher QR Code"
                  className="p-1 border border-gray-200 rounded hover:bg-gray-50"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#16834B]" />
                </button>
                {i.status !== 'Répondue' && i.status !== 'Expirée' && (
                  <button
                    type="button"
                    onClick={() => onOpenSurveyPreview(i.token)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-[#E8F5ED] text-[#16834B] rounded hover:bg-[#d8efe1]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ouvrir</span>
                  </button>
                )}
              </div>
            ),
          },
          {
            key: 'actions',
            label: 'Suivi',
            align: 'right',
            render: (i) => (
              <div className="flex justify-end gap-1.5">
                {i.status === 'À envoyer' && (
                  <button
                    type="button"
                    onClick={() => triggerAction(i.id, 'send')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#16834B] text-white rounded-md"
                  >
                    <Send className="w-3 h-3" />
                    <span>Envoyer</span>
                  </button>
                )}
                {(i.status === 'Envoyée' || i.status === 'Ouverte' || i.status === 'En attente de réponse') && (
                  <button
                    type="button"
                    onClick={() => triggerAction(i.id, 'remind')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-gray-200 text-[#27313B] rounded-md hover:bg-gray-50"
                  >
                    <BellRing className="w-3 h-3 text-amber-600" />
                    <span>Relancer</span>
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* QR Code Modal */}
      {qrModalInv && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#27313B]">QR Code d’évaluation · {qrModalInv.code}</h3>
              <button type="button" onClick={() => setQrModalInv(null)} className="text-[#8B9299]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#8B9299]">{qrModalInv.prestationTitle}</p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code enquête" className="mx-auto border border-gray-200 rounded-xl p-2" />}
            <div className="text-[11px] font-mono text-[#8B9299] break-all bg-[#F9FAFB] p-2 rounded-lg">
              {window.location.origin}/?survey={qrModalInv.token}
            </div>
            <div className="flex justify-center gap-2">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qrcode-${qrModalInv.code}.png`}
                  className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg"
                >
                  Télécharger PNG
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  const token = qrModalInv.token;
                  setQrModalInv(null);
                  onOpenSurveyPreview(token);
                }}
                className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg"
              >
                Tester l’enquête
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invitations Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#27313B]">Distribution d’enquêtes après-prestation</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-[#8B9299]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="p-2.5 rounded-lg bg-red-50 text-xs text-red-700">{error}</div>}

            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Prestation réalisée *</label>
              <select
                required
                value={prestationId}
                onChange={(e) => handlePrestationSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {prestations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({new Date(p.realizedAt).toLocaleDateString('fr-FR')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Questionnaire *</label>
              <select
                required
                value={questionnaireId}
                onChange={(e) => setQuestionnaireId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {questionnaires.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 p-1 bg-[#F3F4F6] rounded-lg">
              <button
                type="button"
                onClick={() => setMode('batch')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                  mode === 'batch' ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299]'
                }`}
              >
                Liens individuels par bénéficiaire
              </button>
              <button
                type="button"
                onClick={() => setMode('anonymous_link')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                  mode === 'anonymous_link' ? 'bg-white text-[#27313B] shadow-xs' : 'text-[#8B9299]'
                }`}
              >
                Lien ouvert / QR Code anonyme
              </button>
            </div>

            {mode === 'batch' && (
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1.5">
                  Bénéficiaires destinataires ({selectedBens.length})
                </label>
                <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {beneficiaries.map((b) => (
                    <label key={b.id} className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedBens.includes(b.id)}
                        onChange={() =>
                          setSelectedBens((prev) => (prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]))
                        }
                        className="accent-[#16834B]"
                      />
                      <span className="font-medium text-[#27313B]">
                        {b.firstName} {b.lastName}
                      </span>
                      <span className="text-[#8B9299]">{b.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Canal principal</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="link">Lien direct / QR Code</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Expiration (jours)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendNow}
                  onChange={(e) => setSendNow(e.target.checked)}
                  className="accent-[#16834B]"
                />
                <span>Marquer comme envoyée immédiatement (sinon programmer ou envoyer manuellement)</span>
              </label>
              {!sendNow && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg"
                />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowAnonymous}
                  onChange={(e) => setAllowAnonymous(e.target.checked)}
                  className="accent-[#16834B]"
                />
                <span>Autoriser la soumission anonyme sur ce lien</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg">
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving || prestations.length === 0 || questionnaires.length === 0}
                className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg disabled:opacity-60"
              >
                {saving ? 'Génération...' : 'Générer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
