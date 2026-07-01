import { useState, useMemo } from 'react';
import {
  Plus, RefreshCw, Calendar, Users, UserPlus, Trash2, Pencil,
  BadgeCheck, TrendingUp, Info, Trophy, Shuffle, ChevronRight,
  CheckCircle, Clock, Banknote, Star, X,
  ListOrdered, Gavel, Dices, FileText,
} from 'lucide-react';
import { fmt, fmtDate, typeAttrLabel, periodeLabel } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Badge, Modal, FormField } from '../components/ui/index';
import { NavLink, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';

const TYPE_CONFIG = {
  rotation: {
    icon: '', color: 'primary', bg: 'bg-primary-50', border: 'border-primary-200',
    badge: 'blue', label: 'Rotation fixe',
    desc: 'Chaque membre bénéficie du pot dans un ordre prédéfini et fixe.',
    actionLabel: 'Définir l\'ordre', ActionIcon: ListOrdered,
    tip: 'Planifiez qui reçoit le pot à chaque tour selon un ordre convenu à l\'avance.',
  },
  tirage: {
    icon: '', color: 'blue', bg: 'bg-blue-50', border: 'border-blue-200',
    badge: 'blue', label: 'Tirage au sort',
    desc: 'Le bénéficiaire de chaque tour est désigné aléatoirement parmi les membres.',
    actionLabel: 'Lancer le tirage', ActionIcon: Dices,
    tip: 'Le tirage garantit l\'équité. Chaque membre sera tiré une seule fois.',
  },
  enchere: {
    icon: '', color: 'amber', bg: 'bg-amber-50', border: 'border-amber-200',
    badge: 'amber', label: 'Enchère',
    desc: 'Le membre qui propose la mise la plus haute remporte le pot du tour.',
    actionLabel: 'Gérer les enchères', ActionIcon: Gavel,
    tip: 'L\'enchère permet d\'avancer son tour en contrepartie d\'une mise reversée au groupe.',
  },
};

const PERIODE_DUREE = {
  hebdomadaire: 'sem.', mensuel: 'mois', bimestriel: 'bim.', trimestriel: 'trim.',
};

function calcDateFin(dateDebut, nbTours, periode) {
  if (!dateDebut || !nbTours) return '';
  const d = new Date(dateDebut);
  const n = Number(nbTours);
  switch (periode) {
    case 'hebdomadaire': d.setDate(d.getDate() + n * 7); break;
    case 'mensuel':      d.setMonth(d.getMonth() + n); break;
    case 'bimestriel':   d.setMonth(d.getMonth() + n * 2); break;
    case 'trimestriel':  d.setMonth(d.getMonth() + n * 3); break;
    default:             d.setMonth(d.getMonth() + n); break;
  }
  return d.toISOString().split('T')[0];
}

const EMPTY_FORM = { nom:'', cotisation:'', caisseId:'', periode:'mensuel', nbTours:12, typeAttribution:'rotation', dateDebut:'', dateFin:'' };
const EMPTY_MT   = { idMembre:'', nombreParts:'1', dateAdhesion: new Date().toISOString().split('T')[0] };

export default function Tontines() {
  const {
    tontines, caisses, addTontine, updateTontine,
    membres, membresParTontine, addMembreTontine, updateMembreTontine, removeMembreTontine,
    planningTours, addTourPlanning, marquerTourEncaisse, retirerTourPlanning, tirerAuSort,
    encheres, rotations, attribuerTour,
    genererBulletin, ouvrirBulletinPdf,
  } = useApp();

  const [searchParams] = useSearchParams();
  const initialTab = ['toutes', 'rotation', 'tirage', 'enchere'].includes(searchParams.get('type'))
    ? searchParams.get('type')
    : 'toutes';
  const [activeTab,       setActiveTab]       = useState(initialTab);
  const [showAdd,         setShowAdd]         = useState(false);
  const [showEdit,        setShowEdit]        = useState(null);
  const [showMembres,     setShowMembres]     = useState(null);
  const [showBenef,       setShowBenef]       = useState(null);
  const [showAddMembre,   setShowAddMembre]   = useState(false);
  const [showEditMT,      setShowEditMT]      = useState(null);
  const [showTirage,      setShowTirage]      = useState(null);
  const [form,            setForm]            = useState(EMPTY_FORM);
  const [formMT,          setFormMT]          = useState(EMPTY_MT);
  const [formTour,        setFormTour]        = useState({ idMembre:'', datePrevue:'', note:'' });
  const [addTourMode,     setAddTourMode]     = useState(false);
  const [rankingMode,     setRankingMode]     = useState(false);
  const [rankingOrder,    setRankingOrder]    = useState([]); // [{idMembre, nom, parts, dateDebut}]
  const [rankingDateBase, setRankingDateBase] = useState('');
  const [dragIdx,         setDragIdx]         = useState(null);
  const [showBulletin,    setShowBulletin]    = useState(null);
  const [bulletinForm,    setBulletinForm]    = useState({ idMembre:'', numeroCycle:1, retenueLibelle:'', retenueMontant:0 });

  const filteredTontines = tontines.filter(t =>
    activeTab === 'toutes' ? true : t.typeAttribution === activeTab
  );
  const caissesMap = Object.fromEntries((caisses || []).map((c) => [c.id, c]));
  const caissesTontine = (caisses || []).filter((c) =>
    c?.type === 'tontine' ||
    c?.type === 'banque_tontine' ||
    (c?.operationsAutorisees || []).includes('cotisation')
  );

  const getTourPlanning   = (id) => (planningTours || []).filter(p => p.idTontine === id).sort((a,b) => a.numeroTour - b.numeroTour);
  const getMembresActifs  = (id) => membresParTontine.filter(mt => mt.idTontine === id && mt.statut === 'actif');
  const getNbEncaisses    = (id) => (planningTours || []).filter(p => p.idTontine === id && p.statut === 'encaisse').length;
  const getProchainTour   = (id, nb) => Math.min(getNbEncaisses(id) + 1, nb);

  const handleAdd = () => {
    if (!form.nom.trim() || !form.cotisation || !form.caisseId) return;
    const dateFin = form.dateFin || calcDateFin(form.dateDebut, form.nbTours, form.periode);
    addTontine({ ...form, cotisation: Number(form.cotisation), nbTours: Number(form.nbTours), dateFin });
    setShowAdd(false); setForm(EMPTY_FORM);
  };

  const handleEdit = () => {
    if (!form.nom.trim() || !form.cotisation || !form.caisseId) return;
    updateTontine({ ...showEdit, ...form, cotisation: Number(form.cotisation), nbTours: Number(form.nbTours) });
    setShowEdit(null);
  };

  const handleAddMembre = () => {
    if (!formMT.idMembre || !showMembres) return;
    addMembreTontine({ idTontine: showMembres.id, idMembre: Number(formMT.idMembre), nombreParts: Number(formMT.nombreParts) || 1, dateAdhesion: formMT.dateAdhesion });
    setShowAddMembre(false); setFormMT(EMPTY_MT);
  };

  const handleAddTour = (idTontine, nbTours) => {
    if (!formTour.idMembre) return;
    const t = tontines.find(x => x.id === idTontine);
    const m = membres.find(x => x.id === Number(formTour.idMembre));
    const numeroTour = getProchainTour(idTontine, nbTours);
    addTourPlanning({
      idTontine, idMembre: Number(formTour.idMembre),
      nomMembre: `${m?.nom} ${m?.prenom}`, numeroTour,
      datePrevue: formTour.datePrevue, note: formTour.note,
      montantPot: t ? t.cotisation * t.totalParts : 0,
    });
    setFormTour({ idMembre:'', datePrevue:'', note:'' }); setAddTourMode(false);
  };

  const handleTirage = (idTontine, nbTours) => {
    const numeroTour = getProchainTour(idTontine, nbTours);
    const result = tirerAuSort(idTontine, numeroTour, formTour.datePrevue);
    if (result) setShowTirage(result);
  };

  const membresDeTontine  = (id) => membresParTontine.filter(mt => mt.idTontine === id).map(mt => ({ ...mt, ...membres.find(m => m.id === mt.idMembre) }));
  const membresDisponibles = (id) => membres.filter(m => !membresParTontine.some(mt => mt.idTontine === id && mt.idMembre === m.id));
  const getEncheresDuTour = (id) => {
    const rotation = rotations.find(r => r.idTontine === id && !r.dateAttribution);
    return rotation ? { rotation, bids: encheres.filter(e => e.idRotation === rotation.id) } : null;
  };

  const F = ({ k, ...p }) => <input className="input" value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} {...p}/>;
  const S = ({ k, children }) => <select className="select" value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}>{children}</select>;

  const tabs = [
    { id:'toutes',   label:'Toutes',       count: tontines.length },
    { id:'rotation', label:' Rotation',   count: tontines.filter(t=>t.typeAttribution==='rotation').length },
    { id:'tirage',   label:' Tirage',     count: tontines.filter(t=>t.typeAttribution==='tirage').length   },
    { id:'enchere',  label:' Enchère',    count: tontines.filter(t=>t.typeAttribution==='enchere').length  },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tontines"
        subtitle={`${tontines.filter(t=>t.statut==='active').length} tontine(s) active(s)`}
        action={<button onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }} className="btn-primary"><Plus size={15}/> Nouvelle tontine</button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l:'Pot total cumulé',  v: fmt(tontines.reduce((s,t)=>s+t.cotisation*t.totalParts,0)), c:'text-primary-600', bg:'bg-primary-50', icon:'' },
          { l:'Membres inscrits',  v: membresParTontine.filter(mt=>mt.statut==='actif').length,   c:'text-blue-600',   bg:'bg-blue-50',   icon:'' },
          { l:'Tours encaissés',   v: (planningTours||[]).filter(p=>p.statut==='encaisse').length, c:'text-amber-600',  bg:'bg-amber-50',  icon:'' },
          { l:'Parts totales',     v: tontines.reduce((s,t)=>s+t.totalParts,0),                    c:'text-purple-600', bg:'bg-purple-50', icon:'' },
        ].map(s => (
          <div key={s.l} className={`p-3 rounded-2xl ${s.bg} text-center border-0`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
            <p className="text-xs text-gray-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx('px-3 py-1.5 rounded-xl text-sm font-medium transition-all border',
              activeTab === tab.id
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600')}>
            {tab.label}
            <span className={clsx('ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
              activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grille tontines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredTontines.map(t => {
          const cfg       = TYPE_CONFIG[t.typeAttribution] || TYPE_CONFIG.rotation;
          const planning  = getTourPlanning(t.id);
          const nbActifs  = getMembresActifs(t.id).length;
          const encaisses = getNbEncaisses(t.id);
          const prochain  = getProchainTour(t.id, t.nbTours);
          const progress  = Math.round((encaisses / Math.max(t.nbTours, 1)) * 100);
          const potTour   = t.cotisation * t.totalParts;
          const prochainTour = planning.find(p => p.statut === 'planifie');
          const enCoursEnch  = getEncheresDuTour(t.id);

          return (
            <div key={t.id} className="card border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl ${cfg.bg} flex items-center justify-center text-2xl shrink-0`}>{cfg.icon}</div>
                  <div>
                    <h3 className="font-bold text-gray-900">{t.nom}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={cfg.badge}>{cfg.label}</Badge>
                      <span className="text-xs text-gray-400">{periodeLabel[t.periode]}</span>
                      <span className="text-xs text-gray-400">· {caissesMap[t.caisseId]?.nom || 'Caisse non liée'}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setShowEdit(t); setForm({ nom:t.nom, cotisation:t.cotisation, caisseId:t.caisseId||'', periode:t.periode, nbTours:t.nbTours, typeAttribution:t.typeAttribution, dateDebut:t.dateDebut||''  , dateFin:t.dateFin||'' }); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Pencil size={13}/>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2.5 bg-gray-50 rounded-xl">
                  <p className="text-sm font-bold text-gray-800">{fmt(t.cotisation)}</p>
                  <p className="text-xs text-gray-400">/ part</p>
                </div>
                <div className="text-center p-2.5 bg-primary-50 rounded-xl">
                  <p className="text-sm font-bold text-primary-600">{fmt(potTour)}</p>
                  <p className="text-xs text-gray-400">pot/tour</p>
                </div>
                <div className="text-center p-2.5 bg-blue-50 rounded-xl">
                  <p className="text-sm font-bold text-blue-600">{nbActifs}</p>
                  <p className="text-xs text-gray-400">membres</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span className="font-medium">Progression des tours</span>
                  <span>{encaisses}/{t.nbTours} · Tour N°{prochain}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all" style={{ width: `${progress}%` }}/>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-primary-600 font-medium">{progress}% accompli</span>
                  <span className="text-gray-400">{t.nbTours - encaisses} restant(s)</span>
                </div>
              </div>

              {prochainTour ? (
                <div className={`p-2.5 rounded-xl border mb-4 ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-800">Tour N°{prochainTour.numeroTour} — {prochainTour.nomMembre}</p>
                      {prochainTour.datePrevue && <p className="text-xs text-gray-500">{fmtDate(prochainTour.datePrevue)}</p>}
                    </div>
                    <span className="text-xs font-bold text-gray-700">{fmt(prochainTour.montantPot)}</span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl border border-dashed border-gray-200 mb-4 text-center">
                  <p className="text-xs text-gray-400">Aucun bénéficiaire planifié — Tour N°{prochain}</p>
                </div>
              )}

              {enCoursEnch && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-amber-800"> Enchère — {enCoursEnch.bids.length} offre(s)</p>
                    <span className="text-xs font-bold text-amber-700">Max : {fmt(Math.max(...enCoursEnch.bids.map(b=>b.montantEnchere), 0))}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => { setShowMembres(t); setShowAddMembre(false); }} className="btn-secondary text-xs py-1.5 justify-center">
                  <Users size={12}/> Membres ({nbActifs})
                </button>
                <button onClick={() => { setShowBenef(t); setAddTourMode(false); setFormTour({ idMembre:'', datePrevue:'', note:'' }); }}
                  className="btn-secondary text-xs py-1.5 justify-center">
                  <cfg.ActionIcon size={12}/> Tours
                </button>
                <NavLink to={t.typeAttribution === 'enchere' ? '/encheres' : '/rotations'} className="btn-secondary text-xs py-1.5 justify-center">
                  <Trophy size={12}/> Historique
                </NavLink>
                <button onClick={() => { setShowBulletin(t); setBulletinForm({ idMembre:'', numeroCycle:prochain, retenueLibelle:'', retenueMontant:0 }); }} className="btn-secondary text-xs py-1.5 justify-center">
                  <FileText size={12}/> Bulletin
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTontines.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3"></div>
          <p className="text-gray-500 font-medium">Aucune tontine dans cette catégorie</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-3 text-sm"><Plus size={14}/> Créer une tontine</button>
        </div>
      )}

      {/* ═══ MODAL BÉNÉFICIAIRES ═════════════════════════════ */}
      {showBenef && (() => {
        const t         = tontines.find(x=>x.id===showBenef.id)||showBenef;
        const cfg       = TYPE_CONFIG[t.typeAttribution]||TYPE_CONFIG.rotation;
        const planning  = getTourPlanning(t.id);
        const encaisses = getNbEncaisses(t.id);
        const prochain  = getProchainTour(t.id, t.nbTours);
        const membresActifs = getMembresActifs(t.id).map(mt=>{const m=membres.find(x=>x.id===mt.idMembre);return m?{...m,parts:mt.nombreParts}:null;}).filter(Boolean);
        const dejaBenef = new Set(planning.filter(p=>p.statut!=='saute').map(p=>p.idMembre));
        const enCoursEnch = getEncheresDuTour(t.id);

        return (
          <Modal open={true} onClose={()=>setShowBenef(null)} title={`${cfg.icon} Bénéficiaires — ${t.nom}`}
            footer={<button onClick={()=>setShowBenef(null)} className="btn-secondary ml-auto">Fermer</button>}>
            <div className="space-y-4">
              <div className={`p-3 rounded-xl border text-sm ${cfg.bg} ${cfg.border}`}>
                <p className="font-bold text-gray-800 mb-1">{cfg.icon} Mode : {cfg.label}</p>
                <p className="text-xs text-gray-600">{cfg.tip}</p>
              </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-gray-50 rounded-xl"><p className="text-lg font-bold text-primary-600">{encaisses}</p><p className="text-xs text-gray-400">Encaissés</p></div>
                <div className="p-2 bg-gray-50 rounded-xl"><p className="text-lg font-bold text-blue-600">{planning.filter(p=>p.statut==='planifie').length}</p><p className="text-xs text-gray-400">Planifiés</p></div>
                <div className="p-2 bg-gray-50 rounded-xl"><p className="text-lg font-bold text-gray-500">{t.nbTours-encaisses}</p><p className="text-xs text-gray-400">Restants</p></div>
              </div>

              {planning.length > 0 && (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {planning.map(p => (
                    <div key={p.id} className={clsx('flex items-center gap-3 p-2.5 rounded-xl border',
                      p.statut==='encaisse'?'bg-primary-50 border-primary-200':p.statut==='planifie'?'bg-blue-50 border-blue-200':'bg-gray-50 border-gray-200')}>
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                        p.statut==='encaisse'?'bg-primary-500 text-white':p.statut==='planifie'?'bg-blue-500 text-white':'bg-gray-300 text-gray-600')}>{p.numeroTour}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{p.nomMembre}</p>
                        <p className="text-xs text-gray-400">{p.datePrevue?fmtDate(p.datePrevue):'Date non définie'}{p.note&&` · ${p.note}`}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-700 shrink-0">{fmt(p.montantPot)}</span>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        {p.statut==='planifie'&&(
                          <button onClick={()=>marquerTourEncaisse(p.id,'','')} title="Marquer encaissé" className="p-1 hover:bg-primary-100 rounded text-primary-600"><CheckCircle size={13}/></button>
                        )}
                        {p.statut!=='encaisse'&&(
                          <button onClick={()=>retirerTourPlanning(p.id)} title="Retirer" className="p-1 hover:bg-red-100 rounded text-red-400"><X size={12}/></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ROTATION — Classement complet de tous les membres */}
              {t.typeAttribution==='rotation' && (
                <div className="border-t pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><ListOrdered size={13}/> Ordre de rotation</p>
                    {encaisses < t.nbTours && !rankingMode && (
                      <button onClick={() => {
                        // Initialiser le ranking : membres déjà planifiés en tête (dans l'ordre), puis les non planifiés
                        const planifies = planning.filter(p => p.statut !== 'saute').sort((a,b) => a.numeroTour - b.numeroTour);
                        const idsPlanifies = new Set(planifies.map(p => p.idMembre));
                        const nonPlanifies = membresActifs.filter(m => !idsPlanifies.has(m.id));
                        const initOrder = [
                          ...planifies.map(p => {
                            const m = membres.find(x => x.id === p.idMembre);
                            return { idMembre: p.idMembre, nom: `${m?.nom||''} ${m?.prenom||''}`.trim(), parts: m ? membresParTontine.find(mt=>mt.idMembre===m.id&&mt.idTontine===t.id)?.nombreParts||1 : 1, encaisse: p.statut==='encaisse', tourNum: p.numeroTour };
                          }),
                          ...nonPlanifies.map(m => ({ idMembre: m.id, nom: `${m.nom} ${m.prenom}`, parts: m.parts||1, encaisse: false, tourNum: null }))
                        ];
                        setRankingOrder(initOrder);
                        setRankingMode(true);
                        setRankingDateBase(t.dateDebut||'');
                      }} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                        <ListOrdered size={12}/> Définir l'ordre complet
                      </button>
                    )}
                  </div>

                  {/* Mode classement complet */}
                  {rankingMode && (
                    <div className="space-y-3 bg-primary-50 rounded-2xl border-2 border-primary-200 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-primary-700 flex items-center gap-1.5">
                          <ListOrdered size={13}/> Classez les membres dans l'ordre de bénéfice
                        </p>
                        <button onClick={()=>{setRankingMode(false);setRankingOrder([]);}} className="text-xs text-gray-400 hover:text-gray-600">X Annuler</button>
                      </div>
                      <p className="text-xs text-primary-600">Glissez  ou utilisez les flèches pour réorganiser. Les membres déjà encaissés sont verrouillés en position.</p>

                      <FormField label="Date de départ (1er tour)">
                        <input type="date" className="input text-sm" value={rankingDateBase} onChange={e=>setRankingDateBase(e.target.value)}/>
                      </FormField>

                      <div className="space-y-1.5">
                        {rankingOrder.map((item, idx) => (
                          <div key={item.idMembre}
                            draggable={!item.encaisse}
                            onDragStart={() => setDragIdx(idx)}
                            onDragOver={e => { e.preventDefault(); }}
                            onDrop={() => {
                              if (dragIdx === null || item.encaisse || dragIdx === idx) return;
                              const newOrder = [...rankingOrder];
                              const [moved] = newOrder.splice(dragIdx, 1);
                              newOrder.splice(idx, 0, moved);
                              setRankingOrder(newOrder);
                              setDragIdx(null);
                            }}
                            className={clsx('flex items-center gap-3 p-2.5 rounded-xl border transition-all select-none',
                              item.encaisse ? 'bg-primary-100 border-primary-300 opacity-70' :
                              dragIdx === idx ? 'border-primary-400 bg-primary-50 shadow-md scale-[1.01]' :
                              'bg-white border-gray-200 hover:border-primary-300 cursor-grab active:cursor-grabbing'
                            )}>
                            {/* Numéro tour */}
                            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0',
                              item.encaisse ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700')}>
                              {idx + 1}
                            </div>
                            {/* Nom */}
                            <div className="flex-1 min-w-0">
                              <p className={clsx('text-sm font-semibold', item.encaisse ? 'text-primary-800' : 'text-gray-800')}>
                                {item.nom}
                                {item.encaisse && <span className="ml-2 text-xs text-primary-600 font-normal">OK Encaissé</span>}
                              </p>
                              <p className="text-xs text-gray-400">{item.parts} part{item.parts>1?'s':''} · {fmt(t.cotisation * item.parts)} / tour</p>
                            </div>
                            {/* Flèches déplacement */}
                            {!item.encaisse && (
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button onClick={() => {
                                  if (idx === 0) return;
                                  const newOrder = [...rankingOrder];
                                  // Skip encaisse items when moving up
                                  let targetIdx = idx - 1;
                                  while (targetIdx > 0 && newOrder[targetIdx].encaisse) targetIdx--;
                                  if (newOrder[targetIdx].encaisse) return;
                                  [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
                                  setRankingOrder(newOrder);
                                }} className="p-0.5 hover:bg-primary-100 rounded text-gray-400 hover:text-primary-600" title="Monter">
                                  Haut
                                </button>
                                <button onClick={() => {
                                  if (idx === rankingOrder.length - 1) return;
                                  const newOrder = [...rankingOrder];
                                  let targetIdx = idx + 1;
                                  [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
                                  setRankingOrder(newOrder);
                                }} className="p-0.5 hover:bg-primary-100 rounded text-gray-400 hover:text-primary-600" title="Descendre">
                                  Bas
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button onClick={() => {
                        // Enregistrer tous les tours non encore planifiés dans l'ordre défini
                        const dejaEncaisses = new Set(planning.filter(p=>p.statut==='encaisse').map(p=>p.idMembre));
                        const dejaPlanifies = new Set(planning.filter(p=>p.statut==='planifie').map(p=>p.idMembre));
                        let tourNum = encaisses; // commencer après les encaissés
                        rankingOrder.forEach((item) => {
                          if (dejaEncaisses.has(item.idMembre)) return; // déjà encaissé, skip
                          tourNum++;
                          // Calculer date prévue en fonction de la périodicité
                          let datePrevue = '';
                          if (rankingDateBase) {
                            const d = new Date(rankingDateBase);
                            const offset = tourNum - 1;
                            switch(t.periode) {
                              case 'hebdomadaire': d.setDate(d.getDate() + offset * 7); break;
                              case 'mensuel':      d.setMonth(d.getMonth() + offset); break;
                              case 'bimestriel':   d.setMonth(d.getMonth() + offset * 2); break;
                              case 'trimestriel':  d.setMonth(d.getMonth() + offset * 3); break;
                              default:             d.setMonth(d.getMonth() + offset);
                            }
                            datePrevue = d.toISOString().split('T')[0];
                          }
                          addTourPlanning({
                            idTontine: t.id,
                            idMembre: item.idMembre,
                            nomMembre: item.nom,
                            numeroTour: tourNum,
                            datePrevue,
                            montantPot: t.cotisation * t.totalParts,
                            statut: 'planifie',
                            note: `Rotation — position ${tourNum}`,
                          });
                        });
                        setRankingMode(false);
                        setRankingOrder([]);
                      }} className="btn-primary w-full justify-center text-sm">
                        <CheckCircle size={14}/> Enregistrer l'ordre de rotation complet
                      </button>
                    </div>
                  )}

                  {/* Aperçu planning existant si pas en mode ranking */}
                  {!rankingMode && planning.length > 0 && (
                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                      <CheckCircle size={11} className="text-primary-500"/>
                      {encaisses} tour(s) encaissé(s), {planning.filter(p=>p.statut==='planifie').length} planifié(s)
                    </div>
                  )}
                  {!rankingMode && planning.length === 0 && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700 text-center">
                       Aucun ordre défini. Cliquez sur "Définir l'ordre complet" pour planifier tous les tours de rotation.
                    </div>
                  )}
                </div>
              )}

              {/* TIRAGE */}
              {t.typeAttribution==='tirage' && (
                <div className="border-t pt-3">
                  <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5"><Dices size={13}/> Tirage au sort — Tour N°{prochain}</p>
                  {prochain>t.nbTours ? (
                    <div className="p-3 bg-primary-50 rounded-xl text-center text-sm text-primary-700 font-medium"> Tous les tours tirés !</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-gray-50 rounded-xl text-xs text-gray-600">
                        <strong>{membresActifs.length - dejaBenef.size}</strong> membre(s) éligible(s) · Les bénéficiaires déjà tirés sont exclus.
                      </div>
                      <div className="flex gap-2">
                        <input type="date" className="input flex-1 text-sm" value={formTour.datePrevue}
                          onChange={e=>setFormTour(f=>({...f,datePrevue:e.target.value}))}/>
                        <button onClick={()=>handleTirage(t.id,t.nbTours)} className="btn-primary text-sm px-4 flex items-center gap-1.5">
                          <Shuffle size={14}/> Tirer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ENCHÈRE */}
              {t.typeAttribution==='enchere' && (
                <div className="border-t pt-3 space-y-3">
                  <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><Gavel size={13}/> Enchères — Tour N°{prochain}</p>
                  {enCoursEnch ? (
                    <div className="space-y-2">
                      {[...enCoursEnch.bids].sort((a,b)=>b.montantEnchere-a.montantEnchere).map((bid,i)=>(
                        <div key={bid.id} className={clsx('flex items-center gap-3 p-2.5 rounded-xl',i===0?'bg-amber-50 border border-amber-200':'bg-gray-50')}>
                          <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',i===0?'bg-amber-500 text-white':'bg-gray-200 text-gray-600')}>{i+1}</div>
                          <p className="text-sm font-medium text-gray-800 flex-1">{bid.nomMembre}</p>
                          <p className={clsx('text-sm font-bold',i===0?'text-amber-700':'text-gray-600')}>{fmt(bid.montantEnchere)}</p>
                        </div>
                      ))}
                      <button onClick={()=>attribuerTour(enCoursEnch.rotation.id,enCoursEnch.bids.sort((a,b)=>b.montantEnchere-a.montantEnchere)[0].idMembre)}
                        className="btn-primary w-full text-sm justify-center">
                        <Trophy size={14}/> Attribuer au plus offrant
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                      Aucune enchère ouverte.<br/>
                      <NavLink to="/encheres" className="text-primary-600 hover:underline mt-1 inline-block">Gérer les enchères -</NavLink>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-3">
                <p className="text-xs text-gray-400 mb-2">Membres restant à bénéficier : {membresActifs.filter(m=>!dejaBenef.has(m.id)).length}/{membresActifs.length}</p>
                <div className="flex flex-wrap gap-1.5">
                  {membresActifs.map(m=>(
                    <span key={m.id} className={clsx('text-xs px-2 py-0.5 rounded-full border',
                      dejaBenef.has(m.id)?'bg-primary-50 border-primary-200 text-primary-700':'bg-white border-gray-200 text-gray-600')}>
                      {m.nom} {m.prenom?.charAt(0)}.{dejaBenef.has(m.id)?' OK':''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Résultat tirage */}
      {showTirage && (
        <Modal open={true} onClose={()=>setShowTirage(null)} title=" Résultat du tirage au sort"
          footer={<button onClick={()=>setShowTirage(null)} className="btn-primary w-full justify-center">Fermer</button>}>
          <div className="text-center space-y-4 py-2">
            <div className="text-6xl"></div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-2">Bénéficiaire — Tour N°{showTirage.numeroTour}</p>
              <p className="text-2xl font-black text-blue-800">{showTirage.nomMembre}</p>
              <p className="text-base font-bold text-blue-600 mt-1">{fmt(showTirage.montantPot)} FCFA</p>
            </div>
            <p className="text-xs text-gray-400">Enregistré dans le planning de la tontine.</p>
          </div>
        </Modal>
      )}

      {/* Membres d'une tontine */}
      {showMembres && (() => {
        const t   = tontines.find(x=>x.id===showMembres.id)||showMembres;
        const cfg = TYPE_CONFIG[t.typeAttribution]||TYPE_CONFIG.rotation;
        const mtList = membresDeTontine(t.id);
        const pot = t.cotisation * t.totalParts;
        return (
          <Modal open={true} onClose={()=>{setShowMembres(null);setShowAddMembre(false);}} title={`${cfg.icon} Membres — ${t.nom}`}
            footer={<div className="flex gap-2 w-full"><button onClick={()=>setShowAddMembre(true)} className="btn-primary"><UserPlus size={14}/> Inscrire</button><button onClick={()=>setShowMembres(null)} className="btn-secondary ml-auto">Fermer</button></div>}>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-gray-50 rounded-xl"><p className="text-sm font-bold text-primary-600">{fmt(pot)}</p><p className="text-xs text-gray-400">Pot/tour</p></div>
                <div className="p-2.5 bg-gray-50 rounded-xl"><p className="text-sm font-bold text-gray-800">{t.totalParts}</p><p className="text-xs text-gray-400">Parts</p></div>
                <div className="p-2.5 bg-gray-50 rounded-xl"><p className="text-sm font-bold text-blue-600">{mtList.filter(m=>m.statut==='actif').length}</p><p className="text-xs text-gray-400">Actifs</p></div>
              </div>
              {mtList.length===0 ? (
                <div className="text-center py-8 text-gray-400"><Users size={28} className="mx-auto mb-2 text-gray-200"/><p className="text-sm">Aucun membre inscrit</p></div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {mtList.map(mt=>(
                    <div key={mt.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group hover:bg-white transition-all">
                      <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold shrink-0">{mt.nom?.[0]}{mt.prenom?.[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{mt.nom} {mt.prenom}</p>
                        <p className="text-xs text-gray-400">{mt.nombreParts} part(s) · {fmt(t.cotisation * mt.nombreParts)}/tour</p>
                      </div>
                      <Badge variant={mt.statut==='actif'?'green':'gray'}>{mt.statut==='actif'?'Actif':'Suspendu'}</Badge>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>{setShowEditMT(mt);setFormMT({idMembre:mt.idMembre,nombreParts:mt.nombreParts});}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={12}/></button>
                        <button onClick={()=>removeMembreTontine(mt.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {mtList.length>0&&(
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 mb-2">Contribution par membre / tour</p>
                  <div className="space-y-1">
                    {mtList.map(mt=>(
                      <div key={mt.id} className="flex justify-between text-xs">
                        <span className="text-gray-600">{mt.nom} {mt.prenom} (x{mt.nombreParts})</span>
                        <span className="font-bold text-amber-700">{fmt(t.cotisation*mt.nombreParts)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      <Modal open={showAddMembre&&!!showMembres} onClose={()=>setShowAddMembre(false)} title={`Inscrire un membre — ${showMembres?.nom}`}
        footer={<><button onClick={()=>setShowAddMembre(false)} className="btn-secondary">Annuler</button><button onClick={handleAddMembre} className="btn-primary"><UserPlus size={14}/>Inscrire</button></>}>
        <div className="space-y-4">
          {showMembres&&membresDisponibles(showMembres.id).length===0 ? (
            <div className="p-4 bg-primary-50 rounded-xl text-center"><BadgeCheck size={24} className="mx-auto mb-2 text-primary-500"/><p className="text-sm font-medium text-primary-700">Tous les membres sont déjà inscrits</p></div>
          ) : (
            <>
              <FormField label="Membre" required>
                <select className="select" value={formMT.idMembre} onChange={e=>setFormMT(f=>({...f,idMembre:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {showMembres&&membresDisponibles(showMembres.id).map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom} ({m.statut})</option>)}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Parts"><input className="input" type="number" min="1" max="20" value={formMT.nombreParts} onChange={e=>setFormMT(f=>({...f,nombreParts:e.target.value}))}/></FormField>
                <FormField label="Date inscription"><input className="input" type="date" value={formMT.dateAdhesion} onChange={e=>setFormMT(f=>({...f,dateAdhesion:e.target.value}))}/></FormField>
              </div>
              {formMT.nombreParts&&showMembres&&(
                <div className="p-3 bg-primary-50 rounded-xl flex justify-between text-sm">
                  <span className="text-gray-600">Cotisation / tour :</span>
                  <span className="font-bold text-primary-700">{fmt(Number(showMembres.cotisation)*Number(formMT.nombreParts))}</span>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!showEditMT} onClose={()=>setShowEditMT(null)} title="Modifier les parts"
        footer={<><button onClick={()=>setShowEditMT(null)} className="btn-secondary">Annuler</button><button onClick={()=>{updateMembreTontine({...showEditMT,nombreParts:Number(formMT.nombreParts)});setShowEditMT(null);}} className="btn-primary"><Pencil size={14}/>Enregistrer</button></>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Parts de <strong>{showEditMT?.nom} {showEditMT?.prenom}</strong></p>
          <FormField label="Nombre de parts"><input className="input" type="number" min="1" max="20" value={formMT.nombreParts} onChange={e=>setFormMT(f=>({...f,nombreParts:e.target.value}))}/></FormField>
        </div>
      </Modal>

      <Modal open={!!showBulletin} onClose={()=>setShowBulletin(null)} title={`Bulletin de gain — ${showBulletin?.nom || ''}`}
        footer={<><button onClick={()=>setShowBulletin(null)} className="btn-secondary">Annuler</button><button onClick={async()=>{const retenues=bulletinForm.retenueMontant>0?[{libelle:bulletinForm.retenueLibelle||'Retenue',montant:Number(bulletinForm.retenueMontant)}]:[];const b=await genererBulletin({idTontine:showBulletin.id,idMembre:Number(bulletinForm.idMembre),numeroCycle:Number(bulletinForm.numeroCycle),retenues});if(b){ouvrirBulletinPdf(b.id);setShowBulletin(null);}}} className="btn-primary"><FileText size={14}/> Générer PDF</button></>}>
        <div className="space-y-4">
          <FormField label="Bénéficiaire" required>
            <select className="select" value={bulletinForm.idMembre} onChange={e=>setBulletinForm(f=>({...f,idMembre:e.target.value}))}>
              <option value="">Sélectionner…</option>
              {showBulletin && membresDeTontine(showBulletin.id).map(m=><option key={m.idMembre} value={m.idMembre}>{m.nom} {m.prenom}</option>)}
            </select>
          </FormField>
          <FormField label="Cycle">
            <input type="number" min="1" className="input" value={bulletinForm.numeroCycle} onChange={e=>setBulletinForm(f=>({...f,numeroCycle:e.target.value}))}/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Retenue">
              <input className="input" placeholder="Ex : sanction" value={bulletinForm.retenueLibelle} onChange={e=>setBulletinForm(f=>({...f,retenueLibelle:e.target.value}))}/>
            </FormField>
            <FormField label="Montant retenue">
              <input type="number" min="0" className="input" value={bulletinForm.retenueMontant} onChange={e=>setBulletinForm(f=>({...f,retenueMontant:e.target.value}))}/>
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Nouvelle tontine */}
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Nouvelle tontine"
        footer={<><button onClick={()=>setShowAdd(false)} className="btn-secondary">Annuler</button><button onClick={handleAdd} disabled={!form.nom.trim()||!form.cotisation} className={clsx('btn-primary',(!form.nom.trim()||!form.cotisation)&&'opacity-40 cursor-not-allowed')}><Plus size={14}/> Créer</button></>}>
        <div className="space-y-5">
          <div className="p-3 bg-gray-50 rounded-xl space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Identité</p>
            <FormField label="Nom de la tontine" required><F k="nom" placeholder="Ex : Tontine Famille — 2025"/></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cotisation / part (FCFA)" required><F k="cotisation" type="number" placeholder="50 000"/></FormField>
              <FormField label="Périodicité"><S k="periode"><option value="hebdomadaire">Hebdomadaire</option><option value="mensuel">Mensuelle</option><option value="bimestriel">Bimestrielle</option><option value="trimestriel">Trimestrielle</option></S></FormField>
            </div>
            <FormField label="Caisse liée" required>
              <S k="caisseId">
                <option value="">Sélectionner une caisse…</option>
                {caissesTontine.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </S>
            </FormField>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Mode d'attribution</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_CONFIG).map(([key,cfg])=>(
                <button key={key} type="button" onClick={()=>setForm(f=>({...f,typeAttribution:key}))}
                  className={clsx('p-3 rounded-xl border-2 text-center transition-all',form.typeAttribution===key?`border-${cfg.color}-400 ${cfg.bg}`:'border-gray-200 bg-white hover:border-gray-300')}>
                  <p className="text-xl mb-1">{cfg.icon}</p>
                  <p className="text-xs font-bold text-gray-800 leading-tight">{cfg.label}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 italic">{TYPE_CONFIG[form.typeAttribution]?.desc}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Paramètres</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nombre de tours"><F k="nbTours" type="number" min="1" placeholder="12"/></FormField>
              <FormField label="Date de démarrage"><F k="dateDebut" type="date"/></FormField>
            </div>
            {form.dateDebut&&form.nbTours&&(
              <div className="p-2.5 bg-primary-50 rounded-xl flex justify-between text-xs">
                <span className="text-primary-700"> Fin estimée :</span>
                <span className="font-bold text-primary-800">{fmtDate(calcDateFin(form.dateDebut,form.nbTours,form.periode))}</span>
              </div>
            )}
          </div>
          {form.cotisation&&Number(form.cotisation)>0&&(
            <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-50 rounded-xl border border-primary-200">
              <p className="text-xs font-bold text-primary-700 mb-2"> Aperçu</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 flex justify-between"><span className="text-gray-500">Pot (10 parts)</span><span className="font-bold text-primary-700">{fmt(Number(form.cotisation)*10)}</span></div>
                <div className="bg-white rounded-lg p-2 flex justify-between"><span className="text-gray-500">Durée</span><span className="font-bold text-gray-700">{form.nbTours} {PERIODE_DUREE[form.periode]}</span></div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modifier tontine */}
      <Modal open={!!showEdit} onClose={()=>setShowEdit(null)} title={`Modifier — ${showEdit?.nom}`}
        footer={<><button onClick={()=>setShowEdit(null)} className="btn-secondary">Annuler</button><button onClick={handleEdit} className="btn-primary"><Pencil size={14}/>Enregistrer</button></>}>
        <div className="space-y-4">
          <FormField label="Nom" required><F k="nom"/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cotisation (FCFA)" required><F k="cotisation" type="number"/></FormField>
            <FormField label="Périodicité"><S k="periode"><option value="hebdomadaire">Hebdomadaire</option><option value="mensuel">Mensuelle</option><option value="bimestriel">Bimestrielle</option><option value="trimestriel">Trimestrielle</option></S></FormField>
          </div>
          <FormField label="Caisse liée" required>
            <S k="caisseId">
              <option value="">Sélectionner une caisse…</option>
              {caissesTontine.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </S>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nb tours"><F k="nbTours" type="number" min="1"/></FormField>
            <FormField label="Type"><S k="typeAttribution"><option value="rotation"> Rotation</option><option value="tirage"> Tirage</option><option value="enchere"> Enchère</option></S></FormField>
          </div>
        </div>
      </Modal>
    </div>
  );
}
