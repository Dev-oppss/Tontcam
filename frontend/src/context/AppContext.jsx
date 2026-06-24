import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
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

const AppContext = createContext();
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const AppProvider = ({ children }) => {
  const [membres, setMembres] = useState(mock.membres);
  const [tontines, setTontines] = useState(mock.tontines);
  const [membresParTontine, setMembresParTontine] = useState(mock.membresParTontine);
  const [reunions, setReunions] = useState(mock.reunions);
  const [rotations, setRotations] = useState(mock.rotations);
  const [encheres, setEncheres] = useState(mock.encheres);
  const [banques, setBanques] = useState(mock.banques);
  const [comptesBanque, setComptesBanque] = useState(mock.comptesBanque);
  const [operationsBanque, setOperationsBanque] = useState(mock.operationsBanque);
  const [prets, setPrets] = useState(mock.prets);
  const [sanctions, setSanctions] = useState(mock.sanctions);
  const [fondAssurance, setFondAssurance] = useState(mock.fondAssurance);
  const [caisseJournal, setCaisseJournal] = useState(mock.caisseJournal);
  const [utilisateurs, setUtilisateurs] = useState(mock.utilisateurs);
  const [planningTours, setPlanningTours] = useState(mock.planningTours);
  const [seanceTransactions, setSeanceTransactions] = useState([]);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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

  const value = {
    membres, tontines, membresParTontine, reunions, rotations, encheres, banques, comptesBanque, operationsBanque,
    prets, sanctions, fondAssurance, aidesAssurance: fondAssurance, caisseSociale: fondAssurance, caisseJournal,
    utilisateurs, planningTours, seanceTransactions, evolutionCaisse: mock.evolutionCaisse, dashboardStats, repartitionBanques,
    toast, apiStatus: "disabled", user,
    addMembre, updateMembre, deleteMembre, addTontine, updateTontine, addMembreTontine, removeMembreTontine, updateMembreTontine,
    addReunion, updateReunion, ouvrirReunion, cloturerReunion, addSeanceTransaction, enregistrerBeneficiaireSeance, tirerAuSort,
    addEnchere, attribuerTour, annulerEncheres, addBanque, doOperation, addMembreBanque, addPret, rembourserPret, distribuerInteretsPret,
    addSanction, payerSanction, genererBulletin, ouvrirBulletinPdf, addAide, membreEligibleAssurance, addCaisseEntry, addPlanningTour,
    addUtilisateur, desactiverUtilisateur, activerUtilisateur, showToast,
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
