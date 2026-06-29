import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as mock from "../data/mockData";

export const TX_TYPES = [
  { value: "cotisation", label: "Cotisation", dir: "entree", icon: "" },
  { value: "depot_banque", label: "Depot banque", dir: "entree", icon: "" },
  { value: "sanction", label: "Sanction", dir: "entree", icon: "" },
  { value: "pret", label: "Pret accorde", dir: "sortie", icon: "" },
  { value: "remboursement", label: "Remboursement pret", dir: "entree", icon: "" },
  { value: "retrait", label: "Retrait", dir: "sortie", icon: "" },
  { value: "autre", label: "Autre", dir: "entree", icon: "" },
];

export const TX_LABELS = TX_TYPES.reduce((acc, type) => ({ ...acc, [type.value]: type.label }), {});

export const AppContext = createContext(null);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const STORAGE_KEY = "tontix-demo-workspace-v1";

const emptyWorkspace = () => ({
  associations: [],
  currentAssociationId: null,
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
  prets: [],
  sanctions: [],
  fondAssurance: [],
  caisseJournal: [],
  utilisateurs: [],
  planningTours: [],
  seanceTransactions: [],
  evolutionCaisse: [],
});

const createDemoWorkspace = () => {
  const association = {
    id: "asso-demo-tontix",
    nom: "TONTIX Solidarité Cameroun",
    abrege: "TSC",
    ville: "Douala",
    pays: "Cameroun",
    devise: "XAF",
    siege: "Akwa, Douala",
    telephone: "+237 699 100 200",
    email: "contact@tontix.cm",
    statut: "active",
  };

  const membres = [
    { id: "m1", association_id: association.id, nom: "Mballa", prenom: "Aline", statut: "actif", telephone: "+237 691 111 111" },
    { id: "m2", association_id: association.id, nom: "Ndzi", prenom: "Patrick", statut: "actif", telephone: "+237 691 111 112" },
    { id: "m3", association_id: association.id, nom: "Biloa", prenom: "Mireille", statut: "actif", telephone: "+237 691 111 113" },
    { id: "m4", association_id: association.id, nom: "Essono", prenom: "Jean", statut: "actif", telephone: "+237 691 111 114" },
    { id: "m5", association_id: association.id, nom: "Ngassa", prenom: "Clarisse", statut: "suspendu", telephone: "+237 691 111 115" },
    { id: "m6", association_id: association.id, nom: "Mouangue", prenom: "Robert", statut: "actif", telephone: "+237 691 111 116" },
  ];

  const banques = [
    { id: "b1", association_id: association.id, nom: "Caisse Tontine", statut: "active" },
    { id: "b2", association_id: association.id, nom: "Mutuelle", statut: "active" },
  ];

  const comptesBanque = [
    { id: "cb1", idBanque: "b1", idMembre: "m1", nomMembre: "Aline Mballa", solde: 180000 },
    { id: "cb2", idBanque: "b1", idMembre: "m2", nomMembre: "Patrick Ndzi", solde: 120000 },
    { id: "cb3", idBanque: "b2", idMembre: "m3", nomMembre: "Mireille Biloa", solde: 250000 },
  ];

  const tontines = [
    { id: "t1", association_id: association.id, nom: "Tontine Mensuelle", statut: "active", cotisation: 25000, totalParts: 12, nbTours: 12, periode: "mensuel", typeAttribution: "rotation" },
    { id: "t2", association_id: association.id, nom: "Tontine Enchère", statut: "active", cotisation: 50000, totalParts: 8, nbTours: 8, periode: "mensuel", typeAttribution: "enchere" },
  ];

  const membresParTontine = [
    { id: "tp1", idTontine: "t1", idMembre: "m1", nom: "Mballa", prenom: "Aline", statut: "actif" },
    { id: "tp2", idTontine: "t1", idMembre: "m2", nom: "Ndzi", prenom: "Patrick", statut: "actif" },
    { id: "tp3", idTontine: "t1", idMembre: "m3", nom: "Biloa", prenom: "Mireille", statut: "actif" },
    { id: "tp4", idTontine: "t2", idMembre: "m4", nom: "Essono", prenom: "Jean", statut: "actif" },
  ];

  const reunions = [
    { id: "r1", association_id: association.id, numero: 1, date: "2026-06-28", lieu: "Salle communautaire", statutReunion: "ouverte", type: "ordinaire", pointsOrdreJour: [] },
    { id: "r2", association_id: association.id, numero: 2, date: "2026-07-05", lieu: "Quartier Bonanjo", statutReunion: "planifiee", type: "ordinaire", pointsOrdreJour: [] },
  ];

  const rotations = [
    { id: "rot1", idTontine: "t1", numeroTour: 1, beneficiaire: "Aline Mballa", montantRecu: 250000, dateAttribution: "2026-06-10" },
    { id: "rot2", idTontine: "t1", numeroTour: 2, beneficiaire: "Patrick Ndzi", montantRecu: 250000, dateAttribution: "2026-07-10" },
  ];

  const encheres = [
    { id: "e1", idRotation: "t2", idMembre: "m4", statut: "en_attente", mise: 120000 },
  ];

  const prets = [
    { id: "p1", idMembre: "m3", nomMembre: "Mireille Biloa", montantPret: 500000, tauxInteret: 10, montantInteret: 50000, montantTotal: 550000, montantRembourse: 150000, resteAPayer: 400000, statut: "en_cours", datePret: "2026-05-28", interetsDistribues: false, repartitionInterets: [] },
    { id: "p2", idMembre: "m6", nomMembre: "Robert Mouangue", montantPret: 300000, tauxInteret: 8, montantInteret: 24000, montantTotal: 324000, montantRembourse: 324000, resteAPayer: 0, statut: "rembourse", datePret: "2026-04-12", interetsDistribues: true, repartitionInterets: [] },
  ];

  const sanctions = [
    { id: "s1", idMembre: "m5", nomMembre: "Clarisse Ngassa", motif: "Retard cotisation", montant: 5000, statut: "impayee", dateSanction: "2026-06-20" },
    { id: "s2", idMembre: "m4", nomMembre: "Jean Essono", motif: "Absence réunion", montant: 2500, statut: "payee", dateSanction: "2026-06-15" },
  ];

  const fondAssurance = [
    { id: "fa1", nomEvenement: "Naissance", montantAide: 25000, statut: "verse", dateEvenement: "2026-06-14" },
    { id: "fa2", nomEvenement: "Maladie", montantAide: 50000, statut: "verse", dateEvenement: "2026-06-18" },
  ];

  const caisseJournal = [
    { id: "cj1", type: "entree", montant: 250000, libelle: "Cotisations", date: "2026-06-28" },
    { id: "cj2", type: "sortie", montant: 50000, libelle: "Aide sociale", date: "2026-06-28" },
  ];

  const utilisateurs = [
    { id: "u1", nom: "Administrateur", role: "super_admin", statut: "actif", derniereConnexion: "Aujourd'hui" },
    { id: "u2", nom: "Secrétaire", role: "secretaire", statut: "actif", derniereConnexion: "Hier" },
  ];

  const planningTours = [
    { id: "pt1", idTontine: "t1", numeroTour: 3, nomMembre: "Mireille Biloa", statut: "planifie" },
    { id: "pt2", idTontine: "t1", numeroTour: 4, nomMembre: "Jean Essono", statut: "planifie" },
  ];

  const evolutionCaisse = [
    { mois: "Fév", entrees: 220000, sorties: 80000 },
    { mois: "Mar", entrees: 290000, sorties: 90000 },
    { mois: "Avr", entrees: 320000, sorties: 120000 },
    { mois: "Mai", entrees: 410000, sorties: 110000 },
    { mois: "Juin", entrees: 520000, sorties: 170000 },
  ];

  return {
    associations: [association],
    currentAssociationId: association.id,
    user: { id: "u1", name: "Administration", role: "super_admin" },
    membres,
    tontines,
    membresParTontine,
    reunions,
    rotations,
    encheres,
    banques,
    comptesBanque,
    operationsBanque: [
      { id: "op1", idBanque: "b1", type: "entree", montant: 150000, libelle: "Dépôt caisse" },
      { id: "op2", idBanque: "b2", type: "sortie", montant: 50000, libelle: "Aide médicale" },
    ],
    prets,
    sanctions,
    fondAssurance,
    caisseJournal,
    utilisateurs,
    planningTours,
    seanceTransactions: [],
    evolutionCaisse,
  };
};

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
  const [membres, setMembres] = useState(initial.membres);
  const [tontines, setTontines] = useState(initial.tontines);
  const [membresParTontine, setMembresParTontine] = useState(initial.membresParTontine);
  const [reunions, setReunions] = useState(initial.reunions);
  const [rotations, setRotations] = useState(initial.rotations);
  const [encheres, setEncheres] = useState(initial.encheres);
  const [banques, setBanques] = useState(initial.banques);
  const [comptesBanque, setComptesBanque] = useState(initial.comptesBanque);
  const [operationsBanque, setOperationsBanque] = useState(initial.operationsBanque);
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
      membres,
      tontines,
      membresParTontine,
      reunions,
      rotations,
      encheres,
      banques,
      comptesBanque,
      operationsBanque,
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
    membres,
    tontines,
    membresParTontine,
    reunions,
    rotations,
    encheres,
    banques,
    comptesBanque,
    operationsBanque,
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
    showToast("Membre ajoute");
    return item;
  };
  const updateMembre = async (id, data) => { setMembres((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m))); showToast("Membre modifie"); };
  const deleteMembre = async (id) => { setMembres((prev) => prev.filter((m) => m.id !== id)); setMembresParTontine((prev) => prev.filter((m) => m.idMembre !== id)); showToast("Membre supprime"); };

  const addTontine = async (data) => { const item = { id: uid(), statut: "active", totalParts: 0, ...data }; setTontines((prev) => [...prev, item]); showToast("Tontine creee"); return item; };
  const updateTontine = async (data) => { setTontines((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t))); showToast("Tontine modifiee"); };
  const addMembreTontine = async (data) => { setMembresParTontine((prev) => [...prev, { id: uid(), statut: "actif", dateAdhesion: today(), ...data }]); showToast("Part ajoutee"); };
  const removeMembreTontine = async (id) => { setMembresParTontine((prev) => prev.filter((m) => m.id !== id)); showToast("Part retiree"); };
  const updateMembreTontine = async (idOrData, maybeData) => {
    const data = maybeData || idOrData;
    const id = maybeData ? idOrData : data.id;
    setMembresParTontine((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  };

  const addReunion = async (data) => { const item = { id: uid(), statutReunion: "planifiee", pointsOrdreJour: [], cloture: null, ...data }; setReunions((prev) => [item, ...prev]); showToast("Reunion planifiee"); return item; };
  const updateReunion = async (idOrData, maybeData) => { const data = maybeData || idOrData; const id = maybeData ? idOrData : data.id; setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r))); };
  const ouvrirReunion = (id, data) => { setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, statutReunion: "en_cours", ouverture: data } : r))); showToast("Reunion ouverte"); };
  const cloturerReunion = (id, data) => { setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, statutReunion: "cloturee", cloture: data } : r))); showToast("Reunion cloturee"); };

  const addSeanceTransaction = async (reunionOrData, maybeData) => {
    const data = maybeData ? { ...maybeData, idReunion: reunionOrData } : reunionOrData;
    const tx = { id: uid(), date: new Date().toISOString(), ...data };
    setSeanceTransactions((prev) => [...prev, tx]);
    setCaisseJournal((prev) => [...prev, tx]);
    return tx;
  };

  const enregistrerBeneficiaireSeance = (data) => { setRotations((prev) => [...prev, { id: uid(), dateAttribution: today(), ...data }]); showToast("Beneficiaire enregistre"); };
  const tirerAuSort = (idTontine) => {
    const inscrits = membresParTontine.filter((m) => m.idTontine === idTontine && m.statut === "actif");
    const gagne = inscrits[Math.floor(Math.random() * inscrits.length)];
    const membre = membres.find((m) => m.id === gagne?.idMembre);
    return membre ? `${membre.nom} ${membre.prenom}` : null;
  };

  const addEnchere = (data) => { setEncheres((prev) => [...prev, { id: uid(), statut: "en_attente", dateEnchere: today(), ...data }]); showToast("Enchere enregistree"); };
  const attribuerTour = (idRotation, idMembre, montant) => {
    setEncheres((prev) => prev.map((e) => ({ ...e, statut: e.idRotation === idRotation ? (e.idMembre === idMembre ? "gagnee" : "perdue") : e.statut })));
    setRotations((prev) => prev.map((r) => (r.id === idRotation ? { ...r, idMembre, montantRecu: montant, dateAttribution: today() } : r)));
    showToast("Tour attribue");
  };
  const annulerEncheres = (idRotation) => { setEncheres((prev) => prev.filter((e) => e.idRotation !== idRotation)); showToast("Encheres annulees"); };

  const addBanque = async (data) => { setBanques((prev) => [...prev, { id: uid(), statut: "active", totalSolde: 0, dateCreation: today(), ...data }]); showToast("Banque creee"); };
  const doOperation = async (data) => { const op = { id: uid(), date: new Date().toISOString(), ...data }; setOperationsBanque((prev) => [...prev, op]); showToast("Operation enregistree"); };
  const addMembreBanque = (data) => { setComptesBanque((prev) => [...prev, { id: uid(), solde: 0, statut: "actif", ...data }]); showToast("Compte ajoute"); };

  const addPret = async (data) => {
    const montant = Number(data.montantPret || 0);
    const taux = Number(data.tauxInteret || 0);
    const interet = Math.round((montant * taux) / 100);
    setPrets((prev) => [...prev, { id: uid(), statut: "en_cours", montantRembourse: 0, montantInteret: interet, montantTotal: montant + interet, resteAPayer: montant + interet, datePret: today(), ...data }]);
    showToast("Pret ajoute");
  };
  const rembourserPret = async (id, montant) => {
    setPrets((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const rembourse = Number(p.montantRembourse || 0) + Number(montant || 0);
      const reste = Math.max(0, Number(p.montantTotal || 0) - rembourse);
      return { ...p, montantRembourse: rembourse, resteAPayer: reste, statut: reste === 0 ? "rembourse" : p.statut };
    }));
    showToast("Remboursement enregistre");
  };
  const distribuerInteretsPret = () => showToast("Interets distribues");

  const addSanction = async (data) => { setSanctions((prev) => [...prev, { id: uid(), statut: "impayee", dateSanction: today(), ...data }]); showToast("Sanction ajoutee"); };
  const payerSanction = async (id) => { setSanctions((prev) => prev.map((s) => (s.id === id ? { ...s, statut: "payee" } : s))); showToast("Sanction reglee"); };
  const genererBulletin = async (data) => ({ id: uid(), ...data, pdfPending: true });
  const ouvrirBulletinPdf = () => showToast("Generation PDF disponible apres branchement API", "info");
  const addAide = async (data) => { setFondAssurance((prev) => [...prev, { id: uid(), statut: "verse", dateEvenement: today(), ...data }]); showToast("Aide ajoutee"); };
  const membreEligibleAssurance = (idMembre) => membres.some((m) => m.id === idMembre && m.statut === "actif");
  const addCaisseEntry = async (data) => { setCaisseJournal((prev) => [...prev, { id: uid(), date: new Date().toISOString(), ...data }]); };
  const addPlanningTour = (data) => setPlanningTours((prev) => [...prev, { id: uid(), ...data }]);
  const addUtilisateur = (data) => { setUtilisateurs((prev) => [...prev, { id: uid(), statut: "actif", derniereConnexion: "-", ...data }]); showToast("Utilisateur cree"); };
  const desactiverUtilisateur = (id) => { setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: "inactif" } : u))); showToast("Utilisateur desactive"); };
  const activerUtilisateur = (id) => { setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: "actif" } : u))); showToast("Utilisateur active"); };
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
    });
    showToast("Association creee");
    return association;
  };
  const loadDemoWorkspace = async () => {
    applyWorkspace(createDemoWorkspace());
    showToast("Démo chargee");
  };
  const resetWorkspace = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    applyWorkspace(emptyWorkspace());
    showToast("Workspace reinitialise");
  };

  const value = {
    membres, tontines, membresParTontine, reunions, rotations, encheres, banques, comptesBanque, operationsBanque,
    prets, sanctions, fondAssurance, aidesAssurance: fondAssurance, caisseSociale: fondAssurance, caisseJournal,
    utilisateurs, planningTours, seanceTransactions, evolutionCaisse, dashboardStats, repartitionBanques,
    associations, currentAssociation, currentAssociationId, toast, apiStatus: "disabled", user,
    addMembre, updateMembre, deleteMembre, addTontine, updateTontine, addMembreTontine, removeMembreTontine, updateMembreTontine,
    addReunion, updateReunion, ouvrirReunion, cloturerReunion, addSeanceTransaction, enregistrerBeneficiaireSeance, tirerAuSort,
    addEnchere, attribuerTour, annulerEncheres, addBanque, doOperation, addMembreBanque, addPret, rembourserPret, distribuerInteretsPret,
    addSanction, payerSanction, genererBulletin, ouvrirBulletinPdf, addAide, membreEligibleAssurance, addCaisseEntry, addPlanningTour,
    addUtilisateur, desactiverUtilisateur, activerUtilisateur, showToast,
    setCurrentAssociationId, createAssociation, loadDemoWorkspace, resetWorkspace,
    login: async (credentials) => { const next = { id: "local", name: credentials.email || "Utilisateur", role: "local" }; setUser(next); showToast("Session locale ouverte"); return { user: next, must_change_password: false }; },
    changePassword: async () => { showToast("Mot de passe gere par le backend final", "info"); },
    logout: async () => { setUser(null); showToast("Deconnecte"); },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp doit etre utilise dans AppProvider");
  return context;
};
