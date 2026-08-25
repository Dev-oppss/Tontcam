import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CalendarPlus, MapPin, Users, Clock, CheckCircle, PlayCircle,
  Plus, Trash2, Pencil, Lock, FileText, AlertCircle,
  ClipboardList, ListChecks, ArrowDownCircle, ArrowUpCircle,
  Landmark, DollarSign, ChevronRight, Printer, Receipt, X,
  ClipboardCheck, ShieldAlert, CheckSquare, XSquare, MinusSquare,
  BadgeDollarSign, TrendingUp, AlertTriangle, Banknote,
  Trophy, Dices, Gavel, RefreshCw, Star, HeartHandshake, ArrowLeft,
} from 'lucide-react';
import { fmtDate, typePointLabel, statutPointLabel, fmt, periodeLabel, ACTEUR_ROLES, acteurRoleLabel, roleLabel, STATUTS_PRESENCE, statutPresenceLabel, MODES_PAIEMENT, modePaiementConfig } from '../data/mockData';
import { API_BASE, request } from '../lib/api';
import { useApp, TX_TYPES, TX_LABELS } from '../context/AppContext';
import { PageHeader, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';
import { ModePaiementFields, isModePaiementValid, ModePaiementBadge } from '../components/ui/ModePaiement';
import clsx from 'clsx';

// ── Config statuts ────────────────────────────────────────────
const sCfg = {
  planifiee: { label:'Planifiée',       v:'blue',  icon: Clock       },
  en_cours:  { label:'En cours',        v:'amber', icon: PlayCircle  },
  tenue:     { label:'Tenue — à signer',v:'amber', icon: FileText    },
  cloturee:  { label:'Clôturée',        v:'green', icon: CheckCircle },
  annulee:   { label:'Annulée',         v:'red',   icon: AlertCircle },
};
const typeCfg = {
  administratif:{ v:'blue',  label:'Administratif' },
  financier:    { v:'green', label:'Financier'     },
  attribution:  { v:'amber', label:'Attribution'   },
  disciplinaire:{ v:'red',   label:'Disciplinaire' },
  divers:       { v:'gray',  label:'Divers'        },
};
const statutPointCfg = {
  prevu:    { v:'blue',  label:'Prévu'    },
  en_cours: { v:'amber', label:'En cours' },
  traite:   { v:'green', label:'Traité'   },
  reporte:  { v:'gray',  label:'Reporté'  },
  annule:   { v:'red',   label:'Annulé'   },
};

// ── Accès aux onglets de la fiche réunion, par rôle (RG-SEC-002) ──
// Un acteur ne voit QUE les onglets qui le concernent. Le rôle vient du
// compte créé dans Utilisateurs (Sécurité), pas d'un choix libre à la
// connexion. Le Président voit tout en LECTURE SEULE (consultation
// générale). L'Administrateur (créateur de l'association / super-admin)
// a accès complet à tout, y compris la saisie — c'est le seul rôle à la
// fois "voit tout" et "peut tout modifier".
const TAB_ACCESS = {
  info:               ['super_admin','president','vice_president','tresorier','secretaire','controleur','membre'],
  presences:          ['super_admin','president','secretaire','controleur'],
  feuille_cotisation: ['super_admin','president','tresorier','controleur'],
  beneficiaire:       ['super_admin','president','tresorier','secretaire','controleur'],
  remboursement:      ['super_admin','president','tresorier','controleur'],
  pret:               ['super_admin','president','tresorier','controleur'],
  sanction:           ['super_admin','president','tresorier','secretaire','controleur'],
  aide:               ['super_admin','president','tresorier','secretaire','controleur'],
  banque:             ['super_admin','president','tresorier','controleur'],
  divers:             ['super_admin','president','tresorier','controleur'],
  signatures:         ['super_admin','president','vice_president','tresorier','secretaire','controleur'],
};
const ROLES_LECTURE_SEULE = ['president','controleur'];

const EMPTY_REUNION   = { date:'', lieu:'', numero:'', observation:'' };
const EMPTY_OUVERTURE = { heureOuverture:'', presidentSeance:'', secretaireSeance:'', motOuverture:'' };
const EMPTY_CLOTURE   = { heureCloture:'', presents:'', absents:'', membresAbsents:'', observation:'' };
const EMPTY_POINT     = { titre:'', rubriqueId:'', type:'administratif', description:'', acteurRole:'' };
const EMPTY_TX        = { type:'cotisation', idMembre:'', montant:'', libelle:'', idSanction:'', idPret:'', idBanque:'', sousType:'', note:'', modePaiement:'especes', detailsPaiement:'' };

// ── Feuille de présence / cotisation tontine ─────────────────
const STATUT_COTIS = { non_defini: null, cotise: 'cotise', defaillant: 'defaillant' };

function FeuillePresenceTontine({ reunion, onClose, readOnly = false }) {
  const {
    tontines, membres, membresParTontine,
    addSeanceTransaction, addSanction, seanceTransactions,
    planningTours, ouvrirCycle, saisirCotisationCycle, designerGagnantCycle, cloturerCycle,
    encheres, cyclesTontine, ouvrirBulletinPdf, addEnchere, ajouterRetenueBulletin, payerBulletin, banques,
  } = useApp();

  const locked   = !!reunion.verrouillee;
  const notOpen  = reunion.statutReunion === 'planifiee';
  const [bulletinUrl, setBulletinUrl] = useState(null);
  const [busyPaiement, setBusyPaiement] = useState(false); // anti double-clic : versement / retenue bulletin

  // reunion.beneficiairesSeance n'a jamais existé côté API — dérivé ici de la vraie
  // source de vérité (cyclesTontine) pour que le bénéficiaire désigné reste visible
  // même après un changement d'onglet ou de composant.
  const beneficiairesSeance = useMemo(() => (cyclesTontine || [])
    .filter(c => c.idReunion === reunion.id && c.statut === 'clos')
    .map(c => {
      const t = tontines.find(tt => tt.id === c.idTontine);
      return {
        idTontine: c.idTontine, nomTontine: t?.nom || '',
        typeAttribution: t?.typeAttribution, nomMembre: c.gagnantNom,
        numeroTour: c.numeroCycle, montantEnchere: c.montantEnchere,
        montantPot: c.montantCollecteReel, dateAttrib: c.dateCloture, idBulletin: c.idBulletin,
      };
    }), [cyclesTontine, tontines, reunion.id]);

  const [idTontineSelectee, setIdTontineSelectee] = useState('');
  const [statutParMembre,   setStatutParMembre]   = useState({});
  const [modeParMembre,     setModeParMembre]     = useState({}); // { [idMembre]: { modePaiement, detailsPaiement } }
  const [sanctionMontant,   setSanctionMontant]   = useState('');
  const [valide,            setValide]            = useState(false);
  // etape: 'choix' - 'cotisation' - 'beneficiaire' - 'recap'
  const [etape, setEtape] = useState('choix');

  // Bénéficiaire state (selon type)
  const [gagnant,           setGagnant]           = useState(null);
  const [enchereIdGagnant,  setEnchereIdGagnant]  = useState('');
  const [miseGagnante,      setMiseGagnante]      = useState('');
  const [tirageEffectue,    setTirageEffectue]    = useState(false);
  const [cycleActuelId,     setCycleActuelId]     = useState(null); // cycle ouvert à l'étape cotisation, réutilisé à l'étape bénéficiaire
  const [nouvelleEnchereMembre, setNouvelleEnchereMembre] = useState('');
  const [nouvelleEnchereMontant, setNouvelleEnchereMontant] = useState('');
  const [nouvelleEnchereCaisseId, setNouvelleEnchereCaisseId] = useState('');
  const [miseGagnanteCaisseId, setMiseGagnanteCaisseId] = useState('');
  // Choix manuel du bénéficiaire — disponible pour rotation ET tirage au sort,
  // comme pour l'enchère (dérogation possible à l'ordre planifié / au hasard).
  const [choixManuel,          setChoixManuel]          = useState(false);
  const [beneficiaireManuelId, setBeneficiaireManuelId]  = useState('');
  const [retenueModal, setRetenueModal] = useState(false);
  const [retenueLibelle, setRetenueLibelle] = useState('');
  const [retenueMontant, setRetenueMontant] = useState('');
  const [retenueCaisseId, setRetenueCaisseId] = useState('');
  const [versementModal, setVersementModal] = useState(false);
  const [modeVersement, setModeVersement] = useState('especes');
  const [referenceVersement, setReferenceVersement] = useState('');

  const tontineSelectee = tontines.find(t => t.id === idTontineSelectee);
  const cycleActuel = cyclesTontine.find(c => c.id === cycleActuelId);
  const typeAttr = tontineSelectee?.typeAttribution;
  const TYPE_ICONS  = { rotation:'', tirage:'', enchere:'' };
  const TYPE_LABELS = { rotation:'Rotation fixe', tirage:'Tirage au sort', enchere:'Enchère' };
  const TYPE_COLORS = {
    rotation: 'border-primary-400 bg-primary-50 text-primary-800',
    tirage:   'border-blue-400 bg-blue-50 text-blue-800',
    enchere:  'border-amber-400 bg-amber-50 text-amber-800',
  };

  const membresDeLatontine = useMemo(() => {
    if (!tontineSelectee) return [];
    // Une part gagnée est exclue du prochain tirage, jamais des cotisations.
    // On regroupe les parts d'un même membre pour ne présenter qu'une ligne par membre.
    const partsParMembre = new Map();
    membresParTontine
      .filter(mt => mt.idTontine === tontineSelectee.id && ['actif', 'gagnee'].includes(mt.statut))
      .forEach(mt => partsParMembre.set(mt.idMembre, (partsParMembre.get(mt.idMembre) || 0) + mt.nombreParts));
    return [...partsParMembre.entries()].map(([idMembre, nombreParts]) => {
      const membre = membres.find(m => m.id === idMembre);
      return membre ? { ...membre, nombreParts, montantDu: tontineSelectee.cotisation * nombreParts } : null;
    }).filter(Boolean);
  }, [tontineSelectee, membresParTontine, membres]);

  const membresEligiblesGain = useMemo(() => {
    // Un membre avec plusieurs parts apparaît plusieurs fois dans membresParTontine
    // (une ligne = une part côté serveur) — on regroupe pour n'afficher qu'une seule
    // fois chaque membre, avec son nombre de parts entre parenthèses.
    const partsParMembre = new Map();
    membresParTontine
      .filter(mt => mt.idTontine === tontineSelectee?.id && mt.statut === 'actif')
      .forEach(mt => partsParMembre.set(mt.idMembre, (partsParMembre.get(mt.idMembre) || 0) + 1));
    return [...partsParMembre.entries()]
      .map(([idMembre, nombreParts]) => {
        const membre = membres.find(m => m.id === idMembre);
        return membre ? { ...membre, nombreParts } : null;
      }).filter(Boolean);
  }, [tontineSelectee, membresParTontine, membres]);

  const montantPot     = tontineSelectee ? tontineSelectee.cotisation * tontineSelectee.totalParts : 0;
  const totalAttendu   = membresDeLatontine.reduce((s, m) => s + m.montantDu, 0);
  const cotises        = membresDeLatontine.filter(m => statutParMembre[m.id] === 'cotise');
  const defaillants    = membresDeLatontine.filter(m => statutParMembre[m.id] === 'defaillant');
  const nonRenseignes  = membresDeLatontine.filter(m => !statutParMembre[m.id]);
  const totalCollecte  = cotises.reduce((s, m) => s + m.montantDu, 0);

  // Bénéficiaire déjà enregistré pour cette tontine dans la séance
  const toursDejaTraites = beneficiairesSeance.filter(b => b.idTontine === idTontineSelectee).length;
  const limiteToursSeance = tontineSelectee?.maxCyclesParReunion || 1;
  const benefDejaEnregistre = toursDejaTraites >= limiteToursSeance;

  // Tour planifié rotation
  const tourPlanifieProchain = useMemo(() => {
    if (!tontineSelectee || typeAttr !== 'rotation') return null;
    const nbEncaisses = planningTours.filter(p => p.idTontine === tontineSelectee.id && p.statut === 'encaisse').length;
    return planningTours.find(p => p.idTontine === tontineSelectee.id && p.numeroTour === nbEncaisses + 1 && p.statut !== 'encaisse');
  }, [tontineSelectee, typeAttr, planningTours]);

  // Enchères en attente — scopées au cycle courant uniquement, sinon des enchères
  // saisies pour une autre réunion/cycle de la même tontine (enchère mode) apparaissaient
  // ici par erreur.
  const encheresEnAttente = useMemo(() => {
    if (!tontineSelectee || typeAttr !== 'enchere' || !cycleActuelId) return [];
    return encheres.filter(e => !e.estGagnante && e.idRotation === cycleActuelId);
  }, [tontineSelectee, typeAttr, encheres, cycleActuelId]);

  // Le serveur reste la source de vérité pour départager les offres : montant
  // maximal, puis offre la plus ancienne en cas d'égalité. Ce calcul sert
  // uniquement à indiquer visuellement l'offre qui sera retenue.
  const meilleureEnchere = useMemo(() => [...encheresEnAttente].sort((a, b) =>
    b.montantEnchere - a.montantEnchere || new Date(a.dateEnchere) - new Date(b.dateEnchere)
  )[0] || null, [encheresEnAttente]);

  // Par défaut, chaque membre est considéré cotisé (RG-TON-030 : toute
  // cotisation non renseignée est marquée impayée) — l'utilisateur décoche
  // uniquement les membres qui n'ont pas payé, au lieu de tout cocher un à un.
  useEffect(() => {
    if (!tontineSelectee) return;
    setStatutParMembre(prev => {
      const next = { ...prev }; let changed = false;
      membresDeLatontine.forEach(m => { if (next[m.id] === undefined) { next[m.id] = 'cotise'; changed = true; } });
      return changed ? next : prev;
    });
    setModeParMembre(prev => {
      const next = { ...prev }; let changed = false;
      membresDeLatontine.forEach(m => { if (!next[m.id]) { next[m.id] = { modePaiement: 'especes', detailsPaiement: '' }; changed = true; } });
      return changed ? next : prev;
    });
  }, [idTontineSelectee, membresDeLatontine, tontineSelectee]);

  // ── Reprise d'un cycle laissé en suspens ──────────────────────────────
  // Bug corrigé : "Valider et désigner le bénéficiaire" ouvre le cycle
  // (ouvrirCycle) dès la validation des cotisations — AVANT toute
  // désignation réelle — pour pouvoir y rattacher les transactions de
  // cotisation (cf. commentaire dans handleValiderFeuille). Si l'utilisateur
  // quitte ensuite l'onglet (ex. pour aller pointer les présences) sans
  // avoir désigné de bénéficiaire, ce cycle "ouvert" reste orphelin en base
  // : le tour est déjà compté, mais localement `etape`/`cycleActuelId` sont
  // remis à zéro au remontage du composant. Résultat : en revenant sur
  // Feuille Cotisation, tout repart de "choix" comme si rien n'avait été
  // fait, et re-valider les cotisations tente d'ouvrir un DEUXIÈME cycle
  // pour la même séance → rejeté par le backend ("comporte déjà le nombre
  // de tours prévu"), avec un message qui ne dit pas pourquoi.
  //
  // On détecte donc ici, pour la tontine sélectionnée, un cycle déjà ouvert
  // pour cette réunion et pas encore clos/annulé, et on reprend directement
  // à l'étape bénéficiaire au lieu de repartir de zéro.
  const cycleOuvertPourTontine = (idTontineCandidat) => (cyclesTontine || []).find(c =>
    c.idReunion === reunion.id && c.idTontine === idTontineCandidat && c.statut !== 'clos' && c.statut !== 'annule');

  useEffect(() => {
    if (!tontineSelectee) return;
    if (etape !== 'choix' && etape !== 'cotisation') return;
    const enSuspens = cycleOuvertPourTontine(tontineSelectee.id);
    if (enSuspens && enSuspens.id !== cycleActuelId) {
      setCycleActuelId(enSuspens.id);
      setEtape('beneficiaire');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tontineSelectee, cyclesTontine]);

  const toggleCotise = (idMembre) =>
    setStatutParMembre(prev => ({ ...prev, [idMembre]: prev[idMembre] === 'defaillant' ? 'cotise' : 'defaillant' }));
  const setModePaiementMembre = (idMembre, patch) =>
    setModeParMembre(prev => ({ ...prev, [idMembre]: { ...(prev[idMembre]||{modePaiement:'especes',detailsPaiement:''}), ...patch } }));

  // Anti double-clic : valider la feuille de cotisation, désigner un bénéficiaire
  // (rotation/tirage/manuel/enchère) et ajouter une enchère sont des séquences
  // d'appels serveur (parfois plusieurs cotisations puis ouverture/clôture de
  // cycle) — un second clic pendant que la première séquence tourne encore
  // pourrait dupliquer les cotisations ou désigner deux bénéficiaires.
  const [busyCotisationBenef, setBusyCotisationBenef] = useState(false);
  const runGuarded = async (fn) => {
    if (busyCotisationBenef) return;
    setBusyCotisationBenef(true);
    try { await fn(); } finally { setBusyCotisationBenef(false); }
  };

  // ── Valider la feuille de cotisation ──
  const handleValiderFeuille = async () => {
    if (!tontineSelectee) return;
    // Bug critique corrigé : forEach n'attendait jamais les appels async ci-dessous.
    // Si une cotisation échouait (ex: aucune caisse assignée à la tontine → "caisse_id
    // field is required"), l'erreur était totalement ignorée et le code enchaînait quand
    // même sur l'ouverture du cycle — la cotisation ratée disparaissait silencieusement,
    // mais le cycle avançait comme si de rien n'était ("cycle déjà effectué" au retour).
    //
    // Le cycle doit être ouvert AVANT de créer les transactions de cotisation, pour
    // pouvoir les rattacher via cycle_tontine_id (idCycle). Sans ce lien, annuler le
    // cycle plus tard ne pouvait pas retrouver ces transactions pour les contre-passer :
    // l'argent et la ligne restaient visibles en caisse/historique/PV malgré l'annulation.
    const cycle = await ouvrirCycle(tontineSelectee.id, reunion.id);
    if (!cycle) return; // ouvrirCycle a déjà affiché l'erreur (ex: plus aucune part disponible)
    setCycleActuelId(cycle.id);

    try {
      for (const m of cotises) {
        const mode = modeParMembre[m.id] || { modePaiement:'especes', detailsPaiement:'' };
        // eslint-disable-next-line no-await-in-loop
        await addSeanceTransaction(reunion.id, {
          type: 'cotisation', idMembre: m.id, montant: m.montantDu,
          libelle: `Cotisation ${tontineSelectee.nom} — ${m.nombreParts} part(s)`,
          idCycle: cycle.id, idBanque: tontineSelectee.idCaisse,
          modePaiement: mode.modePaiement, detailsPaiement: mode.detailsPaiement,
        });
      }
      for (const m of defaillants) {
        // eslint-disable-next-line no-await-in-loop
        await addSanction({
          idMembre: m.id, nomMembre: `${m.nom} ${m.prenom}`,
          typeSanction: 'non_paiement',
          motif: `Défaillance cotisation — ${tontineSelectee.nom} — Séance N°${reunion.numero}`,
          montant: sanctionMontant ? Number(sanctionMontant) : Math.round(m.montantDu * 0.1),
          date: reunion.date, reunionId: reunion.id,
        });
      }
    } catch (err) {
      // Le toast d'erreur est déjà affiché par addSeanceTransaction/addSanction (handleError).
      // Le cycle est déjà ouvert (aucune cotisation dedans n'a pu bloquer son ouverture),
      // donc on ne le referme pas ici — mais on n'avance pas non plus à l'étape bénéficiaire :
      // l'utilisateur peut annuler le cycle (bouton dédié) puis recommencer proprement.
      return;
    }

    for (const m of cotises) {
      const cotisationsMembre = cycle.cotisations.filter(co => co.idMembre === m.id);
      if (cotisationsMembre.length === 0) continue;
      const mode = modeParMembre[m.id] || { modePaiement:'especes', detailsPaiement:'' };
      for (const cotisation of cotisationsMembre) {
        await saisirCotisationCycle(cycle.id, cotisation.id, cotisation.montantDu, { modePaiement: mode.modePaiement });
      }
    }

    setValide(true);
    // Aller directement à la désignation du bénéficiaire
    setEtape('beneficiaire');
  };

  // Résout l'id de PART (tontine_parts) d'un membre — c'est ce que désignerGagnantCycle
  // attend, pas un id de membre. membresParTontine EST directement la liste des parts.
  const resolvePartId = (idMembre) => membresParTontine
    .find(mt => mt.idTontine === tontineSelectee?.id && mt.idMembre === idMembre && mt.statut === 'actif')?.id;

  // ── Handlers bénéficiaire — passent tous par le vrai circuit désormais :
  // désignerGagnantCycle() puis clôturerCycle(), sur le cycle ouvert à l'étape précédente.
  const handleConfirmerRotation = async () => {
    if (!tourPlanifieProchain || !cycleActuelId) return;
    // Le planning est rattaché à une part précise : si un membre possède deux
    // parts, chaque part conserve donc son tour distinct.
    const idPart = tourPlanifieProchain.idPart || resolvePartId(tourPlanifieProchain.idMembre);
    await designerGagnantCycle(cycleActuelId, idPart);
    const cycleFinal = await cloturerCycle(cycleActuelId);
    if (!cycleFinal) return;
    setGagnant({ nomMembre: cycleFinal.gagnantNom, montantPot: cycleFinal.montantCollecteReel, idBulletin: cycleFinal.idBulletin });
    setEtape('recap');
  };

  const handleTirage = async () => {
    if (!cycleActuelId) return;
    const apresDesignation = await designerGagnantCycle(cycleActuelId); // pas de part forcée = tirage aléatoire côté serveur
    if (!apresDesignation) return;
    const cycleFinal = await cloturerCycle(cycleActuelId);
    if (!cycleFinal) return;
    setGagnant({ nomMembre: cycleFinal.gagnantNom, montantPot: cycleFinal.montantCollecteReel, idBulletin: cycleFinal.idBulletin });
    setTirageEffectue(true);
    setEtape('recap');
  };

  // Choix manuel du bénéficiaire — utilisable en mode rotation (dérogation à
  // l'ordre planifié) et en mode tirage (le serveur accepte part_id pour tout
  // mode, voir TontineCycleService::designerGagnant). Un membre avec plusieurs
  // parts peut être choisi tant qu'il lui reste au moins une part disponible ;
  // resolvePartId() se charge de prendre une part encore 'actif' de ce membre.
  const handleDesignationManuelle = async () => {
    if (!cycleActuelId || !beneficiaireManuelId) return;
    const idPart = resolvePartId(beneficiaireManuelId);
    if (!idPart) return;
    const apresDesignation = await designerGagnantCycle(cycleActuelId, idPart);
    if (!apresDesignation) return;
    const cycleFinal = await cloturerCycle(cycleActuelId);
    if (!cycleFinal) return;
    setGagnant({ nomMembre: cycleFinal.gagnantNom, montantPot: cycleFinal.montantCollecteReel, idBulletin: cycleFinal.idBulletin });
    setChoixManuel(false);
    setBeneficiaireManuelId('');
    setEtape('recap');
  };

  const handleAjouterEnchere = async () => {
    if (!cycleActuelId) return;
    const missing = [];
    if (!nouvelleEnchereMembre) missing.push('Membre');
    if (!nouvelleEnchereMontant) missing.push('Montant de la mise');
    if (!nouvelleEnchereCaisseId) missing.push('Caisse');
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const ok = await addEnchere({
      idRotation: cycleActuelId,
      idTontine: tontineSelectee.id,
      idMembre: nouvelleEnchereMembre,
      montantEnchere: nouvelleEnchereMontant,
      idCaisse: nouvelleEnchereCaisseId,
    });
    if (ok) { setNouvelleEnchereMembre(''); setNouvelleEnchereMontant(''); setNouvelleEnchereCaisseId(''); }
  };

  const terminerEnchere = async (cycleFinal) => {
    if (!cycleFinal) return;
    setGagnant({
      nomMembre: cycleFinal.gagnantNom,
      montantPot: cycleFinal.montantCollecteReel - cycleFinal.montantEnchere,
      mise: cycleFinal.montantEnchere,
      idBulletin: cycleFinal.idBulletin,
    });
    setEtape('recap');
  };

  // Clôture normale : le backend choisit obligatoirement la meilleure offre.
  const handleCloturerEncheres = async () => {
    if (!cycleActuelId || !meilleureEnchere) return;
    const apresDesignation = await designerGagnantCycle(cycleActuelId);
    if (!apresDesignation) return;
    await terminerEnchere(await cloturerCycle(cycleActuelId));
  };

  // Dérogation explicitement manuelle : l'offre sélectionnée est conservée et
  // enregistrée comme gagnante par le backend avant la clôture.
  const handleConfirmerEnchere = async (idPart) => {
    if (!cycleActuelId) return;
    if (!idPart) return;
    const apresDesignation = await designerGagnantCycle(cycleActuelId, idPart);
    if (!apresDesignation) return;
    await terminerEnchere(await cloturerCycle(cycleActuelId));
  };

  // La désignation manuelle sans offre crée d'abord une offre réelle, afin que
  // le montant apparaisse dans l'historique et le bulletin de gain.
  const handleEnregistrerEtDesignerManuellement = async () => {
    if (!cycleActuelId) return;
    const missing = [];
    if (!enchereIdGagnant) missing.push('Membre bénéficiaire');
    if (!miseGagnante) missing.push('Montant');
    if (!miseGagnanteCaisseId) missing.push('Caisse');
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const offre = await addEnchere({
      idRotation: cycleActuelId,
      idTontine: tontineSelectee.id,
      idMembre: enchereIdGagnant,
      montantEnchere: miseGagnante,
      idCaisse: miseGagnanteCaisseId,
    });
    if (offre) await handleConfirmerEnchere(offre.idPart);
  };

  const reset = () => {
    setIdTontineSelectee(''); setEtape('choix'); setStatutParMembre({}); setModeParMembre({});
    setValide(false); setSanctionMontant(''); setGagnant(null);
    setEnchereIdGagnant(''); setMiseGagnante(''); setTirageEffectue(false); setCycleActuelId(null);
    setChoixManuel(false); setBeneficiaireManuelId('');
  };

  // ── Blocage si séance non ouverte ──
  if (notOpen) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Lock size={28} className="text-amber-500"/>
        </div>
        <p className="font-bold text-gray-700">Séance non ouverte</p>
        <p className="text-sm text-gray-400 max-w-xs">Les opérations de cotisation ne sont disponibles qu'après l'ouverture officielle de la séance.</p>
        <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
           Ouvrez d'abord la séance via le bouton "Ouvrir la séance"
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── ÉTAPE 1 : Choix de la tontine ── */}
      {etape === 'choix' && (
        <div className="space-y-3">
          <div className="p-3 bg-primary-50 rounded-xl border border-primary-100 text-xs text-primary-700 flex items-start gap-2">
            <ClipboardCheck size={14} className="mt-0.5 shrink-0"/>
            <p>Sélectionnez la tontine à traiter. Le système détectera automatiquement son mode (rotation, tirage ou enchère) et vous guidera vers la désignation du bénéficiaire.</p>
          </div>

          <div className="space-y-2">
            {tontines.filter(t => t.statut === 'active').map(t => {
              const nbEncaisses = planningTours.filter(p => p.idTontine === t.id && p.statut === 'encaisse').length;
              const progressPct = t.nbTours > 0 ? Math.round(nbEncaisses / t.nbTours * 100) : 0;
              const toursTraites = beneficiairesSeance.filter(b => b.idTontine === t.id).length;
              const dejaTraite  = toursTraites >= (t.maxCyclesParReunion || 1);
              const enSuspens   = !!cycleOuvertPourTontine(t.id);
              const isSelected  = idTontineSelectee === t.id;
              const tColor      = TYPE_COLORS[t.typeAttribution] || '';
              return (
                <button key={t.id} type="button"
                  onClick={() => setIdTontineSelectee(String(t.id))}
                  className={clsx('w-full text-left p-3.5 rounded-xl border-2 transition-all',
                    dejaTraite ? 'border-green-300 bg-green-50' :
                    enSuspens ? 'border-amber-400 bg-amber-50' :
                    isSelected ? 'border-primary-500 bg-primary-50 shadow-sm ring-2 ring-primary-200' :
                    'border-gray-200 hover:border-primary-300'
                  )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{TYPE_ICONS[t.typeAttribution] || ''}</span>
                      <div>
                        <p className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                          {t.nom}
                          {isSelected && <CheckCircle size={14} className="text-primary-600"/>}
                        </p>
                        <p className="text-xs text-gray-400">{fmt(t.cotisation)} / part · {t.totalParts} parts = <strong>{fmt(t.cotisation * t.totalParts)}</strong></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {enSuspens ? (
                        <span className="text-xs px-2 py-0.5 rounded-full border font-medium border-amber-300 bg-amber-100 text-amber-700">
                          Bénéficiaire à désigner
                        </span>
                      ) : (
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', tColor)}>
                          {TYPE_LABELS[t.typeAttribution]}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-medium">{toursTraites}/{t.maxCyclesParReunion || 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-primary-500 rounded-full" style={{ width: `${progressPct}%` }}/>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">Tour {nbEncaisses + 1}/{t.nbTours}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {idTontineSelectee && tontineSelectee && cycleOuvertPourTontine(tontineSelectee.id) && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl text-xs text-amber-700 border border-amber-200">
              <AlertTriangle size={13}/> Les cotisations de cette tontine ont déjà été validées pour cette séance — vous allez reprendre directement à la désignation du bénéficiaire.
            </div>
          )}
          {idTontineSelectee && tontineSelectee && !benefDejaEnregistre && (
            <button onClick={() => setEtape('cotisation')} className="btn-primary w-full justify-center">
              <ClipboardList size={15}/>
              Commencer — Cotisations + {TYPE_ICONS[typeAttr]} {TYPE_LABELS[typeAttr]}
            </button>
          )}
          {idTontineSelectee && benefDejaEnregistre && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-2 text-sm text-green-700">
              <Trophy size={15}/> Limite de {limiteToursSeance} tour(s) atteinte pour cette tontine dans cette séance.
            </div>
          )}
        </div>
      )}

      {/* ── ÉTAPE 2 : Feuille de cotisation ── */}
      {etape === 'cotisation' && tontineSelectee && (
        <div className="space-y-4">
          {/* En-tête avec type tontine bien visible */}
          <div className={clsx('p-3 rounded-xl border-2 flex items-center justify-between', TYPE_COLORS[typeAttr])}>
            <div>
              <p className="font-bold text-sm">{TYPE_ICONS[typeAttr]} {tontineSelectee.nom}</p>
              <p className="text-xs opacity-75 mt-0.5">{TYPE_LABELS[typeAttr]} · {fmt(tontineSelectee.cotisation)} / part</p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">Pot du tour</p>
              <p className="font-black text-base">{fmt(montantPot)}</p>
            </div>
          </div>

          {/* Pipeline visuel */}
          <div className="flex items-center gap-1 text-xs">
            <div className="flex items-center gap-1 px-2.5 py-1 bg-primary-600 text-white rounded-full font-bold">
              <span>1</span><span>Cotisations</span>
            </div>
            <ChevronRight size={12} className="text-gray-300"/>
            <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-400 rounded-full">
              <span>2</span><span>{TYPE_ICONS[typeAttr]} Bénéficiaire</span>
            </div>
            <ChevronRight size={12} className="text-gray-300"/>
            <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-400 rounded-full">
              <span>3</span><span>Résumé</span>
            </div>
          </div>

          <button onClick={() => setEtape('choix')} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
            - Changer de tontine
          </button>

          {/* Consigne simple */}
          <div className="p-2.5 bg-gray-50 rounded-xl text-xs text-gray-500 flex items-start gap-2">
            <ClipboardCheck size={14} className="mt-0.5 shrink-0 text-primary-500"/>
            <p>Tout le monde est coché <strong>« a cotisé »</strong> par défaut. Décochez uniquement les membres qui n'ont pas payé.</p>
          </div>

          {/* Sélection rapide */}
          {!(locked || readOnly) && (
            <div className="flex gap-2">
              <button onClick={() => { const all = {}; membresDeLatontine.forEach(m => { all[m.id] = 'cotise'; }); setStatutParMembre(all); }}
                className="btn-secondary text-xs py-1.5 flex-1"><CheckSquare size={12}/> Tout cocher (tous cotisé)</button>
              <button onClick={() => { const all = {}; membresDeLatontine.forEach(m => { all[m.id] = 'defaillant'; }); setStatutParMembre(all); }}
                className="btn-secondary text-xs py-1.5 flex-1">
                <MinusSquare size={12}/> Tout décocher</button>
            </div>
          )}

          {/* Liste membres — cases à cocher larges + mode de paiement inline */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {membresDeLatontine.map(m => {
              const isCotise = statutParMembre[m.id] !== 'defaillant';
              const mode = modeParMembre[m.id] || { modePaiement:'especes', detailsPaiement:'' };
              const modeCfg = modePaiementConfig?.[mode.modePaiement];
              const dis = locked || readOnly;
              return (
                <div key={m.id} className={clsx('px-3 py-3 transition-colors', isCotise ? 'bg-green-50' : 'bg-red-50')}>
                  <div className="flex items-center gap-3">
                    {/* Grande case à cocher tactile */}
                    <button onClick={() => toggleCotise(m.id)} disabled={dis}
                      aria-label={isCotise ? 'Décocher (n\'a pas cotisé)' : 'Cocher (a cotisé)'}
                      className={clsx('w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0 transition-all',
                        dis && 'opacity-60 cursor-not-allowed',
                        isCotise ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-red-300 text-red-400')}>
                      {isCotise ? <CheckSquare size={20}/> : <XSquare size={20}/>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('font-semibold text-sm truncate', isCotise ? 'text-green-800' : 'text-red-700')}>
                        {m.nom} {m.prenom} <span className="text-xs font-normal text-gray-400">x{m.nombreParts} part(s)</span>
                      </p>
                      <p className={clsx('text-sm font-bold', isCotise ? 'text-green-700' : 'text-red-600')}>{fmt(m.montantDu)}</p>
                    </div>
                    <span className={clsx('text-xs font-bold px-2 py-1 rounded-full shrink-0', isCotise ? 'bg-green-600 text-white' : 'bg-red-500 text-white')}>
                      {isCotise ? 'A cotisé' : 'Défaillant'}
                    </span>
                  </div>
                  {/* Mode de paiement — seulement si a cotisé */}
                  {isCotise && (
                    <div className="mt-2 pl-[52px] flex flex-wrap items-center gap-2">
                      <select className="select text-xs py-1.5 flex-1 min-w-[140px]" disabled={dis}
                        value={mode.modePaiement}
                        onChange={e => setModePaiementMembre(m.id, { modePaiement: e.target.value, detailsPaiement: '' })}>
                        {MODES_PAIEMENT.map(mp => <option key={mp.value} value={mp.value}>{mp.label}</option>)}
                      </select>
                      {modeCfg?.detail && (
                        <input className="input text-xs py-1.5 flex-1 min-w-[140px]" disabled={dis}
                          placeholder={modeCfg.detailPlaceholder || 'Référence'}
                          value={mode.detailsPaiement}
                          onChange={e => setModePaiementMembre(m.id, { detailsPaiement: e.target.value })}/>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bilan */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-green-50 rounded-xl text-center border border-green-100">
              <p className="text-lg font-bold text-green-700">{cotises.length}</p>
              <p className="text-xs text-green-600">Cotisé(s)</p>
              <p className="text-xs font-semibold text-green-800 mt-0.5">{fmt(totalCollecte)}</p>
            </div>
            <div className="p-2.5 bg-red-50 rounded-xl text-center border border-red-100">
              <p className="text-lg font-bold text-red-600">{defaillants.length}</p>
              <p className="text-xs text-red-500">Défaillant(s)</p>
            </div>
            <div className="p-2.5 bg-gray-50 rounded-xl text-center border border-gray-200">
              <p className="text-lg font-bold text-gray-500">{nonRenseignes.length}</p>
              <p className="text-xs text-gray-400">Non renseigné</p>
            </div>
          </div>

          {/* Sanction */}
          {defaillants.length > 0 && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5"><ShieldAlert size={13}/> Amende pour {defaillants.length} défaillant(s)</p>
              <input type="number" className="input text-sm"
                placeholder={`Défaut : 10% = ${fmt(Math.round((membresDeLatontine[0]?.montantDu||0)*0.1))}`}
                value={sanctionMontant} onChange={e => setSanctionMontant(e.target.value)}/>
            </div>
          )}
          {nonRenseignes.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl text-xs text-amber-700 border border-amber-200">
              <AlertTriangle size={13}/> <strong>{nonRenseignes.length}</strong> non renseigné(s) — non enregistrés.
            </div>
          )}

          {!locked && !readOnly && (
            <button onClick={() => runGuarded(handleValiderFeuille)}
              disabled={cotises.length + defaillants.length === 0 || busyCotisationBenef}
              className={clsx('btn-primary w-full justify-center', (cotises.length + defaillants.length === 0 || busyCotisationBenef) && 'opacity-40 cursor-not-allowed')}>
              <ClipboardCheck size={15}/> {busyCotisationBenef ? 'Enregistrement…' : <>Valider et désigner le bénéficiaire {TYPE_ICONS[typeAttr]}</>}
            </button>
          )}
        </div>
      )}

      {/* ── ÉTAPE 3 : Désignation du bénéficiaire ── */}
      {etape === 'beneficiaire' && tontineSelectee && (
        <div className="space-y-4">
          {/* Pipeline visuel */}
          <div className="flex items-center gap-1 text-xs">
            <div className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">
              <CheckCircle size={11}/><span>Cotisations OK</span>
            </div>
            <ChevronRight size={12} className="text-gray-300"/>
            <div className="flex items-center gap-1 px-2.5 py-1 bg-primary-600 text-white rounded-full font-bold">
              <span>{TYPE_ICONS[typeAttr]}</span><span>Bénéficiaire</span>
            </div>
            <ChevronRight size={12} className="text-gray-300"/>
            <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-400 rounded-full">
              <span>3</span><span>Résumé</span>
            </div>
          </div>

          {/* Bandeau tontine */}
          <div className={clsx('p-3 rounded-xl border-2 text-center', TYPE_COLORS[typeAttr])}>
            <p className="text-2xl mb-1">{TYPE_ICONS[typeAttr]}</p>
            <p className="font-bold">{tontineSelectee.nom}</p>
            <p className="text-xs mt-0.5 opacity-75">{TYPE_LABELS[typeAttr]} · Pot : <strong>{fmt(montantPot)}</strong></p>
          </div>

          {/* ROTATION */}
          {typeAttr === 'rotation' && (
            <div className="space-y-3">
              {tourPlanifieProchain && !choixManuel ? (
                <>
                  <div className="p-4 bg-white rounded-2xl border-2 border-primary-400 text-center shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">Bénéficiaire planifié — Tour N°{tourPlanifieProchain.numeroTour}</p>
                    <p className="text-2xl font-black text-gray-800 mt-1">{tourPlanifieProchain.nomMembre}</p>
                    <p className="text-sm font-bold text-primary-600 mt-1">{fmt(montantPot)}</p>
                  </div>
                  <button onClick={() => runGuarded(handleConfirmerRotation)} disabled={busyCotisationBenef} className="btn-primary w-full justify-center">
                    <Trophy size={15}/> {busyCotisationBenef ? 'Encaissement…' : 'Confirmer et encaisser le tour'}
                  </button>
                  <p className="text-xs text-gray-400 text-center">L'ordre a été défini au préalable dans le module Tontines.</p>
                  <button onClick={() => { setChoixManuel(true); setBeneficiaireManuelId(''); }} disabled={busyCotisationBenef}
                    className="text-xs text-gray-400 hover:text-gray-600 w-full text-center hover:underline">
                    Choisir un autre bénéficiaire manuellement (dérogation)
                  </button>
                </>
              ) : (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                  {!tourPlanifieProchain && (
                    <>
                      <AlertCircle size={24} className="mx-auto text-amber-500"/>
                      <p className="font-semibold text-amber-800 text-sm text-center">Aucun tour planifié</p>
                      <p className="text-xs text-amber-600 text-center">Allez dans Tontines - Bénéficiaires pour définir l'ordre de rotation, ou désignez un bénéficiaire manuellement ci-dessous.</p>
                    </>
                  )}
                  <p className="text-xs font-semibold text-amber-700">Désignation manuelle — un membre avec plusieurs parts reste éligible tant qu'il lui en reste une disponible.</p>
                  <select className="select" value={beneficiaireManuelId} onChange={e => setBeneficiaireManuelId(e.target.value)}>
                    <option value="">— Sélectionner un membre —</option>
                    {membresEligiblesGain.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}{m.nombreParts > 1 ? ` (${m.nombreParts} parts)` : ''}</option>)}
                  </select>
                  <button onClick={() => runGuarded(handleDesignationManuelle)} disabled={!beneficiaireManuelId || busyCotisationBenef} className="btn-primary w-full justify-center">
                    <Trophy size={15}/> {busyCotisationBenef ? 'Confirmation…' : 'Confirmer ce bénéficiaire'}
                  </button>
                  <div className="flex justify-between">
                    {tourPlanifieProchain && (
                      <button onClick={() => { setChoixManuel(false); setBeneficiaireManuelId(''); }} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                        Revenir au tour planifié
                      </button>
                    )}
                    <button onClick={() => setEtape('recap')} className="text-xs text-gray-400 hover:text-gray-600 hover:underline ml-auto">
                      Passer sans bénéficiaire
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TIRAGE AU SORT */}
          {typeAttr === 'tirage' && (
            <div className="space-y-3">
              {!choixManuel ? (
                <>
                  <div className="p-4 bg-white rounded-2xl border-2 border-blue-300 text-center">
                    <Dices size={40} className="mx-auto text-blue-400 mb-3"/>
                    <p className="text-sm text-gray-600 mb-1">Désignation aléatoire en séance</p>
                    <p className="text-xs text-gray-400 mb-4">Seuls les membres n'ayant plus aucune part disponible sont exclus.</p>
                    <button onClick={() => runGuarded(handleTirage)} disabled={busyCotisationBenef} className="btn-primary w-full justify-center text-base py-3">
                      <Dices size={18}/>  {busyCotisationBenef ? 'Tirage en cours…' : 'Lancer le tirage maintenant'}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <button onClick={() => { setChoixManuel(true); setBeneficiaireManuelId(''); }}
                      className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                      Choisir le bénéficiaire manuellement
                    </button>
                    <button onClick={() => setEtape('recap')} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                      Passer sans tirage
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                  <p className="text-xs font-semibold text-amber-700">Désignation manuelle (dérogation au tirage aléatoire)</p>
                  <select className="select" value={beneficiaireManuelId} onChange={e => setBeneficiaireManuelId(e.target.value)}>
                    <option value="">— Sélectionner un membre —</option>
                    {membresEligiblesGain.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}{m.nombreParts > 1 ? ` (${m.nombreParts} parts)` : ''}</option>)}
                  </select>
                  <button onClick={() => runGuarded(handleDesignationManuelle)} disabled={!beneficiaireManuelId || busyCotisationBenef} className="btn-primary w-full justify-center">
                    <Trophy size={15}/> {busyCotisationBenef ? 'Confirmation…' : 'Confirmer ce bénéficiaire'}
                  </button>
                  <button onClick={() => { setChoixManuel(false); setBeneficiaireManuelId(''); }} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center hover:underline">
                    Revenir au tirage aléatoire
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ENCHÈRE */}
          {typeAttr === 'enchere' && (
            <div className="space-y-3">
              {/* Saisie en direct — les membres annoncent leur mise en séance,
                  le secrétaire/trésorier la saisit ici au fur et à mesure. */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                <p className="text-xs font-semibold text-blue-700">Enregistrer une enchère en direct</p>
                <div className="grid grid-cols-2 gap-2">
                  <select className="select text-sm" value={nouvelleEnchereMembre} onChange={e => setNouvelleEnchereMembre(e.target.value)}>
                    <option value="">— Membre —</option>
                    {membresEligiblesGain
                      .filter(m => !encheresEnAttente.some(e => e.idMembre === m.id))
                      .map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}{m.nombreParts > 1 ? ` (${m.nombreParts} parts)` : ''}</option>)}
                  </select>
                  <input type="number" min="0" max={cycleActuel?.montantCollecteReel || cycleActuel?.montantCollectePrevu || undefined} className="input text-sm" placeholder="Montant (FCFA)"
                    value={nouvelleEnchereMontant} onChange={e => setNouvelleEnchereMontant(e.target.value)}/>
                </div>
                <select className="select text-sm" value={nouvelleEnchereCaisseId} onChange={e => setNouvelleEnchereCaisseId(e.target.value)}>
                  <option value="">— Caisse bénéficiaire de l'enchère —</option>
                  {banques.filter(c => c.statut !== 'inactive').map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                <button onClick={() => runGuarded(handleAjouterEnchere)} disabled={!nouvelleEnchereMembre || !nouvelleEnchereMontant || !nouvelleEnchereCaisseId || busyCotisationBenef}
                  className="btn-secondary w-full justify-center text-sm">
                  <Gavel size={14}/> {busyCotisationBenef ? 'Ajout…' : 'Ajouter cette enchère'}
                </button>
              </div>

              {encheresEnAttente.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-gray-600">Enchères enregistrées — la meilleure offre est proposée automatiquement :</p>
                  {encheresEnAttente.map(e => (
                    <label key={e.id}
                      className={clsx('flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                        enchereIdGagnant === e.id ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300',
                        meilleureEnchere?.id === e.id && 'ring-1 ring-amber-300')}>
                      <input type="radio" name="enc_gagnant" value={e.id}
                        checked={enchereIdGagnant === e.id}
                        onChange={() => { setEnchereIdGagnant(String(e.id)); setMiseGagnante(String(e.montantEnchere)); }}/>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{e.nomMembre}</p>
                        <p className="text-xs text-gray-500">Mise : <strong className="text-amber-600">{fmt(e.montantEnchere)}</strong></p>
                      </div>
                      {meilleureEnchere?.id === e.id && <Badge variant="amber">Meilleure offre</Badge>}
                    </label>
                  ))}
                  <button onClick={() => runGuarded(handleCloturerEncheres)} disabled={busyCotisationBenef} className="btn-primary w-full justify-center">
                    <Trophy size={15}/> {busyCotisationBenef ? 'Clôture…' : 'Clôturer les enchères — attribuer au meilleur offrant'}
                  </button>
                  {enchereIdGagnant && (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gray-50 rounded-lg"><span className="text-gray-400">Pot total</span><br/><strong>{fmt(montantPot)}</strong></div>
                        <div className="p-2 bg-amber-50 rounded-lg"><span className="text-gray-400">Mise retenue</span><br/><strong className="text-amber-600">{fmt(Number(miseGagnante))}</strong></div>
                        <div className="col-span-2 p-2 bg-green-50 rounded-lg"><span className="text-gray-400">Net versé au gagnant</span><br/><strong className="text-green-600 text-base">{fmt(montantPot - Number(miseGagnante))}</strong></div>
                      </div>
                      <button onClick={() => {
                        const enc = encheres.find(e => e.id === enchereIdGagnant);
                        if (enc) runGuarded(() => handleConfirmerEnchere(enc.idPart));
                      }} disabled={busyCotisationBenef} className="btn-secondary w-full justify-center">
                        <Trophy size={15}/> {busyCotisationBenef ? 'Désignation…' : 'Désigner manuellement cette offre'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                // Saisie manuelle
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                  <p className="text-xs font-semibold text-amber-700">Aucune offre saisie — enregistrer puis désigner manuellement une offre (dérogation)</p>
                  <select className="select" value={enchereIdGagnant} onChange={e => setEnchereIdGagnant(e.target.value)}>
                    <option value="">— Sélectionner le gagnant —</option>
                    {membresEligiblesGain.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}{m.nombreParts > 1 ? ` (${m.nombreParts} parts)` : ''}</option>)}
                  </select>
                  <input type="number" className="input" placeholder="Montant de la mise gagnante (FCFA)"
                    value={miseGagnante} onChange={e => setMiseGagnante(e.target.value)}/>
                  <select className="select" value={miseGagnanteCaisseId} onChange={e => setMiseGagnanteCaisseId(e.target.value)}>
                    <option value="">— Caisse bénéficiaire de l'enchère —</option>
                    {banques.filter(c => c.statut !== 'inactive').map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                  {enchereIdGagnant && miseGagnante && (() => {
                    const m = membres.find(x => x.id === enchereIdGagnant);
                    return m ? (
                      <button onClick={() => runGuarded(handleEnregistrerEtDesignerManuellement)} disabled={busyCotisationBenef}
                        className="btn-primary w-full justify-center">
                        <Trophy size={15}/> {busyCotisationBenef ? 'Enregistrement…' : "Enregistrer l'offre et désigner le gagnant"}
                      </button>
                    ) : null;
                  })()}
                </div>
              )}
              <button onClick={() => setEtape('recap')} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center hover:underline">
                Passer sans désigner
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ÉTAPE 4 : Récapitulatif ── */}
      {etape === 'recap' && tontineSelectee && (
        <div className="space-y-4">
          {/* Pipeline complet */}
          <div className="flex items-center gap-1 text-xs justify-center">
            {['Cotisations', 'Bénéficiaire', 'Résumé'].map((s, i) => (
              <>
                <div key={s} className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  <CheckCircle size={11}/><span>{s} OK</span>
                </div>
                {i < 2 && <ChevronRight key={`a${i}`} size={12} className="text-gray-300"/>}
              </>
            ))}
          </div>

          <div className="p-4 bg-green-50 rounded-2xl border border-green-200 text-center">
            <CheckCircle size={32} className="mx-auto text-green-500 mb-2"/>
            <p className="font-bold text-green-800">Séance traitée !</p>
            <p className="text-xs text-green-600 mt-1">{tontineSelectee.nom} — Séance N°{reunion.numero}</p>
          </div>

          <div className="space-y-2">
            {cotises.length > 0 && (
              <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs font-bold text-green-700 mb-1.5 flex items-center gap-1"><Banknote size={12}/> {cotises.length} cotisation(s) — {fmt(totalCollecte)}</p>
                {cotises.map(m => (
                  <div key={m.id} className="flex justify-between text-xs py-1 border-b border-green-100 last:border-0">
                    <span className="text-green-800 font-medium">{m.nom} {m.prenom}</span>
                    <span className="font-bold text-green-700">{fmt(m.montantDu)}</span>
                  </div>
                ))}
              </div>
            )}

            {gagnant && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
                <Trophy size={20} className="text-amber-500 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-900 text-sm">{gagnant.nomMembre}</p>
                  <p className="text-xs text-amber-600">
                    {TYPE_ICONS[typeAttr]} {TYPE_LABELS[typeAttr]} ·{' '}
                    {gagnant.mise ? `Mise ${fmt(gagnant.mise)} - Net ${fmt(gagnant.montantPot)}` : fmt(gagnant.montantPot)}
                  </p>
                </div>
                {gagnant.idBulletin && (
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button onClick={() => { setModeVersement('especes'); setReferenceVersement(''); setVersementModal(true); }}
                      className="text-xs px-2.5 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                      Verser le gain
                    </button>
                    <button onClick={() => { setRetenueLibelle(''); setRetenueMontant(''); setRetenueCaisseId(''); setRetenueModal(true); }}
                      className="text-xs px-2.5 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-50">
                      + Retenue
                    </button>
                    <button onClick={async () => { const url = await ouvrirBulletinPdf(gagnant.idBulletin); if (url) setBulletinUrl(url); }}
                      className="text-xs px-2.5 py-1.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 flex items-center gap-1">
                      <FileText size={12}/> Bulletin
                    </button>
                  </div>
                )}
              </div>
            )}

            {defaillants.length > 0 && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                <p className="text-xs font-bold text-red-700 mb-1"><ShieldAlert size={12} className="inline mr-1"/>{defaillants.length} sanction(s)</p>
                {defaillants.map(m => <p key={m.id} className="text-xs text-red-600">- {m.nom} {m.prenom}</p>)}
              </div>
            )}
          </div>

          <button onClick={reset} className="btn-secondary w-full justify-center text-sm">
            <ClipboardList size={14}/> Traiter une autre tontine
          </button>
        </div>
      )}

      <Modal open={!!bulletinUrl} onClose={() => setBulletinUrl(null)} title="Bulletin de gain" size="xl">
        {bulletinUrl && (
          <iframe src={bulletinUrl} title="Bulletin de gain" className="w-full rounded-xl border border-gray-200" style={{ height: '75vh' }} />
        )}
      </Modal>

      <Modal open={versementModal} onClose={() => setVersementModal(false)} title="Verser le gain au bénéficiaire"
        footer={<>
          <button onClick={() => setVersementModal(false)} disabled={busyPaiement} className="btn-secondary">Annuler</button>
          <button onClick={async () => {
            if (busyPaiement) return;
            setBusyPaiement(true);
            try {
              const bulletin = await payerBulletin(gagnant.idBulletin, modeVersement, referenceVersement);
              if (bulletin) setVersementModal(false);
            } finally { setBusyPaiement(false); }
          }} disabled={busyPaiement || (modeVersement !== 'especes' && !referenceVersement.trim())} className="btn-primary">{busyPaiement ? 'Versement…' : 'Confirmer le versement'}</button>
        </>}>
        <p className="text-xs text-gray-500 mb-4">Le net sort de la caisse de la tontine et les retenues sont imputées dans le PV.</p>
        <FormField label="Mode de versement" required>
          <select className="select" value={modeVersement} onChange={e => setModeVersement(e.target.value)}>
            <option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="mobile_money">Mobile Money</option><option value="carte_bancaire">Carte bancaire</option>
          </select>
        </FormField>
        {modeVersement !== 'especes' && <FormField label="Référence du paiement" required><input className="input" value={referenceVersement} onChange={e => setReferenceVersement(e.target.value)} /></FormField>}
      </Modal>

      <Modal open={retenueModal} onClose={() => setRetenueModal(false)} title="Ajouter une retenue manuelle"
        footer={<>
          <button onClick={() => setRetenueModal(false)} disabled={busyPaiement} className="btn-secondary">Annuler</button>
          <button
            onClick={async () => {
              if (busyPaiement) return;
              if (!retenueLibelle.trim() || !retenueMontant || Number(retenueMontant) <= 0) return;
              setBusyPaiement(true);
              try {
                const b = await ajouterRetenueBulletin(gagnant.idBulletin, retenueLibelle.trim(), retenueMontant, retenueCaisseId);
                if (b) setRetenueModal(false);
              } finally { setBusyPaiement(false); }
            }}
            disabled={busyPaiement || !retenueLibelle.trim() || !retenueMontant || Number(retenueMontant) <= 0 || !retenueCaisseId}
            className={clsx('btn-primary', (busyPaiement || !retenueLibelle.trim() || !retenueMontant || Number(retenueMontant) <= 0 || !retenueCaisseId) && 'opacity-40 cursor-not-allowed')}>
            {busyPaiement ? 'Ajout…' : 'Ajouter'}
          </button>
        </>}>
        <p className="text-xs text-gray-500 mb-3">
          Priorité 5 du cahier des charges — frais d'organisation, décision d'AG, ou toute autre
          obligation non couverte automatiquement (prêt, sanction, mutuelle, assurance). Possible
          uniquement avant toute signature du bulletin.
        </p>
        <FormField label="Libellé" required>
          <input className="input" placeholder="Ex : Frais d'organisation réunion (hôte)" value={retenueLibelle} onChange={e => setRetenueLibelle(e.target.value)} autoFocus/>
        </FormField>
        <FormField label="Montant (FCFA)" required>
          <input type="number" className="input" placeholder="10000" value={retenueMontant} onChange={e => setRetenueMontant(e.target.value)}/>
        </FormField>
        <FormField label="Caisse de destination" required hint="La retenue sera affectée à cette caisse au moment du versement.">
          <select className="select" value={retenueCaisseId} onChange={e => setRetenueCaisseId(e.target.value)}>
            <option value="">— Sélectionner une caisse —</option>
            {banques.filter(caisse => caisse.statut === 'active').map(caisse => (
              <option key={caisse.id} value={caisse.id}>{caisse.nom} — solde {fmt(caisse.totalSolde)}</option>
            ))}
          </select>
        </FormField>
      </Modal>
    </div>
  );
}

function RapportSeance({ reunion, transactions, membres, onClose }) {
  const { tontines, cyclesTontine, banques } = useApp();
  const txs = transactions.filter(t => t.idReunion === reunion.id);

  // reunion.beneficiairesSeance n'a jamais existé côté API — dérivé ici de la vraie
  // source de vérité (cyclesTontine), comme dans FeuillePresenceTontine.
  const beneficiairesSeance = useMemo(() => (cyclesTontine || [])
    .filter(c => c.idReunion === reunion.id && c.statut === 'clos')
    .map(c => {
      const t = tontines.find(tt => tt.id === c.idTontine);
      return {
        idTontine: c.idTontine, nomTontine: t?.nom || '',
        typeAttribution: t?.typeAttribution, nomMembre: c.gagnantNom,
        numeroTour: c.numeroCycle, montantEnchere: c.montantEnchere,
        montantPot: c.montantCollecteReel, dateAttrib: c.dateCloture, idBulletin: c.idBulletin,
      };
    }), [cyclesTontine, tontines, reunion.id]);

  // Le PV est un document de contrôle : chaque mouvement doit être rattaché à
  // sa caisse. Les mouvements sans caisse restent visibles dans un groupe dédié
  // plutôt que d'être confondus avec une caisse réelle.
  const transactionsParCaisse = useMemo(() => {
    const groupes = new Map();
    txs.forEach((tx) => {
      const idCaisse = tx.idCaisse || tx.idBanque || null;
      const caisse = banques.find((b) => b.id === idCaisse);
      const cle = idCaisse || '__sans_caisse__';
      if (!groupes.has(cle)) {
        groupes.set(cle, {
          idCaisse,
          nomCaisse: tx.nomCaisse || caisse?.nom || 'Sans caisse affectée',
          items: [],
        });
      }
      groupes.get(cle).items.push(tx);
    });

    return [...groupes.values()].map((groupe) => {
      const totalEntrees = groupe.items
        .filter((tx) => TX_TYPES.find((type) => type.value === tx.type)?.dir === 'entree')
        .reduce((somme, tx) => somme + tx.montant, 0);
      const totalSorties = groupe.items
        .filter((tx) => TX_TYPES.find((type) => type.value === tx.type)?.dir === 'sortie')
        .reduce((somme, tx) => somme + tx.montant, 0);
      const totalBanque = groupe.items
        .filter((tx) => tx.type === 'depot_banque')
        .reduce((somme, tx) => somme + tx.montant, 0);

      return { ...groupe, totalEntrees, totalSorties, totalBanque, soldeNet: totalEntrees - totalSorties };
    });
  }, [txs, banques]);

  const tauxPresence = reunion.cloture && (reunion.cloture.presents + reunion.cloture.absents) > 0
    ? Math.round(reunion.cloture.presents / (reunion.cloture.presents + reunion.cloture.absents) * 100)
    : null;

  return (
    <Modal open={true} onClose={onClose} size="full"
      title={<span className="flex items-center gap-2"><FileText size={18} className="text-primary-600"/>Procès-verbal — Réunion N°{reunion.numero}</span>}
      footer={<>
        <button onClick={() => {
          const popup = window.open('', '_blank');
          request(`/reunions/${reunion.id}/pv-pdf`).then(({ pdf_url: url }) => {
            const origin = API_BASE.replace(/\/api\/?$/, '');
            if (popup) popup.location.href = /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
          }).catch(() => popup?.close());
        }} className="btn-secondary"><Printer size={14}/> Générer le PDF</button>
        <button onClick={onClose} className="btn-primary ml-auto">Fermer</button>
      </>}>
        <div id="rapport-print" className="space-y-5 text-sm">
          {/* En-tête officiel */}
          <div className="text-center border-b-2 border-primary-200 pb-4">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Procès-verbal de séance</p>
            <h2 className="text-xl font-black text-primary-700">RÉUNION N°{reunion.numero}</h2>
            <p className="text-gray-600 mt-1">{fmtDate(reunion.date)} &nbsp;·&nbsp; {reunion.lieu}</p>
          </div>

          {/* Section I — Participants */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">I</span>
              Bureau & Participants
            </h4>
            {reunion.ouverture ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Président de séance :</span><span className="font-semibold ml-1">{reunion.ouverture.presidentSeance}</span></div>
                {reunion.ouverture.secretaireSeance && <div><span className="text-gray-400">Secrétaire :</span><span className="font-semibold ml-1">{reunion.ouverture.secretaireSeance}</span></div>}
                <div><span className="text-gray-400">Heure d'ouverture :</span><span className="font-semibold ml-1">{reunion.ouverture.heureOuverture}</span></div>
                {reunion.cloture?.heureCloture && <div><span className="text-gray-400">Heure de clôture :</span><span className="font-semibold ml-1">{reunion.cloture.heureCloture}</span></div>}
              </div>
            ) : <p className="text-gray-400 italic">Ouverture non renseignée</p>}
            {reunion.cloture && (
              <div className="flex gap-6 mt-3 pt-3 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600">{reunion.cloture.presents}</p>
                  <p className="text-xs text-gray-500">Présents</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{reunion.cloture.absents}</p>
                  <p className="text-xs text-gray-500">Absents</p>
                </div>
                {tauxPresence !== null && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{tauxPresence}%</p>
                    <p className="text-xs text-gray-500">Taux présence</p>
                  </div>
                )}
              </div>
            )}
            {reunion.cloture?.membresAbsents && (
              <p className="text-xs text-red-500 mt-2">Absent(s) : {reunion.cloture.membresAbsents}</p>
            )}
          </div>

          {/* Section II — Ordre du jour */}
          <div>
            <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">II</span>
              Ordre du jour ({reunion.pointsOrdreJour?.length || 0} points)
            </h4>
            {(reunion.pointsOrdreJour || []).length === 0
              ? <p className="text-gray-400 italic text-sm">Aucun point enregistré</p>
              : <div className="space-y-1.5">
                  {(reunion.pointsOrdreJour || []).map((p, i) => (
                    <div key={p.id} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-400 font-mono mt-0.5 shrink-0 w-6">{i + 1}.</span>
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{p.titre}</span>
                        {p.description && <span className="text-gray-500 ml-2 text-xs">— {p.description}</span>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant={typeCfg[p.type]?.v || 'gray'}>{typeCfg[p.type]?.label || p.type}</Badge>
                        <Badge variant={statutPointCfg[p.statut]?.v || 'gray'}>{statutPointCfg[p.statut]?.label || p.statut}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Section III — Transactions financières */}
          <div>
            <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">III</span>
              Transactions financières de la séance ({txs.length})
            </h4>
            {txs.length === 0
              ? <p className="text-gray-400 italic text-sm">Aucune transaction enregistrée pour cette séance</p>
              : (
                <>
                  <div className="space-y-4">
                    {transactionsParCaisse.map((groupe) => (
                      <div key={groupe.idCaisse || '__sans_caisse__'} className="overflow-x-auto rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 border-b border-gray-200">
                          <p className="font-bold text-gray-800">Caisse : {groupe.nomCaisse}</p>
                          <Badge variant={groupe.idCaisse ? 'blue' : 'amber'}>{groupe.items.length} opération(s)</Badge>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-2.5 font-semibold text-gray-600">Heure</th>
                              <th className="text-left p-2.5 font-semibold text-gray-600">Type</th>
                              <th className="text-left p-2.5 font-semibold text-gray-600">Membre</th>
                              <th className="text-left p-2.5 font-semibold text-gray-600">Libellé</th>
                              <th className="text-right p-2.5 font-semibold text-green-600">Entrée</th>
                              <th className="text-right p-2.5 font-semibold text-red-500">Sortie</th>
                              <th className="text-right p-2.5 font-semibold text-blue-600">Banque</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {groupe.items.map((tx) => {
                              const meta = TX_TYPES.find((type) => type.value === tx.type);
                              const isEntree = meta?.dir === 'entree';
                              const isSortie = meta?.dir === 'sortie';
                              const isBanque = tx.type === 'depot_banque';
                              const isImputation = tx.note?.includes('Imputation sur gain');
                              return (
                                <tr key={tx.id} className="hover:bg-gray-50">
                                  <td className="p-2.5 text-gray-400 font-mono">{tx.heure}</td>
                                  <td className="p-2.5"><span>{meta?.icon} {meta?.label || tx.type}{isImputation ? ' (imputation)' : ''}</span></td>
                                  <td className="p-2.5 font-medium text-gray-700">{tx.nomMembre || '—'}</td>
                                  <td className="p-2.5 text-gray-500 italic truncate max-w-[140px]">{tx.libelle || '—'}</td>
                                  <td className="p-2.5 text-right font-bold text-green-600">{isEntree ? fmt(tx.montant) : '—'}</td>
                                  <td className="p-2.5 text-right font-bold text-red-500">{isSortie ? fmt(tx.montant) : '—'}</td>
                                  <td className="p-2.5 text-right font-bold text-blue-600">{isBanque ? fmt(tx.montant) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-xs">
                            <tr>
                              <td colSpan={4} className="p-2.5 text-gray-700">TOTAUX — {groupe.nomCaisse}</td>
                              <td className="p-2.5 text-right text-green-600">{fmt(groupe.totalEntrees)}</td>
                              <td className="p-2.5 text-right text-red-500">{fmt(groupe.totalSorties)}</td>
                              <td className="p-2.5 text-right text-blue-600">{fmt(groupe.totalBanque)}</td>
                            </tr>
                            <tr className="bg-primary-50">
                              <td colSpan={4} className="p-2.5 text-primary-700 font-bold">SOLDE NET — {groupe.nomCaisse}</td>
                              <td colSpan={3} className={clsx('p-2.5 text-right text-base font-black', groupe.soldeNet >= 0 ? 'text-primary-700' : 'text-red-600')}>
                                {groupe.soldeNet >= 0 ? '+' : ''}{fmt(groupe.soldeNet)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}
                  </div>
                </>
              )
            }
          </div>

          {/* Section IV — Bénéficiaires tontine */}
          {(beneficiairesSeance || []).length > 0 && (
            <div>
              <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">IV</span>
                Bénéficiaires de la tontine — Séance N°{reunion.numero}
              </h4>
              <div className="space-y-2">
                {beneficiairesSeance.map((b, i) => {
                  const typeIcon = { rotation: '', tirage: '', enchere: '' }[b.typeAttribution] || '';
                  const typeLabel = { rotation: 'Rotation fixe', tirage: 'Tirage au sort', enchere: 'Enchère' }[b.typeAttribution] || b.typeAttribution;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-xl shrink-0">{typeIcon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-amber-900 text-sm">{b.nomMembre}</p>
                          <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full font-medium">{typeLabel}</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-0.5">Tontine : <strong>{b.nomTontine}</strong> — Tour N°{b.numeroTour}</p>
                        <div className="flex gap-4 mt-1.5 text-xs">
                          {b.montantEnchere > 0 && (
                            <>
                              <span className="text-amber-600">Mise : <strong>{fmt(b.montantEnchere)}</strong></span>
                              <span className="text-green-600">Net reçu : <strong>{fmt(b.montantPot)}</strong></span>
                            </>
                          )}
                          {!b.montantEnchere && (
                            <span className="text-green-600">Montant versé : <strong>{fmt(b.montantPot)}</strong></span>
                          )}
                          <span className="text-gray-500">Le {b.dateAttrib ? new Date(b.dateAttrib).toLocaleDateString('fr-FR') : fmtDate(reunion.date)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section V — Décisions / résolutions */}
          {reunion.cloture?.observation && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold">{(beneficiairesSeance||[]).length > 0 ? 'V' : 'IV'}</span>
                Décisions & observations
              </h4>
              <p className="text-gray-700 italic text-sm">« {reunion.cloture.observation} »</p>
            </div>
          )}

          {/* Signatures du PV */}
          <div className="border-t-2 border-dashed border-gray-200 pt-4 mt-2">
            <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
              <Lock size={12} className={reunion.verrouillee ? 'text-green-600' : 'text-amber-500'}/>
              Signatures {reunion.verrouillee ? '— PV verrouillé définitivement' : '— en attente de signature du Président'}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              {SIGNATAIRES_ATTENDUS.map(slot => {
                const sig = (reunion.signatures || []).find(s => s.role === slot.role);
                return (
                  <div key={slot.role} className={clsx('rounded-xl border p-3', sig ? 'bg-green-50 border-green-200' : 'border-dashed border-gray-200')}>
                    <p className="text-gray-400 mb-1">{acteurRoleLabel[slot.role] || slot.label}</p>
                    {sig ? (
                      <>
                        <p className="font-semibold text-green-700">{sig.nom}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(sig.signeLe).toLocaleString('fr-FR')}</p>
                      </>
                    ) : <p className="italic text-gray-300">Non signé</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
    </Modal>
  );
}

// ── Formulaires intelligents par type de transaction ──────────

const AIDE_SOCIALE_MONTANTS = {
  maladie: 25000, deces_parent: 50000, deces_membre: 100000, mariage: 30000, naissance: 15000, autre: 0,
};
const AIDE_SOCIALE_LABELS = {
  maladie: 'Maladie grave', deces_parent: 'Décès parent proche', deces_membre: 'Décès membre',
  mariage: 'Mariage', naissance: 'Naissance', autre: 'Autre événement',
};

function TypePicker({ onSelect }) {
  const groups = [
    {
      label: ' Entrées de caisse', color: 'green',
      types: TX_TYPES.filter(t => t.dir === 'entree'),
    },
    {
      label: ' Sorties de caisse', color: 'red',
      types: TX_TYPES.filter(t => t.dir === 'sortie'),
    },
    {
      label: ' Opérations bancaires', color: 'blue',
      types: TX_TYPES.filter(t => t.dir === 'banque'),
    },
  ];
  const dirDesc = {
    cotisation:         'Encaissement des parts membres',
    amende:             'Règlement d\'une sanction / pénalité',
    remboursement_pret: 'Remboursement total ou partiel',
    divers_entree:      'Autre recette non catégorisée',
    pret_accorde:       'Octroi d\'un prêt à un membre',
    aide_sociale:       'Maladie, décès, mariage, naissance…',
    attribution_tour:   'Versement du pot au bénéficiaire',
    divers_sortie:      'Autre dépense non catégorisée',
    depot_banque:       'Dépôt des fonds en banque',
  };
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choisir le type de transaction</p>
      {groups.map(g => (
        <div key={g.label}>
          <p className={clsx(
            'text-xs font-bold mb-2 px-2 py-1 rounded-lg inline-block',
            g.color === 'green' ? 'bg-green-100 text-green-700' :
            g.color === 'red'   ? 'bg-red-100 text-red-700'     :
            'bg-blue-100 text-blue-700'
          )}>{g.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.types.map(t => (
              <button key={t.value} onClick={() => onSelect(t.value)}
                className="text-left p-3 rounded-xl border-2 border-gray-100 bg-white hover:border-primary-300 hover:bg-primary-50 transition-all group">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-xs font-bold text-gray-800 group-hover:text-primary-700 leading-tight">{t.label}</span>
                </div>
                <p className="text-xs text-gray-400 leading-snug">{dirDesc[t.value] || ''}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


// ── Wrapper formulaire intelligent (sans hook conditionnel) ────
// Tous les états "extra" sont dans form._idTontine pour éviter
// les hooks conditionnels (violation React)
function SmartFormWrapper({ type, reunion, membres, banques, prets, sanctions, tontines, membresParTontine, soldeDisponible = Infinity, onSubmit, onCancel, submitting = false }) {
  const [form, setForm] = useState({
    type, montant: '', libelle: '', idMembre: '', idSanction: '', idPret: '',
    idBanque: '', sousType: 'autre',
    modePaiement: 'especes', detailsPaiement: '',
    _idTontine: '',   // état partagé pour cotisation + attribution_tour
  });
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const meta = TX_TYPES.find(t => t.value === type);
  const estSortie = meta?.dir === 'sortie' || meta?.dir === 'banque';
  const depasseSoldeCaisse = estSortie && Number(form.montant || 0) > soldeDisponible;

  const handleSubmit = () => {
    if (submitting) return; // clic ignoré : enregistrement déjà en cours
    if (!form.montant || Number(form.montant) <= 0) return;
    if (!isModePaiementValid(form.modePaiement, form.detailsPaiement)) return;
    if (depasseSoldeCaisse) return; // RG-CAI-006 : solde caisse jamais négatif
    if (type === 'remboursement_pret' && !form.idPret) return; // on ne peut pas rembourser « dans le vide »
    if (type === 'pret_accorde' && !form.idMembre) return;
    // Sans caisse choisie, l'argent n'existe nulle part : ni crédité ni débité
    // réellement, juste une ligne de journal — on ne laisse plus passer ça.
    if (type !== 'depot_banque' && type !== 'remboursement_pret' && !form.idBanque) return;
    // Nettoyage des champs internes avant envoi
    const { _idTontine, ...cleanForm } = form;
    onSubmit(cleanForm);
  };

  // Validation selon le type
  const isValid = (() => {
    if (!form.montant || Number(form.montant) <= 0) return false;
    if (!isModePaiementValid(form.modePaiement, form.detailsPaiement)) return false;
    if (depasseSoldeCaisse) return false;
    if (type === 'depot_banque' && !form.idBanque) return false;
    if (type === 'depot_banque' && !form.idMembre) return false;
    if (type === 'attribution_tour' && !form.idMembre) return false;
    if (type === 'remboursement_pret' && !form.idPret) return false;
    if (type === 'pret_accorde' && !form.idMembre) return false;
    if (type !== 'depot_banque' && type !== 'remboursement_pret' && !form.idBanque) return false;
    return true;
  })();

  return (
    <div className="space-y-4">
      <SmartFormFields
        type={type} form={form} sf={sf} reunion={reunion}
        membres={membres} banques={banques} prets={prets} sanctions={sanctions}
        tontines={tontines} membresParTontine={membresParTontine}
      />
      {/* Caisse concernée — obligatoire partout sauf dépôt banque (a son propre
          sélecteur dédié plus riche ci-dessus) et remboursement de prêt (la caisse
          du prêt lui-même fait foi, imposée côté serveur). Sans ce champ, l'argent
          affiché dans le PV de séance n'a jamais réellement existé dans aucune
          caisse — juste une ligne de journal sans contrepartie. */}
      {type !== 'depot_banque' && type !== 'remboursement_pret' && (
        <FormField label="Caisse concernée" required>
          <select className="select" value={form.idBanque} onChange={e => sf('idBanque', e.target.value)}>
            <option value="">— Sélectionner la caisse —</option>
            {banques.map(b => <option key={b.id} value={b.id}>{b.nom} — Solde : {fmt(b.totalSolde)}</option>)}
          </select>
        </FormField>
      )}
      <div className="pt-1 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-3">Règlement — toute entrée/sortie de caisse (RG-CAI-011)</p>
        <ModePaiementFields
          modePaiement={form.modePaiement}
          detailsPaiement={form.detailsPaiement}
          onModeChange={(v) => setForm(f => ({ ...f, modePaiement: v, detailsPaiement: '' }))}
          onDetailsChange={(v) => sf('detailsPaiement', v)}
        />
      </div>
      {form.montant && Number(form.montant) > 0 && (
        <div className={clsx('p-2.5 rounded-xl text-center border',
          depasseSoldeCaisse ? 'bg-red-50 border-red-300 text-red-700' :
          meta?.dir === 'entree' ? 'bg-green-50 border-green-200 text-green-800' :
          meta?.dir === 'sortie' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800')}>
          <p className="text-xs">Montant à enregistrer</p>
          <p className="text-lg font-black">{fmt(Number(form.montant))} FCFA</p>
          {depasseSoldeCaisse && (
            <p className="text-xs font-semibold mt-1">
              Solde de caisse insuffisant — disponible : {fmt(soldeDisponible)} FCFA
            </p>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} disabled={submitting} className="btn-secondary flex-1">Annuler</button>
        <button onClick={handleSubmit} disabled={!isValid || submitting}
          className={clsx('btn-primary flex-1', (!isValid || submitting) && 'opacity-40 cursor-not-allowed')}>
          <CheckCircle size={14}/> {submitting ? 'Enregistrement…' : 'Valider la transaction'}
        </button>
      </div>
    </div>
  );
}

// ── Champs intelligents par type — SANS hook conditionnel ──────
// Tous les hooks sont appelés inconditionnellement en haut.
// Les états "internes" des sous-formulaires (ex: idTontine pour cotisation
// et attribution) sont stockés dans form._idTontine via sf().
function SmartFormFields({ type, form, sf, reunion, membres, banques, prets, sanctions, tontines, membresParTontine }) {
  const meta      = TX_TYPES.find(t => t.value === type);
  const isEntree  = meta?.dir === 'entree';

  // ── Pré-calculs (sans hooks conditionnels) ──────────────────
  const tontinesActives   = tontines.filter(t => t.statut === 'active');
  const tontineChoisie    = tontines.find(t => t.id === form._idTontine);
  const pretsActifs       = prets.filter(p => ['en_cours', 'en_retard'].includes(p.statut));
  const sanctionsImpayees = sanctions.filter(s => s.statut === 'impayee');

  const membresEligiblesCotis = tontineChoisie
    ? (() => {
        // Même bug que les enchères : une ligne par PART côté serveur, il faut
        // regrouper par membre sinon un membre à N parts apparaît N fois.
        const partsParMembre = new Map();
        membresParTontine
          .filter(mt => mt.idTontine === tontineChoisie.id && mt.statut === 'actif')
          .forEach(mt => partsParMembre.set(mt.idMembre, (partsParMembre.get(mt.idMembre) || 0) + mt.nombreParts));
        return [...partsParMembre.entries()]
          .map(([idMembre, parts]) => {
            const m = membres.find(x => x.id === idMembre);
            return m ? { ...m, parts, montantDu: tontineChoisie.cotisation * parts } : null;
          }).filter(Boolean);
      })()
    : membres;

  const membreDansTontine = tontineChoisie && form.idMembre
    ? membresParTontine.find(mt => mt.idTontine === tontineChoisie.id && mt.idMembre === form.idMembre && mt.statut === 'actif')
    : null;

  const membresAttrTour = tontineChoisie
    ? membresParTontine.filter(mt => mt.idTontine === tontineChoisie.id && mt.statut === 'actif')
        .map(mt => membres.find(x => x.id === mt.idMembre)).filter(Boolean)
    : [];

  const pretChoisi        = form.idPret    ? prets.find(p => p.id === form.idPret)        : null;
  const sanctionsMembre   = form.idMembre  ? sanctionsImpayees.filter(s => s.idMembre === form.idMembre) : sanctionsImpayees;

  // ── Handlers ────────────────────────────────────────────────
  const onTontineChange = (val) => {
    sf('_idTontine', val); sf('idMembre', ''); sf('montant', ''); sf('libelle', '');
  };
  const onMembreCotisChange = (val) => {
    sf('idMembre', val);
    const t = tontines.find(x => x.id === form._idTontine);
    if (t && val) {
      const mt = membresParTontine.find(x => x.idTontine === t.id && x.idMembre === val && x.statut === 'actif');
      if (mt) { sf('montant', String(t.cotisation * mt.nombreParts)); sf('libelle', `Cotisation ${t.nom} — ${mt.nombreParts} part(s) — Séance N°${reunion.numero}`); sf('idBanque', t.idCaisse || ''); }
    }
  };
  const onSanctionChange = (val) => {
    sf('idSanction', val);
    const s = sanctions.find(x => x.id === val);
    if (s) { sf('montant', String(s.montant)); sf('libelle', `Amende — ${s.typeSanction} — ${s.nomMembre}`); sf('idMembre', String(s.idMembre)); }
  };
  const onPretChange = (val) => {
    sf('idPret', val);
    const p = prets.find(x => x.id === val);
    if (p) { sf('idMembre', String(p.idMembre)); sf('montant', String(p.resteAPayer)); sf('libelle', `Remboursement prêt — ${p.nomMembre}`); }
  };
  const onTontineAttrChange = (val) => {
    sf('_idTontine', val); sf('idMembre', '');
    const t = tontines.find(x => x.id === val);
    if (t) { sf('montant', String(t.cotisation * t.totalParts)); sf('libelle', `Versement pot — ${t.nom} — Séance N°${reunion.numero}`); sf('idBanque', t.idCaisse || ''); }
  };
  const onBenefChange = (val) => {
    sf('idMembre', val);
    const m = membres.find(x => x.id === val);
    if (m && tontineChoisie) sf('libelle', `Pot ${tontineChoisie.nom} - ${m.nom} ${m.prenom} — Séance N°${reunion.numero}`);
  };
  const onBanqueChange = (val) => {
    sf('idBanque', val);
    const b = banques.find(x => x.id === val);
    const m = membres.find(x => x.id === form.idMembre);
    const depositaire = m ? `${m.nom} ${m.prenom}` : '';
    if (b) sf('libelle', `Dépôt ${b.nom}${depositaire ? ' — ' + depositaire : ''} — Séance N°${reunion.numero}`);
  };
  const onDeposantChange = (val) => {
    sf('idMembre', val);
    const m = membres.find(x => x.id === val);
    const b = banques.find(x => x.id === form.idBanque);
    if (b && m) sf('libelle', `Dépôt ${b.nom} — ${m.nom} ${m.prenom} — Séance N°${reunion.numero}`);
  };
  const onAideEventChange = (val) => {
    sf('sousType', val);
    const def = AIDE_SOCIALE_MONTANTS[val] || 0;
    if (def > 0) sf('montant', String(def));
    const m = membres.find(x => x.id === form.idMembre);
    if (m) sf('libelle', `Aide sociale — ${AIDE_SOCIALE_LABELS[val]} — ${m.nom} ${m.prenom}`);
  };
  const onMembreAideChange = (val) => {
    sf('idMembre', val);
    const m = membres.find(x => x.id === val);
    if (m && form.sousType) sf('libelle', `Aide sociale — ${AIDE_SOCIALE_LABELS[form.sousType] || ''} — ${m.nom} ${m.prenom}`);
  };

  // ── Rendu selon le type ─────────────────────────────────────
  if (type === 'cotisation') return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl border border-green-100">
        <span className="text-lg"></span>
        <div><p className="text-xs font-bold text-green-800">Cotisation membre</p><p className="text-xs text-green-600">Le montant est calculé automatiquement selon les parts</p></div>
      </div>
      {tontinesActives.length > 0 && (
        <FormField label="Tontine concernée">
          <select className="select" value={form._idTontine} onChange={e => onTontineChange(e.target.value)}>
            <option value="">— Cotisation hors tontine —</option>
            {tontinesActives.map(t => <option key={t.id} value={t.id}>{t.nom} — {fmt(t.cotisation)}/part</option>)}
          </select>
        </FormField>
      )}
      <FormField label="Membre" required>
        <select className="select" value={form.idMembre} onChange={e => onMembreCotisChange(e.target.value)}>
          <option value="">— Sélectionner un membre —</option>
          {membresEligiblesCotis.map(m => (
            <option key={m.id} value={m.id}>{m.nom} {m.prenom}{m.parts ? ` — ${m.parts} part(s) - ${fmt(m.montantDu)}` : ''}</option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Montant (FCFA)" required>
          <input className="input" type="number" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
        </FormField>
        {membreDansTontine && tontineChoisie && (
          <div className="p-2.5 bg-green-50 rounded-xl border border-green-200 flex flex-col justify-center">
            <p className="text-xs text-green-600">x{membreDansTontine.nombreParts} parts</p>
            <p className="text-xs font-bold text-green-800">= {fmt(tontineChoisie.cotisation * membreDansTontine.nombreParts)}</p>
          </div>
        )}
      </div>
      <FormField label="Libellé">
        <input className="input" value={form.libelle} onChange={e => sf('libelle', e.target.value)} placeholder="Ex : Cotisation mensuelle"/>
      </FormField>
    </div>
  );

  if (type === 'amende') return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
        <span className="text-lg"></span>
        <div><p className="text-xs font-bold text-amber-800">Paiement d'amende</p><p className="text-xs text-amber-600">Sélectionnez la sanction pour pré-remplir le montant</p></div>
      </div>
      <FormField label="Membre redevable">
        <select className="select" value={form.idMembre} onChange={e => { sf('idMembre', e.target.value); sf('idSanction', ''); sf('montant', ''); }}>
          <option value="">— Tous les membres —</option>
          {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      {sanctionsImpayees.length > 0 && (
        <FormField label="Sanction à régler">
          <select className="select" value={form.idSanction} onChange={e => onSanctionChange(e.target.value)}>
            <option value="">— Saisie manuelle (sans sanction liée) —</option>
            {sanctionsMembre.map(s => <option key={s.id} value={s.id}>{s.nomMembre} — {s.typeSanction} — {fmt(s.montant)}</option>)}
          </select>
        </FormField>
      )}
      {sanctionsImpayees.length === 0 && (
        <div className="p-2 bg-gray-50 rounded-xl text-xs text-gray-400 text-center">Aucune sanction impayée enregistrée</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Montant reçu (FCFA)" required>
          <input className="input" type="number" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
        </FormField>
        <FormField label="Libellé">
          <input className="input" value={form.libelle} onChange={e => sf('libelle', e.target.value)} placeholder="Ex : Amende retard"/>
        </FormField>
      </div>
    </div>
  );

  if (type === 'remboursement_pret') return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl border border-blue-100">
        <span className="text-lg"></span>
        <div><p className="text-xs font-bold text-blue-800">Remboursement de prêt</p><p className="text-xs text-blue-600">Le montant restant est pré-rempli automatiquement</p></div>
      </div>
      {pretsActifs.length === 0
        ? <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400">Aucun prêt actif en cours de remboursement</div>
        : (
          <FormField label="Prêt à rembourser" required>
            <select className="select" value={form.idPret} onChange={e => onPretChange(e.target.value)}>
              <option value="">— Sélectionner un prêt —</option>
              {pretsActifs.map(p => <option key={p.id} value={p.id}>{p.nomMembre} — Reste : {fmt(p.resteAPayer)} {p.statut === 'en_retard' ? '' : ''}</option>)}
            </select>
          </FormField>
        )
      }
      {pretChoisi && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-gray-50 rounded-xl"><p className="text-xs text-gray-400">Prêt initial</p><p className="text-xs font-bold">{fmt(pretChoisi.montantPret)}</p></div>
          <div className="p-2 bg-red-50 rounded-xl"><p className="text-xs text-red-400">Reste dû</p><p className="text-xs font-bold text-red-700">{fmt(pretChoisi.resteAPayer)}</p></div>
          <div className="p-2 bg-green-50 rounded-xl"><p className="text-xs text-green-400">Déjà remboursé</p><p className="text-xs font-bold text-green-700">{fmt(pretChoisi.montantRembourse)}</p></div>
        </div>
      )}
      {pretChoisi && (
        <div className="flex gap-2">
          <button type="button" onClick={() => sf('montant', String(pretChoisi.resteAPayer))} className="text-xs text-blue-600 hover:underline">
            - Rembourser la totalité ({fmt(pretChoisi.resteAPayer)})
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Montant reçu (FCFA)" required>
          <input className="input" type="number" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
        </FormField>
        <FormField label="Libellé">
          <input className="input" value={form.libelle} onChange={e => sf('libelle', e.target.value)}/>
        </FormField>
      </div>
    </div>
  );

  if (type === 'pret_accorde') return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-orange-50 rounded-xl border border-orange-100">
        <span className="text-lg"></span>
        <div><p className="text-xs font-bold text-orange-800">Octroi de prêt</p><p className="text-xs text-orange-600">Décaissement — pensez à l'enregistrer dans Prêts</p></div>
      </div>
      <FormField label="Membre bénéficiaire" required>
        <select className="select" value={form.idMembre} onChange={e => { sf('idMembre', e.target.value); const m = membres.find(x => x.id === e.target.value); if (m) sf('libelle', `Prêt accordé — ${m.nom} ${m.prenom}`); }}>
          <option value="">— Sélectionner un membre —</option>
          {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      <FormField label="Montant accordé (FCFA)" required>
        <input className="input" type="number" placeholder="Ex : 500 000" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
      </FormField>
      <FormField label="Libellé">
        <input className="input" value={form.libelle} onChange={e => sf('libelle', e.target.value)}/>
      </FormField>
      <div className="p-2.5 bg-orange-50 rounded-xl border border-orange-100 text-xs text-orange-700 flex items-center gap-1.5">
        <AlertTriangle size={12}/> Enregistrez aussi ce prêt dans la section <strong>Prêts</strong> pour suivre le remboursement.
      </div>
    </div>
  );

  if (type === 'aide_sociale') return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-pink-50 rounded-xl border border-pink-100">
        <span className="text-lg"></span>
        <div><p className="text-xs font-bold text-pink-800">Aide sociale versée</p><p className="text-xs text-pink-600">Les montants par défaut sont configurés selon l'événement</p></div>
      </div>
      <FormField label="Membre bénéficiaire" required>
        <select className="select" value={form.idMembre} onChange={e => onMembreAideChange(e.target.value)}>
          <option value="">— Sélectionner un membre —</option>
          {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      <FormField label="Type d'événement">
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {Object.entries(AIDE_SOCIALE_LABELS).map(([key, label]) => (
            <button key={key} type="button" onClick={() => onAideEventChange(key)}
              className={clsx('p-2 rounded-xl border-2 text-center transition-all',
                form.sousType === key ? 'border-pink-400 bg-pink-50' : 'border-gray-200 bg-white hover:border-pink-200')}>
              <p className="text-xs font-semibold text-gray-800 leading-tight">{label}</p>
              {AIDE_SOCIALE_MONTANTS[key] > 0 && <p className="text-xs text-pink-600 font-bold mt-0.5">{fmt(AIDE_SOCIALE_MONTANTS[key])}</p>}
            </button>
          ))}
        </div>
      </FormField>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Montant versé (FCFA)" required>
          <input className="input" type="number" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
        </FormField>
        <FormField label="Libellé">
          <input className="input" value={form.libelle} onChange={e => sf('libelle', e.target.value)}/>
        </FormField>
      </div>
    </div>
  );

  if (type === 'attribution_tour') return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-yellow-50 rounded-xl border border-yellow-100">
        <span className="text-lg"></span>
        <div><p className="text-xs font-bold text-yellow-800">Versement du pot</p><p className="text-xs text-yellow-600">Le montant du pot est calculé automatiquement</p></div>
      </div>
      <FormField label="Tontine" required>
        <select className="select" value={form._idTontine} onChange={e => onTontineAttrChange(e.target.value)}>
          <option value="">— Sélectionner la tontine —</option>
          {tontinesActives.map(t => <option key={t.id} value={t.id}>{t.nom} — Pot : {fmt(t.cotisation * t.totalParts)}</option>)}
        </select>
      </FormField>
      {tontineChoisie && (
        <div className="p-2.5 bg-yellow-50 rounded-xl border border-yellow-200 flex justify-between">
          <span className="text-xs text-yellow-700">Pot ({tontineChoisie.totalParts} parts x {fmt(tontineChoisie.cotisation)})</span>
          <span className="text-sm font-black text-yellow-800">{fmt(tontineChoisie.cotisation * tontineChoisie.totalParts)}</span>
        </div>
      )}
      <FormField label="Membre bénéficiaire" required>
        <select className="select" value={form.idMembre} onChange={e => onBenefChange(e.target.value)} disabled={!tontineChoisie}>
          <option value="">— Sélectionner le bénéficiaire —</option>
          {membresAttrTour.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Montant (FCFA)" required>
          <input className="input" type="number" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
        </FormField>
        <FormField label="Libellé">
          <input className="input" value={form.libelle} onChange={e => sf('libelle', e.target.value)}/>
        </FormField>
      </div>
    </div>
  );

  if (type === 'depot_banque') return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 bg-teal-50 rounded-xl border border-teal-100">
        <span className="text-lg"></span>
        <div><p className="text-xs font-bold text-teal-800">Dépôt en banque</p><p className="text-xs text-teal-600">Identifiez le déposant et la banque destinataire</p></div>
      </div>
      {/* DÉPOSANT — champ manquant corrigé */}
      <FormField label="Membre déposant" required>
        <select className="select" value={form.idMembre} onChange={e => onDeposantChange(e.target.value)}>
          <option value="">— Sélectionner le membre déposant —</option>
          {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      <FormField label="Banque de destination" required>
        <div className="grid grid-cols-1 gap-2">
          {banques.map(b => (
            <button key={b.id} type="button" onClick={() => onBanqueChange(String(b.id))}
              className={clsx('p-3 rounded-xl border-2 text-left transition-all',
                form.idBanque === b.id ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-200')}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{b.nom}</p>
                <p className="text-xs text-teal-600 font-bold">Solde : {fmt(b.totalSolde)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>
            </button>
          ))}
        </div>
      </FormField>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Montant à déposer (FCFA)" required>
          <input className="input" type="number" placeholder="Ex : 50 000" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
        </FormField>
        <FormField label="Libellé">
          <input className="input" value={form.libelle} onChange={e => sf('libelle', e.target.value)}/>
        </FormField>
      </div>
      {form.idMembre && form.idBanque && (
        <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-800 flex items-center gap-1.5">
          <CheckCircle size={12}/>
          Dépôt de <strong>{membres.find(m => m.id === form.idMembre)?.nom} {membres.find(m => m.id === form.idMembre)?.prenom}</strong> dans <strong>{banques.find(b => b.id === form.idBanque)?.nom}</strong>
        </div>
      )}
    </div>
  );

  // divers_entree / divers_sortie
  return (
    <div className="space-y-3">
      <div className={clsx('flex items-center gap-2 p-2.5 rounded-xl border',
        isEntree ? 'bg-purple-50 border-purple-100' : 'bg-red-50 border-red-100')}>
        <span className="text-lg">{meta?.icon || ''}</span>
        <div>
          <p className={clsx('text-xs font-bold', isEntree ? 'text-purple-800' : 'text-red-800')}>{meta?.label}</p>
          <p className={clsx('text-xs', isEntree ? 'text-purple-600' : 'text-red-600')}>
            {isEntree ? 'Autre recette non catégorisée' : 'Autre dépense non catégorisée'}
          </p>
        </div>
      </div>
      <FormField label="Libellé / description" required>
        <input className="input"
          placeholder={isEntree ? "Ex : Don, frais d'inscription, droit d'entrée…" : "Ex : Frais de salle, fournitures, déplacement…"}
          value={form.libelle} onChange={e => sf('libelle', e.target.value)}/>
      </FormField>
      <FormField label="Membre concerné (optionnel)">
        <select className="select" value={form.idMembre} onChange={e => sf('idMembre', e.target.value)}>
          <option value="">— Sans membre spécifique —</option>
          {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      <FormField label="Montant (FCFA)" required>
        <input className="input" type="number" placeholder="Ex : 10 000" value={form.montant} onChange={e => sf('montant', e.target.value)}/>
      </FormField>
    </div>
  );
}

// ── Panneau Bénéficiaire de séance ────────────────────────────
function BeneficiaireSeancePanel({ reunion }) {
  const { tontines, cyclesTontine, ouvrirBulletinPdf, ajouterRetenueBulletin, payerBulletin, annulerVersementBulletin, annulerCycle, chargerCycle, saisirCotisationCycle, banques } = useApp();
  const [bulletinUrl, setBulletinUrl] = useState(null);
  const [retenueModal, setRetenueModal] = useState(null); // idBulletin ciblé
  const [retenueLibelle, setRetenueLibelle] = useState('');
  const [retenueMontant, setRetenueMontant] = useState('');
  const [retenueCaisseId, setRetenueCaisseId] = useState('');
  const [versementModal, setVersementModal] = useState(null);
  const [modeVersement, setModeVersement] = useState('especes');
  const [referenceVersement, setReferenceVersement] = useState('');
  const [corrigerModal, setCorrigerModal] = useState(null); // idCycle ciblé
  const [cotisationsCorrection, setCotisationsCorrection] = useState([]); // [{id, nomMembre, montantDu, montantVerse}]
  const [chargementCorrection, setChargementCorrection] = useState(false);
  const [enregistrementCorrection, setEnregistrementCorrection] = useState(false);
  const [busyPaiement, setBusyPaiement] = useState(false); // anti double-clic : versement / retenue bulletin

  // Onglet purement informatif : affiche le(s) bénéficiaire(s) déjà désigné(s)
  // cette séance, quel que soit le mode d'attribution (rotation/tirage/enchère).
  // La désignation elle-même se fait exclusivement dans l'onglet Feuille
  // Cotisation — ce panneau ne doit JAMAIS ouvrir ou clôturer de cycle lui-même,
  // pour éviter tout risque de double-désignation en parallèle du flux principal.
  const beneficiairesSeance = useMemo(() => (cyclesTontine || [])
    .filter(c => c.idReunion === reunion.id && c.statut === 'clos')
    .map(c => {
      const t = tontines.find(tt => tt.id === c.idTontine);
      return {
        idCycle: c.id,
        idTontine: c.idTontine, nomTontine: t?.nom || '',
        typeAttribution: t?.typeAttribution, nomMembre: c.gagnantNom,
        numeroTour: c.numeroCycle, montantEnchere: c.montantEnchere,
        montantPot: c.montantCollecteReel, dateAttrib: c.dateCloture, idBulletin: c.idBulletin,
        statutBulletin: c.statutBulletin,
      };
    }), [cyclesTontine, tontines, reunion.id]);

  const typeLabel = { rotation: 'Rotation', tirage: 'Tirage au sort', enchere: 'Enchère' };

  // Erreur de saisie sur la feuille de cotisation (membre coché à tort, ou oublié) :
  // reste corrigeable même après désignation du bénéficiaire, tant que le bulletin
  // n'a pas été versé ni signé (voir TontineCycleService::assertCotisationCorrigeable
  // côté serveur, qui reste la source de vérité — ce panneau ne fait que la refléter).
  const ouvrirCorrection = async (idCycle) => {
    setCorrigerModal(idCycle);
    setChargementCorrection(true);
    const cycle = await chargerCycle(idCycle);
    setCotisationsCorrection((cycle?.cotisations || []).map(co => ({
      id: co.id, nomMembre: co.nomMembre || '', montantDu: co.montantDu,
      montantVerse: co.montantVerse, statut: co.statut,
    })));
    setChargementCorrection(false);
  };

  const enregistrerCorrections = async () => {
    setEnregistrementCorrection(true);
    for (const c of cotisationsCorrection) {
      await saisirCotisationCycle(corrigerModal, c.id, c.montantVerse);
    }
    setEnregistrementCorrection(false);
    setCorrigerModal(null);
  };

  return (
    <div className="space-y-4">
      {beneficiairesSeance.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bénéficiaires désignés cette séance</p>
          {beneficiairesSeance.map((b, i) => (
            <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
              <Trophy size={18} className="text-amber-500 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-amber-900">{b.nomMembre}</p>
                <p className="text-xs text-amber-700">{b.nomTontine} — {typeLabel[b.typeAttribution] || b.typeAttribution}</p>
                {b.montantEnchere > 0 && <p className="text-xs text-amber-600">Mise : {fmt(b.montantEnchere)} | Net reçu : {fmt(b.montantPot)}</p>}
                {!b.montantEnchere && <p className="text-xs text-amber-600">Montant : {fmt(b.montantPot)}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <button onClick={() => ouvrirCorrection(b.idCycle)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg font-medium hover:bg-blue-50">
                  Corriger cotisations
                </button>
                {b.idBulletin && (
                  <>
                  {b.statutBulletin !== 'paye' && (
                    <button onClick={() => { setModeVersement('especes'); setReferenceVersement(''); setVersementModal(b.idBulletin); }}
                      className="text-xs px-2.5 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                      Verser le gain
                    </button>
                  )}
                  <button onClick={() => { setRetenueLibelle(''); setRetenueMontant(''); setRetenueCaisseId(''); setRetenueModal(b.idBulletin); }}
                    className="text-xs px-2.5 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-50">
                    + Retenue
                  </button>
                  <button onClick={async () => { const url = await ouvrirBulletinPdf(b.idBulletin); if (url) setBulletinUrl(url); }}
                    className="text-xs px-2.5 py-1.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 flex items-center gap-1">
                    <FileText size={12}/> Bulletin
                  </button>
                  {b.statutBulletin === 'paye' && (
                    <button onClick={() => {
                      if (window.confirm('Annuler le versement de ce gain ? Le net et les retenues (transferts, prêt, sanctions) seront contre-passés, et le bulletin repassera au statut « généré ».')) annulerVersementBulletin(b.idBulletin);
                    }} className="text-xs px-2.5 py-1.5 bg-orange-50 text-orange-700 border border-orange-300 rounded-lg font-medium hover:bg-orange-100">
                      Annuler le versement
                    </button>
                  )}
                  <button onClick={() => {
                    if (window.confirm('Annuler ce cycle ? Le bénéficiaire et les cotisations pourront être corrigés.')) annulerCycle(b.idCycle, b.idBulletin);
                  }} className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100">
                    Annuler
                  </button>
                  </>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full font-medium">OK Confirmé</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center text-sm text-gray-500 space-y-1">
          <Trophy size={22} className="mx-auto text-gray-300 mb-1"/>
          <p>Aucun bénéficiaire désigné pour l'instant cette séance.</p>
          <p className="text-xs text-gray-400">La désignation (rotation, tirage au sort ou enchère) se fait dans l'onglet « Feuille Cotisation ».</p>
        </div>
      )}

      <Modal open={!!bulletinUrl} onClose={() => setBulletinUrl(null)} title="Bulletin de gain" size="xl">
        {bulletinUrl && (
          <iframe src={bulletinUrl} title="Bulletin de gain" className="w-full rounded-xl border border-gray-200" style={{ height: '75vh' }} />
        )}
      </Modal>

      <Modal open={!!versementModal} onClose={() => setVersementModal(null)} title="Verser le gain au bénéficiaire"
        footer={<>
          <button onClick={() => setVersementModal(null)} disabled={busyPaiement} className="btn-secondary">Annuler</button>
          <button onClick={async () => {
            if (busyPaiement) return;
            setBusyPaiement(true);
            try {
              const bulletin = await payerBulletin(versementModal, modeVersement, referenceVersement);
              if (bulletin) setVersementModal(null);
            } finally { setBusyPaiement(false); }
          }} disabled={busyPaiement || (modeVersement !== 'especes' && !referenceVersement.trim())} className="btn-primary">{busyPaiement ? 'Versement…' : 'Confirmer le versement'}</button>
        </>}>
        <p className="text-xs text-gray-500 mb-4">
          Le net est décaissé de la caisse de la tontine. Les retenues sont imputées et apparaissent dans le PV.
        </p>
        <FormField label="Mode de versement" required>
          <select className="select" value={modeVersement} onChange={e => setModeVersement(e.target.value)}>
            <option value="especes">Espèces</option>
            <option value="cheque">Chèque</option>
            <option value="virement">Virement</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="carte_bancaire">Carte bancaire</option>
          </select>
        </FormField>
        {modeVersement !== 'especes' && (
          <FormField label="Référence du paiement" required>
            <input className="input" value={referenceVersement} onChange={e => setReferenceVersement(e.target.value)} placeholder="N° de transaction, chèque ou bordereau" />
          </FormField>
        )}
      </Modal>

      <Modal open={!!retenueModal} onClose={() => setRetenueModal(null)} title="Ajouter une retenue manuelle"
        footer={<>
          <button onClick={() => setRetenueModal(null)} disabled={busyPaiement} className="btn-secondary">Annuler</button>
          <button
            onClick={async () => {
              if (busyPaiement) return;
              if (!retenueLibelle.trim() || !retenueMontant || Number(retenueMontant) <= 0) return;
              setBusyPaiement(true);
              try {
                const b = await ajouterRetenueBulletin(retenueModal, retenueLibelle.trim(), retenueMontant, retenueCaisseId);
                if (b) setRetenueModal(null);
              } finally { setBusyPaiement(false); }
            }}
            disabled={busyPaiement || !retenueLibelle.trim() || !retenueMontant || Number(retenueMontant) <= 0 || !retenueCaisseId}
            className={clsx('btn-primary', (busyPaiement || !retenueLibelle.trim() || !retenueMontant || Number(retenueMontant) <= 0 || !retenueCaisseId) && 'opacity-40 cursor-not-allowed')}>
            {busyPaiement ? 'Ajout…' : 'Ajouter'}
          </button>
        </>}>
        <p className="text-xs text-gray-500 mb-3">
          Priorité 5 du cahier des charges — frais d'organisation, décision d'AG, ou toute autre
          obligation non couverte automatiquement (prêt, sanction, mutuelle, assurance). Possible
          uniquement avant toute signature du bulletin.
        </p>
        <FormField label="Libellé" required>
          <input className="input" placeholder="Ex : Frais d'organisation réunion (hôte)" value={retenueLibelle} onChange={e => setRetenueLibelle(e.target.value)} autoFocus/>
        </FormField>
        <FormField label="Montant (FCFA)" required>
          <input type="number" className="input" placeholder="10000" value={retenueMontant} onChange={e => setRetenueMontant(e.target.value)}/>
        </FormField>
        <FormField label="Caisse de destination" required hint="La retenue sera affectée à cette caisse au moment du versement.">
          <select className="select" value={retenueCaisseId} onChange={e => setRetenueCaisseId(e.target.value)}>
            <option value="">— Sélectionner une caisse —</option>
            {banques.filter(caisse => caisse.statut === 'active').map(caisse => (
              <option key={caisse.id} value={caisse.id}>{caisse.nom} — solde {fmt(caisse.totalSolde)}</option>
            ))}
          </select>
        </FormField>
      </Modal>

      <Modal open={!!corrigerModal} onClose={() => setCorrigerModal(null)} title="Corriger la feuille de cotisation" size="lg"
        footer={<>
          <button onClick={() => setCorrigerModal(null)} className="btn-secondary">Fermer</button>
          <button onClick={enregistrerCorrections} disabled={chargementCorrection || enregistrementCorrection}
            className={clsx('btn-primary', (chargementCorrection || enregistrementCorrection) && 'opacity-40 cursor-not-allowed')}>
            {enregistrementCorrection ? 'Enregistrement…' : 'Enregistrer les corrections'}
          </button>
        </>}>
        <p className="text-xs text-gray-500 mb-3">
          Corrige une erreur de saisie (membre coché à tort, ou cotisation oubliée) même après
          la désignation du bénéficiaire. Le bulletin de gain est automatiquement recalculé.
          Bloqué si le bulletin est déjà versé ou signé — annulez alors le versement (bouton
          « Verser le gain » → retour des fonds) ou, en dernier recours, le cycle entier.
        </p>
        {chargementCorrection ? (
          <p className="text-sm text-gray-400 text-center py-6">Chargement…</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {cotisationsCorrection.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.nomMembre}</p>
                  <p className="text-xs text-gray-400">Dû : {fmt(c.montantDu)}</p>
                </div>
                <button
                  onClick={() => setCotisationsCorrection(prev => prev.map((x, j) => j === i
                    ? { ...x, montantVerse: x.montantVerse > 0 ? 0 : x.montantDu }
                    : x))}
                  className={clsx('shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium',
                    c.montantVerse > 0 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200')}>
                  {c.montantVerse > 0 ? 'A cotisé' : 'Défaillant'}
                </button>
                <input type="number" className="input w-28 text-sm" value={c.montantVerse}
                  onChange={e => setCotisationsCorrection(prev => prev.map((x, j) => j === i
                    ? { ...x, montantVerse: Number(e.target.value) }
                    : x))}/>
              </div>
            ))}
            {cotisationsCorrection.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Aucune cotisation trouvée pour ce cycle.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Panneau transactions séance ───────────────────────────────
// ── Panneau Présences (RG-REU-016 à 019) ──────────────────────
function PanneauPresences({ reunion, membres }) {
  const { presences, setPresenceMembre } = useApp();
  const locked  = !!reunion.verrouillee;
  const notOpen = reunion.statutReunion === 'planifiee';

  const presencesReunion = presences.filter(p => p.reunionId === reunion.id);
  const getPresence = (idMembre) => presencesReunion.find(p => p.idMembre === idMembre);

  // Durée de retard = arrivée - (heure d'ouverture réelle de la séance).
  const heureOuverture = reunion.ouverture?.heureOuverture;
  const dureeRetard = (heureArrivee) => {
    if (!heureOuverture || !heureArrivee) return null;
    const [ho, mo] = heureOuverture.split(':').map(Number);
    const [ha, ma] = heureArrivee.split(':').map(Number);
    const diff = (ha * 60 + ma) - (ho * 60 + mo);
    if (diff <= 0) return null;
    const h = Math.floor(diff / 60), m = diff % 60;
    return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m} min`;
  };

  const membresActifs = membres.filter(m => m.statut === 'actif');
  const nbPresents = presencesReunion.filter(p => p.statut === 'present' || p.statut === 'en_retard').length;
  const nbAbsentsExcuses = presencesReunion.filter(p => p.statut === 'absent_excuse').length;
  const nbAbsents = presencesReunion.filter(p => p.statut === 'absent').length;
  const nbNonPointes = membresActifs.length - presencesReunion.length;

  const [motifModal, setMotifModal] = useState(null); // {idMembre}
  const [motif, setMotif] = useState('');
  const [heureModal, setHeureModal] = useState(null); // {idMembre}
  const [heureSaisie, setHeureSaisie] = useState('');

  if (notOpen) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Lock size={28} className="text-amber-500"/>
        </div>
        <p className="font-bold text-gray-700">Séance non ouverte</p>
        <p className="text-sm text-gray-400 max-w-xs">Le pointage des présences ne peut se faire qu'une fois la séance ouverte par le président.</p>
      </div>
    );
  }

  const handleStatut = (idMembre, statut) => {
    if (statut === 'absent_excuse') {
      setMotifModal({ idMembre });
      setMotif('');
      return;
    }
    if (statut === 'present') {
      // Heure d'arrivée éditable (pré-remplie avec l'heure actuelle) : le pointage
      // se fait souvent a posteriori, on ne peut pas se fier uniquement à l'heure du clic.
      const existante = getPresence(idMembre);
      setHeureModal({ idMembre });
      setHeureSaisie(existante?.heureArrivee || new Date().toTimeString().slice(0, 5));
      return;
    }
    setPresenceMembre(reunion.id, idMembre, { statut, heureArrivee: '' });
  };

  const confirmHeure = () => {
    setPresenceMembre(reunion.id, heureModal.idMembre, { statut: 'present', heureArrivee: heureSaisie });
    setHeureModal(null);
    setHeureSaisie('');
  };

  const confirmMotif = () => {
    setPresenceMembre(reunion.id, motifModal.idMembre, { statut: 'absent_excuse', motifAbsence: motif });
    setMotifModal(null);
    setMotif('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {[
          { l:'Présents', v:nbPresents, c:'text-green-600', bg:'bg-green-50 border border-green-100' },
          { l:'Excusés',  v:nbAbsentsExcuses, c:'text-amber-600', bg:'bg-amber-50 border border-amber-100' },
          { l:'Absents',  v:nbAbsents, c:'text-red-500', bg:'bg-red-50 border border-red-100' },
          { l:'Non pointés', v:Math.max(0,nbNonPointes), c:'text-gray-500', bg:'bg-gray-50 border border-gray-100' },
        ].map(s => (
          <div key={s.l} className={`p-2.5 rounded-xl text-center ${s.bg}`}>
            <p className={`text-base font-bold ${s.c}`}>{s.v}</p>
            <p className="text-[11px] text-gray-500">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {membresActifs.map(m => {
          const p = getPresence(m.id);
          const statut = p?.statut;
          return (
            <div key={m.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                {m.nom?.[0]}{m.prenom?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{m.nom} {m.prenom}</p>
                {statut === 'absent_excuse' && p.motifAbsence && (
                  <p className="text-[11px] text-amber-600 truncate">Motif : {p.motifAbsence}</p>
                )}
                {(statut === 'present' || statut === 'en_retard') && p.heureArrivee && (
                  <p className="text-[11px] text-gray-400">
                    Arrivée : {p.heureArrivee}
                    {statut === 'en_retard' && dureeRetard(p.heureArrivee) && (
                      <span className="text-red-500 font-medium"> · Retard : {dureeRetard(p.heureArrivee)}</span>
                    )}
                  </p>
                )}
              </div>
              {statut && (
                <Badge variant={STATUTS_PRESENCE.find(s => s.value === statut)?.color || 'gray'}>
                  {statutPresenceLabel[statut] || statut}
                </Badge>
              )}
              {!locked && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleStatut(m.id, 'present')}
                    className={clsx('p-1.5 rounded-lg border', statut === 'present' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-500')}>
                    <CheckSquare size={14}/>
                  </button>
                  <button onClick={() => handleStatut(m.id, 'absent_excuse')}
                    className={clsx('p-1.5 rounded-lg border', statut === 'absent_excuse' ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500')}>
                    <MinusSquare size={14}/>
                  </button>
                  <button onClick={() => handleStatut(m.id, 'absent')}
                    className={clsx('p-1.5 rounded-lg border', statut === 'absent' ? 'bg-red-500 border-red-500 text-white' : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500')}>
                    <XSquare size={14}/>
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {membresActifs.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">Aucun membre actif à pointer.</p>
        )}
      </div>

      <Modal open={!!motifModal} onClose={() => setMotifModal(null)} title="Motif de l'absence excusée"
        footer={<><button onClick={() => setMotifModal(null)} className="btn-secondary">Annuler</button><button onClick={confirmMotif} className="btn-primary">Confirmer</button></>}>
        <FormField label="Motif" required>
          <input className="input" placeholder="Ex : Maladie, voyage, empêchement professionnel…" value={motif} onChange={e => setMotif(e.target.value)} autoFocus/>
        </FormField>
      </Modal>

      <Modal open={!!heureModal} onClose={() => setHeureModal(null)} title="Heure d'arrivée"
        footer={<><button onClick={() => setHeureModal(null)} className="btn-secondary">Annuler</button><button onClick={confirmHeure} className="btn-primary">Confirmer</button></>}>
        <FormField label="Heure d'arrivée" required>
          <input type="time" className="input" value={heureSaisie} onChange={e => setHeureSaisie(e.target.value)} autoFocus/>
        </FormField>
        <p className="text-xs text-gray-400 mt-2">Pré-remplie avec l'heure actuelle — corrige-la si le pointage se fait après coup. Le statut (présent / en retard) est recalculé automatiquement selon l'heure de début de la réunion.</p>
      </Modal>
    </div>
  );
}


// ── Panneau rubrique séance (ex-Transactions, éclaté par rubrique) ──
// Chaque rubrique métier (Remboursement, Prêt, Sanction, Aide sociale,
// Banque, Divers) a maintenant sa propre interface dédiée au lieu d'un
// unique onglet "Transactions" fourre-tout avec sélecteur de type.
// Applique un type de sanction déjà paramétré (Paramètres → Sanctions) à un
// membre pendant la séance — crée une nouvelle sanction (impayée par défaut,
// réglable ensuite via le formulaire "Paiement d'amende" juste en dessous).
function AppliquerSanctionPanel({ reunion, membres, typesSanction, addSanction, showToast }) {
  const [open, setOpen] = useState(false);
  const [idMembre, setIdMembre] = useState('');
  const [idType, setIdType] = useState('');

  const submit = async () => {
    if (!idMembre || !idType) { showToast?.('Sélectionnez un membre et un type de sanction.', 'error'); return; }
    const m = membres.find(x => x.id === idMembre);
    const t = typesSanction.find(x => x.id === idType);
    await addSanction({
      idMembre, nomMembre: m ? `${m.nom} ${m.prenom}` : '',
      typeSanction: idType, motif: t?.libelle, montant: t?.montantFixe || 0,
      numReunion: reunion.id, dateSanction: new Date().toISOString().split('T')[0],
    });
    setIdMembre(''); setIdType(''); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn-secondary w-full justify-center text-sm">
      <AlertTriangle size={14}/> Appliquer une sanction à un membre
    </button>
  );

  if (typesSanction.length === 0) return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
      Aucun type de sanction paramétré. Rendez-vous dans <strong>Sanctions → Paramètres</strong> pour en créer un (ex : « Bavardage — 1000 »), puis revenez ici.
      <button onClick={() => setOpen(false)} className="block mt-2 text-xs text-primary-600 hover:underline">Fermer</button>
    </div>
  );

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800"><AlertTriangle size={14} className="inline mr-1"/>Appliquer une sanction</p>
        <button onClick={() => setOpen(false)} className="text-xs text-primary-600 hover:underline">Annuler</button>
      </div>
      <FormField label="Membre" required>
        <select className="select" value={idMembre} onChange={e => setIdMembre(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      <FormField label="Type de sanction (paramétré)" required>
        <select className="select" value={idType} onChange={e => setIdType(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {typesSanction.map(t => <option key={t.id} value={t.id}>{t.libelle} — {fmt(t.montantFixe || 0)}</option>)}
        </select>
      </FormField>
      <button onClick={submit} className="btn-primary w-full justify-center text-sm"><AlertTriangle size={14}/>Appliquer la sanction</button>
    </div>
  );
}

// Déclare une aide sociale à partir d'un type déjà paramétré (Paramètres →
// Aide sociale) pendant la séance — symétrique à AppliquerSanctionPanel.
// La déclaration crée une demande "en attente" (RG-SOC) ; validation puis
// versement (avec choix de caisse si besoin) se font ensuite depuis l'onglet
// « Aide sociale » (Social.jsx).
function DeclarerAideSocialePanel({ membres, typesAideSociale, banques, addAide, validerAideSociale, verserAideSociale, showToast }) {
  const [open, setOpen] = useState(false);
  const [idMembre, setIdMembre] = useState('');
  const [idType, setIdType] = useState('');
  const [description, setDescription] = useState('');
  const [justificatif, setJustificatif] = useState('');
  const [verserTout, setVerserTout] = useState(false);
  const [idCaisse, setIdCaisse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const typeChoisi = typesAideSociale.find(t => t.id === idType);
  // Si le type a déjà une caisse par défaut (paramétrée), pas besoin de la
  // redemander ici — sinon, on l'exige avant de verser immédiatement.
  const caisseRequise = verserTout && !typeChoisi?.caisseSourceId;

  const reset = () => { setIdMembre(''); setIdType(''); setDescription(''); setJustificatif(''); setVerserTout(false); setIdCaisse(''); setOpen(false); };

  const submit = async () => {
    if (!idMembre || !idType || !description.trim() || !justificatif.trim()) {
      showToast?.('Membre, type, description et justificatif sont requis.', 'error');
      return;
    }
    if (caisseRequise && !idCaisse) {
      showToast?.('Sélectionnez la caisse pour le versement immédiat.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const aide = await addAide({
        idMembre, categorie: idType, description: description.trim(),
        dateDeclaration: new Date().toISOString().split('T')[0],
        montant: typeChoisi?.montantFixe, justificatif: justificatif.trim(),
      });
      if (!aide) return; // erreur déjà affichée (ex: aucun barème configuré)
      if (verserTout) {
        // Enchaîne déclarer → approuver → verser en un clic — pour le cas où la
        // caisse est là et que tout se règle sur place, dans la même réunion.
        await validerAideSociale(aide.id, aide.montantDemande);
        await verserAideSociale(aide.id, { idCaisse: idCaisse || undefined });
      }
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn-secondary w-full justify-center text-sm">
      <HeartHandshake size={14}/> Déclarer une aide sociale pour un membre
    </button>
  );

  if (typesAideSociale.length === 0) return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
      Aucun type d'aide paramétré. Rendez-vous dans <strong>Aide sociale → Paramètres</strong> pour en créer un (ex : « Mariage — 5000 »), puis revenez ici.
      <button onClick={() => setOpen(false)} className="block mt-2 text-xs text-primary-600 hover:underline">Fermer</button>
    </div>
  );

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800"><HeartHandshake size={14} className="inline mr-1"/>Déclarer une aide sociale</p>
        <button onClick={() => setOpen(false)} className="text-xs text-primary-600 hover:underline">Annuler</button>
      </div>
      <FormField label="Membre bénéficiaire" required>
        <select className="select" value={idMembre} onChange={e => setIdMembre(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
        </select>
      </FormField>
      <FormField label="Type d'aide (paramétré)" required>
        <select className="select" value={idType} onChange={e => setIdType(e.target.value)}>
          <option value="">— Sélectionner —</option>
          {typesAideSociale.map(t => <option key={t.id} value={t.id}>{t.libelle} — {fmt(t.montantFixe || 0)}</option>)}
        </select>
      </FormField>
      <FormField label="Description" required>
        <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex : Naissance du 2e enfant"/>
      </FormField>
      <FormField label="Justificatif" required hint="Référence ou lien du document — obligatoire (RG-SOC-006)">
        <input className="input" value={justificatif} onChange={e => setJustificatif(e.target.value)}/>
      </FormField>

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
        <input type="checkbox" checked={verserTout} onChange={e => setVerserTout(e.target.checked)} className="w-4 h-4"/>
        Verser maintenant (la caisse est disponible sur place, en séance)
      </label>
      {caisseRequise && (
        <FormField label="Caisse de versement" required>
          <select className="select" value={idCaisse} onChange={e => setIdCaisse(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {banques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
          </select>
        </FormField>
      )}

      <button onClick={submit} disabled={submitting} className="btn-primary w-full justify-center text-sm">
        <HeartHandshake size={14}/>{submitting ? 'Traitement…' : verserTout ? "Déclarer et verser maintenant" : "Déclarer l'aide"}
      </button>
      <p className="text-xs text-gray-400">
        {verserTout
          ? "L'aide sera immédiatement approuvée et versée, ici même en séance."
          : "La demande sera ensuite à valider puis verser depuis l'onglet « Aide sociale »."}
      </p>
    </div>
  );
}

function PanneauRubrique({ reunion, types, titre, readOnly = false }) {
  const {
    membres, banques, prets, sanctions, typesSanction, addSanction,
    typesAideSociale, addAide, validerAideSociale, verserAideSociale,
    seanceTransactions, addSeanceTransaction, deleteSeanceTransaction,
    tontines, membresParTontine, showToast,
  } = useApp();

  // BUG corrigé : soldeDisponibleCaisse se basait sur caisseJournal, un état qui
  // n'est JAMAIS peuplé depuis cet écran (chargerJournalCaisse n'est appelé que
  // depuis la page Banques, pour UNE caisse précise choisie là-bas). Résultat :
  // caisseJournal restait toujours vide ici, soldeDisponibleCaisse valait donc
  // toujours 0, et TOUTE transaction sortante (prêt accordé, aide sociale,
  // attribution du tour, sortie diverse) était bloquée par un faux "solde
  // insuffisant — disponible : 0 FCFA", peu importe le vrai solde de la caisse.
  // Le backend vérifie déjà correctement le vrai solde (RG-CAI-006,
  // CaisseService::sortie(), contrainte DB caisses_solde_positif_ck) avec un
  // message d'erreur précis — on laisse SmartFormWrapper à son défaut (Infinity,
  // pas de blocage prématuré côté écran) plutôt que de deviner avec de mauvaises
  // données.

  const txs     = seanceTransactions.filter(t => t.idReunion === reunion.id && types.includes(t.type));
  const locked  = !!reunion.verrouillee || readOnly;
  const notOpen = reunion.statutReunion === 'planifiee';

  // Un seul type -> formulaire direct. Plusieurs types (ex: Divers) -> petit choix parmi eux seulement.
  const [selectedType, setSelectedType] = useState(types.length === 1 ? types[0] : null);

  const totalEntrees = txs.filter(t => TX_TYPES.find(tt => tt.value === t.type)?.dir === 'entree').reduce((s, t) => s + t.montant, 0);
  const totalSorties = txs.filter(t => TX_TYPES.find(tt => tt.value === t.type)?.dir === 'sortie').reduce((s, t) => s + t.montant, 0);

  if (notOpen) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
          <Lock size={28} className="text-amber-500"/>
        </div>
        <p className="font-bold text-gray-700">Séance non ouverte</p>
        <p className="text-sm text-gray-400 max-w-xs">Aucune saisie de {titre.toLowerCase()} tant que la séance n'est pas officiellement ouverte.</p>
      </div>
    );
  }

  const handleSubmitTx = async (form) => {
    if (!form.montant || Number(form.montant) <= 0) return;
    const m = form.idMembre ? membres.find(x => x.id === form.idMembre) : null;
    await addSeanceTransaction(reunion.id, {
      ...form,
      idMembre:   form.idMembre   || null,
      idSanction: form.idSanction || null,
      idPret:     form.idPret     || null,
      idBanque:   form.idBanque   || null,
      nomMembre:  m ? `${m.nom} ${m.prenom}` : (form.nomMembre || ''),
    });
    if (types.length > 1) setSelectedType(null); else setSelectedType(types[0]);
  };
  const [guardedHandleSubmitTx, submittingTx] = useAsyncGuard(handleSubmitTx);

  return (
    <div className="space-y-4">
      {/* Résumé financier de la rubrique */}
      {(totalEntrees > 0 || totalSorties > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl text-center bg-green-50 border border-green-100">
            <p className="text-base font-bold text-green-600">{fmt(totalEntrees)}</p>
            <p className="text-xs text-gray-500">Entrées</p>
          </div>
          <div className="p-2.5 rounded-xl text-center bg-red-50 border border-red-100">
            <p className="text-base font-bold text-red-500">{fmt(totalSorties)}</p>
            <p className="text-xs text-gray-500">Sorties</p>
          </div>
        </div>
      )}

      {/* Appliquer un type de sanction déjà paramétré à un membre — distinct du
          formulaire ci-dessous qui ne fait que RÉGLER une sanction déjà existante.
          C'est ici qu'on utilise les types créés/modifiés dans Paramètres → Sanctions. */}
      {!locked && types.includes('amende') && (
        <AppliquerSanctionPanel reunion={reunion} membres={membres} typesSanction={typesSanction} addSanction={addSanction} showToast={showToast}/>
      )}

      {/* Symétrique côté aide sociale : déclarer une aide à partir d'un type
          déjà paramétré dans Paramètres → Aide sociale. */}
      {!locked && types.includes('aide_sociale') && (
        <DeclarerAideSocialePanel membres={membres} typesAideSociale={typesAideSociale} banques={banques} addAide={addAide} validerAideSociale={validerAideSociale} verserAideSociale={verserAideSociale} showToast={showToast}/>
      )}

      {/* Zone formulaire */}
      {!locked && (
        <div>
          {types.length > 1 && selectedType === null && (
            <div className="flex gap-2">
              {types.map(tv => {
                const meta = TX_TYPES.find(t => t.value === tv);
                return (
                  <button key={tv} onClick={() => setSelectedType(tv)} className="btn-secondary flex-1 justify-center text-sm">
                    {meta?.icon} {meta?.label}
                  </button>
                );
              })}
            </div>
          )}
          {selectedType && (
            <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              {types.length > 1 && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800">
                    {TX_TYPES.find(t => t.value === selectedType)?.icon}{' '}
                    {TX_TYPES.find(t => t.value === selectedType)?.label}
                  </p>
                  <button onClick={() => setSelectedType(null)} className="text-xs text-primary-600 hover:underline">
                    - Changer de type
                  </button>
                </div>
              )}
              <SmartFormWrapper
                type={selectedType}
                reunion={reunion}
                membres={membres}
                banques={banques}
                prets={prets}
                sanctions={sanctions}
                tontines={tontines}
                membresParTontine={membresParTontine}
                onSubmit={guardedHandleSubmitTx}
                submitting={submittingTx}
                onCancel={() => setSelectedType(types.length > 1 ? null : types[0])}
              />
            </div>
          )}
        </div>
      )}

      {/* Liste des opérations de cette rubrique */}
      {txs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <DollarSign size={28} className="mx-auto mb-2 text-gray-200"/>
          <p className="text-sm">Aucune opération « {titre} » enregistrée pour cette séance</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map(tx => {
            const meta    = TX_TYPES.find(t => t.value === tx.type);
            const isEntree = meta?.dir === 'entree';
            const isSortie = meta?.dir === 'sortie';
            return (
              <div key={tx.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group hover:bg-white hover:shadow-sm transition-all">
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0',
                  isEntree ? 'bg-green-100' : isSortie ? 'bg-red-100' : 'bg-blue-100')}>
                  {meta?.icon || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{tx.libelle || meta?.label || tx.type}</p>
                  <p className="text-xs text-gray-400">{tx.nomMembre || '—'} · {tx.heure}</p>
                </div>
                <div className="shrink-0">
                  <ModePaiementBadge modePaiement={tx.modePaiement} detailsPaiement={tx.detailsPaiement} />
                </div>
                <div className="text-right shrink-0">
                  <p className={clsx('text-sm font-bold', isEntree ? 'text-green-600' : isSortie ? 'text-red-500' : 'text-blue-600')}>
                    {isEntree ? '+' : isSortie ? '−' : ''} {fmt(tx.montant)}
                  </p>
                </div>
                {!locked && (
                  <button onClick={() => {
                    if (window.confirm('Annuler cette opération ? Une contre-écriture sera créée pour conserver la traçabilité.')) deleteSeanceTransaction(tx.idReunion, tx.id);
                  }} title="Annuler l'opération"
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Configuration des rubriques individuelles (remplace l'onglet unique Transactions)
const RUBRIQUES = [
  { id:'remboursement', label:'Remboursement', icon: Receipt,     types:['remboursement_pret'] },
  { id:'pret',          label:'Prêt',          icon: Landmark,    types:['pret_accorde']        },
  { id:'sanction',      label:'Sanctions',     icon: AlertTriangle, types:['amende']             },
  { id:'aide',          label:'Aide sociale',  icon: HeartHandshake, types:['aide_sociale']      },
  { id:'banque',        label:'Banque',        icon: Landmark,    types:['depot_banque']         },
  { id:'divers',        label:'Divers',        icon: DollarSign,  types:['divers_entree','divers_sortie'] },
];

// ── Panneau Signatures du PV (règle : verrouillage définitif au Président) ──
// 4 signataires attendus (Président, Secrétaire, Trésorier, 1 membre témoin).
// Tant que le Président n'a pas signé, la réunion reste modifiable — même
// si les 3 autres ont déjà signé. La signature du Président verrouille
// IMMÉDIATEMENT et DÉFINITIVEMENT la réunion.
const SIGNATAIRES_ATTENDUS = [
  { role: 'president',  label: 'Président'  },
  { role: 'secretaire',  label: 'Secrétaire' },
  { role: 'tresorier',   label: 'Trésorier'  },
  { role: 'membre',      label: 'Membre témoin' },
];

const ROLES_PEUVENT_ENREGISTRER_TEMOIN = ['super_admin','president','secretaire','tresorier'];

function PanneauSignatures({ reunion }) {
  const { user, membres, signerPV } = useApp();
  const signatures = reunion.signatures || [];
  const verrouillee = !!reunion.verrouillee;
  const roleUser = user?.role || 'membre';
  const [idTemoin, setIdTemoin] = useState('');

  if (reunion.statutReunion !== 'cloturee') {
    return (
      <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-500 flex items-start gap-2">
        <Lock size={16} className="mt-0.5 shrink-0 text-gray-300"/>
        <p>La signature du PV n'est possible qu'une fois la séance <strong>clôturée</strong>. Utilisez le bouton « Clôturer la séance » une fois toutes les saisies terminées.</p>
      </div>
    );
  }

  const dejaSigne = signatures.some(s => s.idMembre === (user?.idMembre || user?.id));
  const monSlot = SIGNATAIRES_ATTENDUS.find(s => s.role === roleUser);
  const sigTemoin = signatures.find(s => s.role === 'membre');
  const peutEnregistrerTemoin = ROLES_PEUVENT_ENREGISTRER_TEMOIN.includes(roleUser) && !sigTemoin && !verrouillee;

  const handleSigner = () => {
    if (!monSlot || dejaSigne || verrouillee) return;
    const m = membres.find(x => x.id === (user?.idMembre || user?.id));
    signerPV(reunion.id, {
      idMembre: user?.idMembre || user?.id || uidLike(),
      nom: m ? `${m.nom} ${m.prenom}` : (user?.name || monSlot.label),
      role: roleUser,
    });
  };
  const handleEnregistrerTemoin = () => {
    if (!idTemoin || verrouillee) return;
    const m = membres.find(x => x.id === idTemoin);
    if (!m) return;
    signerPV(reunion.id, { idMembre: m.id, nom: `${m.nom} ${m.prenom}`, role: 'membre' });
    setIdTemoin('');
  };
  function uidLike(){ return `u-${Date.now()}`; }

  return (
    <div className="space-y-4">
      <div className={clsx('p-3 rounded-xl border text-sm flex items-start gap-2',
        verrouillee ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700')}>
        {verrouillee ? <Lock size={16} className="mt-0.5 shrink-0"/> : <AlertCircle size={16} className="mt-0.5 shrink-0"/>}
        <p>
          {verrouillee
            ? 'Réunion verrouillée définitivement — le Président a signé. Plus aucune modification possible.'
            : "La réunion reste modifiable tant que le Président n'a pas signé, même si d'autres signataires ont déjà signé."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {SIGNATAIRES_ATTENDUS.map(slot => {
          const sig = signatures.find(s => s.role === slot.role);
          const estPresident = slot.role === 'president';
          const estTemoin = slot.role === 'membre';
          return (
            <div key={slot.role} className={clsx('rounded-xl border-2 p-3 text-center',
              sig ? (estPresident ? 'bg-green-50 border-green-400' : 'bg-emerald-50 border-emerald-200') : 'border-dashed border-gray-200 bg-white')}>
              {sig ? (
                <>
                  <CheckCircle size={16} className={clsx('mx-auto mb-1', estPresident ? 'text-green-600' : 'text-emerald-600')}/>
                  <p className="text-xs font-bold text-gray-800 truncate">{sig.nom}</p>
                  <p className="text-xs text-gray-400">{acteurRoleLabel[slot.role] || slot.label}</p>
                </>
              ) : estTemoin && peutEnregistrerTemoin ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400">{slot.label}</p>
                  <select className="select text-xs py-1" value={idTemoin} onChange={e=>setIdTemoin(e.target.value)}>
                    <option value="">Choisir le membre…</option>
                    {membres.map(m => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
                  </select>
                  <button onClick={handleEnregistrerTemoin} disabled={!idTemoin}
                    className={clsx('w-full text-xs py-1 rounded-lg font-semibold', idTemoin ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-300')}>
                    Enregistrer sa signature
                  </button>
                </div>
              ) : (
                <>
                  <Lock size={16} className="mx-auto mb-1 text-gray-300"/>
                  <p className="text-xs text-gray-400 italic">En attente</p>
                  <p className="text-xs text-gray-400">{acteurRoleLabel[slot.role] || slot.label}</p>
                </>
              )}
              {estPresident && !sig && <p className="text-[10px] text-amber-600 mt-1 font-semibold">Verrouille tout à la signature</p>}
            </div>
          );
        })}
      </div>

      {peutEnregistrerTemoin && (
        <p className="text-xs text-gray-400 -mt-1">Le membre témoin n'ayant pas de compte, {roleLabel[roleUser] || roleUser} enregistre sa signature en son nom, une fois signée physiquement sur le PV papier.</p>
      )}

      {verrouillee ? (
        <p className="text-xs text-gray-400 text-center py-1">PV définitivement scellé.</p>
      ) : monSlot ? (
        dejaSigne ? (
          <p className="text-xs text-gray-400 text-center py-1">Vous avez déjà signé.</p>
        ) : (
          <button onClick={handleSigner} className="btn-primary w-full justify-center">
            <Pencil size={14}/> Signer en tant que {roleLabel[roleUser] || acteurRoleLabel[roleUser] || monSlot.label}
            {roleUser==='president' && ' (verrouille définitivement)'}
          </button>
        )
      ) : (
        <p className="text-xs text-gray-400 text-center py-1">Votre rôle n'est pas prévu comme signataire du PV.</p>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export function Reunions() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const {
    reunions, membres, user, presences,
    addReunion, updateReunion, chargerReunion, ouvrirSeance,
    addPointODJ, updatePointODJ, removePointODJ, movePointODJ, cloturerSeance,
    seanceTransactions, chargerSeanceTransactions, showToast, cyclesTontine,
    rubriquesODJ, creerRubriqueODJ,
  } = useApp();

  // La liste (index()) ne charge jamais l'ordre du jour / les présences / les
  // signatures (trop coûteux pour un listing) : sans ce fetch dédié, ouvrir le
  // détail d'une réunion depuis la liste affichait un ordre du jour vide tant
  // qu'aucune action (ouvrir/modifier/clôturer) n'avait déjà rafraîchi l'objet.
  // Idem pour les transactions de séance (Prêt/Sanctions/Aide sociale/Banque/
  // Divers + condition d'affichage du bouton "Rapport PV") : sans cet appel,
  // seanceTransactions restait à [] après un rafraîchissement de page tant
  // qu'aucune transaction n'avait été ajoutée en direct dans CETTE session.
  useEffect(() => {
    if (routeId) { chargerReunion(routeId); chargerSeanceTransactions(routeId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const [showAdd,        setShowAdd]        = useState(false);
  const [showEdit,       setShowEdit]       = useState(null);
  const [showOuverture,  setShowOuverture]  = useState(null);
  const [showCloture,    setShowCloture]    = useState(null);
  const [showAddPoint,   setShowAddPoint]   = useState(null);
  const [showEditPoint,  setShowEditPoint]  = useState(null);
  const [showRapport,    setShowRapport]    = useState(null);
  const [detailTab,      setDetailTab]      = useState('info'); // onglet actif de la fiche réunion

  const [formReunion,  setFormReunion]  = useState(EMPTY_REUNION);
  const [formOuv,      setFormOuv]      = useState(EMPTY_OUVERTURE);
  const [formCloture,  setFormCloture]  = useState(EMPTY_CLOTURE);
  const [formPoint,    setFormPoint]    = useState(EMPTY_POINT);
  const [enregistrerPointCommeRubrique, setEnregistrerPointCommeRubrique] = useState(false);

  const membresNoms = membres.map(m => `${m.nom} ${m.prenom}`);

  const dateMinReunion = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0]; // RG-REU-002 : J+1 minimum

  const handleAddReunion = () => {
    const missing = getMissingFields(formReunion, [
      { key: 'date', label: 'Date de la réunion' },
      { key: 'lieu', label: 'Lieu de la réunion' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    if (formReunion.date < dateMinReunion) { showToast?.("La date doit être au moins 24h après aujourd'hui.", "error"); return; }
    if (reunions.some(r => r.date === formReunion.date)) { showToast?.("Une réunion est déjà planifiée ce jour-là.", "error"); return; } // RG-REU-005
    addReunion({ ...formReunion });
    setShowAdd(false); setFormReunion(EMPTY_REUNION);
  };

  const handleEditReunion = () => {
    const missing = getMissingFields(formReunion, [
      { key: 'date', label: 'Date' },
      { key: 'lieu', label: 'Lieu' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    if (reunions.some(r => r.date === formReunion.date && r.id !== showEdit.id)) { showToast?.("Une réunion est déjà planifiée ce jour-là.", "error"); return; }
    updateReunion({ ...showEdit, ...formReunion });
    setShowEdit(null);
  };

  const handleOuverture = () => {
    const missing = getMissingFields(formOuv, [
      { key: 'heureOuverture', label: "Heure d'ouverture" },
      { key: 'presidentSeance', label: 'Président de séance' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const ok = ouvrirSeance(showOuverture.id, formOuv);
    if (ok !== false) { setShowOuverture(null); setFormOuv(EMPTY_OUVERTURE); }
  };

  const handleCloture = () => {
    const missing = getMissingFields(formCloture, [
      { key: 'heureCloture', label: 'Heure de clôture' },
      { key: 'presents', label: 'Nombre de présents' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    cloturerSeance(showCloture.id, formCloture);
    setShowCloture(null); setFormCloture(EMPTY_CLOTURE);
  };

  const handleAddPoint = async () => {
    if (!formPoint.titre.trim()) { showToast?.('Titre du point requis.', 'error'); return; }
    let point = { ...formPoint };
    if (enregistrerPointCommeRubrique && !point.rubriqueId) {
      const rubrique = await creerRubriqueODJ(point.titre.trim());
      if (!rubrique) return;
      point = { ...point, rubriqueId: rubrique.id, titre: rubrique.libelle };
    }
    const ajoute = await addPointODJ(showAddPoint, point);
    if (ajoute) {
      setShowAddPoint(null);
      setFormPoint(EMPTY_POINT);
      setEnregistrerPointCommeRubrique(false);
    }
  };

  const handleEditPoint = () => {
    if (!formPoint.titre.trim()) { showToast?.('Titre du point requis.', 'error'); return; }
    updatePointODJ(showEditPoint.reunionId, showEditPoint.point.id, formPoint);
    setShowEditPoint(null); setFormPoint(EMPTY_POINT);
  };

  const stats = [
    { l:'Clôturées',     v: reunions.filter(r=>r.statutReunion==='cloturee').length,  c:'text-primary-600' },
    { l:'En cours',      v: reunions.filter(r=>r.statutReunion==='en_cours').length,   c:'text-amber-600'   },
    { l:'Planifiées',    v: reunions.filter(r=>r.statutReunion==='planifiee').length,  c:'text-blue-600'    },
    { l:'Taux présence', v: (() => {
      const t = reunions.filter(r=>r.cloture && (r.cloture.presents+r.cloture.absents)>0);
      if (!t.length) return '—';
      const moy = t.reduce((s,r)=>s+r.cloture.presents/(r.cloture.presents+r.cloture.absents),0)/t.length;
      return `${Math.round(moy*100)}%`;
    })(), c:'text-purple-600' },
  ];

  // Refs pour exposer la valeur courante des formulaires sans recréer les composants ci-dessous
  // à chaque frappe (sinon React démonte/remonte l'<input> et fait perdre le focus - RG bug "1 caractère puis reclic").
  const formReunionRef = useRef(formReunion); formReunionRef.current = formReunion;
  const formOuvRef = useRef(formOuv); formOuvRef.current = formOuv;
  const formClotureRef = useRef(formCloture); formClotureRef.current = formCloture;
  const formPointRef = useRef(formPoint); formPointRef.current = formPoint;

  const FR = useRef(({ k, ...p }) => <input className="input" value={formReunionRef.current[k]||''} onChange={e=>setFormReunion(f=>({...f,[k]:e.target.value}))} {...p}/>).current;
  const FO = useRef(({ k, ...p }) => <input className="input" value={formOuvRef.current[k]||''} onChange={e=>setFormOuv(f=>({...f,[k]:e.target.value}))} {...p}/>).current;
  const FC = useRef(({ k, ...p }) => <input className="input" value={formClotureRef.current[k]||''} onChange={e=>setFormCloture(f=>({...f,[k]:e.target.value}))} {...p}/>).current;
  const FP = useRef(({ k, ...p }) => <input className="input" value={formPointRef.current[k]||''} onChange={e=>setFormPoint(f=>({...f,[k]:e.target.value}))} {...p}/>).current;

  return (
    <div className="space-y-6">
      {!routeId && (<>
      <PageHeader title="Réunions" subtitle={`${reunions.length} réunions au total`}
        action={<button onClick={()=>{ setFormReunion({ ...EMPTY_REUNION, numero: reunions.length + 1, date: new Date().toISOString().split('T')[0] }); setShowAdd(true); }} className="btn-primary">
          <CalendarPlus size={15}/> Planifier une réunion
        </button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s=>(
          <div key={s.l} className="card text-center py-3">
            <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Bannières actives */}
      {reunions.filter(r=>r.statutReunion==='en_cours').map(r=>(
        <div key={r.id} className="card border-l-4 border-l-amber-500 bg-amber-50/40">
          <div className="flex items-center gap-3 flex-wrap">
            <PlayCircle size={20} className="text-amber-500 shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">Séance en cours — N°{r.numero}</p>
              <p className="text-sm text-gray-500">{fmtDate(r.date)} · {r.lieu}</p>
              {r.ouverture && <p className="text-xs text-amber-700 mt-0.5">Ouverte à {r.ouverture.heureOuverture} par {r.ouverture.presidentSeance}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ navigate(`/reunions/${r.id}`); setDetailTab('feuille_cotisation'); }} className="btn-secondary text-xs">
                <ClipboardCheck size={13}/> Cotisation
              </button>
              <button onClick={()=>{ navigate(`/reunions/${r.id}`); setDetailTab('info'); }} className="btn-secondary text-xs">
                <FileText size={13}/> Gérer
              </button>
              <button onClick={()=>{ setShowCloture(r); setFormCloture(EMPTY_CLOTURE); }} className="btn-primary text-xs">
                <CheckCircle size={13}/> Clôturer
              </button>
            </div>
          </div>
        </div>
      ))}

      {reunions.filter(r=>r.statutReunion==='planifiee').map(r=>(
        <div key={r.id} className="card border-l-4 border-l-blue-500 bg-blue-50/40">
          <div className="flex items-center gap-3 flex-wrap">
            <Clock size={20} className="text-blue-500 shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">Prochaine réunion — N°{r.numero}</p>
              <p className="text-sm text-gray-500">{fmtDate(r.date)} · <span className="inline-flex items-center gap-1"><MapPin size={11}/>{r.lieu}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ setShowEdit(r); setFormReunion({date:r.date,lieu:r.lieu,numero:r.numero,observation:r.observation||''}); }} className="btn-secondary text-xs">
                <Pencil size={13}/> Modifier
              </button>
              <button onClick={()=>{ setShowOuverture(r); setFormOuv({...EMPTY_OUVERTURE, heureOuverture: new Date().toTimeString().slice(0,5)}); }} className="btn-primary text-xs">
                <PlayCircle size={13}/> Ouvrir la séance
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Grille réunions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...reunions].sort((a,b)=>b.numero-a.numero).map(r=>{
          const cfg = sCfg[r.statutReunion];
          const Icon = cfg.icon;
          const cloture = r.cloture;
          const txCount = seanceTransactions.filter(t => t.idReunion === r.id).length;
          return (
            <div key={r.id} onClick={()=>{ navigate(`/reunions/${r.id}`); setDetailTab('info'); }}
              className="card cursor-pointer hover:shadow-md transition-all border border-gray-100 hover:border-primary-200">
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl gradient-primary flex flex-col items-center justify-center text-white shrink-0">
                  <span className="text-base font-bold leading-none">{new Date(r.date).getDate()}</span>
                  <span className="text-xs opacity-80">{new Date(r.date).toLocaleDateString('fr-FR',{month:'short'})}</span>
                </div>
                <Badge variant={cfg.v}>{cfg.label}</Badge>
              </div>
              <p className="font-bold text-gray-800 mb-1">Réunion N°{r.numero}</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <MapPin size={11}/><span className="truncate">{r.lieu}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <ClipboardList size={11}/>
                <span>{r.pointsOrdreJour?.length || 0} point(s) à l'ordre du jour</span>
              </div>
              {txCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 mb-1">
                  <Receipt size={11}/>
                  <span>{txCount} transaction(s) enregistrée(s)</span>
                </div>
              )}
              {cloture && (
                <div className="flex gap-3 pt-2 border-t border-gray-100 text-xs">
                  <span className="text-primary-600 flex items-center gap-1"><Users size={11}/>{cloture.presents} présents</span>
                  {cloture.absents>0 && <span className="text-red-500">{cloture.absents} absent(s)</span>}
                </div>
              )}
              {r.verrouillee && (
                <div className="flex items-center gap-1 text-xs text-gray-300 mt-2 pt-2 border-t border-gray-100">
                  <Lock size={10}/><span>Séance verrouillée (signée par le Président)</span>
                </div>
              )}
              {r.statutReunion==='tenue' && !r.verrouillee && (
                <div className="flex items-center gap-1 text-xs text-amber-500 mt-2 pt-2 border-t border-gray-100">
                  <AlertCircle size={10}/><span>En attente des signatures (Président, Secrétaire, membre élu)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>)}

      {/* ══ PAGE DÉTAIL RÉUNION (route /reunions/:id) ═══════ */}
      {routeId && (() => {
        const r = reunions.find(x=>x.id===routeId);
        if (!r) {
          return (
            <div className="card text-center py-16">
              <p className="text-gray-400">Réunion introuvable.</p>
              <button onClick={()=>navigate('/reunions')} className="btn-secondary mt-4">
                <ArrowLeft size={14}/> Retour aux réunions
              </button>
            </div>
          );
        }
        const cfg = sCfg[r.statutReunion];
        const locked = !!r.verrouillee;
        const roleUser = user?.role || 'membre';
        const lectureSeule = ROLES_LECTURE_SEULE.includes(roleUser);
        const allTabs = [
          { id:'info',              label:'Informations',       icon: ClipboardList  },
          { id:'presences',         label:'Présences',           icon: Users          },
          { id:'feuille_cotisation',label:'Feuille Cotisation', icon: ClipboardCheck },
          { id:'beneficiaire',      label:'Bénéficiaire',       icon: Trophy         },
          ...RUBRIQUES.map(rb => ({ id: rb.id, label: rb.label, icon: rb.icon })),
          { id:'signatures',        label:'Signatures',          icon: FileText       },
        ];
        // Chaque acteur ne voit que les onglets qui le concernent (RG-SEC-002)
        const tabs = allTabs.filter(t => (TAB_ACCESS[t.id]||[]).includes(roleUser));
        const effectiveTab = tabs.some(t => t.id === detailTab) ? detailTab : 'info';

        return (
          <div className="space-y-4">
            <PageHeader
              title={`Réunion N°${r.numero}`}
              subtitle={r.ouverture ? `${fmtDate(r.date)} · ${r.lieu} · Ouverte à ${r.ouverture.heureOuverture}${r.ouverture.presidentSeance ? ' par '+r.ouverture.presidentSeance : ''}` : `${fmtDate(r.date)} · ${r.lieu}`}
              action={<button onClick={()=>navigate('/reunions')} className="btn-secondary">
                <ArrowLeft size={14}/> Retour aux réunions
              </button>}
            />

            <div className="card space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-gray-100">
                <Badge variant={cfg.v}>{cfg.label}</Badge>
                <div className="flex gap-2 flex-wrap">
                  {r.statutReunion==='planifiee' && (
                    <>
                      <button onClick={()=>{ setShowEdit(r); setFormReunion({date:r.date,lieu:r.lieu,numero:r.numero,observation:r.observation||''}); }} className="btn-secondary">
                        <Pencil size={13}/> Modifier
                      </button>
                      <button onClick={()=>{ setShowOuverture(r); setFormOuv({...EMPTY_OUVERTURE, heureOuverture: new Date().toTimeString().slice(0,5)}); }} className="btn-primary">
                        <PlayCircle size={13}/> Ouvrir la séance
                      </button>
                    </>
                  )}
                  {r.statutReunion==='en_cours' && (
                    <button onClick={()=>{ setShowCloture(r); setFormCloture(EMPTY_CLOTURE); }} className="btn-primary">
                      <CheckCircle size={13}/> Clôturer la séance
                    </button>
                  )}
                  {r.statutReunion==='tenue' && !locked && (
                    <button onClick={()=>setDetailTab('signatures')} className="btn-primary">
                      <Lock size={13}/> Signer / Verrouiller
                    </button>
                  )}
                  {(r.statutReunion==='cloturee' || seanceTransactions.filter(t=>t.idReunion===r.id).length > 0) && (
                    <button onClick={()=>{ setShowRapport(r); }} className="btn-secondary">
                      <FileText size={13}/> Rapport PV
                    </button>
                  )}
                </div>
              </div>
              {lectureSeule && (
                <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                  <Lock size={13}/>
                  <span>Vous êtes connecté en tant que <strong>{roleLabel[roleUser] || acteurRoleLabel[roleUser] || roleUser}</strong> : consultation uniquement, aucune saisie possible. Pour saisir la cotisation, reconnectez-vous avec le rôle Trésorier ; pour les présences, avec le rôle Secrétaire.</span>
                </div>
              )}
              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5 p-1.5 bg-gray-100 rounded-xl">
                {tabs.map(tab => {
                  const rubriqueCount = RUBRIQUES.find(rb => rb.id === tab.id)
                    ? seanceTransactions.filter(t => t.idReunion === r.id && RUBRIQUES.find(rb => rb.id === tab.id).types.includes(t.type)).length
                    : 0;
                  return (
                  <button key={tab.id} onClick={()=>setDetailTab(tab.id)}
                    className={clsx('flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-medium transition-all',
                      effectiveTab===tab.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60')}>
                    <tab.icon size={13}/>{tab.label}
                    {rubriqueCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-primary-600 text-white rounded-full text-xs leading-none">
                        {rubriqueCount}
                      </span>
                    )}
                    {tab.id==='beneficiaire' && cyclesTontine.filter(c => c.idReunion === r.id && c.statut === 'clos').length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-xs leading-none">
                        {cyclesTontine.filter(c => c.idReunion === r.id && c.statut === 'clos').length}
                      </span>
                    )}
                    {tab.id==='presences' && r.statutReunion !== 'planifiee' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-primary-500 text-white rounded-full text-xs leading-none">
                        {presences.filter(p=>p.reunionId===r.id).length}
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>

              {/* Tab: Informations */}
              {effectiveTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-400 mb-1">Date</p>
                      <p className="font-semibold">{fmtDate(r.date)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-400 mb-1">Statut</p>
                      <Badge variant={cfg.v}>{cfg.label}</Badge>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl col-span-2">
                      <p className="text-xs text-gray-400 mb-1">Lieu</p>
                      <p className="font-semibold flex items-center gap-1"><MapPin size={12} className="text-gray-400"/>{r.lieu}</p>
                    </div>
                  </div>

                  {r.ouverture ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1"><PlayCircle size={12}/> Ouverture de séance</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-400">Heure : </span><span className="font-medium">{r.ouverture.heureOuverture}</span></div>
                        <div><span className="text-gray-400">Président : </span><span className="font-medium">{r.ouverture.presidentSeance}</span></div>
                        {r.ouverture.secretaireSeance && <div><span className="text-gray-400">Secrétaire : </span><span className="font-medium">{r.ouverture.secretaireSeance}</span></div>}
                      </div>
                      {r.ouverture.motOuverture && <p className="text-xs text-gray-600 mt-2 italic">« {r.ouverture.motOuverture} »</p>}
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                      <Clock size={16} className="mx-auto mb-1 text-gray-300"/>Séance non encore ouverte
                    </div>
                  )}

                  {/* ODJ */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                        <ListChecks size={15} className="text-primary-500"/>
                        Ordre du jour ({r.pointsOrdreJour?.length || 0})
                      </p>
                      {!locked && (
                        <button onClick={()=>{ setShowAddPoint(r.id); setFormPoint(EMPTY_POINT); setEnregistrerPointCommeRubrique(false); }} className="btn-secondary text-xs py-1">
                          <Plus size={12}/> Ajouter
                        </button>
                      )}
                    </div>
                    {r.statutReunion === 'en_cours' && (
                      <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mb-2">
                        Séance ouverte — chaque acteur assigné saisit sa rubrique dans l'onglet correspondant (Cotisation, Prêt, Sanction, Aide sociale…). Vous êtes connecté en tant que <strong>{roleLabel[user?.role] || acteurRoleLabel[user?.role] || user?.role || '—'}</strong>.
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {(r.pointsOrdreJour||[]).slice().sort((a,b)=>(a.ordre??0)-(b.ordre??0)).map((p,i,arr)=>{
                        const acteurAssigne = p.acteurRole ? (acteurRoleLabel[p.acteurRole] || p.acteurRole) : null;
                        const peutSaisir = !p.acteurRole || user?.role === p.acteurRole || user?.role === 'president';
                        return (
                        <div key={p.id} className={clsx('flex items-start gap-2 p-2.5 rounded-lg group', peutSaisir ? 'bg-gray-50' : 'bg-gray-50/60 opacity-70')}>
                          <span className="text-xs text-gray-400 font-mono mt-0.5 shrink-0">{String(i+1).padStart(2,'0')}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{p.titre}</p>
                            {p.description && <p className="text-xs text-gray-500 truncate">{p.description}</p>}
                            {acteurAssigne && (
                              <p className="text-[11px] text-primary-600 flex items-center gap-1 mt-0.5">
                                {!peutSaisir && <Lock size={10}/>} Acteur : {acteurAssigne}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant={typeCfg[p.type]?.v||'gray'}>{typeCfg[p.type]?.label||p.type}</Badge>
                            <Badge variant={statutPointCfg[p.statut]?.v||'gray'}>{statutPointCfg[p.statut]?.label||p.statut}</Badge>
                            {!locked && r.statutReunion === 'planifiee' && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={e=>{e.stopPropagation();movePointODJ(r.id,p.id,'up');}} disabled={i===0} className="p-1 hover:bg-white rounded disabled:opacity-30">
                                  <ChevronRight size={11} className="text-gray-400 -rotate-90"/>
                                </button>
                                <button onClick={e=>{e.stopPropagation();movePointODJ(r.id,p.id,'down');}} disabled={i===arr.length-1} className="p-1 hover:bg-white rounded disabled:opacity-30">
                                  <ChevronRight size={11} className="text-gray-400 rotate-90"/>
                                </button>
                                <button onClick={e=>{e.stopPropagation();setShowEditPoint({reunionId:r.id,point:p});setFormPoint({titre:p.titre,type:p.type,description:p.description||'',statut:p.statut,acteurRole:p.acteurRole||''});}} className="p-1 hover:bg-white rounded">
                                  <Pencil size={11} className="text-gray-400"/>
                                </button>
                                <button onClick={e=>{e.stopPropagation();removePointODJ(r.id,p.id);}} className="p-1 hover:bg-white rounded">
                                  <Trash2 size={11} className="text-red-400"/>
                                </button>
                              </div>
                            )}
                            {!locked && r.statutReunion === 'en_cours' && (
                              <button onClick={e=>{e.stopPropagation();setShowEditPoint({reunionId:r.id,point:p});setFormPoint({titre:p.titre,type:p.type,description:p.description||'',statut:p.statut,acteurRole:p.acteurRole||''});}} className="p-1 hover:bg-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil size={11} className="text-gray-400"/>
                              </button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                      {(!r.pointsOrdreJour||r.pointsOrdreJour.length===0) && (
                        <p className="text-xs text-gray-400 text-center py-3">Aucun point à l'ordre du jour</p>
                      )}
                    </div>
                  </div>

                  {/* Clôture */}
                  {r.cloture ? (
                    <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
                      <p className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1"><CheckCircle size={12}/> Clôture de séance</p>
                      <div className="flex gap-4 text-center mb-2">
                        <div className="flex-1"><p className="text-2xl font-bold text-primary-600">{r.cloture.presents}</p><p className="text-xs text-gray-500">Présents</p></div>
                        <div className="flex-1"><p className="text-2xl font-bold text-red-500">{r.cloture.absents}</p><p className="text-xs text-gray-500">Absents</p></div>
                        <div className="flex-1">
                          <p className="text-2xl font-bold text-amber-600">
                            {r.cloture.presents+r.cloture.absents>0
                              ? `${Math.round(r.cloture.presents/(r.cloture.presents+r.cloture.absents)*100)}%`
                              : '—'}
                          </p>
                          <p className="text-xs text-gray-500">Présence</p>
                        </div>
                      </div>
                      {r.cloture.heureCloture && <p className="text-xs text-gray-500">Heure de clôture : <strong>{r.cloture.heureCloture}</strong></p>}
                      {r.cloture.membresAbsents && <p className="text-xs text-red-500 mt-1">Absents : {r.cloture.membresAbsents}</p>}
                      {r.cloture.observation && <p className="text-xs text-gray-600 mt-2 italic">« {r.cloture.observation} »</p>}
                    </div>
                  ) : r.statutReunion!=='planifiee' ? (
                    <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                      <CheckCircle size={16} className="mx-auto mb-1 text-gray-300"/>
                      Séance en cours — non encore clôturée
                    </div>
                  ) : null}

                  {locked && (
                    <div className="flex items-center gap-2 p-2.5 bg-gray-100 rounded-lg text-xs text-gray-500">
                      <Lock size={12}/> Réunion verrouillée définitivement (signature du Président). Aucune modification possible.
                    </div>
                  )}
                  {r.statutReunion==='tenue' && !locked && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-200">
                      <AlertCircle size={12}/> Séance tenue, en attente des 3 signatures — le verrouillage définitif interviendra à la dernière signature (onglet Signatures).
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Bénéficiaire */}
              {effectiveTab === 'beneficiaire' && (
                <div className={clsx(lectureSeule && 'pointer-events-none opacity-95')}>
                  <BeneficiaireSeancePanel reunion={r}/>
                </div>
              )}

              {/* Tab: Présences */}
              {effectiveTab === 'presences' && (
                <div className={clsx(lectureSeule && 'pointer-events-none opacity-95')}>
                  <PanneauPresences reunion={r} membres={membres}/>
                </div>
              )}

              {/* Tab: Feuille de cotisation */}
              {effectiveTab === 'feuille_cotisation' && (
                <FeuillePresenceTontine reunion={r} onClose={() => navigate('/reunions')} readOnly={lectureSeule}/>
              )}

              {/* Tabs: Rubriques financières individuelles (ex-Transactions) */}
              {RUBRIQUES.map(rb => effectiveTab === rb.id && (
                <div key={rb.id} className={clsx(lectureSeule && 'pointer-events-none opacity-95')}>
                  <PanneauRubrique reunion={r} types={rb.types} titre={rb.label} readOnly={lectureSeule}/>
                </div>
              ))}

              {/* Tab: Signatures */}
              {effectiveTab === 'signatures' && (
                <PanneauSignatures reunion={r}/>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Rapport / PV ─────────────────────────────────── */}
      {showRapport && (
        <RapportSeance
          reunion={reunions.find(r=>r.id===showRapport.id) || showRapport}
          transactions={seanceTransactions}
          membres={membres}
          onClose={()=>setShowRapport(null)}
        />
      )}

      {/* ── Planifier ────────────────────────────────────── */}
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Planifier une réunion"
        footer={<>
          <button onClick={()=>setShowAdd(false)} className="btn-secondary">Annuler</button>
          <button onClick={handleAddReunion}
            disabled={!formReunion.date || !formReunion.lieu || formReunion.date < dateMinReunion || reunions.some(r => r.date === formReunion.date)}
            className={clsx('btn-primary', (!formReunion.date || !formReunion.lieu || formReunion.date < dateMinReunion || reunions.some(r => r.date === formReunion.date)) && 'opacity-40 cursor-not-allowed')}>
            <CalendarPlus size={14}/> Planifier la réunion
          </button>
        </>}>
        <div className="space-y-4">
          {/* Bannière info */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2 text-xs text-blue-700">
            <CalendarPlus size={14} className="mt-0.5 shrink-0"/>
            <p>Remplissez les informations ci-dessous pour planifier la séance. Vous pourrez ajouter l'ordre du jour et ouvrir la séance ultérieurement.</p>
          </div>

          {/* Date + N° (pré-remplis automatiquement) */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date de la réunion" required hint="Minimum 24h à l'avance (RG-REU-002)">
              <FR k="date" type="date" min={dateMinReunion}/>
              {formReunion.date && reunions.some(r => r.date === formReunion.date) && (
                <p className="text-xs text-red-500 mt-1">Une réunion est déjà planifiée ce jour-là.</p>
              )}
            </FormField>
            <FormField label="N° de séance">
              <div className="relative">
                <FR k="numero" type="number" placeholder={reunions.length + 1}/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">auto</span>
              </div>
            </FormField>
          </div>

          {/* Lieu avec suggestions */}
          <FormField label="Lieu de la réunion" required>
            <FR k="lieu" placeholder="Ex : Salle Akwa Palace, Douala"/>
          </FormField>

          {/* Lieux récents comme suggestions rapides */}
          {(() => {
            const lieuxRecents = [...new Set(reunions.slice(-5).map(r => r.lieu).filter(Boolean))];
            return lieuxRecents.length > 0 ? (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Lieux récents :</p>
                <div className="flex flex-wrap gap-1.5">
                  {lieuxRecents.map(l => (
                    <button key={l} type="button"
                      onClick={() => setFormReunion(f => ({ ...f, lieu: l }))}
                      className={clsx('text-xs px-2.5 py-1 rounded-lg border transition-all',
                        formReunion.lieu === l ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-primary-300')}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Observation */}
          <FormField label="Notes préparatoires (optionnel)">
            <textarea className="input h-20 resize-none" placeholder="Ordre du jour prévu, points à aborder, rappels…"
              value={formReunion.observation||''} onChange={e=>setFormReunion(f=>({...f,observation:e.target.value}))}/>
          </FormField>

          {/* Récapitulatif si formulaire complet */}
          {formReunion.date && formReunion.lieu && (
            <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-50 rounded-xl border border-primary-200 text-xs space-y-1">
              <p className="font-bold text-primary-700 mb-1.5"> Récapitulatif de la séance</p>
              <div className="flex gap-2">
                <span className="text-gray-500">Séance N°</span>
                <span className="font-semibold text-gray-800">{formReunion.numero || reunions.length + 1}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold text-gray-800">{fmtDate(formReunion.date)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">Lieu</span>
                <span className="font-semibold text-gray-800">{formReunion.lieu}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modifier ─────────────────────────────────────── */}
      <Modal open={!!showEdit} onClose={()=>setShowEdit(null)} title={`Modifier — Réunion N°${showEdit?.numero}`}
        footer={<><button onClick={()=>setShowEdit(null)} className="btn-secondary">Annuler</button><button onClick={handleEditReunion} className="btn-primary"><Pencil size={14}/>Enregistrer</button></>}>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 flex items-center gap-2">
            <AlertCircle size={14}/> Modifiable jusqu'à l'ouverture et la clôture de la séance.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required><FR k="date" type="date"/></FormField>
            <FormField label="N° de réunion"><FR k="numero" type="number"/></FormField>
          </div>
          <FormField label="Lieu" required><FR k="lieu"/></FormField>
          <FormField label="Observation">
            <textarea className="input h-20 resize-none" value={formReunion.observation||''} onChange={e=>setFormReunion(f=>({...f,observation:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>

      {/* ── Ouverture ────────────────────────────────────── */}
      <Modal open={!!showOuverture} onClose={()=>setShowOuverture(null)} title={`Ouverture — Réunion N°${showOuverture?.numero}`}
        footer={<><button onClick={()=>setShowOuverture(null)} className="btn-secondary">Annuler</button><button onClick={handleOuverture} className="btn-primary"><PlayCircle size={14}/>Ouvrir la séance</button></>}>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-800">
            <strong>{fmtDate(showOuverture?.date)}</strong> — {showOuverture?.lieu}
          </div>
          <FormField label="Heure d'ouverture" required>
            <input type="time" className="input" value={formOuv.heureOuverture||''} onChange={e=>setFormOuv(f=>({...f,heureOuverture:e.target.value}))}/>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Président de séance" required>
              <select className="select" value={formOuv.presidentSeance||''} onChange={e=>setFormOuv(f=>({...f,presidentSeance:e.target.value}))}>
                <option value="">-- Choisir --</option>
                {membresNoms.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </FormField>
            <FormField label="Secrétaire de séance">
              <select className="select" value={formOuv.secretaireSeance||''} onChange={e=>setFormOuv(f=>({...f,secretaireSeance:e.target.value}))}>
                <option value="">-- Choisir --</option>
                {membresNoms.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Mot d'ouverture">
            <textarea className="input h-20 resize-none" placeholder="Discours d'ouverture de séance…"
              value={formOuv.motOuverture||''} onChange={e=>setFormOuv(f=>({...f,motOuverture:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>

      {/* ── Clôture ──────────────────────────────────────── */}
      <Modal open={!!showCloture} onClose={()=>setShowCloture(null)} title={`Clôture — Réunion N°${showCloture?.numero}`}
        footer={<><button onClick={()=>setShowCloture(null)} className="btn-secondary">Annuler</button><button onClick={handleCloture} className="btn-primary"><CheckCircle size={14}/>Valider la clôture</button></>}>
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-800">
            <strong>{fmtDate(showCloture?.date)}</strong> — {showCloture?.lieu}
            <p className="text-xs mt-1 text-amber-600"> Après clôture, aucune modification ne sera possible.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Heure de clôture" required><FC k="heureCloture" placeholder="12h30"/></FormField>
            <div/>
            <FormField label="Nombre de présents" required>
              <input type="number" className="input" min="0" value={formCloture.presents} onChange={e=>setFormCloture(f=>({...f,presents:e.target.value}))}/>
            </FormField>
            <FormField label="Nombre d'absents">
              <input type="number" className="input" min="0" value={formCloture.absents} onChange={e=>setFormCloture(f=>({...f,absents:e.target.value}))}/>
            </FormField>
          </div>
          <FormField label="Membres absents"><FC k="membresAbsents" placeholder="Nom des membres absents"/></FormField>
          <FormField label="Observation / PV">
            <textarea className="input h-24 resize-none" placeholder="Résumé de la séance…"
              value={formCloture.observation||''} onChange={e=>setFormCloture(f=>({...f,observation:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>

      {/* ── Ajouter point ODJ ────────────────────────────── */}
      <Modal open={!!showAddPoint} onClose={()=>setShowAddPoint(null)} title="Ajouter un point à l'ordre du jour"
        footer={<><button onClick={()=>setShowAddPoint(null)} className="btn-secondary">Annuler</button><button onClick={handleAddPoint} className="btn-primary"><Plus size={14}/>Ajouter</button></>}>
        <div className="space-y-4">
          <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl space-y-2">
            <FormField label="Rubrique enregistrée" hint="Sélectionnez une rubrique utilisée régulièrement pour ne pas la ressaisir.">
              <select className="select" value={formPoint.rubriqueId || ''} onChange={e => {
                const rubrique = rubriquesODJ.find((item) => item.id === e.target.value);
                setFormPoint((point) => ({
                  ...point,
                  rubriqueId: e.target.value,
                  titre: rubrique?.libelle || point.titre,
                }));
                setEnregistrerPointCommeRubrique(false);
              }}>
                <option value="">— Saisir une rubrique ponctuelle —</option>
                {rubriquesODJ.filter((rubrique) => rubrique.actif).map((rubrique) => (
                  <option key={rubrique.id} value={rubrique.id}>{rubrique.libelle}</option>
                ))}
              </select>
            </FormField>
            {rubriquesODJ.length === 0 && <p className="text-xs text-primary-700">Aucune rubrique enregistrée : ajoutez votre premier point puis cochez l’option ci-dessous.</p>}
          </div>
          <FormField label="Titre du point" required>
            <input className="input" value={formPoint.titre || ''} placeholder="Ex : Collecte des cotisations"
              onChange={e => setFormPoint((point) => ({ ...point, titre: e.target.value, rubriqueId: '' }))}/>
          </FormField>
          {!formPoint.rubriqueId && formPoint.titre.trim() && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={enregistrerPointCommeRubrique} onChange={e => setEnregistrerPointCommeRubrique(e.target.checked)}/>
              Enregistrer cette rubrique pour les prochaines réunions
            </label>
          )}
          <FormField label="Type">
            <select className="select" value={formPoint.type||'administratif'} onChange={e=>setFormPoint(f=>({...f,type:e.target.value}))}>
              {Object.entries(typePointLabel).map(([k,l])=><option key={k} value={k}>{l}</option>)}
            </select>
          </FormField>
          <FormField label="Acteur responsable" hint="Seule cette personne pourra saisir cette rubrique une fois la séance ouverte">
            <select className="select" value={formPoint.acteurRole||''} onChange={e=>setFormPoint(f=>({...f,acteurRole:e.target.value}))}>
              <option value="">— Non assigné (tous peuvent saisir) —</option>
              {ACTEUR_ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </FormField>
          <FormField label="Description">
            <textarea className="input h-20 resize-none" placeholder="Détails du point…"
              value={formPoint.description||''} onChange={e=>setFormPoint(f=>({...f,description:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>

      {/* ── Modifier point ODJ ───────────────────────────── */}
      <Modal open={!!showEditPoint} onClose={()=>setShowEditPoint(null)} title="Modifier le point"
        footer={<><button onClick={()=>setShowEditPoint(null)} className="btn-secondary">Annuler</button><button onClick={handleEditPoint} className="btn-primary"><Pencil size={14}/>Enregistrer</button></>}>
        <div className="space-y-4">
          <FormField label="Titre du point" required><FP k="titre"/></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type">
              <select className="select" value={formPoint.type||'administratif'} onChange={e=>setFormPoint(f=>({...f,type:e.target.value}))}>
                {Object.entries(typePointLabel).map(([k,l])=><option key={k} value={k}>{l}</option>)}
              </select>
            </FormField>
            <FormField label="Statut">
              <select className="select" value={formPoint.statut||'prevu'} onChange={e=>setFormPoint(f=>({...f,statut:e.target.value}))}>
                {Object.entries(statutPointLabel).map(([k,l])=><option key={k} value={k}>{l}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Acteur responsable" hint="Seule cette personne pourra saisir cette rubrique une fois la séance ouverte">
            <select className="select" value={formPoint.acteurRole||''} onChange={e=>setFormPoint(f=>({...f,acteurRole:e.target.value}))}>
              <option value="">— Non assigné (tous peuvent saisir) —</option>
              {ACTEUR_ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </FormField>
          <FormField label="Description">
            <textarea className="input h-20 resize-none"
              value={formPoint.description||''} onChange={e=>setFormPoint(f=>({...f,description:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
