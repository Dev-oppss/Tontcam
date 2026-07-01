import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as mock from "../data/mockData";

export const TX_TYPES = [
  { value: "cotisation", label: "Cotisation", dir: "entree", icon: "" },
  { value: "depot_banque", label: "Dépôt caisse", dir: "entree", icon: "" },
  { value: "sanction", label: "Sanction", dir: "entree", icon: "" },
  { value: "pret", label: "Prêt accordé", dir: "sortie", icon: "" },
  { value: "remboursement", label: "Remboursement prêt", dir: "entree", icon: "" },
  { value: "retrait", label: "Retrait", dir: "sortie", icon: "" },
  { value: "autre", label: "Autre", dir: "entree", icon: "" },
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
    showToast("Membre ajouté");
    return item;
  };
  const updateMembre = async (id, data) => { setMembres((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m))); showToast("Membre modifié"); };
  const deleteMembre = async (id) => { setMembres((prev) => prev.filter((m) => m.id !== id)); setMembresParTontine((prev) => prev.filter((m) => m.idMembre !== id)); showToast("Membre supprimé"); };

  const addTontine = async (data) => { const item = { id: uid(), statut: "active", totalParts: 0, ...data }; setTontines((prev) => [...prev, item]); showToast("Tontine créée"); return item; };
  const updateTontine = async (data) => { setTontines((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t))); showToast("Tontine modifiée"); };
  const addMembreTontine = async (data) => { setMembresParTontine((prev) => [...prev, { id: uid(), statut: "actif", dateAdhesion: today(), ...data }]); showToast("Part ajoutée"); };
  const removeMembreTontine = async (id) => { setMembresParTontine((prev) => prev.filter((m) => m.id !== id)); showToast("Part retirée"); };
  const updateMembreTontine = async (idOrData, maybeData) => {
    const data = maybeData || idOrData;
    const id = maybeData ? idOrData : data.id;
    setMembresParTontine((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  };

  const addReunion = async (data) => { const item = { id: uid(), statutReunion: "planifiee", pointsOrdreJour: [], cloture: null, ...data }; setReunions((prev) => [item, ...prev]); showToast("Réunion planifiée"); return item; };
  const updateReunion = async (idOrData, maybeData) => { const data = maybeData || idOrData; const id = maybeData ? idOrData : data.id; setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r))); };
  const ouvrirReunion = (id, data) => { setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, statutReunion: "en_cours", ouverture: data } : r))); showToast("Réunion ouverte"); };
  const cloturerReunion = (id, data) => { setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, statutReunion: "cloturee", cloture: data } : r))); showToast("Réunion clôturée"); };

  const addSeanceTransaction = async (reunionOrData, maybeData) => {
    const data = maybeData ? { ...maybeData, idReunion: reunionOrData } : reunionOrData;
    const tx = { id: uid(), date: new Date().toISOString(), ...data };
    setSeanceTransactions((prev) => [...prev, tx]);
    setCaisseJournal((prev) => [...prev, tx]);
    return tx;
  };

  const enregistrerBeneficiaireSeance = (data) => { setRotations((prev) => [...prev, { id: uid(), dateAttribution: today(), ...data }]); showToast("Bénéficiaire enregistré"); };
  const tirerAuSort = (idTontine) => {
    const inscrits = membresParTontine.filter((m) => m.idTontine === idTontine && m.statut === "actif");
    const gagne = inscrits[Math.floor(Math.random() * inscrits.length)];
    const membre = membres.find((m) => m.id === gagne?.idMembre);
    return membre ? `${membre.nom} ${membre.prenom}` : null;
  };

  const addEnchere = (data) => { setEncheres((prev) => [...prev, { id: uid(), statut: "en_attente", dateEnchere: today(), ...data }]); showToast("Enchère enregistrée"); };
  const attribuerTour = (idRotation, idMembre, montant) => {
    setEncheres((prev) => prev.map((e) => ({ ...e, statut: e.idRotation === idRotation ? (e.idMembre === idMembre ? "gagnee" : "perdue") : e.statut })));
    setRotations((prev) => prev.map((r) => (r.id === idRotation ? { ...r, idMembre, montantRecu: montant, dateAttribution: today() } : r)));
    showToast("Tour attribué");
  };
  const annulerEncheres = (idRotation) => { setEncheres((prev) => prev.filter((e) => e.idRotation !== idRotation)); showToast("Enchères annulées"); };

  const addBanque = async (data) => { setBanques((prev) => [...prev, { id: uid(), statut: "active", totalSolde: 0, dateCreation: today(), ...data }]); showToast("Caisse créée"); };
  const doOperation = async (data) => { const op = { id: uid(), date: new Date().toISOString(), ...data }; setOperationsBanque((prev) => [...prev, op]); showToast("Opération enregistrée"); };
  const addMembreBanque = (data) => { setComptesBanque((prev) => [...prev, { id: uid(), solde: 0, statut: "actif", ...data }]); showToast("Compte ajouté"); };
  const transfererCaisse = async (data) => {
    const item = { id: uid(), statut: "effectue", dateTransfert: today(), ...data };
    setTransfertsCaisse((prev) => [...prev, item]);
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
    setPrets((prev) => [...prev, {
      id: uid(),
      ...data,
      statut: "en_cours",
      montantRembourse: 0,
      montantInteret: interet,
      montantTotal: montant + interet,
      resteAPayer: montant + interet,
      datePret: data.datePret || today(),
    }]);
    showToast("Prêt ajouté");
  };
  const rembourserPret = async (id, montant) => {
    setPrets((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const rembourse = Number(p.montantRembourse || 0) + Number(montant || 0);
      const reste = Math.max(0, Number(p.montantTotal || 0) - rembourse);
      return { ...p, montantRembourse: rembourse, resteAPayer: reste, statut: reste === 0 ? "rembourse" : p.statut };
    }));
    showToast("Remboursement enregistré");
  };
  const distribuerInteretsPret = () => showToast("Intérêts distribués");

  const addSanction = async (data) => { setSanctions((prev) => [...prev, { id: uid(), statut: "impayee", dateSanction: today(), ...data }]); showToast("Sanction ajoutée"); };
  const payerSanction = async (id) => { setSanctions((prev) => prev.map((s) => (s.id === id ? { ...s, statut: "payee" } : s))); showToast("Sanction réglée"); };
  const genererBulletin = async (data) => ({ id: uid(), ...data, pdfPending: true });
  const ouvrirBulletinPdf = () => showToast("Génération du bulletin en cours", "info");
  const addAide = async (data) => { setFondAssurance((prev) => [...prev, { id: uid(), statut: "verse", dateEvenement: today(), ...data }]); showToast("Aide ajoutée"); };
  const membreEligibleAssurance = (idMembre) => membres.some((m) => m.id === idMembre && m.statut === "actif");
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
    associations, currentAssociation, currentAssociationId, setupComplete, toast, user,
    addMembre, updateMembre, deleteMembre, addTontine, updateTontine, addMembreTontine, removeMembreTontine, updateMembreTontine,
    addReunion, updateReunion, ouvrirReunion, cloturerReunion, addSeanceTransaction, enregistrerBeneficiaireSeance, tirerAuSort,
    addEnchere, attribuerTour, annulerEncheres, addBanque, addCaisse: addBanque, doOperation, addMembreBanque, transfererCaisse, addTypeSanction, updateTypeSanction, addPret, rembourserPret, distribuerInteretsPret,
    addSanction, payerSanction, genererBulletin, ouvrirBulletinPdf, addAide, membreEligibleAssurance, addCaisseEntry, addPlanningTour,
    addUtilisateur, desactiverUtilisateur, activerUtilisateur, showToast,
    setCurrentAssociationId, createAssociation, resetWorkspace,
    login: async (credentials) => {
      const next = { id: uid(), name: credentials.name || credentials.email || "Utilisateur", role: "president" };
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
