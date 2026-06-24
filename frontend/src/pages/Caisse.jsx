import { useState, useMemo } from 'react';
import {
  Landmark, TrendingUp, TrendingDown, Wallet, ShieldAlert, Gavel,
  HandCoins, RefreshCw, Download, ChevronDown, ChevronUp,
  ArrowDownCircle, ArrowUpCircle, BarChart2, Filter, Eye, EyeOff,
  CreditCard, Coins, AlertCircle, CheckCircle, Clock, Building2,
} from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Badge } from '../components/ui/index';
import clsx from 'clsx';

// ── Catégories de flux financiers (hors cotisations tontine) ──
const CAT_CFG = {
  amende:           { label:'Amende',              icon:'',  color:'amber',  dir:'entree', bg:'bg-amber-50',   text:'text-amber-700'  },
  enchere:          { label:'Bénéfice enchère',     icon:'',  color:'yellow', dir:'entree', bg:'bg-yellow-50',  text:'text-yellow-700' },
  remboursement_pret:{ label:'Remboursement prêt',  icon:'',  color:'blue',   dir:'entree', bg:'bg-blue-50',    text:'text-blue-700'   },
  remboursement:    { label:'Remboursement prêt',   icon:'',  color:'blue',   dir:'entree', bg:'bg-blue-50',    text:'text-blue-700'   },
  pret_accorde:     { label:'Prêt accordé',         icon:'',  color:'orange', dir:'sortie', bg:'bg-orange-50',  text:'text-orange-700' },
  depot_banque:     { label:'Dépôt banque',         icon:'',  color:'teal',   dir:'entree', bg:'bg-teal-50',    text:'text-teal-700'   },
  banque_libre:     { label:'Versement banque',     icon:'',  color:'teal',   dir:'entree', bg:'bg-teal-50',    text:'text-teal-700'   },
  aide_sociale:     { label:'Fond Assurance',       icon:'',  color:'pink',   dir:'sortie', bg:'bg-pink-50',    text:'text-pink-700'   },
  attribution_tour: { label:'Versement pot',        icon:'',  color:'green',  dir:'sortie', bg:'bg-green-50',   text:'text-green-700'  },
  divers_entree:    { label:'Autre recette',         icon:'',  color:'purple', dir:'entree', bg:'bg-purple-50',  text:'text-purple-700' },
  divers_sortie:    { label:'Autre dépense',         icon:'',  color:'red',    dir:'sortie', bg:'bg-red-50',     text:'text-red-700'    },
};

const FLUX_SECTIONS = [
  { key:'banqueLibre',    label:'Banque Libre A',           icon: Building2,    color:'primary' },
  { key:'amendes',        label:'Amendes & Sanctions',       icon: ShieldAlert,  color:'amber'   },
  { key:'encheres',       label:'Bénéfices Enchères',        icon: Gavel,        color:'yellow'  },
  { key:'prets',          label:'Prêts & Intérêts',         icon: HandCoins,    color:'blue'    },
  { key:'fondAssurance',  label:'Fond Assurance',            icon: '',         color:'pink'    },
];

