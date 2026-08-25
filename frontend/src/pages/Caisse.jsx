import { useState, useMemo, useEffect } from 'react';
import {
  Landmark, TrendingUp, TrendingDown, Wallet, ShieldAlert, Gavel,
  HandCoins, RefreshCw, Download, ChevronDown, ChevronUp,
  ArrowDownCircle, ArrowUpCircle, BarChart2, Filter, Eye, EyeOff,
  CreditCard, Coins, AlertCircle, CheckCircle, Clock, Building2,
} from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';
import clsx from 'clsx';

// ── Catégories de flux financiers (hors cotisations tontine) ──
const CAT_CFG = {
  amende:           { label:'Amende',              icon:'',  color:'amber',  dir:'entree', bg:'bg-amber-50',   text:'text-amber-700'  },
  enchere:          { label:'Bénéfice enchère',     icon:'',  color:'yellow', dir:'entree', bg:'bg-yellow-50',  text:'text-yellow-700' },
  remboursement_pret:{ label:'Remboursement prêt',  icon:'',  color:'blue',   dir:'entree', bg:'bg-blue-50',    text:'text-blue-700'   },
  remboursement:    { label:'Remboursement prêt',   icon:'',  color:'blue',   dir:'entree', bg:'bg-blue-50',    text:'text-blue-700'   },
  pret_accorde:     { label:'Prêt accordé',         icon:'',  color:'orange', dir:'sortie', bg:'bg-orange-50',  text:'text-orange-700' },
  depot_banque:     { label:'Dépôt caisse',         icon:'',  color:'teal',   dir:'entree', bg:'bg-teal-50',    text:'text-teal-700'   },
  banque_libre:     { label:'Versement caisse',     icon:'',  color:'teal',   dir:'entree', bg:'bg-teal-50',    text:'text-teal-700'   },
  aide_sociale:     { label:'Fond Assurance',       icon:'',  color:'pink',   dir:'sortie', bg:'bg-pink-50',    text:'text-pink-700'   },
  cotisation:       { label:'Cotisation tontine',   icon:'',  color:'green',  dir:'entree', bg:'bg-green-50',   text:'text-green-700'  },
  transfert:        { label:'Transfert interne',    icon:'',  color:'teal',   dir:'neutre', bg:'bg-teal-50',    text:'text-teal-700'   },
  attribution_tour: { label:'Versement pot',        icon:'',  color:'green',  dir:'sortie', bg:'bg-green-50',   text:'text-green-700'  },
  divers_entree:    { label:'Autre recette',         icon:'',  color:'purple', dir:'entree', bg:'bg-purple-50',  text:'text-purple-700' },
  divers_sortie:    { label:'Autre dépense',         icon:'',  color:'red',    dir:'sortie', bg:'bg-red-50',     text:'text-red-700'    },
};

const FLUX_SECTIONS = [
  { key:'banqueLibre',    label:'Caisse principale',        icon: Building2,    color:'primary' },
  { key:'amendes',        label:'Amendes & Sanctions',       icon: ShieldAlert,  color:'amber'   },
  { key:'encheres',       label:'Bénéfices Enchères',        icon: Gavel,        color:'yellow'  },
  { key:'prets',          label:'Prêts & Intérêts',         icon: HandCoins,    color:'blue'    },
  { key:'fondAssurance',  label:'Fond Assurance',            icon: '',         color:'pink'    },
];

