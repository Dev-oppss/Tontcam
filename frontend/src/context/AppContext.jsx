import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as mock from "../data/mockData";
import { computeEcheancesAvecPenalites } from "../lib/penalites";

// Les valeurs ci-dessous DOIVENT correspondre exactement à celles utilisées
// dans TypePicker / SmartFormFields (Reunions.jsx) — c'est ce qui détermine
// quels boutons de type de transaction apparaissent dans chaque groupe
// (Entrées / Sorties / Opérations bancaires) lors de la saisie en séance.
export const TX_TYPES = [
  { value: "cotisation",         label: "Cotisation",              dir: "entree", icon: "" },
  { value: "amende",             label: "Règlement sanction",       dir: "entree", icon: "" },
  { value: "remboursement_pret", label: "Remboursement prêt",       dir: "entree", icon: "" },
  { value: "divers_entree",      label: "Autre recette",            dir: "entree", icon: "" },
  { value: "pret_accorde",       label: "Prêt accordé",             dir: "sortie", icon: "" },
  { value: "aide_sociale",       label: "Aide sociale",             dir: "sortie", icon: "" },
  { value: "attribution_tour",   label: "Versement pot (tontine)",  dir: "sortie", icon: "" },
  { value: "divers_sortie",      label: "Autre dépense",            dir: "sortie", icon: "" },
  { value: "depot_banque",       label: "Dépôt en banque",          dir: "banque", icon: "" },
];

export const TX_LABELS = TX_TYPES.reduce((acc, type) => ({ ...acc, [type.value]: type.label }), {});

export const AppContext = createContext(null);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STORAGE_KEY = "tontix-workspace-v1";
const syncTypeSanctionLabels = (items = []) => {
  items.forEach((item) => {
    if (item?.code && item?.libelle) {
      mock.typeSancLabel[item.code] = item.libelle;
    }
  });
};

const emptyWorkspace = () => ({
  associations: [],
  currentAssociationId: null,
  setupComplete: false,
  user: null,
  membres: [],
  tontines: [],
  membresParTontine: [],
  reunions: [],
  rotations: [],
  encheres: [],
  banques: [],
  comptesBanque: [],
  operationsBanque: [],
  transfertsCaisse: [],
  typesSanction: [],
  prets: [],
  sanctions: [],
  fondAssurance: [],
  caisseJournal: [],
  utilisateurs: [],
  planningTours: [],
  seanceTransactions: [],
  evolutionCaisse: [],
  presences: [],
  rubriquesModele: [], // gabarit des rubriques d'ODJ réutilisé à la création de chaque nouvelle réunion
  aidesSociales: [],
  parametres: {},
  postes: [],
  mandats: [],
  decisionsAG: [],
  reglements: [],
  rapprochements: [],
  auditLog: [],
});

const readWorkspace = () => {
  if (typeof window === "undefined") return emptyWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    const parsed = JSON.parse(raw);
    return { ...emptyWorkspace(), ...parsed };
  } catch {
    return emptyWorkspace();
  }
};

