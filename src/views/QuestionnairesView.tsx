import React, { useState } from 'react';
import { BookOpen, Eye, Plus, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { QUESTION_BANK } from '../constants/standards';
import type { EvaluationCategoryId, QuestionItem, QuestionType, Questionnaire } from '../types';

const CATEGORY_LABELS: Record<EvaluationCategoryId, string> = {
  A: 'A. Satisfaction générale',
  B: 'B. Évaluation du formateur ou encadreur',
  C: 'C. Organisation de la formation',
  D: 'D. Contenu et qualité pédagogique',
  E: 'E. Certification',
  F: 'F. Résultats et valeur ajoutée',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  scale_5: 'Échelle 1 à 5',
  scale_10: 'Échelle 1 à 10',
  stars: 'Étoiles (1 à 5)',
  single_choice: 'Choix unique',
  multiple_choice: 'Choix multiples',
  open_text: 'Question ouverte',
  yes_no: 'Oui / Non',
  nps: 'NPS (0 à 10)',
};

export function QuestionnairesView({
  questionnaires,
  canManage,
  onReload,
}: {
  questionnaires: Questionnaire[];
  canManage: boolean;
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Questionnaire | null>(null);
  const [previewing, setPreviewing] = useState<Questionnaire | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState('Formation professionnelle');
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [categories, setCategories] = useState<EvaluationCategoryId[]>(['A', 'B', 'C', 'D', 'F']);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openNewBuilder = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setTargetType('Formation professionnelle');
    setAllowAnonymous(true);
    setCategories(['A', 'B', 'C', 'D', 'F']);
    setQuestions(QUESTION_BANK.filter((q) => q.categoryId !== 'E').map((q) => ({ ...q })));
    setError('');
    setShowBuilder(true);
  };

  const openEditBuilder = (q: Questionnaire) => {
    setEditing(q);
    setTitle(q.title);
    setDescription(q.description);
    setTargetType(q.targetType);
    setAllowAnonymous(q.allowAnonymous);
    setCategories(q.categories);
    setQuestions(q.questions.map((item) => ({ ...item })));
    setError('');
    setShowBuilder(true);
  };

  const toggleCategory = (catId: EvaluationCategoryId) => {
    setCategories((prev) => (prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]));
  };

  const addQuestionFromLibrary = (q: QuestionItem) => {
    const uniqueId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setQuestions((prev) => [...prev, { ...q, id: uniqueId }]);
    if (!categories.includes(q.categoryId)) {
      setCategories((prev) => [...prev, q.categoryId]);
    }
  };

  const addCustomQuestion = () => {
    const catId = categories[0] || 'A';
    const newQ: QuestionItem = {
      id: `q_${Date.now()}`,
      categoryId: catId,
      categoryLabel: CATEGORY_LABELS[catId],
      label: 'Nouvelle question personnalisée',
      type: 'scale_5',
      required: true,
      weight: 1,
      commentMode: 'optional',
      options: ['Option 1', 'Option 2'],
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const updateQuestion = (idx: number, patch: Partial<QuestionItem>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        const next = { ...q, ...patch };
        if (patch.categoryId) next.categoryLabel = CATEGORY_LABELS[patch.categoryId];
        return next;
      })
    );
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        targetType,
        allowAnonymous,
        active: true,
        categories,
        questions,
      };
      if (editing) {
        await apiRequest(`/api/questionnaires/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/questionnaires', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowBuilder(false);
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
          <h1 className="text-lg font-bold text-[#27313B]">Questionnaires et critères d’évaluation</h1>
          <p className="text-xs text-[#8B9299] mt-0.5">
            Créez des questionnaires adaptés à chaque type de prestation avec coefficients, types de réponses et commentaires paramétrables.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openNewBuilder}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16834B] hover:bg-[#126b3d] text-white rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Créer un questionnaire</span>
          </button>
        )}
      </div>

      {/* Questionnaires list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {questionnaires.map((q) => (
          <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[#16834B] font-semibold">
                    {q.targetType} · {q.questions.length} question(s)
                  </div>
                  <h2 className="text-base font-bold text-[#27313B] mt-1">{q.title}</h2>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md shrink-0 ${
                    q.active ? 'bg-[#E8F5ED] text-[#16834B]' : 'bg-gray-100 text-[#8B9299]'
                  }`}
                >
                  {q.active ? 'Actif' : 'Archivé'}
                </span>
              </div>
              <p className="text-xs text-[#8B9299] mt-2 leading-relaxed">{q.description}</p>
              <div className="mt-3 text-xs text-[#27313B]">
                <span className="text-[#8B9299]">Catégories activées : </span>
                <span className="font-medium">{q.categories.join(', ')}</span>
                <span className="text-[#8B9299]"> · Anonymat : </span>
                <span className="font-medium">{q.allowAnonymous ? 'Autorisé' : 'Nominatif'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewing(q)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#27313B] hover:text-[#16834B]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Prévisualiser</span>
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => openEditBuilder(q)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#F3F4F6] hover:bg-[#E8F5ED] hover:text-[#16834B] text-[#27313B] rounded-lg transition-colors"
                >
                  Personnaliser
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-gray-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#27313B]">
                {editing ? 'Personnaliser le questionnaire' : 'Nouveau questionnaire d’évaluation'}
              </h2>
              <button type="button" onClick={() => setShowBuilder(false)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {error && <div className="p-3 rounded-lg bg-red-50 text-xs text-red-700">{error}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#27313B] mb-1">Titre du questionnaire *</label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex. Évaluation Post-Certification Avancée"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#27313B] mb-1">Type de prestation ciblé</label>
                  <select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  >
                    <option value="Formation professionnelle">Formation professionnelle</option>
                    <option value="Certification">Certification</option>
                    <option value="Atelier pratique">Atelier pratique</option>
                    <option value="Mixte">Mixte (toutes prestations)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#27313B] mb-1">Description affichée au bénéficiaire</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-[#F9FAFB] rounded-xl border border-gray-200">
                <div>
                  <div className="text-xs font-bold text-[#27313B] mb-2">Catégories actives (A à F — optionnelles selon la prestation)</div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(CATEGORY_LABELS) as EvaluationCategoryId[]).map((catId) => (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => toggleCategory(catId)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          categories.includes(catId)
                            ? 'bg-[#16834B] text-white border-[#16834B]'
                            : 'bg-white text-[#27313B] border-gray-200'
                        }`}
                      >
                        {CATEGORY_LABELS[catId]}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-[#27313B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowAnonymous}
                    onChange={(e) => setAllowAnonymous(e.target.checked)}
                    className="accent-[#16834B]"
                  />
                  <span>Autoriser les réponses anonymes</span>
                </label>
              </div>

              {/* Questions list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#27313B]">Questions configurées ({questions.length})</h3>
                  <button
                    type="button"
                    onClick={addCustomQuestion}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#E8F5ED] text-[#16834B] rounded-lg hover:bg-[#d8efe1]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter une question libre</span>
                  </button>
                </div>

                {questions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-xl border border-gray-200 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-mono text-[#8B9299] pt-2">#{idx + 1}</span>
                      <input
                        value={q.label}
                        onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                        className="flex-1 px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeQuestion(idx)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        aria-label="Supprimer la question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                      <select
                        value={q.categoryId}
                        onChange={(e) => updateQuestion(idx, { categoryId: e.target.value as EvaluationCategoryId })}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg"
                      >
                        {(Object.keys(CATEGORY_LABELS) as EvaluationCategoryId[]).map((cid) => (
                          <option key={cid} value={cid}>
                            {CATEGORY_LABELS[cid]}
                          </option>
                        ))}
                      </select>

                      <select
                        value={q.type}
                        onChange={(e) => updateQuestion(idx, { type: e.target.value as QuestionType })}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg"
                      >
                        {(Object.keys(TYPE_LABELS) as QuestionType[]).map((qt) => (
                          <option key={qt} value={qt}>
                            {TYPE_LABELS[qt]}
                          </option>
                        ))}
                      </select>

                      <select
                        value={q.commentMode}
                        onChange={(e) => updateQuestion(idx, { commentMode: e.target.value as any })}
                        className="px-2.5 py-1.5 border border-gray-200 rounded-lg"
                      >
                        <option value="none">Sans commentaire</option>
                        <option value="optional">Commentaire facultatif</option>
                        <option value="required">Commentaire obligatoire</option>
                      </select>

                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg">
                        <span className="text-[#8B9299]">Coeff.</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="5"
                          value={q.weight}
                          onChange={(e) => updateQuestion(idx, { weight: Number(e.target.value) })}
                          className="w-12 text-right font-mono outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                          className="accent-[#16834B]"
                        />
                        <span>Obligatoire</span>
                      </label>
                    </div>

                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div>
                        <label className="block text-[11px] text-[#8B9299] mb-1">Options (séparées par des virgules)</label>
                        <input
                          value={(q.options || []).join(', ')}
                          onChange={(e) =>
                            updateQuestion(idx, {
                              options: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Criterion Library */}
              <div className="p-4 rounded-xl bg-[#F9FAFB] border border-gray-200 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#27313B]">
                  <BookOpen className="w-4 h-4 text-[#16834B]" />
                  <span>Bibliothèque de critères FormaCare (cliquez pour ajouter au questionnaire)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {QUESTION_BANK.map((qb) => (
                    <button
                      key={qb.id}
                      type="button"
                      onClick={() => addQuestionFromLibrary(qb)}
                      className="text-left p-2.5 bg-white border border-gray-200 rounded-lg hover:border-[#16834B] text-xs transition-colors"
                    >
                      <div className="font-semibold text-[#16834B]">{qb.categoryLabel}</div>
                      <div className="text-[#27313B] mt-0.5 line-clamp-1">{qb.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button type="button" onClick={() => setShowBuilder(false)} className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-lg">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold bg-[#16834B] text-white rounded-lg disabled:opacity-60">
                {saving ? 'Enregistrement...' : 'Enregistrer le questionnaire'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {previewing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-xs text-[#16834B] font-semibold">Aperçu bénéficiaire</div>
                <h2 className="text-base font-bold text-[#27313B]">{previewing.title}</h2>
              </div>
              <button type="button" onClick={() => setPreviewing(null)} className="text-[#8B9299] hover:text-[#27313B]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {previewing.questions.map((q, i) => (
                <div key={q.id} className="p-3.5 rounded-xl border border-gray-200 text-xs space-y-1">
                  <div className="text-[#8B9299] font-medium">
                    {q.categoryLabel} · {TYPE_LABELS[q.type]} · Coeff. {q.weight}
                  </div>
                  <div className="text-sm font-semibold text-[#27313B]">
                    {i + 1}. {q.label} {q.required ? '*' : ''}
                  </div>
                  {q.commentMode !== 'none' && (
                    <div className="text-[11px] text-[#8B9299]">
                      Champ commentaire : {q.commentMode === 'required' ? 'Obligatoire' : 'Facultatif'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
