import React, { useState } from 'react';
import { BellRing, CheckCircle2, DatabaseBackup, Save, Upload } from 'lucide-react';
import { apiRequest, getStoredToken } from '../lib/api';
import type { Company } from '../types';

export function SettingsView({
  company,
  isAdmin,
  onReload,
}: {
  company: Company;
  isAdmin: boolean;
  onReload: () => Promise<void>;
}) {
  const [name, setName] = useState(company.name);
  const [email, setEmail] = useState(company.email);
  const [phone, setPhone] = useState(company.phone);
  const [address, setAddress] = useState(company.address);
  const [website, setWebsite] = useState(company.website);
  const [logoUrl, setLogoUrl] = useState(company.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(company.primaryColor);
  const [domainsText, setDomainsText] = useState(company.domains.join(', '));
  const [trainingTypesText, setTrainingTypesText] = useState(company.trainingTypes.join(', '));
  const [certTypesText, setCertTypesText] = useState(company.certificationTypes.join(', '));
  const [claimCatsText, setClaimCatsText] = useState(company.claimCategories.join(', '));

  const [allowAnonymous, setAllowAnonymous] = useState(company.settings.allowAnonymous);
  const [minTrainerSampleSize, setMinTrainerSampleSize] = useState(company.settings.minTrainerSampleSize);
  const [gdprConsentText, setGdprConsentText] = useState(company.settings.gdprConsentText);
  const [beneficiaryCanViewClaims, setBeneficiaryCanViewClaims] = useState(company.settings.beneficiaryCanViewClaims);
  const [autoInviteDelayHours, setAutoInviteDelayHours] = useState(company.settings.autoInviteDelayHours);
  const [autoReminderDays, setAutoReminderDays] = useState(company.settings.autoReminderDays);
  const [lowSatisfactionThreshold, setLowSatisfactionThreshold] = useState(company.settings.lowSatisfactionThreshold);
  const [urgentClaimAlert, setUrgentClaimAlert] = useState(company.settings.urgentClaimAlert);
  const [periodicReportCadence, setPeriodicReportCadence] = useState(company.settings.periodicReportCadence);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  const splitList = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSavedMsg('');
    setSaving(true);
    try {
      await apiRequest('/api/company', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          website,
          logoUrl,
          primaryColor,
          domains: splitList(domainsText),
          trainingTypes: splitList(trainingTypesText),
          certificationTypes: splitList(certTypesText),
          claimCategories: splitList(claimCatsText),
          settings: {
            allowAnonymous,
            minTrainerSampleSize,
            gdprConsentText,
            beneficiaryCanViewClaims,
            autoInviteDelayHours,
            autoReminderDays,
            lowSatisfactionThreshold,
            urgentClaimAlert,
            periodicReportCadence,
          },
        }),
      });
      setSavedMsg('Paramètres de l’entreprise enregistrés avec succès.');
      await onReload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadBackup = async () => {
    const token = getStoredToken();
    const res = await fetch('/api/company/backup', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formacare-backup-${company.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const charterShades = [
    { label: 'Vert FormaCare (#16834B)', value: '#16834B' },
    { label: 'Vert Forêt (#11693B)', value: '#11693B' },
    { label: 'Vert Sauge Foncé (#1E7A55)', value: '#1E7A55' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Paramètres de l’entreprise et automatisations</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Configurez l’identité de votre organisme, vos référentiels qualité, les règles d’anonymat et les seuils d’alerte.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={downloadBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-gray-200 text-[#27313B] rounded-lg hover:bg-gray-50"
          >
            <DatabaseBackup className="w-4 h-4 text-[#16834B]" />
            <span>Sauvegarde JSON complète</span>
          </button>
        )}
      </div>

      {savedMsg && (
        <div className="p-3.5 rounded-xl bg-[#E8F5ED] border border-[#16834B]/30 text-xs font-semibold text-[#16834B] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedMsg}</span>
        </div>
      )}
      {error && <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identity & Branding */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#27313B] pb-2 border-b border-gray-100">Identité et coordonnées</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Nom de l’organisme</label>
              <input disabled={!isAdmin} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Email de contact qualité</label>
              <input disabled={!isAdmin} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Téléphone</label>
              <input disabled={!isAdmin} value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Site web</label>
              <input disabled={!isAdmin} value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#27313B] mb-1">Adresse</label>
            <input disabled={!isAdmin} value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Logo de l’entreprise (utilisé dans les rapports PDF et enquêtes)</label>
              <div className="flex items-center gap-3">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 w-auto border border-gray-200 rounded p-1" />}
                {isAdmin && (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Importer une image</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Couleur d’accent (charte FormaCare)</label>
              <div className="flex flex-wrap gap-2">
                {charterShades.map((sh) => (
                  <button
                    key={sh.value}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setPrimaryColor(sh.value)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border ${
                      primaryColor === sh.value ? 'border-[#27313B] font-semibold' : 'border-gray-200'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sh.value }} />
                    <span>{sh.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Taxonomies */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-[#27313B] pb-2 border-b border-gray-100">
            Référentiels métier (séparés par des virgules)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Domaines d’activité</label>
              <textarea disabled={!isAdmin} rows={2} value={domainsText} onChange={(e) => setDomainsText(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Types de formations</label>
              <textarea disabled={!isAdmin} rows={2} value={trainingTypesText} onChange={(e) => setTrainingTypesText(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Types de certifications</label>
              <textarea disabled={!isAdmin} rows={2} value={certTypesText} onChange={(e) => setCertTypesText(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Catégories de réclamations</label>
              <textarea disabled={!isAdmin} rows={2} value={claimCatsText} onChange={(e) => setClaimCatsText(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Questionnaires & Automations */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <BellRing className="w-4 h-4 text-[#16834B]" />
            <h2 className="text-sm font-bold text-[#27313B]">Paramètres des questionnaires, RGPD et automatisations</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Délai envoi auto (heures)</label>
              <input type="number" min={1} disabled={!isAdmin} value={autoInviteDelayHours} onChange={(e) => setAutoInviteDelayHours(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Délai relance auto (jours)</label>
              <input type="number" min={1} disabled={!isAdmin} value={autoReminderDays} onChange={(e) => setAutoReminderDays(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Seuil alerte satisfaction (/5)</label>
              <input type="number" step="0.1" min={1} max={5} disabled={!isAdmin} value={lowSatisfactionThreshold} onChange={(e) => setLowSatisfactionThreshold(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Échantillon min. formateur</label>
              <input type="number" min={1} max={30} disabled={!isAdmin} value={minTrainerSampleSize} onChange={(e) => setMinTrainerSampleSize(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Cadence des rapports périodiques</label>
              <select disabled={!isAdmin} value={periodicReportCadence} onChange={(e) => setPeriodicReportCadence(e.target.value as any)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                <option value="Hebdomadaire">Hebdomadaire</option>
                <option value="Mensuelle">Mensuelle</option>
                <option value="Trimestrielle">Trimestrielle</option>
              </select>
            </div>
            <div className="space-y-2 pt-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" disabled={!isAdmin} checked={allowAnonymous} onChange={(e) => setAllowAnonymous(e.target.checked)} className="accent-[#16834B]" />
                <span>Autoriser les réponses anonymes dans l’entreprise</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" disabled={!isAdmin} checked={beneficiaryCanViewClaims} onChange={(e) => setBeneficiaryCanViewClaims(e.target.checked)} className="accent-[#16834B]" />
                <span>Autoriser les bénéficiaires à suivre le statut de leurs réclamations</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" disabled={!isAdmin} checked={urgentClaimAlert} onChange={(e) => setUrgentClaimAlert(e.target.checked)} className="accent-[#16834B]" />
                <span>Alerter automatiquement en cas de réclamation urgente ou en retard</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#27313B] mb-1">Mention légale de consentement RGPD affichée sur les enquêtes</label>
            <textarea disabled={!isAdmin} rows={2} value={gdprConsentText} onChange={(e) => setGdprConsentText(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg" />
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16834B] hover:bg-[#126b3d] text-white text-xs font-semibold rounded-lg disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