export const AppProvider = ({ children }) => {
  const initial = readWorkspace();
  const [associations, setAssociations] = useState(initial.associations);
  const [currentAssociationId, setCurrentAssociationId] = useState(initial.currentAssociationId);
  const [setupComplete, setSetupComplete] = useState(initial.setupComplete || false);
  const [membres, setMembres] = useState(initial.membres);
  const [tontines, setTontines] = useState(initial.tontines);
  const [membresParTontine, setMembresParTontine] = useState(initial.membresParTontine);
  const [reunions, setReunions] = useState(initial.reunions);
  const [rotations, setRotations] = useState(initial.rotations);
  const [encheres, setEncheres] = useState(initial.encheres);
  const [banques, setBanques] = useState(initial.banques);
  const [comptesBanque, setComptesBanque] = useState(initial.comptesBanque);
  const [operationsBanque, setOperationsBanque] = useState(initial.operationsBanque);
  const [transfertsCaisse, setTransfertsCaisse] = useState(initial.transfertsCaisse || []);
  const [typesSanction, setTypesSanction] = useState(initial.typesSanction || []);
  const [prets, setPrets] = useState(initial.prets);
  const [sanctions, setSanctions] = useState(initial.sanctions);
  const [fondAssurance, setFondAssurance] = useState(initial.fondAssurance);
  const [caisseJournal, setCaisseJournal] = useState(initial.caisseJournal);
  const [utilisateurs, setUtilisateurs] = useState(initial.utilisateurs);
  const [planningTours, setPlanningTours] = useState(initial.planningTours);
  const [seanceTransactions, setSeanceTransactions] = useState(initial.seanceTransactions);
  const [evolutionCaisse, setEvolutionCaisse] = useState(initial.evolutionCaisse);
  const [presences, setPresences] = useState(initial.presences || []);
  const [rubriquesModele, setRubriquesModele] = useState(initial.rubriquesModele || []);
  const [aidesSociales, setAidesSociales] = useState(initial.aidesSociales || []);
  const [parametres, setParametres] = useState(initial.parametres || {});
  const [postes, setPostes] = useState(initial.postes || []);
  const [mandats, setMandats] = useState(initial.mandats || []);
  const [decisionsAG, setDecisionsAG] = useState(initial.decisionsAG || []);
  const [reglements, setReglements] = useState(initial.reglements || []);
  const [rapprochements, setRapprochements] = useState(initial.rapprochements || []);
  const [auditLog, setAuditLog] = useState(initial.auditLog || []);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(initial.user);
  const currentAssociation = useMemo(
    () => associations.find((asso) => asso.id === currentAssociationId) || associations[0] || null,
    [associations, currentAssociationId]
  );

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      associations,
      currentAssociationId,
      setupComplete,
      membres,
      tontines,
      membresParTontine,
      reunions,
      rotations,
      encheres,
      banques,
      comptesBanque,
      operationsBanque,
      transfertsCaisse,
      typesSanction,
      prets,
      sanctions,
      fondAssurance,
      caisseJournal,
      utilisateurs,
      planningTours,
      seanceTransactions,
      evolutionCaisse,
      presences,
      rubriquesModele,
      aidesSociales,
      parametres,
      postes,
      mandats,
      decisionsAG,
      reglements,
      rapprochements,
      auditLog,
      user,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    associations,
    currentAssociationId,
    setupComplete,
    membres,
    tontines,
    membresParTontine,
    reunions,
    rotations,
    encheres,
    banques,
    comptesBanque,
    operationsBanque,
    transfertsCaisse,
    typesSanction,
    prets,
    sanctions,
    fondAssurance,
    caisseJournal,
    utilisateurs,
    planningTours,
    seanceTransactions,
    evolutionCaisse,
    presences,
    rubriquesModele,
    aidesSociales,
    parametres,
    postes,
    mandats,
    decisionsAG,
    reglements,
    rapprochements,
    auditLog,
    user,
  ]);

  const applyWorkspace = useCallback((workspace) => {
    setAssociations(workspace.associations || []);
    setCurrentAssociationId(workspace.currentAssociationId || null);
    setSetupComplete(Boolean(workspace.setupComplete));
    setUser(workspace.user || null);
    setMembres(workspace.membres || []);
    setTontines(workspace.tontines || []);
    setMembresParTontine(workspace.membresParTontine || []);
    setReunions(workspace.reunions || []);
    setRotations(workspace.rotations || []);
    setEncheres(workspace.encheres || []);
    setBanques(workspace.banques || []);
    setComptesBanque(workspace.comptesBanque || []);
    setOperationsBanque(workspace.operationsBanque || []);
    setTransfertsCaisse(workspace.transfertsCaisse || []);
    const sanctionTypes = workspace.typesSanction || workspace.sanctionTypes || [];
    setTypesSanction(sanctionTypes);
    syncTypeSanctionLabels(sanctionTypes);
    setPrets(workspace.prets || []);
    setSanctions(workspace.sanctions || []);
    setFondAssurance(workspace.fondAssurance || []);
    setCaisseJournal(workspace.caisseJournal || []);
    setUtilisateurs(workspace.utilisateurs || []);
    setPlanningTours(workspace.planningTours || []);
    setSeanceTransactions(workspace.seanceTransactions || []);
    setEvolutionCaisse(workspace.evolutionCaisse || []);
    setPresences(workspace.presences || []);
    setRubriquesModele(workspace.rubriquesModele || []);
    setAidesSociales(workspace.aidesSociales || []);
    setParametres(workspace.parametres || {});
    setPostes(workspace.postes || []);
    setMandats(workspace.mandats || []);
    setDecisionsAG(workspace.decisionsAG || []);
    setReglements(workspace.reglements || []);
    setRapprochements(workspace.rapprochements || []);
    setAuditLog(workspace.auditLog || []);
  }, []);

  const dashboardStats = useMemo(() => ({
    membresActifs: membres.filter((m) => m.statut === "actif").length,
    totalMembres: membres.length,
    soldeCaisse: caisseJournal.reduce((s, e) => s + (e.type === "entree" ? Number(e.montant || 0) : -Number(e.montant || 0)), 0),
    totalBanques: comptesBanque.reduce((s, c) => s + Number(c.solde || 0), 0),
    totalPrets: prets.filter((p) => p.statut !== "rembourse").reduce((s, p) => s + Number(p.resteAPayer || 0), 0),
    totalPretsRestants: prets.filter((p) => p.statut !== "rembourse").reduce((s, p) => s + Number(p.resteAPayer || 0), 0),
    pretsEnCours: prets.filter((p) => p.statut === "en_cours").length,
    pretsEnRetard: prets.filter((p) => p.statut === "en_retard").length,
    tontinesActives: tontines.filter((t) => t.statut === "active").length,
    fondAssurance: fondAssurance.reduce((s, a) => s + Number(a.montantAide || 0), 0),
    caisseSociale: fondAssurance.reduce((s, a) => s + Number(a.montantAide || 0), 0),
    sanctionsImpayees: sanctions.filter((s) => s.statut === "impayee").length,
    prochaineReunion: reunions.filter((r) => r.statutReunion !== "cloturee").sort((a, b) => new Date(a.date) - new Date(b.date))[0]?.date || null,
  }), [membres, caisseJournal, comptesBanque, prets, tontines, fondAssurance, sanctions, reunions]);

  const repartitionBanques = banques.map((b) => ({
    name: b.nom,
    value: comptesBanque.filter((c) => c.idBanque === b.id).reduce((s, c) => s + Number(c.solde || 0), 0),
  }));

  const addMembre = async (data) => {
    const item = { id: uid(), numero: `M-${String(membres.length + 1).padStart(3, "0")}`, statut: "actif", dateAdhesion: today(), ...data };
    setMembres((prev) => [...prev, item]);
    logAudit("membres", "creation", null, item);
    showToast("Membre ajouté");
    return item;
  };
  const updateMembre = async (id, data) => {
    const avant = membres.find((m) => m.id === id);
    setMembres((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    logAudit("membres", "modification", avant, { ...avant, ...data });
    showToast("Membre modifié");
  };
  const deleteMembre = async (id) => {
    const avant = membres.find((m) => m.id === id);
    setMembres((prev) => prev.filter((m) => m.id !== id));
    setMembresParTontine((prev) => prev.filter((m) => m.idMembre !== id));
    logAudit("membres", "suppression", avant, null);
    showToast("Membre supprimé");
  };

  const addTontine = async (data) => { const item = { id: uid(), statut: "active", totalParts: 0, ...data }; setTontines((prev) => [...prev, item]); showToast("Tontine créée"); return item; };
  const updateTontine = async (data) => { setTontines((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t))); showToast("Tontine modifiée"); };
  const addMembreTontine = async (data) => { setMembresParTontine((prev) => [...prev, { id: uid(), statut: "actif", dateAdhesion: today(), ...data }]); showToast("Part ajoutée"); };
  const removeMembreTontine = async (id) => { setMembresParTontine((prev) => prev.filter((m) => m.id !== id)); showToast("Part retirée"); };
  const updateMembreTontine = async (idOrData, maybeData) => {
    const data = maybeData || idOrData;
    const id = maybeData ? idOrData : data.id;
    setMembresParTontine((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  };

  // ── Réunions & Ordre du Jour (rubriques + acteurs) ──────────
  // Gabarit des rubriques : à la création d'une nouvelle réunion, on
  // reprend automatiquement les rubriques (libellé + ordre + acteur
  // assigné) de la dernière réunion — jusqu'à ce qu'un utilisateur les
  // modifie manuellement pour cette réunion précise.
  const addReunion = async (data) => {
    const modele = rubriquesModele.length > 0 ? rubriquesModele : [];
    const pointsHerites = modele
      .slice()
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((p) => ({
        id: uid(),
        titre: p.titre,
        type: p.type || "administratif",
        description: p.description || "",
        acteurRole: p.acteurRole || "",
        ordre: p.ordre ?? 0,
        statut: "prevu",
        contenuRapport: "",
      }));
    const item = {
      id: uid(),
      statutReunion: "planifiee",
      pointsOrdreJour: data?.pointsOrdreJour || pointsHerites,
      cloture: null,
      ouverture: null,
      ...data,
    };
    setReunions((prev) => [item, ...prev]);
    showToast(pointsHerites.length > 0 ? "Réunion planifiée (ordre du jour repris de la dernière séance)" : "Réunion planifiée");
    return item;
  };

  const updateReunion = async (idOrData, maybeData) => { const data = maybeData || idOrData; const id = maybeData ? idOrData : data.id; setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r))); };

  // Une seule séance peut être ouverte à la fois, tous comptes confondus.
  const ouvrirSeance = (id, data) => {
    const dejaOuverte = reunions.find((r) => r.id !== id && r.statutReunion === "en_cours");
    if (dejaOuverte) {
      showToast(`Impossible : la séance du ${dejaOuverte.date || "—"} est déjà ouverte. Clôturez-la avant d'en ouvrir une autre.`, "error");
      return false;
    }
    setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, statutReunion: "en_cours", ouverture: data } : r)));
    showToast("Séance ouverte — les acteurs assignés peuvent saisir leurs rubriques");
    return true;
  };
  // Alias rétrocompatible
  const ouvrirReunion = ouvrirSeance;

  // À la clôture, on fige les rubriques (ordre + acteurs) de cette
  // réunion comme nouveau gabarit par défaut pour la prochaine création.
  const cloturerSeance = (id, data) => {
    const reunion = reunions.find((r) => r.id === id);
    if (reunion?.pointsOrdreJour?.length) {
      setRubriquesModele(
        reunion.pointsOrdreJour
          .slice()
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
          .map((p, index) => ({
            titre: p.titre, type: p.type, description: p.description,
            acteurRole: p.acteurRole || "", ordre: index + 1,
          }))
      );
    }
    setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, statutReunion: "cloturee", cloture: data } : r)));
    showToast("Réunion clôturée. Saisie verrouillée jusqu'à la prochaine séance.");
  };
  // Alias rétrocompatible
  const cloturerReunion = cloturerSeance;

  const addPointODJ = (reunionId, data) => {
    setReunions((prev) => prev.map((r) => {
      if (r.id !== reunionId) return r;
      const ordre = (r.pointsOrdreJour?.length || 0) + 1;
      const point = { id: uid(), statut: "prevu", contenuRapport: "", acteurRole: "", ordre, ...data };
      return { ...r, pointsOrdreJour: [...(r.pointsOrdreJour || []), point] };
    }));
    showToast("Rubrique ajoutée à l'ordre du jour");
  };

  const updatePointODJ = (reunionId, pointId, data) => {
    setReunions((prev) => prev.map((r) => {
      if (r.id !== reunionId) return r;
      return { ...r, pointsOrdreJour: (r.pointsOrdreJour || []).map((p) => (p.id === pointId ? { ...p, ...data } : p)) };
    }));
    showToast("Rubrique modifiée");
  };

  const removePointODJ = (reunionId, pointId) => {
    setReunions((prev) => prev.map((r) => {
      if (r.id !== reunionId) return r;
      if (r.statutReunion === "en_cours" || r.statutReunion === "cloturee") return r; // RG-REU-015
      return { ...r, pointsOrdreJour: (r.pointsOrdreJour || []).filter((p) => p.id !== pointId) };
    }));
    showToast("Rubrique retirée");
  };

  const movePointODJ = (reunionId, pointId, direction) => {
    setReunions((prev) => prev.map((r) => {
      if (r.id !== reunionId) return r;
      const points = (r.pointsOrdreJour || []).slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      const idx = points.findIndex((p) => p.id === pointId);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= points.length) return r;
      [points[idx], points[swapIdx]] = [points[swapIdx], points[idx]];
      const reordered = points.map((p, i) => ({ ...p, ordre: i + 1 }));
      return { ...r, pointsOrdreJour: reordered };
    }));
  };

  // ── Présences réunion (RG-REU-016 à 019) ────────────────────
  const setPresenceMembre = (reunionId, idMembre, data) => {
    setPresences((prev) => {
      const existant = prev.find((p) => p.reunionId === reunionId && p.idMembre === idMembre);
      if (existant) {
        return prev.map((p) => (p.reunionId === reunionId && p.idMembre === idMembre ? { ...p, ...data, dateSaisie: today() } : p));
      }
      return [...prev, { id: uid(), reunionId, idMembre, statut: "absent", motifAbsence: "", heureArrivee: "", saisiePar: user?.name || "—", dateSaisie: today(), ...data }];
    });
  };

  const addSeanceTransaction = async (reunionOrData, maybeData) => {
    const data = maybeData ? { ...maybeData, idReunion: reunionOrData } : reunionOrData;
    // modePaiement/detailsPaiement transitent librement dans data (RG-CAI-011)
    const tx = { id: uid(), date: new Date().toISOString(), modePaiement: data.modePaiement || "especes", ...data };
    setSeanceTransactions((prev) => [...prev, tx]);
    setCaisseJournal((prev) => [...prev, tx]);
    logAudit("transactions", tx.type || "transaction", null, tx);
    return tx;
  };

  const deleteSeanceTransaction = (id) => {
    const avant = seanceTransactions.find((t) => t.id === id);
    setSeanceTransactions((prev) => prev.filter((t) => t.id !== id));
    setCaisseJournal((prev) => prev.filter((t) => t.id !== id));
    logAudit("transactions", "suppression", avant, null);
    showToast("Transaction retirée");
  };

  const enregistrerBeneficiaireSeance = (data) => { setRotations((prev) => [...prev, { id: uid(), dateAttribution: today(), ...data }]); showToast("Bénéficiaire enregistré"); };
  // ── Tirage au sort pondéré par parts disponibles (RG-TON-015/017) ──
  // Exclut les membres déjà gagnants pour cette tontine (parts déjà "gagnées"),
  // pondère la probabilité par le nombre de parts encore disponibles.
  const tirerAuSort = (idTontine, numeroTour, datePrevue) => {
    const tontine = tontines.find((t) => t.id === idTontine);
    if (!tontine) return null;
    const dejaGagnants = {};
    planningTours.filter((p) => p.idTontine === idTontine && p.statut === "encaisse")
      .forEach((p) => { dejaGagnants[p.idMembre] = (dejaGagnants[p.idMembre] || 0) + 1; });

    const pool = [];
    membresParTontine
      .filter((mt) => mt.idTontine === idTontine && mt.statut === "actif")
      .forEach((mt) => {
        const partsDisponibles = Number(mt.nombreParts || 1) - (dejaGagnants[mt.idMembre] || 0);
        for (let i = 0; i < partsDisponibles; i++) pool.push(mt.idMembre);
      });
    if (pool.length === 0) return null;

    const idMembre = pool[Math.floor(Math.random() * pool.length)];
    const membre = membres.find((m) => m.id === idMembre);
    if (!membre) return null;
    const montantPot = Number(tontine.cotisation || 0) * Number(tontine.totalParts || 0);
    return { idMembre, nomMembre: `${membre.nom} ${membre.prenom}`, montantPot, numeroTour, datePrevue };
  };

  const addTourPlanning = (data) => {
    const item = { id: uid(), statut: "planifie", ...data };
    setPlanningTours((prev) => [...prev, item]);
    logAudit("planning_tours", "creation", null, item);
    showToast("Tour planifié");
    return item;
  };
  const marquerTourEncaisse = (id, modePaiement = "especes", detailsPaiement = "") => {
    setPlanningTours((prev) => prev.map((p) => (p.id === id ? {
      ...p, statut: "encaisse", dateEncaissement: today(),
      modePaiement: modePaiement || "especes", detailsPaiement: detailsPaiement || "",
    } : p)));
    showToast("Tour marqué comme encaissé");
  };
  const retirerTourPlanning = (id) => {
    setPlanningTours((prev) => prev.filter((p) => p.id !== id));
    showToast("Tour retiré de la planification");
  };

  const addEnchere = (data) => { setEncheres((prev) => [...prev, { id: uid(), statut: "en_attente", dateEnchere: today(), ...data }]); showToast("Enchère enregistrée"); };
  const attribuerTour = (idRotation, idMembre, montant) => {
    setEncheres((prev) => prev.map((e) => ({ ...e, statut: e.idRotation === idRotation ? (e.idMembre === idMembre ? "gagnee" : "perdue") : e.statut })));
    setRotations((prev) => prev.map((r) => (r.id === idRotation ? { ...r, idMembre, montantRecu: montant, dateAttribution: today() } : r)));
    showToast("Tour attribué");
  };
  const annulerEncheres = (idRotation) => { setEncheres((prev) => prev.filter((e) => e.idRotation !== idRotation)); showToast("Enchères annulées"); };

  const addBanque = async (data) => { setBanques((prev) => [...prev, { id: uid(), statut: "active", totalSolde: 0, dateCreation: today(), ...data }]); showToast("Caisse créée"); };
  const doOperation = async (data) => { const op = { id: uid(), date: new Date().toISOString(), modePaiement: data.modePaiement || "especes", ...data }; setOperationsBanque((prev) => [...prev, op]); logAudit("operations_banque", data.typeOperation || "operation", null, op); showToast("Opération enregistrée"); };
  const addMembreBanque = (data) => { setComptesBanque((prev) => [...prev, { id: uid(), solde: 0, statut: "actif", ...data }]); showToast("Compte ajouté"); };
  const transfererCaisse = async (data) => {
    const item = { id: uid(), statut: "effectue", dateTransfert: today(), ...data };
    setTransfertsCaisse((prev) => [...prev, item]);
    logAudit("transferts_caisse", "creation", null, item);
    showToast("Transfert enregistré");
    return item;
  };
  const addTypeSanction = async (data) => {
    const item = { id: uid(), association_id: currentAssociationId, actif: true, ...data };
    setTypesSanction((prev) => [...prev, item]);
    if (item.code && item.libelle) {
      mock.typeSancLabel[item.code] = item.libelle;
    }
    showToast("Type de sanction ajouté");
    return item;
  };
  const updateTypeSanction = async (id, data) => {
    setTypesSanction((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    showToast("Type de sanction modifié");
  };

  const addPret = async (data) => {
    const montant = Number(data.montantPret || 0);
    const taux = Number(data.tauxInteret || 0);
    const interet = Math.round((montant * taux) / 100);
    const item = {
      id: uid(),
      ...data,
      statut: "en_cours",
      montantRembourse: 0,
      montantInteret: interet,
      montantTotal: montant + interet,
      resteAPayer: montant + interet,
      datePret: data.datePret || today(),
    };
    setPrets((prev) => [...prev, item]);
    logAudit("prets", "creation", null, item);
    showToast("Prêt ajouté");
  };
  const rembourserPret = async (id, montant, extra = {}) => {
    const avant = prets.find((p) => p.id === id);
    setPrets((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const rembourse = Number(p.montantRembourse || 0) + Number(montant || 0);

      // Caisse associée : porte la config pénalité (RG-CAI, cf. Banques.jsx)
      const caisse = banques.find((b) => b.id === p.caisseId);
      const penaliteActive = Boolean(caisse?.penaliteRetardActive);
      const tauxPenalite = Number(caisse?.tauxPenalite || 0);

      let ficheAmortissement = p.ficheAmortissement;
      let resteAPayer = Math.max(0, Number(p.montantTotal || 0) - rembourse);
      let montantPenaliteTotal = 0;

      if (Array.isArray(p.ficheAmortissement) && p.ficheAmortissement.length > 0) {
        const calc = computeEcheancesAvecPenalites(
          p.ficheAmortissement, rembourse, tauxPenalite, penaliteActive
        );
        ficheAmortissement = calc.echeances;
        resteAPayer = calc.resteAPayer;
        montantPenaliteTotal = calc.totalPenalites;
      }

      const solde = resteAPayer <= 0;
      return {
        ...p,
        montantRembourse: rembourse,
        resteAPayer,
        montantPenaliteTotal,
        ficheAmortissement,
        statut: solde ? "rembourse" : (p.statut === "en_retard" && ficheAmortissement?.some(e => e.estEnRetard) ? "en_retard" : p.statut),
        dernierPaiement: {
          montant: Number(montant || 0),
          date: today(),
          modePaiement: extra.modePaiement || "especes",
          detailsPaiement: extra.detailsPaiement || "",
        },
      };
    }));
    logAudit("prets", "remboursement", avant, { montant: Number(montant || 0), ...extra });
    showToast("Remboursement enregistré");
  };
  const distribuerInteretsPret = () => showToast("Intérêts distribués");

  const addSanction = async (data) => {
    const item = { id: uid(), statut: "impayee", dateSanction: today(), ...data };
    setSanctions((prev) => [...prev, item]);
    logAudit("sanctions", "creation", null, item);
    showToast("Sanction ajoutée");
  };
  const payerSanction = async (id, extra = {}) => {
    const avant = sanctions.find((s) => s.id === id);
    setSanctions((prev) => prev.map((s) => (s.id === id ? {
      ...s, statut: "payee",
      modePaiement: extra.modePaiement || "especes",
      detailsPaiement: extra.detailsPaiement || "",
      datePaiement: today(),
    } : s)));
    logAudit("sanctions", "paiement", avant, extra);
    showToast("Sanction réglée");
  };
  const genererBulletin = async (data) => ({ id: uid(), ...data, pdfPending: true });
  const ouvrirBulletinPdf = () => showToast("Génération du bulletin en cours", "info");
  const addAide = async (data) => { setFondAssurance((prev) => [...prev, { id: uid(), statut: "verse", dateEvenement: today(), ...data }]); showToast("Aide ajoutée"); };
  const membreEligibleAssurance = (idMembre) => membres.some((m) => m.id === idMembre && m.statut === "actif");

  // ── Journal d'audit (RG-SEC-009 à 012) ──────────────────────
  // Enregistre automatiquement les opérations financières sensibles.
  // Immuable : aucune fonction de suppression/édition n'est exposée.
  const logAudit = useCallback((module, action, avant, apres) => {
    setAuditLog((prev) => [
      { id: uid(), module, action, avant: avant ?? null, apres: apres ?? null, utilisateur: user?.name || "Système", role: user?.role || "—", date: new Date().toISOString() },
      ...prev,
    ]);
  }, [user]);
  const logAuditConsultation = (filtres) => logAudit("audit_log", "consultation", null, { filtres, role: user?.role });

  // ── Aides sociales (RG-SOC-006 à 010) ────────────────────────
  const addAideSociale = (data) => {
    const item = { id: uid(), statut: "en_attente", dateDeclaration: today(), ...data };
    setAidesSociales((prev) => [...prev, item]);
    logAudit("aide_sociale", "creation", null, item);
    showToast("Demande d'aide sociale enregistrée");
    return item;
  };
  const validerAideSociale = (id, decision, montantAccorde) => {
    setAidesSociales((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const apres = { ...a, statut: decision === "approuvee" ? "approuvee" : "refusee", montantAccorde: decision === "approuvee" ? Number(montantAccorde ?? a.montant ?? 0) : 0, validePar: user?.name, dateValidation: today() };
      logAudit("aide_sociale", decision === "approuvee" ? "approbation" : "refus", a, apres);
      return apres;
    }));
    showToast(decision === "approuvee" ? "Aide approuvée" : "Aide refusée");
  };
  const verserAideSociale = (id, extra = {}) => {
    setAidesSociales((prev) => prev.map((a) => (a.id === id ? { ...a, statut: "versee", modePaiement: extra.modePaiement || "especes", detailsPaiement: extra.detailsPaiement || "", dateVersement: today() } : a)));
    showToast("Aide versée");
  };

  // ── Paramètres association (RG-ORG-012 à 015) ───────────────
  const updateParametres = (patch) => {
    setParametres((prev) => { const apres = { ...prev, ...patch }; logAudit("parametres", "modification", prev, apres); return apres; });
    showToast("Paramètres mis à jour");
  };

  // ── Postes & mandats (RG-ORG-007 à 011) ─────────────────────
  const addMandat = (data) => {
    const item = { id: uid(), ...data };
    setMandats((prev) => [...prev, item]);
    logAudit("mandat", "attribution", null, item);
    showToast("Poste attribué");
    return item;
  };
  const cloturerMandat = (id) => {
    setMandats((prev) => prev.map((m) => (m.id === id ? { ...m, dateFin: today() } : m)));
    showToast("Mandat clôturé");
  };

  // ── Décisions d'AG (RG-SOC-011 à 014) ───────────────────────
  const addDecisionAG = (data) => {
    const item = { id: uid(), numero: `AG-${new Date().getFullYear()}-${String(decisionsAG.length + 1).padStart(3, "0")}`, statut: "adopte", dateEffet: today(), ...data };
    setDecisionsAG((prev) => [item, ...prev]);
    logAudit("decision_ag", "creation", null, item);
    showToast("Décision AG enregistrée");
    return item;
  };

  // ── Règlement intérieur (RG-ORG-004 à 006) ──────────────────
  const addReglement = (data) => {
    // Une seule version active à la fois (RG-ORG-005)
    setReglements((prev) => [
      { id: uid(), estActif: true, dateAdoption: today(), ...data },
      ...prev.map((r) => ({ ...r, estActif: false })),
    ]);
    showToast("Nouvelle version du règlement publiée");
  };

  // ── Rapprochement bancaire (RG-CAI-017 à 019) ───────────────
  const addRapprochement = (data) => {
    const item = { id: uid(), justifie: false, ...data };
    setRapprochements((prev) => [item, ...prev]);
    logAudit("rapprochement_bancaire", "creation", null, item);
    if (item.statut === "ecart") showToast("Écart détecté — justification requise sous 30 jours", "error");
    else showToast("Rapprochement conforme");
    return item;
  };
  const justifierEcart = (id, motif) => {
    setRapprochements((prev) => prev.map((r) => (r.id === id ? { ...r, justifie: true, motifJustification: motif, justifiePar: user?.name, dateJustification: today() } : r)));
    showToast("Écart justifié");
  };
  const addCaisseEntry = async (data) => { setCaisseJournal((prev) => [...prev, { id: uid(), date: new Date().toISOString(), ...data }]); };
  const addPlanningTour = (data) => setPlanningTours((prev) => [...prev, { id: uid(), ...data }]);
  const addUtilisateur = (data) => { setUtilisateurs((prev) => [...prev, { id: uid(), statut: "actif", derniereConnexion: "-", ...data }]); showToast("Utilisateur créé"); };
  const desactiverUtilisateur = (id) => { setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: "inactif" } : u))); showToast("Utilisateur désactivé"); };
  const activerUtilisateur = (id) => { setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: "actif" } : u))); showToast("Utilisateur activé"); };
  const createAssociation = async (data) => {
    const nom = String(data?.nom || "").trim();
    const association = {
      id: uid(),
      nom,
      abrege: data?.abrege || nom.slice(0, 3).toUpperCase() || "ASS",
      ville: data?.ville || "Douala",
      pays: data?.pays || "Cameroun",
      devise: data?.devise || "XAF",
      siege: data?.siege || "",
      telephone: data?.telephone || "",
      email: data?.email || "",
      statut: "active",
    };
    applyWorkspace({
      ...emptyWorkspace(),
      associations: [association],
      currentAssociationId: association.id,
      setupComplete: true,
    });
    showToast("Association créée");
    return association;
  };
  const resetWorkspace = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    applyWorkspace(emptyWorkspace());
    showToast("Espace réinitialisé");
  };

  const value = {
    membres, tontines, membresParTontine, reunions, rotations, encheres, banques, caisses: banques, comptesBanque, operationsBanque, transfertsCaisse, typesSanction,
    prets, sanctions, fondAssurance, aidesAssurance: fondAssurance, caisseSociale: fondAssurance, caisseJournal,
    utilisateurs, planningTours, seanceTransactions, evolutionCaisse, dashboardStats, repartitionBanques,
    presences, rubriquesModele,
    aidesSociales, parametres, postes, mandats, decisionsAG, reglements, rapprochements, auditLog,
    associations, currentAssociation, currentAssociationId, setupComplete, toast, user,
    addMembre, updateMembre, deleteMembre, addTontine, updateTontine, addMembreTontine, removeMembreTontine, updateMembreTontine,
    addReunion, updateReunion, ouvrirReunion, cloturerReunion, ouvrirSeance, cloturerSeance,
    addPointODJ, updatePointODJ, removePointODJ, movePointODJ,
    setPresenceMembre,
    addSeanceTransaction, deleteSeanceTransaction, enregistrerBeneficiaireSeance, tirerAuSort,
    addEnchere, attribuerTour, annulerEncheres, addBanque, addCaisse: addBanque, doOperation, addMembreBanque, transfererCaisse, addTypeSanction, updateTypeSanction, addPret, rembourserPret, distribuerInteretsPret,
    addSanction, payerSanction, genererBulletin, ouvrirBulletinPdf, addAide, membreEligibleAssurance, addCaisseEntry, addPlanningTour,
    addTourPlanning, marquerTourEncaisse, retirerTourPlanning,
    addUtilisateur, desactiverUtilisateur, activerUtilisateur, showToast,
    setCurrentAssociationId, createAssociation, resetWorkspace,
    addAideSociale, validerAideSociale, verserAideSociale,
    updateParametres,
    addMandat, cloturerMandat,
    addDecisionAG,
    addReglement,
    addRapprochement, justifierEcart,
    logAudit, logAuditConsultation,
    login: async (credentials) => {
      const next = { id: uid(), name: credentials.name || credentials.email || "Utilisateur", role: credentials.role || "president" };
      setUser(next);
      showToast("Connexion réussie");
      return { user: next, must_change_password: false };
    },
    changePassword: async () => { showToast("Mot de passe mis à jour", "info"); },
    logout: async () => { setUser(null); showToast("Déconnecté"); },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp doit etre utilise dans AppProvider");
  return context;
};
