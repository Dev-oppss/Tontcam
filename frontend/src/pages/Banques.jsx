import { useState, useEffect } from 'react';
import { Plus, PiggyBank, Pencil, Lock } from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';
import EpargneModal from '../components/caisses/EpargneModal';
import clsx from 'clsx';

const typeColors = {
  banque_libre:'green', banque_scolaire:'blue',
  banque_annuelle:'amber', banque_projet:'purple', banque_assurance:'purple'
};
const typeLabels = {
  banque_libre:'Épargne libre', banque_scolaire:'Scolaire',
  banque_annuelle:'Annuelle', banque_projet:'Projet', banque_assurance:'Assurance'
};

const createEmptyBanque = () => ({
  nom: '', description: '',
  type: 'autre',
  compteBancaireId: '',
  montantCotisation: '',
  pretAutorise: false,
  tauxInteretPret: 10,
  dureeMaxPretMois: 6,
  amortissementPret: 'unique',
  echeancesPret: 'mensuel',
  penaliteRetardActive: false,
  tauxPenalite: 5,
});

export default function Banques() {
  const {
    banques, comptesBancaire,
    addBanque, modifierBanque, showToast,
  } = useApp();

  const [addModal,     setAddModal]     = useState(false);
  const [editModal,    setEditModal]    = useState(null); // caisse en cours d'édition
  // Écran épargne par membre : Banques.jsx avait sa propre section "Comptes
  // membres" + modal "Inscrire", dupliquant EpargneModal (déjà utilisé par
  // Caisse.jsx) mais adossée à `comptesBanque`/`operationsBanque`, deux
  // tableaux jamais alimentés côté serveur (toujours `[]`) : la liste était
  // donc systématiquement vide et le clic sur "Inscrire" ne servait à rien
  // d'utile pour l'utilisateur, qui ne voyait jamais le résultat. On
  // réutilise le vrai composant, déjà branché sur les endpoints épargne
  // réels (soldes par membre, dépôt, cassation générale).
  const [epargneModal, setEpargneModal] = useState(null); // caisse dont on affiche l'épargne

  const [newBanque,  setNewBanque]  = useState(createEmptyBanque());
  const [editBanque, setEditBanque] = useState(createEmptyBanque());

  // L'ancien second écran « opérations autorisées » a été retiré : ces
  // opérations ne faisaient l'objet d'aucune règle métier ni persistance.
  const step = 1;

  const totalGlobal = banques.reduce((s, b) => s + (b.totalSolde || 0), 0);

  const resetAddWizard = () => {
    setNewBanque(createEmptyBanque());
  };

  const openAddModal = () => {
    resetAddWizard();
    setAddModal(true);
  };

  /* ─── Création banque ──────────────────────────────────────── */
  const handleAddBanque = async () => {
    if (!newBanque.nom.trim()) { showToast?.('Nom de la caisse requis.', 'error'); return; }
    await addBanque({
      ...newBanque,
      pretAutorise: Boolean(newBanque.pretAutorise),
      tauxInteretPret: newBanque.pretAutorise ? Number(newBanque.tauxInteretPret || 0) : 0,
      totalSolde: 0,
    });
    setAddModal(false);
    resetAddWizard();
  };
  const [guardedHandleAddBanque, addingBanque] = useAsyncGuard(handleAddBanque);

  /* ─── Édition banque ───────────────────────────────────────── */
  const openEditModal = (b) => {
    if (!b.modifiable) return; // sécurité : déjà bloqué côté UI, mais on double-vérifie
    setEditBanque({
      nom: b.nom || '',
      description: b.description || '',
      type: b.type || 'autre',
      compteBancaireId: b.compteBancaireId || '',
      pretAutorise: !!b.pretAutorise,
      tauxInteretPret: b.tauxInteret || 0,
    });
    setEditModal(b);
  };

  const handleEditBanque = async () => {
    if (!editModal) return;
    if (!editBanque.nom.trim()) { showToast?.('Nom de la caisse requis.', 'error'); return; }
    await modifierBanque(editModal.id, {
      ...editBanque,
      pretAutorise: Boolean(editBanque.pretAutorise),
      tauxInteret: editBanque.pretAutorise ? Number(editBanque.tauxInteretPret || 0) : 0,
    });
    setEditModal(null);
  };
  const [guardedHandleEditBanque, editingBanque] = useAsyncGuard(handleEditBanque);

  const pretAutorise = Boolean(newBanque.pretAutorise);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caisses internes"
        subtitle={`${banques.length} caisse${banques.length > 1 ? 's' : ''} — Solde global : ${fmt(totalGlobal)}`}
        action={
          <button onClick={openAddModal} className="btn-primary">
            <Plus size={15} /> Nouvelle caisse
          </button>
        }
      />

      {/* ── Cartes caisses ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
        {banques.map(b => {
          return (
            <div key={b.id} className="card-hover fade-up group cursor-pointer" onClick={() => setEpargneModal(b)}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-surface-50">
                  
                </div>
                <Badge variant={typeColors[b.type] || 'gray'}>
                  {typeLabels[b.type] || b.type || 'Caisse'}
                </Badge>
              </div>

              {/* Nom */}
              <p className="font-bold text-ink-900 text-sm mb-1 truncate">{b.nom}</p>
              <p className="text-xs text-ink-600/50 mb-3 line-clamp-2 min-h-[2rem]">{b.description || 'Aucune description'}</p>

              {/* Solde */}
              <p className="text-2xl font-bold text-primary-600 mb-3">{fmt(b.totalSolde || 0)}</p>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-surface-100">
                <button
                  onClick={e => { e.stopPropagation(); setEpargneModal(b); }}
                  className="btn-primary flex-1 text-xs py-1.5 justify-center"
                >
                  <PiggyBank size={12} /> Épargne
                </button>
                <button
                  onClick={e => { e.stopPropagation(); openEditModal(b); }}
                  disabled={!b.modifiable}
                  title={b.modifiable ? 'Modifier la caisse' : 'Des transactions ont déjà été enregistrées : caisse non modifiable'}
                  className="btn-secondary text-xs py-1.5 px-2 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {b.modifiable ? <Pencil size={12} /> : <Lock size={12} />}
                </button>
              </div>
            </div>
          );
        })}

        {/* Carte "ajouter" */}
        <button
          onClick={openAddModal}
          className="rounded-[14px] border-2 border-dashed border-surface-200 hover:border-primary-300 hover:bg-primary-50/40 transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-[200px] text-ink-600/40 hover:text-primary-600 group"
        >
          <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus size={18} />
          </div>
          <span className="text-xs font-semibold">Nouvelle caisse</span>
        </button>
      </div>

      {/* ══ MODAL NOUVELLE CAISSE ═════════════════════════════ */}
      <Modal
        open={addModal}
        onClose={() => { setAddModal(false); resetAddWizard(); }}
        size="xl"
        title="Nouvelle caisse"
        footer={<><button onClick={() => setAddModal(false)} disabled={addingBanque} className="btn-secondary">Annuler</button><button onClick={guardedHandleAddBanque} disabled={addingBanque || !newBanque.nom.trim()} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"><Plus size={14} /> {addingBanque ? 'Création…' : 'Créer la caisse'}</button></>}
      >
        {/* ── Étape 1 : Informations ─────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <FormField label="Nom de la caisse" required>
              <input
                className="input"
                placeholder="Ex : Caisse scolaire 2025, fonds d'urgence…"
                value={newBanque.nom}
                onChange={e => setNewBanque(f => ({ ...f, nom: e.target.value }))}
              />
            </FormField>

            <FormField label="Type de caisse" required hint="Détermine où cette caisse peut être utilisée dans l'application (ex : liée à une tontine).">
              <select
                className="select"
                value={newBanque.type}
                onChange={e => setNewBanque(f => ({ ...f, type: e.target.value }))}
              >
                <option value="tontine">Tontine</option>
                <option value="mutuelle">Mutuelle</option>
                <option value="scolaire">Scolaire</option>
                <option value="evenement">Événement</option>
                <option value="annuelle">Annuelle</option>
                <option value="banque">Banque</option>
                <option value="autre">Autre</option>
              </select>
            </FormField>

            <FormField label="Compte bancaire lié (optionnel)" hint="Nécessaire pour faire un rapprochement bancaire sur cette caisse plus tard.">
              <select
                className="select"
                value={newBanque.compteBancaireId}
                onChange={e => setNewBanque(f => ({ ...f, compteBancaireId: e.target.value }))}
              >
                <option value="">Aucun</option>
                {(comptesBancaire || []).map(c => (
                  <option key={c.id} value={c.id}>{c.banque} — {c.numeroCompte}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Montant de cotisation mensuelle (FCFA)">
              <input
                type="number"
                className="input"
                placeholder="Ex : 5 000 (optionnel)"
                min="0"
                value={newBanque.montantCotisation}
                onChange={e => setNewBanque(f => ({ ...f, montantCotisation: e.target.value }))}
              />
            </FormField>

            <FormField label="Description / règles">
              <textarea
                className="input h-24 resize-none"
                placeholder="Décrivez l'objectif, les règles de fonctionnement…"
                value={newBanque.description}
                onChange={e => setNewBanque(f => ({ ...f, description: e.target.value }))}
              />
            </FormField>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-900">
                <input type="checkbox" checked={pretAutorise} onChange={e => setNewBanque(f => ({ ...f, pretAutorise: e.target.checked }))} className="w-4 h-4 rounded" />
                Autoriser les prêts depuis cette caisse
              </label>
              {pretAutorise && <FormField label="Taux d'intérêt mensuel (%)"><input type="number" className="input" min="0" max="100" value={newBanque.tauxInteretPret} onChange={e => setNewBanque(f => ({ ...f, tauxInteretPret: e.target.value }))} /></FormField>}
            </div>
          </div>
        )}

        {/* ── Étape 2 : Types d'opérations ──────────────── */}
        {false && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-ink-600/50 mb-2">
              <CheckCircle2 size={13} />
              <span>Étape 2 sur 2 — Opérations autorisées</span>
            </div>

            <p className="text-sm text-ink-700 font-medium">
              Quels types d'opérations cette caisse peut-elle effectuer ?
            </p>
            <p className="text-xs text-ink-600/50 -mt-2">
              Sélectionnez une ou plusieurs options. Cela détermine les actions disponibles pour les membres.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pr-1">
              {ALL_OPERATIONS.map(op => {
                const selected = newBanque.operationsAutorisees?.includes(op.id);
                const Icon = op.icon;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => toggleOp(op.id)}
                    className={clsx(
                      'flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all duration-150 w-full',
                      selected
                        ? 'border-primary-400 bg-primary-50 shadow-glow-green'
                        : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
                    )}
                  >
                    <div className={clsx(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                      selected ? 'bg-primary-600 text-white shadow-sm' : `${op.bg} ${op.color} border`
                    )}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className={clsx('text-sm font-semibold leading-tight', selected ? 'text-primary-800' : 'text-ink-800')}>
                        {op.label}
                      </p>
                      <p className={clsx('text-xs mt-0.5 leading-snug', selected ? 'text-primary-600' : 'text-ink-600/50')}>
                        {op.desc}
                      </p>
                    </div>
                    <div className={clsx(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                      selected ? 'border-primary-500 bg-primary-500' : 'border-surface-300 bg-white'
                    )}>
                      {selected && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Récap sélection */}
            {newBanque.operationsAutorisees?.length > 0 && (
              <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl">
                <p className="text-xs font-semibold text-primary-700 mb-2">
                  {newBanque.operationsAutorisees.length} opération{newBanque.operationsAutorisees.length > 1 ? 's' : ''} sélectionnée{newBanque.operationsAutorisees.length > 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {newBanque.operationsAutorisees.map(opId => <OpTag key={opId} opId={opId} />)}
                </div>
              </div>
            )}

            {pretAutorise && (
              <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/70 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-blue-900">Paramètres de prêt</p>
                  <p className="text-xs text-blue-700 mt-1">Cette caisse peut prêter. On configure ici les règles de remboursement.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Taux de remboursement (%)">
                    <input
                      type="number"
                      className="input"
                      min="0"
                      max="100"
                      value={newBanque.tauxInteretPret}
                      onChange={e => setNewBanque(f => ({ ...f, tauxInteretPret: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Durée max (mois)">
                    <input
                      type="number"
                      className="input"
                      min="1"
                      value={newBanque.dureeMaxPretMois}
                      onChange={e => setNewBanque(f => ({ ...f, dureeMaxPretMois: e.target.value }))}
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Amortissement">
                    <select
                      className="select"
                      value={newBanque.amortissementPret}
                      onChange={e => setNewBanque(f => ({ ...f, amortissementPret: e.target.value }))}
                    >
                      <option value="unique">Remboursement unique</option>
                      <option value="echelonne">Échelonné</option>
                    </select>
                  </FormField>
                  <FormField label="Échéances">
                    <select
                      className="select"
                      value={newBanque.echeancesPret}
                      onChange={e => setNewBanque(f => ({ ...f, echeancesPret: e.target.value }))}
                    >
                      <option value="mensuel">Mensuelles</option>
                      <option value="bimestriel">Bimestrielles</option>
                      <option value="trimestriel">Trimestrielles</option>
                    </select>
                  </FormField>
                </div>

                <div className="pt-2 border-t border-blue-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!newBanque.penaliteRetardActive}
                      onChange={e => setNewBanque(f => ({ ...f, penaliteRetardActive: e.target.checked }))}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-semibold text-blue-900">Appliquer une pénalité de retard</span>
                  </label>
                  <p className="text-xs text-blue-700 mt-1 ml-6">
                    Si activé, chaque échéance manquée accumule une pénalité en % du montant dû ce mois-là. Désactivé par défaut (comportement inchangé).
                  </p>
                  {newBanque.penaliteRetardActive && (
                    <div className="mt-2 ml-6">
                      <FormField label="Taux de pénalité par échéance manquée (%)">
                        <input
                          type="number"
                          className="input"
                          min="0"
                          max="100"
                          step="0.5"
                          value={newBanque.tauxPenalite}
                          onChange={e => setNewBanque(f => ({ ...f, tauxPenalite: e.target.value }))}
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              </div>
            )}

            {newBanque.operationsAutorisees?.length === 0 && (
              <p className="text-xs text-red-500 flex items-center gap-1">
               Sélectionnez au moins une opération pour créer la caisse.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ══ MODAL MODIFIER CAISSE ═════════════════════════════ */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        size="xl"
        title="Modifier la caisse"
        footer={<><button onClick={() => setEditModal(null)} disabled={editingBanque} className="btn-secondary">Annuler</button><button onClick={guardedHandleEditBanque} disabled={editingBanque || !editBanque.nom.trim()} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"><Pencil size={14} /> {editingBanque ? 'Enregistrement…' : 'Enregistrer'}</button></>}
      >
        <div className="space-y-4">
          <FormField label="Nom de la caisse" required>
            <input
              className="input"
              value={editBanque.nom}
              onChange={e => setEditBanque(f => ({ ...f, nom: e.target.value }))}
            />
          </FormField>

          <FormField label="Type de caisse" required>
            <select
              className="select"
              value={editBanque.type}
              onChange={e => setEditBanque(f => ({ ...f, type: e.target.value }))}
            >
              <option value="tontine">Tontine</option>
              <option value="mutuelle">Mutuelle</option>
              <option value="scolaire">Scolaire</option>
              <option value="evenement">Événement</option>
              <option value="annuelle">Annuelle</option>
              <option value="banque">Banque</option>
              <option value="autre">Autre</option>
            </select>
          </FormField>

          <FormField label="Compte bancaire lié (optionnel)">
            <select
              className="select"
              value={editBanque.compteBancaireId}
              onChange={e => setEditBanque(f => ({ ...f, compteBancaireId: e.target.value }))}
            >
              <option value="">Aucun</option>
              {(comptesBancaire || []).map(c => (
                <option key={c.id} value={c.id}>{c.banque} — {c.numeroCompte}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Description / règles">
            <textarea
              className="input h-24 resize-none"
              value={editBanque.description}
              onChange={e => setEditBanque(f => ({ ...f, description: e.target.value }))}
            />
          </FormField>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-900">
              <input type="checkbox" checked={!!editBanque.pretAutorise} onChange={e => setEditBanque(f => ({ ...f, pretAutorise: e.target.checked }))} className="w-4 h-4 rounded" />
              Autoriser les prêts depuis cette caisse
            </label>
            {editBanque.pretAutorise && (
              <FormField label="Taux d'intérêt mensuel (%)">
                <input type="number" className="input" min="0" max="100" value={editBanque.tauxInteretPret} onChange={e => setEditBanque(f => ({ ...f, tauxInteretPret: e.target.value }))} />
              </FormField>
            )}
          </div>

          <p className="text-xs text-ink-600/50">
            Le solde initial ne peut plus être modifié une fois la caisse créée. Dès qu'une transaction (dépôt, retrait, prêt…) est enregistrée sur cette caisse, elle ne sera plus modifiable.
          </p>
        </div>
      </Modal>

      {/* ══ MODAL ÉPARGNE (réel, branché sur les endpoints serveur) ══ */}
      {epargneModal && (
        <EpargneModal caisse={banques.find(x => x.id === epargneModal.id) || epargneModal} onClose={() => setEpargneModal(null)} />
      )}
    </div>
  );
}