export default function Caisse() {
  const {
    caisseJournal, banques, comptesBanque, operationsBanque,
    prets, sanctions, encheres, rotations, fondAssurance,
    seanceTransactions,
  } = useApp();

  const [activeSection, setActiveSection] = useState('apercu');
  const [filterCat,    setFilterCat]    = useState('tous');
  const [showJournal,  setShowJournal]  = useState(false);

  // ── Banque Libre A ──
  const banqueLibre = banques.find(b => b.type === 'banque_libre') || banques[0];
  const soldesBanques = banques.map(b => ({ ...b, comptes: comptesBanque.filter(c => c.idBanque === b.id) }));

  // ── Flux amendes ──
  const sanctionsPayees = sanctions.filter(s => s.statut === 'payee');
  const totalAmendes    = sanctionsPayees.reduce((s, x) => s + x.montant, 0);
  const sanctionsImpa   = sanctions.filter(s => s.statut === 'impayee');

  // ── Flux enchères ──
  const rotationsAvecEnchere = rotations.filter(r => r.enchere > 0);
  const totalBenefEnchere    = rotationsAvecEnchere.reduce((s, r) => s + r.enchere, 0);

  // ── Flux prêts ──
  const totalPretsAccordes    = prets.reduce((s, p) => s + p.montantPret, 0);
  const totalRembourses       = prets.reduce((s, p) => s + p.montantRembourse, 0);
  const totalInteretsEncaisses = prets.filter(p => p.interetsDistribues || p.statut === 'rembourse').reduce((s, p) => s + p.montantInteret, 0);
  const pretEnCours            = prets.filter(p => ['en_cours','en_retard'].includes(p.statut));
  const totalRestantDu         = pretEnCours.reduce((s, p) => s + p.resteAPayer, 0);

  // ── Fond Assurance ──
  const totalFondAssurance = (fondAssurance||[]).reduce((s, a) => s + a.montantAide, 0);

  // ── Journal filtré ──
  const journalSansCotisations = useMemo(() => {
    return caisseJournal.filter(op => op.categorie !== 'cotisation' && op.categorie !== 'cotis_tontine');
  }, [caisseJournal]);

  const journalFiltré = useMemo(() => {
    if (filterCat === 'tous') return journalSansCotisations;
    return journalSansCotisations.filter(op => op.categorie === filterCat);
  }, [journalSansCotisations, filterCat]);

  const totalEntrees = journalSansCotisations.reduce((s, op) => s + (op.entree || 0), 0);
  const totalSorties = journalSansCotisations.reduce((s, op) => s + (op.sortie || 0), 0);
  const soldeNet     = totalEntrees - totalSorties;

  // ── Opérations Banque Libre ──
  const opsBanqueLibre = banqueLibre
    ? operationsBanque.filter(op => op.idBanque === banqueLibre.id)
    : [];
  const totalDepotsBL  = opsBanqueLibre.filter(o => o.typeOperation === 'depot' || o.typeOperation === 'depot_collectif').reduce((s, o) => s + o.montant, 0);
  const totalRetraitBL = opsBanqueLibre.filter(o => o.typeOperation === 'retrait').reduce((s, o) => s + o.montant, 0);

  const exportCSV = () => {
    const rows = [['Date','Opération','Catégorie','Entrée','Sortie','Solde cumulé']];
    let cumul = 0;
    journalSansCotisations.forEach(op => {
      cumul += (op.entree || 0) - (op.sortie || 0);
      rows.push([op.date, op.operation, op.categorie, op.entree||0, op.sortie||0, cumul]);
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
    { id:'banque',    label:'Banque Libre A',    icon: Building2   },
    { id:'amendes',   label:'Amendes',           icon: ShieldAlert },
    { id:'prets',     label:'Prêts',             icon: HandCoins   },
    { id:'encheres',  label:'Enchères',          icon: Gavel       },
    { id:'journal',   label:'Journal complet',   icon: Wallet      },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caisse Centrale"
        subtitle="État financier global — hors cotisations tontine. Banque Libre A = caisse principale."
        action={
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
            <Download size={13}/> Exporter CSV
          </button>
        }
      />

      {/* ── KPIs Globaux ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card text-center border-t-4 border-t-primary-500">
          <Building2 size={18} className="mx-auto mb-1 text-primary-500"/>
          <p className="text-xl font-black text-primary-600">{fmt(banqueLibre?.totalSolde || 0)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Banque Libre A</p>
          <p className="text-xs text-gray-300 mt-0.5">Épargne + flux</p>
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
          <p className="text-xs text-gray-400 mt-0.5">Intérêts prêts</p>
          {pretEnCours.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{pretEnCours.length} en cours</p>}
        </div>
      </div>

      {/* ── Solde net global ── */}
      <div className={clsx('card flex items-center justify-between p-4 border-l-4', soldeNet >= 0 ? 'border-l-primary-500 bg-primary-50/30' : 'border-l-red-500 bg-red-50/30')}>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Solde net (hors cotisations tontine)</p>
          <p className={clsx('text-3xl font-black', soldeNet >= 0 ? 'text-primary-700' : 'text-red-600')}>{fmt(soldeNet)}</p>
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
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Building2 size={16} className="text-primary-500"/> État des Banques</h3>
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
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">↓ Banque Libre</span>
              </div>
              <p className="text-2xl font-black text-amber-600">{fmt(totalAmendes)}</p>
              <p className="text-xs text-gray-400 mt-1">{sanctionsPayees.length} amende(s) payée(s)</p>
              {sanctionsImpa.length > 0 && <p className="text-xs text-red-500 mt-0.5"> {fmt(sanctionsImpa.reduce((s,x) => s+x.montant, 0))} impayés</p>}
            </div>

            {/* Enchères */}
            <div className="card border-l-4 border-l-yellow-400">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5"><Gavel size={14} className="text-yellow-500"/>Bénéfices Enchères</p>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">↓ Banque Libre</span>
              </div>
              <p className="text-2xl font-black text-yellow-600">{fmt(totalBenefEnchere)}</p>
              <p className="text-xs text-gray-400 mt-1">{rotationsAvecEnchere.length} enchère(s) attribuée(s)</p>
            </div>

            {/* Prêts */}
            <div className="card border-l-4 border-l-blue-400">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5"><HandCoins size={14} className="text-blue-500"/>Prêts & Intérêts</p>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">⇌ Banque Libre</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Prêts accordés</span><span className="font-bold text-red-500">−{fmt(totalPretsAccordes)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Remboursements</span><span className="font-bold text-green-600">+{fmt(totalRembourses)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Intérêts encaissés</span><span className="font-bold text-blue-600">+{fmt(totalInteretsEncaisses)}</span></div>
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
                { label: 'Épargne libre (dépôts membres)', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === undefined && o.typeOperation === 'depot' && o.idMembre).reduce((s,o) => s+o.montant, 0), color: 'bg-primary-100 text-primary-700' },
                { label: 'Amendes & sanctions', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'amende').reduce((s,o) => s+o.montant, 0), color: 'bg-amber-100 text-amber-700' },
                { label: 'Bénéfices enchères', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'enchere').reduce((s,o) => s+o.montant, 0), color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Remboursements prêts', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'remboursement').reduce((s,o) => s+o.montant, 0), color: 'bg-blue-100 text-blue-700' },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50">
                  <span className="text-sm">{f.icon} <span className="text-gray-700 text-xs font-medium ml-1">{f.label}</span></span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold', f.color)}>{fmt(f.montant)}</span>
                </div>
              ))}
              {[
                { label: 'Prêts accordés (sorties)', icon: '', montant: opsBanqueLibre.filter(o => o.categorie === 'pret').reduce((s,o) => s+o.montant, 0), color: 'bg-red-100 text-red-700' },
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
                  const isDepot = op.typeOperation === 'depot' || op.typeOperation === 'depot_collectif';
                  const catCfg = CAT_CFG[op.categorie] || {};
                  return (
                    <div key={op.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0', isDepot ? 'bg-green-100' : 'bg-red-100')}>
                        {catCfg.icon || (isDepot ? '↓' : '↑')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{op.observation || `${isDepot ? 'Dépôt' : 'Retrait'} — ${op.nomMembre}`}</p>
                        <p className="text-xs text-gray-400">{fmtDate(op.dateOperation)} · {catCfg.label || op.nomMembre}</p>
                      </div>
                      <p className={clsx('font-bold text-sm shrink-0', isDepot ? 'text-green-600' : 'text-red-500')}>
                        {isDepot ? '+' : '−'}{fmt(op.montant)}
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
          <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1"><CheckCircle size={11} className="text-green-500"/>Toutes les amendes payées sont versées automatiquement à la Banque Libre A</p>
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
            <div className="card text-center"><p className="text-lg font-black text-blue-600">{fmt(totalInteretsEncaisses)}</p><p className="text-xs text-gray-400">Intérêts</p></div>
            <div className="card text-center"><p className="text-lg font-black text-orange-600">{fmt(totalRestantDu)}</p><p className="text-xs text-gray-400">Reste dû</p></div>
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1">
            <CheckCircle size={11} className="text-green-500"/>Prêts débités · Remboursements + intérêts crédités — tout passe par la Banque Libre A
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
            <CheckCircle size={11} className="text-green-500"/>Les mises d'enchères (bénéfices) sont versées automatiquement à la Banque Libre A
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
            {['tous', 'amende', 'enchere', 'remboursement_pret', 'remboursement', 'pret_accorde', 'depot_banque', 'banque_libre', 'aide_sociale'].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={clsx('text-xs px-2.5 py-1 rounded-lg border font-medium transition-all',
                  filterCat === cat ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300')}>
                {cat === 'tous' ? `Tous (${journalSansCotisations.length})` : (CAT_CFG[cat]?.icon + ' ' + (CAT_CFG[cat]?.label || cat))}
              </button>
            ))}
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-semibold text-sm text-gray-800">Journal financier (hors cotisations tontine)</h4>
              <span className="text-xs text-gray-400">{journalFiltré.length} ligne(s)</span>
            </div>
            {journalFiltré.length === 0 ? (
              <p className="text-center py-12 text-xs text-gray-400">Aucune opération dans cette catégorie</p>
            ) : (
              <>
                <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                  {[...journalFiltré].reverse().map((op, idx) => {
                    const cfg  = CAT_CFG[op.categorie] || {};
                    const cumul = journalFiltré.slice(0, journalFiltré.indexOf(op) + 1).reduce((s, o) => s + (o.entree||0) - (o.sortie||0), 0);
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
                            {cfg.label && <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.text)}>{cfg.icon} {cfg.label}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isEntree
                            ? <p className="font-bold text-xs text-green-600">+{fmt(op.entree)}</p>
                            : <p className="font-bold text-xs text-red-500">−{fmt(op.sortie)}</p>
                          }
                          <p className={clsx('text-xs font-medium mt-0.5', cumul >= 0 ? 'text-gray-500' : 'text-red-400')}>{fmt(cumul)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 flex justify-between text-xs font-bold">
                  <span className="text-gray-600">{journalFiltré.length} opération(s)</span>
                  <span className={soldeNet >= 0 ? 'text-primary-700' : 'text-red-600'}>Solde : {fmt(soldeNet)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
