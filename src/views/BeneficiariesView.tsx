import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { apiRequest } from '../lib/api';
import type { Beneficiary, Company, Evaluation, Prestation, Claim } from '../types';

interface ImportReport {
  totalRows: number;
  importedBeneficiaries: number;
  updatedBeneficiaries: number;
  importedPrestations: number;
  linkedCount: number;
  duplicatesSkipped: number;
  rejectedCount: number;
  errors: { rowNumber: number; email: string; reason: string }[];
}

const APP_FIELDS = [
  { key: 'firstName', label: 'Prénom *' },
  { key: 'lastName', label: 'Nom *' },
  { key: 'email', label: 'Email *' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'companyName', label: 'Entreprise' },
  { key: 'prestationTitle', label: 'Intitulé prestation' },
  { key: 'domain', label: 'Domaine' },
  { key: 'type', label: 'Type de prestation' },
  { key: 'realizedAt', label: 'Date réalisation (AAAA-MM-JJ)' },
  { key: 'trainerName', label: 'Formateur responsable' },
  { key: 'durationHours', label: 'Durée (heures)' },
  { key: 'sessionCode', label: 'Session / Groupe' },
] as const;

export function BeneficiariesView({
  company,
  beneficiaries,
  onReload,
}: {
  company: Company;
  beneficiaries: Beneficiary[];
  onReload: () => Promise<void>;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [historyBen, setHistoryBen] = useState<Beneficiary | null>(null);
  const [historyData, setHistoryData] = useState<{
    prestations: Prestation[];
    evaluations: Evaluation[];
    claims: Claim[];
  } | null>(null);

  // Manual form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Excel / CSV Import state
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState('');

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await apiRequest('/api/beneficiaries', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email, phone, companyName }),
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCompanyName('');
      setShowAddModal(false);
      await onReload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (ben: Beneficiary) => {
    setHistoryBen(ben);
    setHistoryData(null);
    try {
      const res = await apiRequest<any>(`/api/beneficiaries/${ben.id}/history`);
      setHistoryData(res);
    } catch {
      setHistoryData({ prestations: [], evaluations: [], claims: [] });
    }
  };

  const downloadSampleTemplate = () => {
    const sample = [
      {
        Prenom: 'Léa',
        Nom: 'Fontaine',
        Email: 'lea.fontaine@exemple-client.fr',
        Telephone: '+33 6 44 55 66 77',
        Entreprise: 'TechNova SAS',
        Prestation: 'Management Opérationnel Avancé',
        Domaine: company.domains[0] || 'Management & Leadership',
        Type: company.trainingTypes[0] || 'Formation professionnelle',
        Date_Realisation: '2026-11-10',
        Formateur: 'Claire Dubois',
        Duree_Heures: 14,
        Session: 'SES-2026-IMP1',
      },
      {
        Prenom: 'Hugo',
        Nom: 'Lambert',
        Email: 'hugo.lambert@exemple-client.fr',
        Telephone: '+33 6 77 88 99 00',
        Entreprise: 'EuroLogistique',
        Prestation: 'Management Opérationnel Avancé',
        Domaine: company.domains[0] || 'Management & Leadership',
        Type: company.trainingTypes[0] || 'Formation professionnelle',
        Date_Realisation: '2026-11-10',
        Formateur: 'Claire Dubois',
        Duree_Heures: 14,
        Session: 'SES-2026-IMP1',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Beneficiaires');
    XLSX.writeFile(wb, 'modele-import-formacare.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportReport(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });
      if (jsonRows.length === 0) {
        setImportError('Le fichier ne contient aucune ligne exploitable.');
        return;
      }
      const headers = Object.keys(jsonRows[0]);
      setRawHeaders(headers);
      setRawRows(jsonRows);

      // Auto-guess column mapping
      const autoMap: Record<string, string> = {};
      const guess = (fieldKey: string, patterns: string[]) => {
        const found = headers.find((h) => patterns.some((p) => h.toLowerCase().includes(p)));
        if (found) autoMap[fieldKey] = found;
      };
      guess('firstName', ['prenom', 'prénom', 'first']);
      guess('lastName', ['nom', 'last']);
      guess('email', ['email', 'mail', 'courriel']);
      guess('phone', ['tel', 'tél', 'phone', 'mobile']);
      guess('companyName', ['entreprise', 'societe', 'société', 'company', 'org']);
      guess('prestationTitle', ['prestation', 'formation', 'certification', 'intitule', 'intitulé']);
      guess('domain', ['domaine', 'secteur']);
      guess('type', ['type']);
      guess('realizedAt', ['date']);
      guess('trainerName', ['formateur', 'encadreur', 'intervenant', 'trainer']);
      guess('durationHours', ['duree', 'durée', 'heure']);
      guess('sessionCode', ['session', 'groupe', 'cohorte']);
      setMapping(autoMap);
    } catch {
      setImportError('Impossible de lire le fichier. Formats supportés : .xlsx, .xls, .csv.');
    }
  };

  const executeImport = async () => {
    setImportError('');
    setImporting(true);
    try {
      const mappedRows = rawRows.map((row) => {
        const obj: Record<string, any> = {};
        for (const f of APP_FIELDS) {
          const col = mapping[f.key];
          if (col) obj[f.key] = row[col];
        }
        return obj;
      });
      const report = await apiRequest<ImportReport>('/api/beneficiaries/import', {
        method: 'POST',
        body: JSON.stringify({ rows: mappedRows, duplicateMode }),
      });
      setImportReport(report);
      await onReload();
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const existingEmails = new Set(beneficiaries.map((b) => b.email.toLowerCase()));
  const previewDuplicatesCount = mapping.email
    ? rawRows.filter((r) => existingEmails.has(String(r[mapping.email] || '').trim().toLowerCase())).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Bénéficiaires et participants</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Consultez l’historique des prestations évaluées ou importez vos listes Excel / CSV après réalisation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setImportReport(null);
              setRawRows([]);
              setRawHeaders([]);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-[#27313B] rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-3.5 h-3.5 text-[#16834B]" />
            <span>Importer Excel / CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] hover:bg-[#126b3d] text-white rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un bénéficiaire</span>
          </button>
        </div>
      </div>

      <DataTable
        rows={beneficiaries}
        rowKey={(b) => b.id}
        searchPlaceholder="Rechercher par nom, email, entreprise, ID..."
        searchFilter={(b, q) =>
          `${b.uniqueCode} ${b.firstName} ${b.lastName} ${b.email} ${b.companyName}`.toLowerCase().includes(q)
        }
        emptyTitle="Aucun bénéficiaire enregistré"
        emptyDescription="Ajoutez un bénéficiaire manuellement ou importez un fichier Excel / CSV."
        onRowClick={openHistory}
        columns={[
          {
            key: 'code',
            label: 'Identifiant',
            sortable: true,
            sortValue: (b) => b.uniqueCode,
            render: (b) => <span className="font-mono text-xs text-[#8B9299]">{b.uniqueCode}</span>,
          },
          {
            key: 'name',
            label: 'Bénéficiaire',
            sortable: true,
            sortValue: (b) => `${b.lastName} ${b.firstName}`,
            render: (b) => (
              <div>
                <div className="font-semibold text-[#27313B]">
                  {b.firstName} {b.lastName}
                </div>
                <div className="text-xs text-[#8B9299]">{b.email}</div>
              </div>
            ),
          },
          {
            key: 'companyName',
            label: 'Entreprise',
            sortable: true,
            sortValue: (b) => b.companyName,
            render: (b) => <span className="text-xs text-[#27313B]">{b.companyName || '—'}</span>,
          },
          {
            key: 'phone',
            label: 'Téléphone',
            render: (b) => <span className="text-xs font-mono text-[#8B9299]">{b.phone || '—'}</span>,
          },
          {
            key: 'prestations',
            label: 'Prestations',
            align: 'right',
            sortable: true,
            sortValue: (b) => b.prestationCount || 0,
            render: (b) => <span className="font-mono text-xs font-semibold">{b.prestationCount || 0}</span>,
          },
          {
            key: 'evaluations',
            label: 'Évaluations',
            align: 'right',
            sortable: true,
            sortValue: (b) => b.evaluationCount || 0,
            render: (b) => <span className="font-mono text-xs">{b.evaluationCount || 0}</span>,
          },
          {
            key: 'lastScore',
            label: 'Dernière note',
            align: 'right',
            sortable: true,
            sortValue: (b) => b.lastScore ?? -1,
            render: (b) =>
              b.lastScore !== null && b.lastScore !== undefined ? (
                <span className="font-mono text-xs font-semibold text-[#16834B]">{b.lastScore.toFixed(1)}/5</span>
              ) : (
                <span className="text-xs text-[#8B9299]">—</span>
              ),
          },
          {
            key: 'actions',
            label: 'Historique',
            align: 'right',
            render: (b) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openHistory(b);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#16834B] hover:underline"
              >
                <History className="w-3.5 h-3.5" />
                <span>Dossier</span>
              </button>
            ),
          },
        ]}
      />

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleAddBeneficiary} className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#27313B]">Nouveau bénéficiaire</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {formError && <div className="p-2.5 rounded-lg bg-red-50 text-xs text-red-700">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Prénom *</label>
                <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Nom *</label>
                <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#27313B] mb-1">Adresse email *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Téléphone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Entreprise</label>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg disabled:opacity-60">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Excel / CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#16834B]" />
                <h2 className="text-base font-bold text-[#27313B]">Importation Excel / CSV des bénéficiaires et prestations</h2>
              </div>
              <button type="button" onClick={() => setShowImportModal(false)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#F9FAFB] border border-gray-200">
                <div className="text-xs text-[#27313B]">
                  <span className="font-semibold block">1. Sélectionnez un fichier (.xlsx, .xls, .csv)</span>
                  <span className="text-[#8B9299]">
                    Vous pouvez inclure uniquement les bénéficiaires ou associer directement une prestation réalisée.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadSampleTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[#27313B]"
                  >
                    <Download className="w-3.5 h-3.5 text-[#16834B]" />
                    <span>Modèle Excel</span>
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#16834B] text-white rounded-lg cursor-pointer hover:bg-[#126b3d]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choisir un fichier</span>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {importError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {rawRows.length > 0 && !importReport && (
                <>
                  {/* Column mapping */}
                  <div>
                    <h3 className="text-xs font-bold text-[#27313B] mb-2">
                      2. Correspondance entre colonnes du fichier et champs FormaCare ({rawRows.length} lignes détectées)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {APP_FIELDS.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-200 bg-white">
                          <span className="text-xs font-medium text-[#27313B] truncate">{f.label}</span>
                          <select
                            value={mapping[f.key] || ''}
                            onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                            className="text-xs border border-gray-200 rounded px-2 py-1 max-w-[145px]"
                          >
                            <option value="">— Ignorer —</option>
                            {rawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Duplicate detection */}
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-[#27313B]">Détection des doublons (email existant) : </span>
                      <span className="text-amber-800 font-semibold tabular-nums">{previewDuplicatesCount} doublon(s) détecté(s)</span>
                    </div>
                    <select
                      value={duplicateMode}
                      onChange={(e) => setDuplicateMode(e.target.value as 'skip' | 'update')}
                      className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium"
                    >
                      <option value="skip">Conserver les fiches existantes (lier uniquement la prestation)</option>
                      <option value="update">Mettre à jour les informations existantes</option>
                    </select>
                  </div>

                  {/* Preview table */}
                  <div>
                    <h3 className="text-xs font-bold text-[#27313B] mb-2">3. Prévisualisation (5 premières lignes)</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#F9FAFB] border-b border-gray-200">
                          <tr>
                            {rawHeaders.map((h) => (
                              <th key={h} className="px-3 py-2 font-semibold text-[#8B9299] whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rawRows.slice(0, 5).map((r, idx) => (
                            <tr key={idx}>
                              {rawHeaders.map((h) => (
                                <td key={h} className="px-3 py-2 text-[#27313B] whitespace-nowrap">
                                  {String(r[h] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {importReport && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#E8F5ED] border border-[#16834B]/20 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#16834B] shrink-0" />
                    <div className="text-xs text-[#27313B]">
                      <div className="font-bold">Rapport d’importation terminé ({importReport.totalRows} lignes analysées)</div>
                      <div className="mt-1 flex flex-wrap gap-4 tabular-nums">
                        <span>Bénéficiaires créés : <strong>{importReport.importedBeneficiaries}</strong></span>
                        <span>Mis à jour : <strong>{importReport.updatedBeneficiaries}</strong></span>
                        <span>Doublons ignorés : <strong>{importReport.duplicatesSkipped}</strong></span>
                        <span>Prestations créées : <strong>{importReport.importedPrestations}</strong></span>
                        <span>Lignes rejetées : <strong className="text-red-700">{importReport.rejectedCount}</strong></span>
                      </div>
                    </div>
                  </div>

                  {importReport.errors.length > 0 && (
                    <div className="border border-red-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-red-50 text-xs font-bold text-red-800">
                        Détail des lignes rejetées ({importReport.errors.length})
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-red-100 text-xs">
                        {importReport.errors.map((err, i) => (
                          <div key={i} className="px-4 py-2 flex items-center justify-between gap-4">
                            <span className="font-mono text-[#8B9299]">Ligne {err.rowNumber} ({err.email})</span>
                            <span className="text-red-700 font-medium">{err.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg"
              >
                Fermer
              </button>
              {rawRows.length > 0 && !importReport && (
                <button
                  type="button"
                  disabled={importing}
                  onClick={executeImport}
                  className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg hover:bg-[#126b3d] disabled:opacity-60"
                >
                  {importing ? 'Importation en cours...' : `Valider et importer (${rawRows.length} lignes)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Beneficiary History Drawer */}
      {historyBen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 space-y-6 border-l border-gray-200">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="text-xs font-mono text-[#8B9299]">{historyBen.uniqueCode}</div>
                <h2 className="text-lg font-bold text-[#27313B]">
                  {historyBen.firstName} {historyBen.lastName}
                </h2>
                <div className="text-xs text-[#8B9299] mt-0.5">
                  {historyBen.email} {historyBen.companyName ? `· ${historyBen.companyName}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => setHistoryBen(null)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!historyData ? (
              <div className="text-xs text-[#8B9299]">Chargement de l’historique...</div>
            ) : (
              <>
                <div>
                  <h3 className="text-xs font-bold text-[#27313B] mb-2">
                    Prestations suivies ({historyData.prestations.length})
                  </h3>
                  {historyData.prestations.length === 0 ? (
                    <p className="text-xs text-[#8B9299]">Aucune prestation associée.</p>
                  ) : (
                    <div className="space-y-2">
                      {historyData.prestations.map((p: any) => (
                        <div key={p.id} className="p-3 rounded-lg border border-gray-200 text-xs">
                          <div className="font-semibold text-[#27313B]">{p.title}</div>
                          <div className="text-[#8B9299] mt-0.5">
                            {p.type} · Formateur : {p.trainer_name} · {new Date(p.realized_at).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#27313B] mb-2">
                    Évaluations identifiées ({historyData.evaluations.length})
                  </h3>
                  {historyData.evaluations.length === 0 ? (
                    <p className="text-xs text-[#8B9299]">Aucune évaluation nominative enregistrée.</p>
                  ) : (
                    <div className="space-y-2">
                      {historyData.evaluations.map((e: any) => (
                        <div key={e.id} className="p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span>{e.prestation_title}</span>
                            <span className="font-mono text-[#16834B]">{e.overall_score}/5</span>
                          </div>
                          {e.general_comment && <p className="text-[#8B9299]">« {e.general_comment} »</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#27313B] mb-2">
                    Réclamations associées ({historyData.claims.length})
                  </h3>
                  {historyData.claims.length === 0 ? (
                    <p className="text-xs text-[#8B9299]">Aucune réclamation enregistrée.</p>
                  ) : (
                    <div className="space-y-2">
                      {historyData.claims.map((c: any) => (
                        <div key={c.id} className="p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span>
                              {c.code} · {c.category}
                            </span>
                            <span>{c.status}</span>
                          </div>
                          <p className="text-[#8B9299]">{c.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
