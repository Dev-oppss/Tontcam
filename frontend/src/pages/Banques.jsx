import { useState } from 'react';
import {
  Plus, ArrowDownCircle, ArrowUpCircle, Eye, UserPlus, Users, Landmark,
  PiggyBank, HandCoins, Heart, GraduationCap, Calendar, FolderOpen,
  ShieldCheck, Banknote, CheckCircle2, Settings2, ChevronRight
} from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField, SectionCard } from '../components/ui/index';
import { ModePaiementFields, isModePaiementValid } from '../components/ui/ModePaiement';
import clsx from 'clsx';

/* ─── Définition des types d'opérations disponibles ─────────── */
const ALL_OPERATIONS = [
  {
    id: 'epargne',
    label: 'Épargne',
    desc: 'Dépôts et retraits d\'épargne classique',
    icon: PiggyBank,
    color: 'text-primary-600',
    bg: 'bg-primary-50 border-primary-200',
    bgActive: 'bg-primary-600',
  },
  {
    id: 'pret',
    label: 'Prêt / Crédit',
    desc: 'Accorder et rembourser des prêts',
    icon: HandCoins,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    bgActive: 'bg-blue-600',
  },
  {
    id: 'aide',
    label: 'Aide / Assistance',
    desc: 'Versements d\'aides solidaires',
    icon: Heart,
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
    bgActive: 'bg-rose-500',
  },
  {
    id: 'scolaire',
    label: 'Frais scolaires',
    desc: 'Financement frais de scolarité',
    icon: GraduationCap,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200',
    bgActive: 'bg-indigo-600',
  },
  {
    id: 'cotisation',
    label: 'Cotisation',
    desc: 'Collecte de cotisations périodiques',
    icon: Calendar,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    bgActive: 'bg-amber-500',
  },
  {
    id: 'projet',
    label: 'Projet / Investissement',
    desc: 'Financement de projets membres',
    icon: FolderOpen,
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    bgActive: 'bg-purple-600',
  },
  {
    id: 'assurance',
    label: 'Fond d\'assurance',
    desc: 'Couverture risques et sinistres',
    icon: ShieldCheck,
    color: 'text-teal-600',
    bg: 'bg-teal-50 border-teal-200',
    bgActive: 'bg-teal-600',
  },
  {
    id: 'retrait_libre',
    label: 'Retrait libre',
    desc: 'Retrait à tout moment sans conditions',
    icon: Banknote,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    bgActive: 'bg-orange-500',
  },
];

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
  montantCotisation: '',
  operationsAutorisees: ['epargne'],
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
    membres, banques, comptesBanque, operationsBanque,
    addBanque, doOperation, addMembreBanque,
  } = useApp();

  const [addModal,    setAddModal]    = useState(false);
  const [opModal,     setOpModal]     = useState(null);
  const [enrollModal, setEnrollModal] = useState(null);
  const [showComptes, setShowComptes] = useState(null);

  const [newBanque,  setNewBanque]  = useState(createEmptyBanque());
  const [opForm,     setOpForm]     = useState({ montant:'', observation:'', dateOperation: new Date().toISOString().split('T')[0], modePaiement: 'especes', detailsPaiement: '' });
  const [enrollForm, setEnrollForm] = useState({ idMembre:'' });

  // ── Step du wizard création ─────────────────────────────────
  const [step, setStep] = useState(1); // 1 = infos, 2 = opérations

  const totalGlobal = banques.reduce((s, b) => s + (b.totalSolde || 0), 0);

  /* ─── Helpers ──────────────────────────────────────────────── */
  const comptesDeBanque     = (id) => comptesBanque.filter(c => c.idBanque === id);
  const membresDisponibles  = (id) => membres.filter(m => !comptesBanque.some(c => c.idBanque === id && c.idMembre === m.id));

  const resetAddWizard = () => {
    setNewBanque(createEmptyBanque());
    setStep(1);
  };

  const toggleOp = (opId) => {
    setNewBanque(prev => {
      const ops = prev.operationsAutorisees || [];
      return {
        ...prev,
        operationsAutorisees: ops.includes(opId)
          ? ops.filter(o => o !== opId)
          : [...ops, opId],
      };
    });
  };

  const openAddModal = () => {
    resetAddWizard();
    setAddModal(true);
  };

  /* ─── Opération ────────────────────────────────────────────── */
  const openOp = (compte, type) => {
    setOpForm({ montant:'', observation:'', dateOperation: new Date().toISOString().split('T')[0], modePaiement: 'especes', detailsPaiement: '' });
    setOpModal({ compte, type });
  };

  const handleOp = () => {
    if (!opForm.montant || Number(opForm.montant) <= 0) return;
    if (!isModePaiementValid(opForm.modePaiement, opForm.detailsPaiement)) return;
    if (opModal.type === 'retrait' && Number(opForm.montant) > Number(opModal.compte.solde || 0)) return; // RG-CAI-006
    doOperation({
      idMembre: opModal.compte.idMembre,
      idBanque: opModal.compte.idBanque,
      typeOperation: opModal.type,
      montant: Number(opForm.montant),
      observation: opForm.observation,
      dateOperation: opForm.dateOperation,
      modePaiement: opForm.modePaiement,
      detailsPaiement: opForm.detailsPaiement,
    });
    setOpModal(null);
  };

  /* ─── Création banque ──────────────────────────────────────── */
  const handleAddBanque = () => {
    if (!newBanque.nom.trim()) return;
    if (!newBanque.operationsAutorisees?.length) return;
    const pretAutorise = newBanque.operationsAutorisees.includes('pret');
    addBanque({
      ...newBanque,
      pretAutorise,
      tauxInteretPret: pretAutorise ? Number(newBanque.tauxInteretPret || 0) : 0,
      dureeMaxPretMois: pretAutorise ? Number(newBanque.dureeMaxPretMois || 0) : 0,
      amortissementPret: pretAutorise ? newBanque.amortissementPret || 'unique' : 'unique',
      echeancesPret: pretAutorise ? newBanque.echeancesPret || 'mensuel' : 'mensuel',
      penaliteRetardActive: pretAutorise ? Boolean(newBanque.penaliteRetardActive) : false,
      tauxPenalite: pretAutorise && newBanque.penaliteRetardActive ? Number(newBanque.tauxPenalite || 0) : 0,
      totalSolde: 0,
    });
    setAddModal(false);
    resetAddWizard();
  };

  /* ─── Inscription membre ───────────────────────────────────── */
  const handleEnroll = () => {
    if (!enrollForm.idMembre || !enrollModal) return;
    const mEnroll = membres.find(m => m.id === enrollForm.idMembre);
    addMembreBanque({ idMembre: enrollForm.idMembre, idBanque: enrollModal.id, nomBanque: enrollModal.nom,
      nomMembre: mEnroll ? `${mEnroll.nom} ${mEnroll.prenom}` : '—',
    });
    setEnrollForm({ idMembre:'' });
    setEnrollModal(null);
  };

  /* ─── Badge opérations autorisées ─────────────────────────── */
  const OpTag = ({ opId }) => {
    const op = ALL_OPERATIONS.find(o => o.id === opId);
    if (!op) return null;
    const Icon = op.icon;
    return (
      <span className={clsx('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', op.bg, op.color)}>
        <Icon size={10} />
        {op.label}
      </span>
    );
  };
  const pretAutorise = newBanque.operationsAutorisees?.includes('pret');

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
          const comptes = comptesDeBanque(b.id);
          const ops = (b.operationsAutorisees || []).slice(0, 3);
          return (
            <div key={b.id} className="card-hover fade-up group cursor-pointer" onClick={() => setShowComptes(b)}>
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
              <p className="text-2xl font-bold text-primary-600 mb-0.5">{fmt(b.totalSolde || 0)}</p>
              <p className="text-xs text-ink-600/40 mb-3">{comptes.length} membre{comptes.length > 1 ? 's' : ''}</p>

              {/* Opérations autorisées */}
              {ops.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {ops.map(opId => <OpTag key={opId} opId={opId} />)}
                  {(b.operationsAutorisees || []).length > 3 && (
                    <span className="text-[11px] text-ink-600/40 px-1">+{b.operationsAutorisees.length - 3}</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-surface-100">
                <button
                  onClick={e => { e.stopPropagation(); setShowComptes(b); }}
                  className="btn-secondary flex-1 text-xs py-1.5 justify-center"
                >
                  <Users size={12} /> Membres
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setEnrollModal(b); }}
                  className="btn-primary flex-1 text-xs py-1.5 justify-center"
                >
                  <UserPlus size={12} /> Inscrire
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

      {/* ── Comptes membres global ───────────────────────────── */}
      <SectionCard
        title="Comptes membres"
        subtitle={`${comptesBanque.length} compte(s) au total`}
        className="p-0 overflow-hidden"
      >
        <Table headers={['Membre','Caisse','Solde','Statut','Actions']}>
          {comptesBanque.map(c => (
            <tr key={c.id} className="tr">
              <td className="td">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(c.nomMembre || '?')[0]}
                  </div>
                  <span className="font-medium text-ink-800">{c.nomMembre}</span>
                </div>
              </td>
              <td className="td">
                <Badge variant={typeColors[banques.find(b => b.id === c.idBanque)?.type] || 'gray'}>
                  {c.nomBanque}
                </Badge>
              </td>
              <td className="td font-bold text-primary-600">{fmt(c.solde)}</td>
              <td className="td">
                <Badge variant={c.statut === 'actif' ? 'green' : 'gray'}>
                  {c.statut === 'actif' ? 'Actif' : 'Inactif'}
                </Badge>
              </td>
              <td className="td">
                <div className="flex gap-1">
                  <button onClick={() => openOp(c, 'depot')} title="Dépôt"
                    className="p-1.5 text-ink-600/40 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <ArrowDownCircle size={14} />
                  </button>
                  <button onClick={() => openOp(c, 'retrait')} title="Retrait"
                    className="p-1.5 text-ink-600/40 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                    <ArrowUpCircle size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {comptesBanque.length === 0 && (
            <tr><td colSpan={5} className="td text-center text-ink-600/40 py-10">Aucun compte enregistré</td></tr>
          )}
        </Table>
      </SectionCard>

      {/* ── Dernières opérations ─────────────────────────────── */}
      <SectionCard
        title="Dernières opérations"
        subtitle={`${operationsBanque.length} opération(s) enregistrée(s)`}
        className="p-0 overflow-hidden"
      >
        <Table headers={['Date','Membre','Caisse','Type','Montant','Observation']}>
          {[...operationsBanque].reverse().slice(0, 20).map(op => (
            <tr key={op.id} className="tr">
              <td className="td text-xs text-ink-600/50">{fmtDate(op.dateOperation)}</td>
              <td className="td">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(op.nomMembre || '?')[0]}
                  </div>
                  <span className="font-medium text-ink-800">{op.nomMembre || '—'}</span>
                </div>
              </td>
              <td className="td">
                <Badge variant={typeColors[banques.find(b => b.id === op.idBanque)?.type] || 'gray'}>
                  {op.nomBanque}
                </Badge>
              </td>
              <td className="td">
                <Badge variant={op.typeOperation === 'depot' ? 'green' : 'amber'}>
                  {op.typeOperation === 'depot' ? '↓ Dépôt' : '↑ Retrait'}
                </Badge>
              </td>
              <td className="td font-bold text-primary-600">{fmt(op.montant)}</td>
              <td className="td text-xs text-ink-600/40 truncate max-w-[180px]">{op.observation || '—'}</td>
            </tr>
          ))}
          {operationsBanque.length === 0 && (
            <tr><td colSpan={6} className="td text-center text-ink-600/40 py-10">Aucune opération enregistrée</td></tr>
          )}
        </Table>
      </SectionCard>

      {/* ══ MODAL NOUVELLE BANQUE — wizard 2 étapes ══════════ */}
      <Modal
        open={addModal}
        onClose={() => { setAddModal(false); resetAddWizard(); }}
        size="xl"
        title={
          <div className="flex items-center gap-3">
            <span>Nouvelle caisse</span>
            <div className="flex items-center gap-1.5 ml-2">
              {[1, 2].map(s => (
                <div key={s} className={clsx(
                  'h-1.5 rounded-full transition-all duration-300',
                  s === step ? 'w-6 bg-primary-500' : s < step ? 'w-3 bg-primary-300' : 'w-3 bg-surface-200'
                )} />
              ))}
            </div>
          </div>
        }
        footer={
          step === 1 ? (
            <>
              <button onClick={() => setAddModal(false)} className="btn-secondary">Annuler</button>
              <button
                onClick={() => setStep(2)}
                disabled={!newBanque.nom.trim()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suivant <ChevronRight size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="btn-secondary">- Retour</button>
            <button
              onClick={handleAddBanque}
              disabled={!newBanque.operationsAutorisees?.length}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Créer la caisse
            </button>
            </>
          )
        }
      >
        {/* ── Étape 1 : Informations ─────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-ink-600/50 mb-2">
              <Settings2 size={13} />
              <span>Étape 1 sur 2 — Informations générales</span>
            </div>

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
          </div>
        )}

        {/* ── Étape 2 : Types d'opérations ──────────────── */}
        {step === 2 && (
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

      {/* ══ MODAL MEMBRES D'UNE BANQUE ════════════════════ */}
      {showComptes && (() => {
        const b = banques.find(x => x.id === showComptes.id) || showComptes;
        const comptes = comptesDeBanque(b.id);
        const opsB = operationsBanque.filter(o => o.idBanque === b.id);
        return (
          <Modal
            open={true}
            onClose={() => setShowComptes(null)}
            title={b.nom}
            footer={
              <div className="flex gap-2 w-full">
                <button onClick={() => { setEnrollModal(b); setShowComptes(null); }} className="btn-primary">
                  <UserPlus size={14} /> Inscrire un membre
                </button>
                <button onClick={() => setShowComptes(null)} className="btn-secondary ml-auto">Fermer</button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Opérations autorisées */}
              {b.operationsAutorisees?.length > 0 && (
                <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
                  <p className="text-xs font-semibold text-ink-600/60 mb-2 uppercase tracking-wide">Opérations autorisées</p>
                  <div className="flex flex-wrap gap-1.5">
                    {b.operationsAutorisees.map(opId => <OpTag key={opId} opId={opId} />)}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-primary-50 rounded-xl text-center">
                  <p className="text-lg font-bold text-primary-600">{fmt(b.totalSolde || 0)}</p>
                  <p className="text-xs text-ink-600/50">Solde</p>
                </div>
                <div className="p-3 bg-surface-50 rounded-xl text-center">
                  <p className="text-lg font-bold text-ink-800">{comptes.length}</p>
                  <p className="text-xs text-ink-600/50">Membres</p>
                </div>
                <div className="p-3 bg-surface-50 rounded-xl text-center">
                  <p className="text-lg font-bold text-ink-800">{opsB.length}</p>
                  <p className="text-xs text-ink-600/50">Opérations</p>
                </div>
              </div>

              {/* Liste comptes */}
              {comptes.length === 0 ? (
                <div className="text-center py-8 text-ink-600/40">
                  <Landmark size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun membre inscrit dans cette caisse</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {comptes.map(c => {
                    const opsM = opsB.filter(o => o.idMembre === c.idMembre);
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl group hover:bg-white hover:shadow-card transition-all">
                        <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(c.nomMembre || '?')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink-800">{c.nomMembre}</p>
                          <p className="text-xs text-ink-600/40">{opsM.length} opération(s)</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary-600">{fmt(c.solde)}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openOp(c, 'depot')} title="Dépôt"
                            className="p-1.5 text-ink-600/40 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                            <ArrowDownCircle size={13} />
                          </button>
                          <button onClick={() => openOp(c, 'retrait')} title="Retrait"
                            className="p-1.5 text-ink-600/40 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                            <ArrowUpCircle size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ══ MODAL INSCRIRE MEMBRE ══════════════════════════ */}
      <Modal
        open={!!enrollModal}
        onClose={() => { setEnrollModal(null); setEnrollForm({ idMembre:'' }); }}
        title={`Inscrire un membre — ${enrollModal?.nom}`}
        footer={<>
          <button onClick={() => { setEnrollModal(null); setEnrollForm({ idMembre:'' }); }} className="btn-secondary">Annuler</button>
          <button onClick={handleEnroll} className="btn-primary"><UserPlus size={14} /> Inscrire</button>
        </>}
      >
        <div className="space-y-4">
          {enrollModal && membresDisponibles(enrollModal.id).length === 0 ? (
            <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl text-center">
              <Users size={24} className="mx-auto mb-2 text-primary-500" />
              <p className="text-sm font-medium text-primary-700">Tous les membres sont déjà inscrits !</p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 border border-blue-100">
                 Un membre peut être inscrit dans plusieurs caisses différentes. Chaque compte est géré indépendamment.
              </div>
              <FormField label="Membre à inscrire" required>
                <select className="select" value={enrollForm.idMembre}
                  onChange={e => setEnrollForm(f => ({ ...f, idMembre: e.target.value }))}>
                  <option value="">— Sélectionner un membre —</option>
                  {enrollModal && membresDisponibles(enrollModal.id).map(m => (
                    <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>
                  ))}
                </select>
              </FormField>
            </>
          )}
        </div>
      </Modal>

      {/* ══ MODAL OPÉRATION ═══════════════════════════════ */}
      <Modal
        open={!!opModal}
        onClose={() => setOpModal(null)}
        title={opModal?.type === 'depot' ? `Dépôt — ${opModal?.compte.nomMembre}` : `Retrait — ${opModal?.compte.nomMembre}`}
        footer={<>
          <button onClick={() => setOpModal(null)} className="btn-secondary">Annuler</button>
          <button
            onClick={handleOp}
            disabled={!opForm.montant || Number(opForm.montant) <= 0 || !isModePaiementValid(opForm.modePaiement, opForm.detailsPaiement) || (opModal?.type === 'retrait' && Number(opForm.montant) > Number(opModal?.compte.solde || 0))}
            className={clsx('btn-primary', (!opForm.montant || Number(opForm.montant) <= 0 || !isModePaiementValid(opForm.modePaiement, opForm.detailsPaiement) || (opModal?.type === 'retrait' && Number(opForm.montant) > Number(opModal?.compte.solde || 0))) && 'opacity-40 cursor-not-allowed')}
          >
            {opModal?.type === 'depot'
              ? <><ArrowDownCircle size={14} /> Enregistrer le dépôt</>
              : <><ArrowUpCircle size={14} /> Enregistrer le retrait</>}
          </button>
        </>}
      >
        <div className="space-y-4">
          <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
            <p className="font-semibold text-ink-800 text-sm">{opModal?.compte.nomMembre}</p>
            <p className="text-xs text-ink-600/50 mt-0.5">
              {opModal?.compte.nomBanque} · Solde : <strong>{fmt(opModal?.compte.solde || 0)}</strong>
            </p>
          </div>
          <FormField label="Montant (FCFA)" required>
            <input type="number" className="input" placeholder="Ex : 50 000" min="1"
              value={opForm.montant} onChange={e => setOpForm(f => ({ ...f, montant: e.target.value }))} />
            {opModal?.type === 'retrait' && Number(opForm.montant) > Number(opModal?.compte.solde || 0) && (
              <p className="text-xs text-red-500 mt-1">Solde insuffisant — disponible : {fmt(opModal?.compte.solde || 0)} FCFA</p>
            )}
          </FormField>
          <FormField label="Date de l'opération">
            <input type="date" className="input" value={opForm.dateOperation}
              onChange={e => setOpForm(f => ({ ...f, dateOperation: e.target.value }))} />
          </FormField>
          <ModePaiementFields
            modePaiement={opForm.modePaiement}
            detailsPaiement={opForm.detailsPaiement}
            onModeChange={(v) => setOpForm(f => ({ ...f, modePaiement: v, detailsPaiement: '' }))}
            onDetailsChange={(v) => setOpForm(f => ({ ...f, detailsPaiement: v }))}
          />
          <FormField label="Observation">
            <input className="input" placeholder="Ex : Dépôt séance juin 2025"
              value={opForm.observation} onChange={e => setOpForm(f => ({ ...f, observation: e.target.value }))} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
