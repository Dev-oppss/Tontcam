import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Calendar, Users, UserPlus, Trash2, Pencil,
  BadgeCheck, TrendingUp, Info, Trophy, Shuffle, ChevronRight,
  CheckCircle, Clock, Banknote, Star, X,
  ListOrdered, Gavel, Dices, FileText, Coins,
} from 'lucide-react';
import { fmt, fmtDate, typeAttrLabel, periodeLabel } from '../data/mockData';
import { getMissingFields } from '../lib/validation';
import { useApp } from '../context/AppContext';
import { PageHeader, Badge, Modal, FormField } from '../components/ui/index';
import { ModePaiementFields, isModePaiementValid } from '../components/ui/ModePaiement';
import { NavLink, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { useAsyncGuard } from '../hooks/useAsyncGuard';
import CagnotteModal from '../components/tontines/CagnotteModal';

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

const EMPTY_FORM = { nom:'', cotisation:'', idCaisse:'', periode:'mensuel', nbTours:12, dureeSeances:12, typeAttribution:'rotation', dateDebut:'', dateFin:'' };
const EMPTY_MT   = { idMembre:'', nombreParts:'1', dateAdhesion: new Date().toISOString().split('T')[0], idAvaliste:'' };

export default function Tontines() {
  const {
    tontines, caisses, addTontine, updateTontine,
    membres, membresParTontine, addMembreTontine, removeMembreTontine,
    planningTours, addTourPlanning, marquerTourEncaisse, retirerTourPlanning, chargerPlanningTours,
    encheres, rotations,
    genererBulletin, ouvrirBulletinPdf, cyclesTontine, chargerCycles,
    reunions,
    enregistrerBeneficiaireSeance, showToast,
  } = useApp();

  // Le planning des tours n'est pas inclus dans le chargement initial global de
  // l'application : sans cet appel, `planningTours` reste vide après chaque
  // rechargement de page et l'ordre de rotation semblait "disparaître".
  useEffect(() => {
    tontines.filter(t => t.typeAttribution === 'rotation').forEach(t => chargerPlanningTours(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tontines.map(t => t.id).join(',')]);

  const [searchParams] = useSearchParams();
  const initialTab = ['toutes', 'rotation', 'tirage', 'enchere'].includes(searchParams.get('type'))
    ? searchParams.get('type')
    : 'toutes';
  const [activeTab,       setActiveTab]       = useState(initialTab);

  // useState(initialTab) ne lit l'URL qu'au tout premier montage. Comme /tontines?type=rotation
  // et /tontines?type=enchere sont la MÊME route (React Router ne démonte pas le composant),
  // cliquer sur un autre type de tontine dans la sidebar après le premier clic ne changeait
  // jamais activeTab : le filtre restait bloqué sur sa valeur initiale.
  // Le lien "Tontines actives" pointe vers /tontines SANS paramètre ?type= du tout : il faut
  // traiter cette absence de paramètre comme 'toutes', sinon revenir dessus après avoir cliqué
  // un type ne fait plus rien non plus (le filtre reste bloqué sur le dernier type choisi).
  useEffect(() => {
    const type = searchParams.get('type');
    const cible = ['rotation', 'tirage', 'enchere'].includes(type) ? type : 'toutes';
    setActiveTab(cible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('type')]);
  const [showAdd,         setShowAdd]         = useState(false);
  const [showEdit,        setShowEdit]        = useState(null);
  const [showMembres,     setShowMembres]     = useState(null);
  const [showCagnotte,    setShowCagnotte]    = useState(null);
  const [showBenef,       setShowBenef]       = useState(null);
  const [bulkParts,       setBulkParts]       = useState({});
  const [bulkAvalistes,   setBulkAvalistes]   = useState({});
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
  const [bulletinForm,    setBulletinForm]    = useState({ idCycle:'' });
  const [encaisseModal,   setEncaisseModal]   = useState(null); // tour planning à encaisser
  const [encModePaiement, setEncModePaiement] = useState('especes');
  const [encDetails,      setEncDetails]      = useState('');

  const filteredTontines = tontines.filter(t =>
    activeTab === 'toutes' ? true : t.typeAttribution === activeTab
  );
  const caissesMap = Object.fromEntries((caisses || []).map((c) => [c.id, c]));
  const caissesTontine = (caisses || []).filter((c) =>
    String(c?.type || '').toLowerCase() === 'tontine' && c.statut !== 'inactive'
  );
  const aucuneCaisseDisponible = (caisses || []).length > 0 && caissesTontine.length === 0;

  const getTourPlanning   = (id) => (planningTours || []).filter(p => p.idTontine === id).sort((a,b) => a.numeroTour - b.numeroTour);
  const potTontine = (t) => Number(t?.cotisation || 0) * Number(t?.totalParts || 0);
  const getMembresActifs  = (id) => {
    const vus = new Set();
    return membresParTontine.filter(mt => mt.idTontine === id && mt.statut === 'actif' && !vus.has(mt.idMembre) && vus.add(mt.idMembre));
  };
  const getNbEncaisses    = (id) => (planningTours || []).filter(p => p.idTontine === id && p.statut === 'encaisse').length;
  const getProchainTour   = (id, nb) => Math.min(getNbEncaisses(id) + 1, nb);
  const modeAttributionVerrouillee = !!showEdit && (cyclesTontine || []).some((cycle) => cycle.idTontine === showEdit.id);

  const handleAdd = async () => {
    const missing = getMissingFields(form, [
      { key: 'nom', label: 'Nom de la tontine' },
      { key: 'idCaisse', label: 'Caisse liée' },
      { key: 'cotisation', label: 'Cotisation / part' },
    ]);
    // La mise minimum n'est plus obligatoire pour une tontine à enchère : elle
    // reste un champ indicatif optionnel, plus une contrainte bloquante (pt.7).
    if (!missing.length && (!form.cotisation || Number(form.cotisation) <= 0)) missing.push('Cotisation / part');
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const dateFin = form.dateFin || calcDateFin(form.dateDebut, form.dureeSeances, form.periode);
    await addTontine({ ...form, cotisation: Number(form.cotisation), nbTours: Number(form.nbTours), dateFin });
    setShowAdd(false); setForm(EMPTY_FORM);
  };
  const [guardedHandleAddTontine, addingTontine] = useAsyncGuard(handleAdd);

  const handleEdit = async () => {
    const missing = getMissingFields(form, [
      { key: 'nom', label: 'Nom' },
      { key: 'idCaisse', label: 'Caisse liée' },
      { key: 'cotisation', label: 'Cotisation' },
    ]);
    if (!missing.length && (!form.cotisation || Number(form.cotisation) <= 0)) missing.push('Cotisation');
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    await updateTontine({ ...showEdit, ...form, cotisation: Number(form.cotisation), nbTours: Number(form.nbTours), dureeSeances: Number(form.dureeSeances) });
    setShowEdit(null);
  };
  const [guardedHandleEdit, editingTontine] = useAsyncGuard(handleEdit);

  const nextNumeroPart = (idTontine) => {
    const existants = membresParTontine.filter(mt => mt.idTontine === idTontine);
    return existants.length ? Math.max(...existants.map(mt => mt.numeroPart || 0)) + 1 : 1;
  };

  // Liste unique "tous les membres + nombre de parts" (0 par défaut = pas dans la
  // tontine). On applique la sauvegarde en une fois : pour chaque membre dont le
  // nombre cible diffère de l'actuel, on ajoute ou retire les parts nécessaires.
  const handleSaveBulkParts = async (idTontine) => {
    const t = tontines.find(x => x.id === idTontine);
    const actuels = new Map(membresDeTontine(idTontine).map(mt => [mt.idMembre, mt]));
    let numero = nextNumeroPart(idTontine);
    try {
      for (const m of membres) {
        const cible = Math.max(0, Number(bulkParts[m.id] ?? actuels.get(m.id)?.nombreParts ?? 0) || 0);
        const actuelMt = actuels.get(m.id);
        const actuel = actuelMt?.nombreParts || 0;
        if (cible === actuel) continue;
        if (cible > actuel) {
          if (t?.avalisteRequis && !actuelMt && !bulkAvalistes[m.id]) {
            showToast?.(`Avaliste requis pour ${m.nom} ${m.prenom}.`, 'error');
            continue;
          }
          for (let i = 0; i < cible - actuel; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await addMembreTontine({
              idTontine, idMembre: m.id, numeroPart: numero,
              dateAdhesion: new Date().toISOString().split('T')[0],
              idAvaliste: bulkAvalistes[m.id] || actuelMt?.idAvaliste || null,
            });
            numero += 1;
          }
        } else {
          const aRetirer = (actuelMt?.partIds || []).slice(cible);
          for (const pid of aRetirer) {
            // eslint-disable-next-line no-await-in-loop
            await removeMembreTontine(pid, idTontine);
          }
        }
      }
    } catch {
      return; // toast d'erreur déjà affiché par handleError
    }
    // Ne pas vider bulkParts avec {} : la modale reste ouverte après
    // l'enregistrement (voir bouton Fermer séparé), et les champs de saisie
    // affichent bulkParts[m.id] ?? '0'. Un {} vide fait donc retomber
    // TOUTES les lignes à 0 à l'écran, alors que les parts viennent d'être
    // sauvegardées avec succès (visible seulement dans les totaux Pot/
    // Parts/Actifs en haut, pas ligne par ligne) — source de confusion.
    // On réinitialise plutôt depuis les données fraîchement enregistrées.
    const init = {};
    membresDeTontine(idTontine).forEach(mt => { init[mt.idMembre] = String(mt.nombreParts); });
    setBulkParts(init);
    setBulkAvalistes({});
  };
  const [guardedHandleSaveBulkParts, savingBulkParts] = useAsyncGuard(handleSaveBulkParts);

  const handleAddTour = (idTontine, nbTours) => {
    if (!formTour.idMembre) return;
    const t = tontines.find(x => x.id === idTontine);
    const m = membres.find(x => x.id === formTour.idMembre);
    const numeroTour = getProchainTour(idTontine, nbTours);
    addTourPlanning({
      idTontine, idMembre: formTour.idMembre,
      nomMembre: `${m?.nom} ${m?.prenom}`, numeroTour,
      datePrevue: formTour.datePrevue, note: formTour.note,
      montantPot: t ? potTontine(t) : 0,
    });
    setFormTour({ idMembre:'', datePrevue:'', note:'' }); setAddTourMode(false);
  };

  const handleTirage = async (idTontine, nbTours) => {
    const numeroTour = getProchainTour(idTontine, nbTours);
    const reunionOuverte = reunions.find(r => r.statutReunion === 'en_cours');
    if (!reunionOuverte) { showToast?.('Ouvrez une réunion avant de désigner un bénéficiaire.', 'error'); return; }
    const t = tontines.find(x => x.id === idTontine);
    const cycle = await enregistrerBeneficiaireSeance(reunionOuverte.id, {
      idTontine, nomTontine: t?.nom, typeAttribution: 'tirage', numeroTour, modeDesignation: 'tirage_au_sort',
    });
    if (cycle?.gagnant?.membre) {
      setShowTirage({
        numeroTour,
        nomMembre: `${cycle.gagnant.membre.nom} ${cycle.gagnant.membre.prenom}`,
        montantPot: Number(cycle.bulletin?.montant_brut || 0),
      });
    }
  };
  const [guardedHandleTirage, tirageEnCours] = useAsyncGuard(handleTirage);

  // Chaque `mt` est une part (une ligne = une part côté serveur). On y ajoute les
  // champs du membre SANS écraser l'id de la part (bug corrigé : `{...mt, ...membre}`
  // remplaçait `mt.id` par l'id du membre, ce qui corrompait `partIds` utilisé pour
  // la suppression et faisait apparaître des clés React dupliquées).
  const partsDeTontine    = (id) => membresParTontine.filter(mt => mt.idTontine === id).map(mt => ({ ...membres.find(m => m.id === mt.idMembre), ...mt }));
  // Le backend modélise chaque part individuellement (une ligne = une part) ; on
  // regroupe ici par membre pour l'affichage (CDC 4.3 — parts multiples).
  const membresDeTontine  = (id) => {
    const parts = partsDeTontine(id);
    const groupes = new Map();
    const vues = new Set(); // garde-fou anti-doublon sur l'id réel de la part
    parts.forEach((p) => {
      if (vues.has(p.id)) return;
      vues.add(p.id);
      if (!groupes.has(p.idMembre)) {
        groupes.set(p.idMembre, { ...p, partIds: [p.id], nombreParts: 1 });
      } else {
        const g = groupes.get(p.idMembre);
        g.partIds.push(p.id);
        g.nombreParts += 1;
        if (p.statut === 'actif') g.statut = 'actif';
      }
    });
    return Array.from(groupes.values());
  };
  const membresDisponibles = (id) => membres.filter(m => !membresParTontine.some(mt => mt.idTontine === id && mt.idMembre === m.id));

  // Le bouton "Membres (n)" ne fait qu'initialiser bulkParts UNE FOIS, au clic.
  // Si les parts d'une tontine viennent d'être modifiées ailleurs (ou si le
  // rechargement des données côté API arrive après ce clic), rouvrir la même
  // modale montrait alors 0 part pour tout le monde alors que les compteurs
  // globaux (pot/tour, parts, actifs) — eux dérivés de tontine.totalParts,
  // recalculé indépendamment — restaient corrects. On resynchronise donc
  // bulkParts en continu tant que la modale est ouverte, à chaque changement
  // de membresParTontine, au lieu de ne le faire qu'à l'ouverture.
  useEffect(() => {
    if (!showMembres) return;
    const init = {};
    membresDeTontine(showMembres.id).forEach(mt => { init[mt.idMembre] = String(mt.nombreParts); });
    setBulkParts(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMembres, membresParTontine]);
  const getEncheresDuTour = (id) => {
    const rotation = rotations.find(r => r.idTontine === id && !r.dateAttribution);
    return rotation ? { rotation, bids: encheres.filter(e => e.idRotation === rotation.id) } : null;
  };

  const formRef = useRef(form); formRef.current = form;
  const F = useRef(({ k, ...p }) => <input className="input" value={formRef.current[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} {...p}/>).current;
  const S = useRef(({ k, children, ...p }) => <select className="select" value={formRef.current[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} {...p}>{children}</select>).current;

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
        action={<button onClick={() => { setForm({ ...EMPTY_FORM, typeAttribution: activeTab !== 'toutes' ? activeTab : 'rotation' }); setShowAdd(true); }} className="btn-primary"><Plus size={15}/> Nouvelle tontine</button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l:'Pot total cumulé',  v: fmt(tontines.reduce((s,t)=>s+potTontine(t),0)), c:'text-primary-600', bg:'bg-primary-50', icon:'' },
          { l:'Membres inscrits',  v: new Set(membresParTontine.filter(mt=>mt.statut==='actif').map(mt=>mt.idMembre)).size,   c:'text-blue-600',   bg:'bg-blue-50',   icon:'' },
          { l:'Tours encaissés',   v: (planningTours||[]).filter(p=>p.statut==='encaisse').length, c:'text-amber-600',  bg:'bg-amber-50',  icon:'' },
          { l:'Parts totales',     v: tontines.reduce((s,t)=>s+Number(t.totalParts||0),0),                    c:'text-purple-600', bg:'bg-purple-50', icon:'' },
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
          const potTour   = potTontine(t);
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
                      <span className="text-xs text-gray-400">· {caissesMap[t.idCaisse]?.nom || 'Caisse non liée'}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setShowEdit(t); setForm({ nom:t.nom, cotisation:t.cotisation, idCaisse:t.idCaisse||'', periode:t.periode, nbTours:t.nbTours, dureeSeances:t.dureeSeances||t.nbTours, typeAttribution:t.typeAttribution, dateDebut:t.dateDebut||'', dateFin:t.dateFin||'' }); }}
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
                <button onClick={() => { setShowMembres(t); setShowAddMembre(false); setBulkAvalistes({}); }} className="btn-secondary text-xs py-1.5 justify-center">
                  <Users size={12}/> Membres ({nbActifs})
                </button>
                <button onClick={() => { setShowBenef(t); setAddTourMode(false); setFormTour({ idMembre:'', datePrevue:'', note:'' }); chargerPlanningTours(t.id); }}
                  className="btn-secondary text-xs py-1.5 justify-center">
                  <cfg.ActionIcon size={12}/> Tours
                </button>
                <NavLink to={t.typeAttribution === 'enchere' ? '/encheres' : '/rotations'} className="btn-secondary text-xs py-1.5 justify-center">
                  <Trophy size={12}/> Historique
                </NavLink>
                <button onClick={() => { setShowBulletin(t); setBulletinForm({ idCycle:'' }); chargerCycles(t.id); }} className="btn-secondary text-xs py-1.5 justify-center">
                  <FileText size={12}/> Bulletin
                </button>
              </div>
              <button onClick={() => setShowCagnotte(t)} className={`mt-2 w-full text-xs py-1.5 rounded-xl justify-center flex items-center gap-1.5 ${t.modeCagnotte ? 'btn-secondary' : 'text-ink-400 hover:text-ink-600'}`}>
                <Coins size={12}/> {t.modeCagnotte ? 'Cagnotte — remise de gains' : 'Activer le mode cagnotte'}
              </button>
            </div>
          );
        })}
        {showCagnotte && <CagnotteModal tontine={showCagnotte} onClose={() => setShowCagnotte(null)} />}
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
        const partsActives = partsDeTontine(t.id).filter(p => p.statut === 'actif' || p.statut === 'disponible' || p.statut === 'reservee');
        const membresActifs = getMembresActifs(t.id).map(mt=>{const m=membres.find(x=>x.id===mt.idMembre);return m?{...m,parts:mt.nombreParts}:null;}).filter(Boolean);
        // BUGFIX RG-TON : chaque part a son propre cycle de gain (un membre avec
        // plusieurs parts peut encore bénéficier tant qu'il lui reste au moins une
        // part non consommée). `dejaBenefPart` (par part) est la seule source fiable ;
        // `dejaBenef` (par membre) n'en est dérivé que pour ne marquer "déjà bénéficié"
        // un membre que lorsque TOUTES ses parts sont consommées — jamais dès la première.
        const dejaBenefPart = new Set(planning.filter(p=>p.statut!=='saute').map(p=>p.idPart));
        const dejaBenef = new Set(
          membresActifs
            .filter(m => {
              const partsDuMembre = partsActives.filter(p => p.idMembre === m.id);
              return partsDuMembre.length > 0 && partsDuMembre.every(p => dejaBenefPart.has(p.id));
            })
            .map(m => m.id)
        );
        const enCoursEnch = getEncheresDuTour(t.id);

        return (
          <Modal open={true} onClose={()=>setShowBenef(null)} title={`${cfg.icon} Bénéficiaires — ${t.nom}`}
            footer={<button onClick={()=>setShowBenef(null)} className="btn-secondary ml-auto">Fermer</button>}>
            <div className="space-y-4">
              <div className={`p-3 rounded-xl border text-sm ${cfg.bg} ${cfg.border}`}>
                <p className="font-bold text-gray-800 mb-1">{cfg.icon} Mode : {cfg.label}</p>
                <p className="text-xs text-gray-600">{cfg.tip}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                Cet écran planifie l'ordre de passage. La collecte des cotisations et la désignation du gagnant se font depuis <strong>Réunions</strong>, dans l'onglet « Feuille Cotisation » d'une séance ouverte.
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
                        <p className="text-sm font-semibold text-gray-800">{p.nomMembre}{p.numeroPart ? ` · part n°${p.numeroPart}` : ''}</p>
                        <p className="text-xs text-gray-400">{p.datePrevue?fmtDate(p.datePrevue):'Date non définie'}{p.note&&` · ${p.note}`}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-700 shrink-0">{fmt(p.statut === 'encaisse' ? p.montantPot : potTontine(t))}</span>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        {p.statut!=='encaisse'&&(
                          <button onClick={()=>retirerTourPlanning(t.id, p.id)} title="Retirer" className="p-1 hover:bg-red-100 rounded text-red-400"><X size={12}/></button>
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
                        // Initialiser le ranking par PART (RG-TON : chaque part a son propre
                        // cycle de gain — un membre avec plusieurs parts occupe plusieurs
                        // positions distinctes, jamais regroupées sur un seul tour).
                        const planifies = planning.filter(p => p.statut !== 'saute' && p.idPart).sort((a,b) => a.numeroTour - b.numeroTour);
                        const idsPartsPlanifiees = new Set(planifies.map(p => p.idPart));
                        const partsNonPlanifiees = partsActives.filter(p => !idsPartsPlanifiees.has(p.id));

                        const initOrder = [
                          ...planifies.map(p => {
                            const m = membres.find(x => x.id === p.idMembre);
                            const part = partsActives.find(x => x.id === p.idPart);
                            return { idPart: p.idPart, idMembre: p.idMembre, nom: `${m?.nom||p.nomMembre||''} ${m?.prenom||''}`.trim(), numeroPart: part?.numeroPart, encaisse: p.statut==='encaisse', tourNum: p.numeroTour };
                          }),
                          ...partsNonPlanifiees.map(p => ({ idPart: p.id, idMembre: p.idMembre, nom: `${p.nom||''} ${p.prenom||''}`.trim(), numeroPart: p.numeroPart, encaisse: false, tourNum: null }))
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
                          <div key={item.idPart}
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
                              <p className="text-xs text-gray-400">Part n°{item.numeroPart ?? '?'} · {fmt(t.cotisation)} / tour</p>
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
                        const dejaEncaissesPart = new Set(planning.filter(p=>p.statut==='encaisse').map(p=>p.idPart));
                        let tourNum = encaisses; // commencer après les encaissés
                        rankingOrder.forEach((item) => {
                          if (dejaEncaissesPart.has(item.idPart)) return; // cette part est déjà encaissée, skip
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
                            idPart: item.idPart,
                            idMembre: item.idMembre,
                            nomMembre: item.nom,
                            numeroTour: tourNum,
                            datePrevue,
                            // RG-TON : le pot d'un tour = cotisation × parts actives de la tontine
                            // (tout le monde cotise à chaque tour), pas le nombre de parts du bénéficiaire.
                            montantPot: potTontine(t),
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
                        <button onClick={()=>guardedHandleTirage(t.id,t.nbTours)} disabled={tirageEnCours} className="btn-primary text-sm px-4 flex items-center gap-1.5">
                          <Shuffle size={14}/> {tirageEnCours ? 'Tirage…' : 'Tirer'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ENCHÈRE — lecture seule ici : l'attribution se fait en RÉUNION (règle d'or) */}
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
                      <p className="text-xs text-gray-400 text-center">L'attribution au plus offrant se fait depuis la Réunion en cours.</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                      Aucune enchère ouverte.<br/>
                      Les enchères s'enregistrent depuis la Réunion en cours.
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

      {/* Membres d'une tontine — liste unique de tous les membres, nombre de parts
          éditable par ligne. 0 = pas dans la tontine, 1+ = inscrit avec ce nombre
          de parts. Une seule sauvegarde applique tous les changements. */}
      {showMembres && (() => {
        const t   = tontines.find(x=>x.id===showMembres.id)||showMembres;
        const cfg = TYPE_CONFIG[t.typeAttribution]||TYPE_CONFIG.rotation;
        const mtList = membresDeTontine(t.id);
        const pot = potTontine(t);
        return (
          <Modal open={true} onClose={()=>{setShowMembres(null);setBulkParts({});setBulkAvalistes({});}} title={`${cfg.icon} Membres — ${t.nom}`}
            footer={<div className="flex gap-2 w-full"><button onClick={()=>guardedHandleSaveBulkParts(t.id)} disabled={savingBulkParts} className="btn-primary"><Pencil size={14}/> {savingBulkParts ? 'Enregistrement…' : 'Enregistrer'}</button><button onClick={()=>{setShowMembres(null);setBulkParts({});setBulkAvalistes({});}} disabled={savingBulkParts} className="btn-secondary ml-auto">Fermer</button></div>}>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-gray-50 rounded-xl"><p className="text-sm font-bold text-primary-600">{fmt(pot)}</p><p className="text-xs text-gray-400">Pot/tour</p></div>
                <div className="p-2.5 bg-gray-50 rounded-xl"><p className="text-sm font-bold text-gray-800">{Number(t.totalParts || 0)}</p><p className="text-xs text-gray-400">Parts</p></div>
                <div className="p-2.5 bg-gray-50 rounded-xl"><p className="text-sm font-bold text-blue-600">{mtList.filter(m=>m.statut==='actif').length}</p><p className="text-xs text-gray-400">Actifs</p></div>
              </div>
              <p className="text-xs text-gray-400">Nombre de parts par membre. 0 = pas inscrit à la tontine.</p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {membres.map(m=>{
                  const enTontine = Number(bulkParts[m.id] ?? 0) > 0;
                  const actuelMt = mtList.find(mt=>mt.idMembre===m.id);
                  const besoinAvaliste = t?.avalisteRequis && enTontine && !actuelMt;
                  return (
                    <div key={m.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${enTontine?'bg-primary-50':'bg-gray-50'}`}>
                      <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{m.nom?.[0]}{m.prenom?.[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.nom} {m.prenom}</p>
                        {enTontine && <p className="text-xs text-primary-600">{fmt(Number(t.cotisation||0) * Number(bulkParts[m.id]||0))}/tour</p>}
                      </div>
                      {besoinAvaliste && (
                        <select className="select !w-32 !py-1 text-xs" value={bulkAvalistes[m.id]||''} onChange={e=>setBulkAvalistes(a=>({...a,[m.id]:e.target.value}))}>
                          <option value="">Avaliste…</option>
                          {membres.filter(x=>x.id!==m.id&&x.statut==='actif').map(x=><option key={x.id} value={x.id}>{x.nom} {x.prenom}</option>)}
                        </select>
                      )}
                      <input type="number" min="0" max="20" className="input !w-16 !py-1 text-center"
                        value={bulkParts[m.id] ?? '0'}
                        onChange={e=>setBulkParts(p=>({...p,[m.id]:e.target.value}))}/>
                    </div>
                  );
                })}
              </div>
            </div>
          </Modal>
        );
      })()}

      <Modal open={!!showBulletin} onClose={()=>setShowBulletin(null)} title={`Bulletin de gain — ${showBulletin?.nom || ''}`}
        footer={<><button onClick={()=>setShowBulletin(null)} className="btn-secondary">Annuler</button><button disabled={!bulletinForm.idCycle} onClick={async()=>{const b=await genererBulletin(bulletinForm.idCycle);if(b){ouvrirBulletinPdf(b.id);setShowBulletin(null);}}} className="btn-primary"><FileText size={14}/> Télécharger le PDF</button></>}>
        <div className="space-y-4">
          <FormField label="Cycle clôturé" required hint="Le bulletin (montant, retenues) est calculé automatiquement à la clôture du cycle.">
            <select className="select" value={bulletinForm.idCycle} onChange={e=>setBulletinForm(f=>({...f,idCycle:e.target.value}))}>
              <option value="">Sélectionner…</option>
              {showBulletin && cyclesTontine.filter(c=>c.idTontine===showBulletin.id && c.statut==='clos').map(c=>
                <option key={c.id} value={c.id}>Cycle n°{c.numeroCycle} — {c.gagnantNom || 'gagnant inconnu'}</option>
              )}
            </select>
          </FormField>
          {showBulletin && cyclesTontine.filter(c=>c.idTontine===showBulletin.id && c.statut==='clos').length===0 && (
            <p className="text-xs text-gray-500">Aucun cycle clôturé pour cette tontine — le bulletin n'est disponible qu'une fois un cycle terminé (gagnant désigné puis clôturé).</p>
          )}
        </div>
      </Modal>

      {/* Nouvelle tontine */}
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Nouvelle tontine"
        footer={<><button onClick={()=>setShowAdd(false)} disabled={addingTontine} className="btn-secondary">Annuler</button><button onClick={guardedHandleAddTontine} disabled={!form.nom.trim()||!form.cotisation||addingTontine} className={clsx('btn-primary',(!form.nom.trim()||!form.cotisation||addingTontine)&&'opacity-40 cursor-not-allowed')}><Plus size={14}/> {addingTontine ? 'Création…' : 'Créer'}</button></>}>
        <div className="space-y-5">
          <div className="p-3 bg-gray-50 rounded-xl space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Identité</p>
            <FormField label="Nom de la tontine" required><F k="nom" placeholder="Ex : Tontine Famille — 2025"/></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cotisation / part (FCFA)" required><F k="cotisation" type="number" placeholder="50 000"/></FormField>
              <FormField label="Périodicité"><S k="periode"><option value="hebdomadaire">Hebdomadaire</option><option value="mensuel">Mensuelle</option><option value="bimestriel">Bimestrielle</option><option value="trimestriel">Trimestrielle</option></S></FormField>
            </div>
            <FormField label="Caisse liée" required
              hint={aucuneCaisseDisponible ? "Aucune caisse éligible : vérifiez qu'au moins une caisse existante n'est pas de type Mutuelle/Scolaire/Événement/Annuelle/Banque, ou créez-en une nouvelle dans Caisses." : undefined}>
              <S k="idCaisse">
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
              <FormField label="Nombre de parts prévues" hint="1 part = 1 tour de gain"><F k="nbTours" type="number" min="1" placeholder="12"/></FormField>
              <FormField label="Durée cible (séances)"><F k="dureeSeances" type="number" min="1" placeholder="12"/></FormField>
              <FormField label="Date de démarrage"><F k="dateDebut" type="date"/></FormField>
            </div>
            {form.dateDebut&&form.dureeSeances&&(
              <div className="p-2.5 bg-primary-50 rounded-xl flex justify-between text-xs">
                <span className="text-primary-700"> Fin estimée :</span>
                <span className="font-bold text-primary-800">{fmtDate(calcDateFin(form.dateDebut,form.dureeSeances,form.periode))}</span>
              </div>
            )}
          </div>
          {form.cotisation&&Number(form.cotisation)>0&&(
            <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-50 rounded-xl border border-primary-200">
              <p className="text-xs font-bold text-primary-700 mb-2"> Aperçu</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 flex justify-between"><span className="text-gray-500">Pot (10 parts)</span><span className="font-bold text-primary-700">{fmt(Number(form.cotisation)*10)}</span></div>
                <div className="bg-white rounded-lg p-2 flex justify-between"><span className="text-gray-500">Plan</span><span className="font-bold text-gray-700">{form.nbTours} tours / {form.dureeSeances} séances</span></div>
                <div className="bg-white rounded-lg p-2 flex justify-between col-span-2"><span className="text-gray-500">Maximum calculé</span><span className="font-bold text-gray-700">{Math.ceil(Number(form.nbTours || 1) / Number(form.dureeSeances || 1))} tour(s) / séance</span></div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modifier tontine */}
      <Modal open={!!showEdit} onClose={()=>setShowEdit(null)} title={`Modifier — ${showEdit?.nom}`}
        footer={<><button onClick={()=>setShowEdit(null)} disabled={editingTontine} className="btn-secondary">Annuler</button><button onClick={guardedHandleEdit} disabled={editingTontine} className="btn-primary"><Pencil size={14}/>{editingTontine ? 'Enregistrement…' : 'Enregistrer'}</button></>}>
        <div className="space-y-4">
          <FormField label="Nom" required><F k="nom"/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cotisation (FCFA)" required hint={showEdit && getNbEncaisses(showEdit.id) > 0 ? "Immuable : au moins un cycle a déjà été encaissé (RG-TON-002)" : undefined}>
              <F k="cotisation" type="number" disabled={showEdit && getNbEncaisses(showEdit.id) > 0}/>
            </FormField>
            <FormField label="Périodicité"><S k="periode"><option value="hebdomadaire">Hebdomadaire</option><option value="mensuel">Mensuelle</option><option value="bimestriel">Bimestrielle</option><option value="trimestriel">Trimestrielle</option></S></FormField>
          </div>
          <FormField label="Caisse liée" required
            hint={aucuneCaisseDisponible ? "Aucune caisse éligible : vérifiez qu'au moins une caisse existante n'est pas de type Mutuelle/Scolaire/Événement/Annuelle/Banque, ou créez-en une nouvelle dans Caisses." : undefined}>
            <S k="idCaisse">
              <option value="">Sélectionner une caisse…</option>
              {caissesTontine.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </S>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombre de parts / tours" hint="Calculé sur les parts de la tontine"><F k="nbTours" type="number" min="1"/></FormField>
            <FormField label="Durée cible (séances)"><F k="dureeSeances" type="number" min="1"/></FormField>
            <FormField label="Type" hint={modeAttributionVerrouillee ? "Verrouillé : au moins un tour a déjà démarré." : undefined}><S k="typeAttribution" disabled={modeAttributionVerrouillee}><option value="rotation"> Rotation</option><option value="tirage"> Tirage</option><option value="enchere"> Enchère</option></S></FormField>
          </div>
          {form.typeAttribution === 'enchere' && (
            <FormField label="Mise minimum (FCFA)" hint="Facultatif — indicatif seulement, n'est plus imposé aux offres.">
              <F k="miseMinEnchere" type="number" min="0"/>
            </FormField>
          )}
        </div>
      </Modal>

      {/* Encaissement d'un tour — mode de paiement obligatoire (RG-TON-039) */}
      <Modal open={!!encaisseModal} onClose={()=>setEncaisseModal(null)} title="Marquer le tour comme encaissé"
        footer={<>
          <button onClick={()=>setEncaisseModal(null)} className="btn-secondary">Annuler</button>
          <button
            onClick={()=>{ marquerTourEncaisse(encaisseModal.idTontine, encaisseModal.id); setEncaisseModal(null); }}
            disabled={!isModePaiementValid(encModePaiement, encDetails)}
            className={clsx('btn-primary', !isModePaiementValid(encModePaiement, encDetails) && 'opacity-40 cursor-not-allowed')}
          ><CheckCircle size={14}/>Confirmer l'encaissement</button>
        </>}>
        {encaisseModal && (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
              <p className="text-sm font-semibold text-primary-800">{encaisseModal.nomMembre}</p>
              <p className="text-xs text-primary-600 mt-0.5">Tour N°{encaisseModal.numeroTour} — <strong>{fmt(encaisseModal.montantPot)}</strong></p>
            </div>
            <ModePaiementFields
              modePaiement={encModePaiement}
              detailsPaiement={encDetails}
              onModeChange={(v)=>{setEncModePaiement(v);setEncDetails('');}}
              onDetailsChange={setEncDetails}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
