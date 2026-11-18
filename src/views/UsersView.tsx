import React, { useEffect, useState } from 'react';
import { History, Plus, Shield, X } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { apiRequest } from '../lib/api';
import type { AuditLog, Beneficiary, User, UserRole } from '../types';

export function UsersView({
  currentUser,
  users,
  beneficiaries,
  onReload,
}: {
  currentUser: User;
  users: User[];
  beneficiaries: Beneficiary[];
  onReload: () => Promise<void>;
}) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('quality_manager');
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [canManageQuestionnaires, setCanManageQuestionnaires] = useState(true);
  const [canExportReports, setCanExportReports] = useState(true);
  const [canManageTrainers, setCanManageTrainers] = useState(false);
  const [canManageClaims, setCanManageClaims] = useState(true);
  const [canImportData, setCanImportData] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      apiRequest<AuditLog[]>('/api/audit-logs')
        .then(setAuditLogs)
        .catch(() => {});
    }
  }, [isAdmin, users]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          beneficiaryId: role === 'beneficiary' ? beneficiaryId || null : null,
          permissions: {
            canManageQuestionnaires,
            canExportReports,
            canManageTrainers,
            canManageClaims,
            canImportData,
          },
        }),
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPassword('');
      await onReload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleUserActive = async (u: User) => {
    await apiRequest(`/api/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    await onReload();
  };

  const togglePermission = async (u: User, permKey: keyof User['permissions']) => {
    await apiRequest(`/api/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        permissions: { ...u.permissions, [permKey]: !u.permissions[permKey] },
      }),
    });
    await onReload();
  };

  const roleLabel = (r: UserRole) => {
    if (r === 'admin') return 'Administrateur';
    if (r === 'quality_manager') return 'Gestionnaire qualité';
    return 'Bénéficiaire';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27313B]">Utilisateurs, rôles et journal d’audit</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Gérez les accès Administrateur, Gestionnaire qualité (avec permissions granulaires) et Bénéficiaire.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] hover:bg-[#126b3d] text-white rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un utilisateur</span>
          </button>
        )}
      </div>

      <DataTable
        rows={users}
        rowKey={(u) => u.id}
        searchPlaceholder="Rechercher un utilisateur..."
        searchFilter={(u, q) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q)}
        columns={[
          {
            key: 'name',
            label: 'Utilisateur',
            render: (u) => (
              <div>
                <div className="font-semibold text-[#27313B]">{u.name}</div>
                <div className="text-xs text-[#8B9299]">{u.email}</div>
              </div>
            ),
          },
          {
            key: 'role',
            label: 'Profil',
            render: (u) => (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#27313B]">
                <Shield className="w-3.5 h-3.5 text-[#16834B]" />
                <span>{roleLabel(u.role)}</span>
              </span>
            ),
          },
          {
            key: 'permissions',
            label: 'Permissions effectives',
            render: (u) => {
              if (u.role === 'admin') return <span className="text-xs text-[#16834B] font-medium">Accès complet</span>;
              if (u.role === 'beneficiary')
                return <span className="text-xs text-[#8B9299]">Espace personnel uniquement</span>;
              return (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={Boolean(u.permissions.canManageQuestionnaires)}
                      onChange={() => togglePermission(u, 'canManageQuestionnaires')}
                      className="accent-[#16834B]"
                    />
                    <span>Questionnaires</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={Boolean(u.permissions.canManageTrainers)}
                      onChange={() => togglePermission(u, 'canManageTrainers')}
                      className="accent-[#16834B]"
                    />
                    <span>Formateurs</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={Boolean(u.permissions.canImportData)}
                      onChange={() => togglePermission(u, 'canImportData')}
                      className="accent-[#16834B]"
                    />
                    <span>Import</span>
                  </label>
                </div>
              );
            },
          },
          {
            key: 'status',
            label: 'Statut',
            render: (u) => (
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${
                  u.isActive ? 'bg-[#E8F5ED] text-[#16834B]' : 'bg-gray-100 text-[#8B9299]'
                }`}
              >
                {u.isActive ? 'Actif' : 'Désactivé'}
              </span>
            ),
          },
          {
            key: 'action',
            label: 'Action',
            align: 'right',
            render: (u) =>
              isAdmin && u.id !== currentUser.id ? (
                <button
                  type="button"
                  onClick={() => toggleUserActive(u)}
                  className="text-xs font-semibold text-[#27313B] hover:text-[#16834B]"
                >
                  {u.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
              ) : (
                <span className="text-xs text-[#8B9299]">—</span>
              ),
          },
        ]}
      />

      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <History className="w-4 h-4 text-[#16834B]" />
            <h2 className="text-sm font-bold text-[#27313B]">Journalisation des actions importantes (Audit Log)</h2>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-semibold text-[#16834B] mr-2">{log.action}</span>
                  <span className="font-semibold text-[#27313B]">{log.userName}</span>
                  <span className="text-[#8B9299] ml-2">— {log.details}</span>
                </div>
                <span className="font-mono text-[#8B9299]">
                  {new Date(log.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#27313B]">Créer un compte utilisateur</h2>
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
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Rôle *</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="quality_manager">Gestionnaire qualité</option>
                  <option value="admin">Administrateur</option>
                  <option value="beneficiary">Bénéficiaire</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Email *</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Mot de passe *</label>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              </div>
            </div>

            {role === 'beneficiary' && (
              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Fiche bénéficiaire rattachée</label>
                <select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                  <option value="">Sélectionner...</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.firstName} {b.lastName} ({b.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role === 'quality_manager' && (
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-gray-200 space-y-2 text-xs">
                <div className="font-bold text-[#27313B]">Permissions du gestionnaire qualité</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={canManageQuestionnaires} onChange={(e) => setCanManageQuestionnaires(e.target.checked)} className="accent-[#16834B]" />
                    <span>Gérer questionnaires</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={canManageClaims} onChange={(e) => setCanManageClaims(e.target.checked)} className="accent-[#16834B]" />
                    <span>Traiter réclamations</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={canExportReports} onChange={(e) => setCanExportReports(e.target.checked)} className="accent-[#16834B]" />
                    <span>Générer rapports</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={canImportData} onChange={(e) => setCanImportData(e.target.checked)} className="accent-[#16834B]" />
                    <span>Importer Excel/CSV</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={canManageTrainers} onChange={(e) => setCanManageTrainers(e.target.checked)} className="accent-[#16834B]" />
                    <span>Gérer formateurs</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg">
                {saving ? 'Création...' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