export default function Caisse() {
  const {
    user, caisseJournal, caisseJournalPagination, banques, comptesBanque, operationsBanque, transfertsCaisse, transfererCaisse, approuverTransfertCaisse,
    prets, sanctions, encheres, rotations, fondAssurance,
    seanceTransactions, chargerJournalGlobal, showToast,
  } = useApp();

  const [journalPage, setJournalPage] = useState(1);
  useEffect(() => {
    chargerJournalGlobal({ page: journalPage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalPage]);

  const [activeSection, setActiveSection] = useState('apercu');
  const [filterCat,    setFilterCat]    = useState('tous');
  const [showJournal,  setShowJournal]  = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    caisseSourceId: '',
    caisseDestinationId: '',
    montant: '',
    motif: '',
    dateTransfert: new Date().toISOString().split('T')[0],
  });

  // ── Caisse principale ──
  const soldeGlobal = banques.reduce((s, b) => s + Number(b.totalSolde || 0), 0);
  const banqueLibre = { id: 'global', nom: 'Trésorerie générale', totalSolde: soldeGlobal };
  const soldesBanques = banques.map(b => ({ ...b, comptes: comptesBanque.filter(c => c.idBanque === b.id) }));

  // Le journal complet reste inchangé (piste d'audit : on doit pouvoir VOIR
  // qu'une cotisation a été faite puis annulée), mais les totaux Entrées/Sorties
  // excluent les lignes annulées et leur contre-passation — sinon annuler une
  // cotisation gonflait artificiellement les Entrées au lieu de les laisser
  // nettes (ex: 60000 cotisé + 60000 contre-passé = 120000 d'« Entrées »
  // affichées pour une opération qui, au final, n'a rien rapporté).
  const journalPourKpi = useMemo(
    () => caisseJournal.filter((op) => !op.annulee && op.referenceType !== 'annulation_transaction'),
    [caisseJournal]
  );

  // ── Flux amendes ──
  const sanctionsPayees = sanctions.filter(s => s.statut === 'payee');
  const totalAmendes    = journalPourKpi.filter((x) => x.categorie === 'amende').reduce((s, x) => s + x.entree, 0);
  const sanctionsImpa   = sanctions.filter(s => s.statut === 'impayee');

  // ── Flux enchères ──
  const rotationsAvecEnchere = rotations.filter(r => r.enchere > 0);
  const totalBenefEnchere    = journalPourKpi.filter((x) => x.categorie === 'enchere').reduce((s, x) => s + x.entree, 0);

  // ── Flux prêts ──
  const totalPretsAccordes    = journalPourKpi.filter((x) => x.categorie === 'pret_accorde').reduce((s, x) => s + x.sortie, 0);
  const totalRembourses       = journalPourKpi.filter((x) => ['remboursement_pret', 'remboursement'].includes(x.categorie)).reduce((s, x) => s + x.entree, 0);
  const totalInteretsEncaisses = totalRembourses;
  const pretEnCours            = prets.filter(p => ['en_cours','en_retard'].includes(p.statut));
  const totalRestantDu         = pretEnCours.reduce((s, p) => s + p.resteAPayer, 0);

  // ── Fond Assurance ──
  const totalFondAssurance = journalPourKpi.filter((x) => x.categorie === 'aide_sociale').reduce((s, x) => s + x.sortie, 0);

  // ── Journal filtré (affichage complet, non filtré des annulations) ──
  const journalSansCotisations = useMemo(() => {
    return caisseJournal;
  }, [caisseJournal]);

  const journalFiltré = useMemo(() => {
    if (filterCat === 'tous') return journalSansCotisations;
    return journalSansCotisations.filter(op => op.categorie === filterCat);
  }, [journalSansCotisations, filterCat]);

  const totalEntrees = journalPourKpi.reduce((s, op) => s + (op.entree || 0), 0);
  const totalSorties = journalPourKpi.reduce((s, op) => s + (op.sortie || 0), 0);
  const soldeNet     = totalEntrees - totalSorties;

  // ── Opérations Banque Libre ──
  const opsBanqueLibre = caisseJournal;
  const totalDepotsBL  = opsBanqueLibre.reduce((s, o) => s + o.entree, 0);
  const totalRetraitBL = opsBanqueLibre.reduce((s, o) => s + o.sortie, 0);

  const handleTransfer = async () => {
    const missing = getMissingFields(transferForm, [
      { key: 'caisseSourceId', label: 'Caisse source' },
      { key: 'caisseDestinationId', label: 'Caisse destination' },
      { key: 'montant', label: 'Montant' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    if (transferForm.caisseSourceId === transferForm.caisseDestinationId) { showToast?.('La caisse source et la caisse destination doivent être différentes.', 'error'); return; }
    if (Number(transferForm.montant) <= 0) { showToast?.('Le montant doit être supérieur à 0.', 'error'); return; }
    try {
      await transfererCaisse({
      idSource: transferForm.caisseSourceId,
      idDestination: transferForm.caisseDestinationId,
      montant: Number(transferForm.montant),
      motif: transferForm.motif,
      });
    } catch { return; }
    setShowTransfer(false);
    setTransferForm({
      caisseSourceId: '',
      caisseDestinationId: '',
      montant: '',
      motif: '',
    });
  };
  const [guardedHandleTransfer, transferring] = useAsyncGuard(handleTransfer);

  const exportCSV = () => {
    const rows = [['Date','Caisse','Opération','Catégorie','Entrée','Sortie','Solde cumulé']];
    let cumul = 0;
    journalSansCotisations.forEach(op => {
      cumul += (op.entree || 0) - (op.sortie || 0);
      rows.push([op.date, banques.find((b) => b.id === op.idCaisse)?.nom || op.idCaisse, op.operation, op.categorie, op.entree||0, op.sortie||0, cumul]);
    });
    const csv  = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = 'caisse-centrale.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id:'apercu',    label:'Aperçu général',   icon: BarChart2   },
    { id:'banque',    label:'Caisse centrale',    icon: Building2   },
    { id:'transferts', label:'Transferts',       icon: RefreshCw    },
    { id:'amendes',   label:'Amendes',           icon: ShieldAlert },
    { id:'prets',     label:'Prêts',             icon: HandCoins   },
    { id:'encheres',  label:'Enchères',          icon: Gavel       },
    { id:'journal',   label:'Journal complet',   icon: Wallet      },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trésorerie générale"
        subtitle="Soldes réels et journal consolidé de toutes les caisses."
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowTransfer(true)} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              <RefreshCw size={13}/> Transférer
            </button>
            <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
              <Download size={13}/> Exporter CSV
            </button>
          </div>
        }
      />

      {/* ── KPIs Globaux ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card text-center border-t-4 border-t-primary-500">
          <Building2 size={18} className="mx-auto mb-1 text-primary-500"/>
          <p className="text-xl font-black text-primary-600">{fmt(banqueLibre?.totalSolde || 0)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Solde de toutes les caisses</p>
        </div>
        <div className="card text-center border-t-4 border-t-amber-400">
          <ShieldAlert size={18} className="mx-auto mb-1 text-amber-500"/>
          <p className="text-xl font-black text-amber-600">{fmt(totalAmendes)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Amendes encaissées</p>
          {sanctionsImpa.length > 0 && <p className="text-xs text-red-400 mt-0.5">{sanctionsImpa.length} impayée(s)</p>}
        </div>
        <div className="card text-center border-t-4 border-t-yellow-400">
          <Gavel size={18} className="mx-auto mb-1 text-yellow-500"/>
          <p className="text-xl font-black text-yellow-600">{fmt(totalBenefEnchere)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Bénéfices enchères</p>
          <p className="text-xs text-gray-300 mt-0.5">{rotationsAvecEnchere.length} tour(s)</p>
        </div>
        <div className="card text-center border-t-4 border-t-blue-400">
          <HandCoins size={18} className="mx-auto mb-1 text-blue-500"/>
          <p className="text-xl font-black text-blue-600">{fmt(totalInteretsEncaisses)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Remboursements prêts</p>
          {pretEnCours.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{pretEnCours.length} en cours</p>}
        </div>
      </div>

      {/* ── Solde net global ── */}
      <div className={clsx('card flex items-center justify-between p-4 border-l-4', soldeNet >= 0 ? 'border-l-primary-500 bg-primary-50/30' : 'border-l-red-500 bg-red-50/30')}>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Solde réel de trésorerie</p>
          <p className={clsx('text-3xl font-black', soldeGlobal >= 0 ? 'text-primary-700' : 'text-red-600')}>{fmt(soldeGlobal)}</p>
        </div>
        <div className="flex gap-6 text-right text-sm">
          <div>
            <p className="text-xs text-gray-400">Entrées</p>
            <p className="font-bold text-green-600">{fmt(totalEntrees)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sorties</p>
            <p className="font-bold text-red-500">{fmt(totalSorties)}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)}
            className={clsx('flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              activeSection === tab.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {typeof tab.icon === 'string' ? <span>{tab.icon}</span> : <tab.icon size={12}/>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: APERÇU GÉNÉRAL ══════════════════════════════ */}
      {activeSection === 'apercu' && (
        <div className="space-y-4">

          {/* Toutes les banques */}
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Building2 size={16} className="text-primary-500"/> État des caisses</h3>
            <div className="space-y-3">
              {soldesBanques.map(b => {
                const isLibre = b.type === 'banque_libre';
                const pct = banques.reduce((s, x) => s + x.totalSolde, 0) > 0
                  ? Math.round(b.totalSolde / banques.reduce((s, x) => s + x.totalSolde, 0) * 100)
                  : 0;
                return (
                  <div key={b.id} className={clsx('p-3 rounded-xl border', isLibre ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold', isLibre ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600')}>
                          {isLibre ? 'A' : 'B'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{b.nom}{isLibre && <span className="ml-1 text-xs text-primary-600">— Caisse principale</span>}</p>
                          <p className="text-xs text-gray-400">{b.comptes.length} membre(s) · {b.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={clsx('font-black text-sm', isLibre ? 'text-primary-700' : 'text-primary-600')}>{fmt(b.totalSolde)}</p>
                        <p className="text-xs text-gray-400">{pct}% du total</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={clsx('h-1.5 rounded-full transition-all', isLibre ? 'bg-primary-500' : 'bg-primary-400')} style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200 font-bold text-gray-700">
                <span>Total toutes banques</span>
                <span className="text-primary-600">{fmt(banques.reduce((s, b) => s + b.totalSolde, 0))}</span>
              </div>
            </div>
          </div>

          {/* Flux récapitulatifs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Amendes */}
            <div className="card border-l-4 border-l-amber-400">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5"><ShieldAlert size={14} className="text-amber-500"/>Amendes</p>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">↓ Caisse centrale</span>
              </div>
              <p className="text-2xl font-black text-amber-600">{fmt(totalAmendes)}</p>
              <p className="text-xs text-gray-400 mt-1">{sanctionsPayees.length} amende(s) payée(s)</p>
              {sanctionsImpa.length > 0 && <p className="text-xs text-red-500 mt-0.5"> {fmt(sanctionsImpa.reduce((s,x) => s+x.montant, 0))} impayés</p>}
            </div>

            {/* Enchères */}
            <div className="card border-l-4 border-l-yellow-400">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5"><Gavel size={14} className="text-yellow-500"/>Bénéfices Enchères</p>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">↓ Caisse centrale</span>
              </div>
              <p className="text-2xl font-black text-yellow-600">{fmt(totalBenefEnchere)}</p>
              <p className="text-xs text-gray-400 mt-1">{rotationsAvecEnchere.length} enchère(s) attribuée(s)</p>
            </div>

            {/* Prêts */}
            <div className="card border-l-4 border-l-blue-400">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5"><HandCoins size={14} className="text-blue-500"/>Prêts & Intérêts</p>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">⇌ Caisse centrale</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Prêts accordés</span><span className="font-bold text-red-500">−{fmt(totalPretsAccordes)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Remboursements</span><span className="font-bold text-green-600">+{fmt(totalRembourses)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Remboursements encaissés</span><span className="font-bold text-blue-600">+{fmt(totalInteretsEncaisses)}</span></div>
                <div className="flex justify-between pt-1 border-t border-gray-100"><span className="font-semibold text-gray-700">Reste dû</span><span className="font-black text-blue-700">{fmt(totalRestantDu)}</span></div>
              </div>
            </div>

            {/* Fond Assurance */}
            <div className="card border-l-4 border-l-pink-400">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5"> Fond Assurance</p>
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">↑ Sorties</span>
              </div>
              <p className="text-2xl font-black text-pink-600">{fmt(totalFondAssurance)}</p>
              <p className="text-xs text-gray-400 mt-1">{(fondAssurance||[]).length} aide(s) versée(s)</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: BANQUE LIBRE A ══════════════════════════════ */}
      {activeSection === 'banque' && banqueLibre && (
        <div className="space-y-4">
          <div className="card bg-gradient-to-br from-primary-50 to-teal-50 border-2 border-primary-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center text-white text-xl font-bold shrink-0">A</div>
              <div>
                <p className="font-black text-gray-900">{banqueLibre.nom}</p>
                <p className="text-xs text-gray-500">Caisse principale — Épargne, amendes, enchères, prêts</p>
              </div>
              <p className="ml-auto text-2xl font-black text-primary-700">{fmt(banqueLibre.totalSolde)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="p-2 bg-white rounded-xl">
                <p className="font-bold text-green-600">{fmt(totalDepotsBL)}</p><p className="text-gray-400">Dépôts totaux</p>
              </div>
              <div className="p-2 bg-white rounded-xl">
                <p className="font-bold text-red-500">{fmt(totalRetraitBL)}</p><p className="text-gray-400">Retraits totaux</p>
              </div>
              <div className="p-2 bg-white rounded-xl">
                <p className="font-bold text-gray-700">{opsBanqueLibre.length}</p><p className="text-gray-400">Opérations</p>
              </div>
            </div>
          </div>

          {/* Catégories qui alimentent la Banque Libre */}
          <div className="card">
            <h4 className="font-bold text-gray-700 text-sm mb-3">Flux entrants automatiques vers la Banque Libre</h4>
            <div className="space-y-2">
                {[
                { label: 'Cotisations tontine', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'cotisation').reduce((s,o) => s+o.entree, 0), color: 'bg-primary-100 text-primary-700' },
                { label: 'Amendes & sanctions', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'amende').reduce((s,o) => s+o.entree, 0), color: 'bg-amber-100 text-amber-700' },
                { label: 'Bénéfices enchères', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'enchere').reduce((s,o) => s+o.entree, 0), color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Remboursements prêts', icon: '', montant: opsBanqueLibre.filter(o => ['remboursement', 'remboursement_pret'].includes(o.categorie)).reduce((s,o) => s+o.entree, 0), color: 'bg-blue-100 text-blue-700' },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50">
                  <span className="text-sm">{f.icon} <span className="text-gray-700 text-xs font-medium ml-1">{f.label}</span></span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold', f.color)}>{fmt(f.montant)}</span>
                </div>
              ))}
              {[
                { label: 'Prêts accordés (sorties)', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'pret_accorde').reduce((s,o) => s+o.sortie, 0), color: 'bg-red-100 text-red-700' },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between p-2.5 rounded-xl bg-red-50/50 border border-red-100">
                  <span className="text-sm">{f.icon} <span className="text-gray-700 text-xs font-medium ml-1">{f.label}</span></span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold', f.color)}>−{fmt(f.montant)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comptes membres Banque Libre */}
                    <div className="card">
            <h4 className="font-bold text-gray-700 text-sm mb-3">Comptes membres ({comptesBanque.filter(c => c.idBanque === banqueLibre.id).length})</h4>
            {comptesBanque.filter(c => c.idBanque === banqueLibre.id).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Aucun compte enregistré</p>
            ) : (
              <div className="space-y-2">
                {comptesBanque.filter(c => c.idBanque === banqueLibre.id).map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 rounded-lg gradient-blue flex items-center justify-center text-white text-xs font-bold shrink-0">{c.nomMembre[0]}</div>
                    <p className="flex-1 font-medium text-sm text-gray-800">{c.nomMembre}</p>
                    <p className="font-bold text-primary-600">{fmt(c.solde)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique opérations Banque Libre */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-bold text-gray-700 text-sm">Historique des opérations</h4>
              <p className="text-xs text-gray-400">{opsBanqueLibre.length} opération(s)</p>
            </div>
            {opsBanqueLibre.length === 0 ? (
              <p className="text-center py-8 text-xs text-gray-400">Aucune opération enregistrée</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {[...opsBanqueLibre].reverse().map(op => {
                  const isDepot = op.entree > 0;
                  const catCfg = CAT_CFG[op.categorie] || {};
                  return (
                    <div key={op.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0', isDepot ? 'bg-green-100' : 'bg-red-100')}>
                        {catCfg.icon || (isDepot ? '↓' : '↑')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{op.operation}</p>
                        <p className="text-xs text-gray-400">{fmtDate(op.date)} · {op.nomCaisse || catCfg.label || 'Caisse'}</p>
                      </div>
                      <p className={clsx('font-bold text-sm shrink-0', isDepot ? 'text-green-600' : 'text-red-500')}>
                        {isDepot ? '+' : '−'}{fmt(isDepot ? op.entree : op.sortie)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: AMENDES ═══════════════════════════════════ */}
      {activeSection === 'amendes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center border-t-4 border-t-green-400">
              <p className="text-2xl font-black text-green-600">{fmt(totalAmendes)}</p>
              <p className="text-xs text-gray-400 mt-1">Encaissées</p>
              <p className="text-xs text-gray-300">{sanctionsPayees.length} sanction(s)</p>
            </div>
            <div className="card text-center border-t-4 border-t-red-400">
              <p className="text-2xl font-black text-red-500">{fmt(sanctionsImpa.reduce((s,x) => s+x.montant, 0))}</p>
              <p className="text-xs text-gray-400 mt-1">Impayées</p>
              <p className="text-xs text-red-400">{sanctionsImpa.length} en attente</p>
            </div>
          </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1"><CheckCircle size={11} className="text-green-500"/>Toutes les amendes payées sont versées automatiquement à la caisse centrale</p>
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h4 className="font-semibold text-sm text-gray-800">Détail des sanctions</h4></div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {sanctions.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400">Aucune sanction</p>
              ) : [...sanctions].reverse().map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="text-base"></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{s.nomMembre}</p>
                    <p className="text-xs text-gray-400">{s.typeSanction} · Réunion N°{s.numReunion} · {fmtDate(s.dateSanction)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-amber-600">{fmt(s.montant)}</p>
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', s.statut === 'payee' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                      {s.statut === 'payee' ? 'OK Payée' : ' Impayée'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: PRÊTS ═══════════════════════════════════ */}
      {activeSection === 'prets' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card text-center"><p className="text-lg font-black text-red-500">{fmt(totalPretsAccordes)}</p><p className="text-xs text-gray-400">Accordés (sorties)</p></div>
            <div className="card text-center"><p className="text-lg font-black text-green-600">{fmt(totalRembourses)}</p><p className="text-xs text-gray-400">Remboursés</p></div>
            <div className="card text-center"><p className="text-lg font-black text-blue-600">{fmt(totalInteretsEncaisses)}</p><p className="text-xs text-gray-400">Remboursements</p></div>
            <div className="card text-center"><p className="text-lg font-black text-orange-600">{fmt(totalRestantDu)}</p><p className="text-xs text-gray-400">Reste dû</p></div>
          </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1">
            <CheckCircle size={11} className="text-green-500"/>Prêts débités · Remboursements + intérêts crédités — tout passe par la caisse centrale
          </p>
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h4 className="font-semibold text-sm text-gray-800">Suivi des prêts</h4></div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {prets.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400">Aucun prêt</p>
              ) : prets.map(p => {
                const pct = Math.round(p.montantRembourse / p.montantTotal * 100);
                const statCfg = { en_cours: { c: 'blue', l: 'En cours' }, en_retard: { c: 'red', l: 'En retard' }, rembourse: { c: 'green', l: 'Remboursé' } };
                const sc = statCfg[p.statut] || { c: 'gray', l: p.statut };
                return (
                  <div key={p.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{p.nomMembre[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-gray-800">{p.nomMembre}</p>
                          <p className="text-xs font-bold text-gray-700">{fmt(p.montantPret)} <span className="text-purple-500">+{fmt(p.montantInteret)}</span></p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={clsx('h-1.5 rounded-full', p.statut === 'en_retard' ? 'bg-red-500' : 'bg-primary-500')} style={{ width: `${pct}%` }}/>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                          <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', `bg-${sc.c}-100 text-${sc.c}-700`)}>{sc.l}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Reste : <strong>{fmt(p.resteAPayer)}</strong> · Échéance : {fmtDate(p.dateEcheance)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: ENCHÈRES ════════════════════════════════ */}
      {activeSection === 'encheres' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center border-t-4 border-t-yellow-400">
              <p className="text-2xl font-black text-yellow-600">{fmt(totalBenefEnchere)}</p>
              <p className="text-xs text-gray-400 mt-1">Bénéfices totaux</p>
              <p className="text-xs text-gray-300">{rotationsAvecEnchere.length} enchère(s)</p>
            </div>
            <div className="card text-center border-t-4 border-t-green-400">
              <p className="text-2xl font-black text-green-600">{fmt(rotations.reduce((s,r) => s + r.montantRecu, 0))}</p>
              <p className="text-xs text-gray-400 mt-1">Net versé aux bénéficiaires</p>
            </div>
          </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1">
            <CheckCircle size={11} className="text-green-500"/>Les mises d'enchères (bénéfices) sont versées automatiquement à la caisse centrale
          </p>
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100"><h4 className="font-semibold text-sm text-gray-800">Historique des enchères</h4></div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {rotations.length === 0 ? (
                <p className="text-center py-8 text-xs text-gray-400">Aucune enchère</p>
              ) : rotations.filter(r => r.beneficiaire && r.beneficiaire !== '—').map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="text-base"></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">Tour N°{r.numeroTour} — {r.beneficiaire}</p>
                    <p className="text-xs text-gray-400">Pot : {fmt(r.montantTotal)} · Net reçu : {fmt(r.montantRecu)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-yellow-600">+{fmt(r.enchere || 0)}</p>
                    <p className="text-xs text-gray-400">bénéfice</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: JOURNAL COMPLET ════════════════════════════ */}
      {activeSection === 'journal' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {['tous', 'cotisation', 'amende', 'enchere', 'remboursement_pret', 'remboursement', 'pret_accorde', 'transfert', 'aide_sociale'].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={clsx('text-xs px-2.5 py-1 rounded-lg border font-medium transition-all',
                  filterCat === cat ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300')}>
                {cat === 'tous' ? `Tous (${journalSansCotisations.length})` : (CAT_CFG[cat]?.icon + ' ' + (CAT_CFG[cat]?.label || cat))}
              </button>
            ))}
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-semibold text-sm text-gray-800">Journal financier consolidé</h4>
              <span className="text-xs text-gray-400">{journalFiltré.length} ligne(s)</span>
            </div>
            {journalFiltré.length === 0 ? (
              <p className="text-center py-12 text-xs text-gray-400">Aucune opération dans cette catégorie</p>
            ) : (
              <>
                <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                  {journalFiltré.map((op) => {
                    const cfg  = CAT_CFG[op.categorie] || {};
                    const nomCaisse = op.nomCaisse || banques.find((b) => b.id === op.idCaisse)?.nom || 'Caisse indisponible';
                    const isEntree = (op.entree || 0) > 0;
                    return (
                      <div key={op.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0', isEntree ? 'bg-green-100' : 'bg-red-100')}>
                          {cfg.icon || (isEntree ? '↓' : '↑')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{op.operation}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{fmtDate(op.date)}</span>
                            <span className="text-xs font-medium text-primary-700">{nomCaisse}</span>
                            {cfg.label && <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.text)}>{cfg.icon} {cfg.label}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isEntree
                            ? <p className="font-bold text-xs text-green-600">+{fmt(op.entree)}</p>
                            : <p className="font-bold text-xs text-red-500">−{fmt(op.sortie)}</p>
                          }
                          <p className="text-xs font-medium mt-0.5 text-gray-500">Solde caisse : {fmt(op.soldeApres)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 flex justify-between text-xs font-bold">
                  <span className="text-gray-600">{journalFiltré.length} opération(s)</span>
                  <span className={soldeGlobal >= 0 ? 'text-primary-700' : 'text-red-600'}>Solde global : {fmt(soldeGlobal)}</span>
                </div>
                {caisseJournalPagination.lastPage > 1 && (
                  <div className="px-4 pb-3 flex items-center justify-end gap-2 text-xs">
                    <button className="btn-secondary py-1" disabled={journalPage <= 1} onClick={() => setJournalPage((p) => p - 1)}>Précédent</button>
                    <span>Page {caisseJournalPagination.currentPage} / {caisseJournalPagination.lastPage}</span>
                    <button className="btn-secondary py-1" disabled={journalPage >= caisseJournalPagination.lastPage} onClick={() => setJournalPage((p) => p + 1)}>Suivant</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {activeSection === 'transferts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="card text-center">
              <p className="text-2xl font-black text-primary-600">{transfertsCaisse.length}</p>
              <p className="text-xs text-gray-400 mt-1">Transferts</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-black text-green-600">{fmt(transfertsCaisse.reduce((s, t) => s + Number(t.montant || 0), 0))}</p>
              <p className="text-xs text-gray-400 mt-1">Montant total</p>
            </div>
            <button onClick={() => setShowTransfer(true)} className="card text-left border-dashed border-primary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors">
              <p className="text-sm font-semibold text-primary-700">Nouveau transfert</p>
              <p className="text-xs text-gray-500 mt-1">Déplacer des fonds d’une caisse à une autre.</p>
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-semibold text-sm text-gray-800">Historique des transferts</h4>
              <span className="text-xs text-gray-400">{transfertsCaisse.length} ligne(s)</span>
            </div>
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {transfertsCaisse.length === 0 ? (
                <p className="text-center py-12 text-xs text-gray-400">Aucun transfert enregistré</p>
              ) : [...transfertsCaisse].reverse().map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                    <RefreshCw size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {banques.find((b) => b.id === t.caisseSourceId)?.nom || 'Source'} → {banques.find((b) => b.id === t.caisseDestinationId)?.nom || 'Destination'}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(t.dateTransfert)} · {t.motif || 'Transfert interne'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-600">{fmt(t.montant)}</p>
                    {t.statut === 'en_attente' && <p className="text-xs text-amber-600">En attente</p>}
                    {t.statut === 'en_attente' && ['president', 'super_admin'].includes(user?.role) && <button className="btn-primary py-1 text-xs mt-1" onClick={() => approuverTransfertCaisse(t.id)}>Approuver</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        title="Nouveau transfert de caisse"
        footer={
          <>
            <button onClick={() => setShowTransfer(false)} disabled={transferring} className="btn-secondary">Annuler</button>
            <button onClick={guardedHandleTransfer} disabled={transferring} className="btn-primary"><RefreshCw size={14}/> {transferring ? 'Transfert…' : 'Transférer'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
            Le transfert crée une sortie dans la caisse source et une entrée dans la caisse destination.
          </p>
          <FormField label="Caisse source" required>
            <select className="select" value={transferForm.caisseSourceId} onChange={(e) => setTransferForm((f) => ({ ...f, caisseSourceId: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {banques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </FormField>
          <FormField label="Caisse destination" required>
            <select className="select" value={transferForm.caisseDestinationId} onChange={(e) => setTransferForm((f) => ({ ...f, caisseDestinationId: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {banques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-1 gap-3">
            <FormField label="Montant (FCFA)" required>
              <input type="number" className="input" min="1" value={transferForm.montant} onChange={(e) => setTransferForm((f) => ({ ...f, montant: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Motif">
            <input className="input" value={transferForm.motif} onChange={(e) => setTransferForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Ex : soutien caisse sociale" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
