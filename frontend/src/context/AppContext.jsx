import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearApiToken, getApiToken, request, setApiToken } from "../lib/api";

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

const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const today = () => new Date().toISOString().slice(0, 10);
const API_READY_KEY = "tontix-api-ready";

const emptyLists = () => ({
  associations: [],
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

const normalizeAssociation = (a = {}) => ({
  ...a,
  id: a.id,
  nom: a.nom ?? "",
  abrege: a.nom_abrege ?? a.abrege ?? (a.nom ? a.nom.slice(0, 3).toUpperCase() : ""),
  ville: a.ville ?? "",
  pays: a.pays ?? "",
  siege: a.siege_social ?? a.siege ?? "",
  devise: a.devise ?? "XAF",
  statut: a.actif === false ? "inactive" : (a.statut ?? "active"),
});

const normalizeMembre = (m = {}) => ({
  ...m,
  id: m.id,
  idMembre: m.id,
  matricule: m.matricule ?? m.numero ?? "",
  numero: m.matricule ?? m.numero ?? "",
  nom: m.nom ?? "",
  prenom: m.prenom ?? "",
  telephone: m.telephone ?? "",
  email: m.email ?? "",
  dateAdhesion: m.date_adhesion ?? m.dateAdhesion ?? null,
  statut: m.statut ?? "actif",
});

const normalizeTontine = (t = {}) => ({
  ...t,
  id: t.id,
  nom: t.libelle ?? t.nom ?? "",
  cotisation: Number(t.montant_part ?? t.cotisation ?? 0),
  montant_part: Number(t.montant_part ?? t.cotisation ?? 0),
  typeAttribution: t.mode_attribution ?? t.typeAttribution ?? "rotation",
  mode_attribution: t.mode_attribution ?? "rotation",
  statut: t.statut ?? "active",
  totalParts: Number(t.total_parts ?? t.totalParts ?? 0),
  nbTours: Number(t.nb_tours ?? t.nbTours ?? 0),
});

const normalizeCaisse = (c = {}) => ({
  ...c,
  id: c.id,
  idBanque: c.id,
  nom: c.libelle ?? c.nom ?? "",
  libelle: c.libelle ?? c.nom ?? "",
  description: c.description ?? "",
  type: c.type ?? "autre",
  totalSolde: Number(c.solde_actuel ?? c.totalSolde ?? 0),
  solde: Number(c.solde_actuel ?? c.solde ?? 0),
  pretAutorise: Boolean(c.pret_autorise ?? c.pretAutorise ?? false),
  dureeMaxPretMois: Number(c.duree_max_pret ?? c.dureeMaxPretMois ?? 0),
  operationsAutorisees: c.operations_autorisees ?? c.operationsAutorisees ?? [],
});

const normalizeCompteBancaire = (c = {}) => {
  const notes = typeof c.notes === "string"
    ? (() => { try { return JSON.parse(c.notes); } catch { return {}; } })()
    : (c.notes || {});
  return {
    ...c,
    id: c.id,
    idBanque: notes.idBanque ?? c.idBanque ?? null,
    idMembre: notes.idMembre ?? c.idMembre ?? null,
    nomBanque: notes.nomBanque ?? c.banque ?? c.nomBanque ?? "",
    nomMembre: notes.nomMembre ?? c.titulaire ?? c.nomMembre ?? "",
    solde: Number(c.solde_dernier_releve ?? c.solde ?? 0),
    statut: c.actif === false ? "inactif" : (c.statut ?? "actif"),
    notes,
  };
};

const normalizeTransaction = (tx = {}, caisseId = null) => ({
  id: tx.id,
  idBanque: caisseId ?? tx.caisse_id ?? null,
  idMembre: tx.reference_id ?? tx.idMembre ?? null,
  nomMembre: tx.notes?.nomMembre ?? tx.nomMembre ?? tx.created_by ?? "—",
  typeOperation: tx.type === "sortie" ? "retrait" : "depot",
  montant: Number(tx.montant ?? 0),
  observation: tx.libelle ?? tx.observation ?? "",
  dateOperation: tx.date_transaction ?? tx.dateOperation ?? null,
  entree: tx.type === "entree" ? Number(tx.montant ?? 0) : 0,
  sortie: tx.type === "sortie" ? Number(tx.montant ?? 0) : 0,
});

const normalizePret = (p = {}, membersById = {}, caissesById = {}) => {
  const membre = membersById[p.emprunteur_id] || {};
  const caisse = caissesById[p.caisse_id] || {};
  return {
    ...p,
    id: p.id,
    nomMembre: `${membre.nom ?? ""} ${membre.prenom ?? ""}`.trim() || p.emprunteur_id,
    caisseNom: caisse.libelle ?? caisse.nom ?? "",
    montantPret: Number(p.montant_principal ?? p.montantPret ?? 0),
    montantPrincipal: Number(p.montant_principal ?? p.montantPrincipal ?? 0),
    montantInteret: Number(p.interet_total ?? p.montantInteret ?? 0),
    montantTotal: Number(p.montant_total_du ?? p.montantTotal ?? 0),
    montantRembourse: Number(p.montant_rembourse ?? p.montantRembourse ?? 0),
    resteAPayer: Number(p.capital_restant ?? p.resteAPayer ?? 0),
    statut: p.statut ?? "demande",
    datePret: p.date_demande ?? p.datePret ?? null,
  };
};

const normalizeSanction = (s = {}, membersById = {}) => ({
  ...s,
  id: s.id,
  nomMembre: membersById[s.membre_id]
    ? `${membersById[s.membre_id].nom ?? ""} ${membersById[s.membre_id].prenom ?? ""}`.trim()
    : s.membre_id,
  montant: Number(s.montant ?? 0),
  statut: s.statut ?? "due",
  dateSanction: s.created_at ?? s.dateSanction ?? null,
});

const normalizeAide = (a = {}, membersById = {}) => ({
  ...a,
  id: a.id,
  nomMembre: membersById[a.membre_id]
    ? `${membersById[a.membre_id].nom ?? ""} ${membersById[a.membre_id].prenom ?? ""}`.trim()
    : a.membre_id,
  montantAide: Number(a.montant_accorde ?? a.montant_demande ?? 0),
  statut: a.statut ?? "demandee",
  dateEvenement: a.date_evenement ?? a.dateEvenement ?? null,
});

const normalizeReunion = (r = {}) => ({
  ...r,
  id: r.id,
  date: r.date_reunion ?? r.date ?? null,
  statutReunion: r.statut ?? r.statutReunion ?? "planifiee",
});

const normalizeUser = (u) => {
  const src = u || {};
  return {
    ...src,
    id: src.id,
    name: src.name || src.nom || [src.membre?.nom, src.membre?.prenom].filter(Boolean).join(" ") || src.email || "Utilisateur",
  };
};

const safe = async (promise, fallback = null) => {
  try {
    return await promise;
  } catch {
    return fallback;
  }
};

export const AppProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => getApiToken());
  const [user, setUser] = useState(null);
  const [associations, setAssociations] = useState([]);
  const [currentAssociationId, setCurrentAssociationId] = useState(null);
  const [membres, setMembres] = useState([]);
  const [tontines, setTontines] = useState([]);
  const [membresParTontine, setMembresParTontine] = useState([]);
  const [reunions, setReunions] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [encheres, setEncheres] = useState([]);
  const [banques, setBanques] = useState([]);
  const [comptesBanque, setComptesBanque] = useState([]);
  const [operationsBanque, setOperationsBanque] = useState([]);
  const [transfertsCaisse, setTransfertsCaisse] = useState([]);
  const [typesSanction, setTypesSanction] = useState([]);
  const [typesAideSociale, setTypesAideSociale] = useState([]);
  const [prets, setPrets] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [fondAssurance, setFondAssurance] = useState([]);
  const [caisseJournal, setCaisseJournal] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [planningTours, setPlanningTours] = useState([]);
  const [seanceTransactions, setSeanceTransactions] = useState([]);
  const [evolutionCaisse, setEvolutionCaisse] = useState([]);
  const [toast, setToast] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const currentAssociation = useMemo(
    () => associations.find((a) => a.id === currentAssociationId) || associations[0] || null,
    [associations, currentAssociationId]
  );

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const loadWorkspace = useCallback(async (currentUser = null) => {
    if (!getApiToken()) {
      setAssociations([]);
      setMembres([]);
      setTontines([]);
      setReunions([]);
      setBanques([]);
      setComptesBanque([]);
      setOperationsBanque([]);
      setTransfertsCaisse([]);
      setTypesSanction([]);
      setTypesAideSociale([]);
      setPrets([]);
      setSanctions([]);
      setFondAssurance([]);
      setCaisseJournal([]);
      setUtilisateurs([]);
      setPlanningTours([]);
      setSeanceTransactions([]);
      setEvolutionCaisse([]);
      setRotations([]);
      setEncheres([]);
      setMembresParTontine([]);
      setCurrentAssociationId(null);
      return;
    }

    const [assocRes, membresRes, tontinesRes, reunionsRes, caissesRes, pretsRes, sanctionsRes, aidesRes, typesSanctionRes, typesAideRes, comptesRes] = await Promise.all([
      safe(request("/associations"), []),
      safe(request("/membres"), []),
      safe(request("/tontines"), []),
      safe(request("/reunions"), []),
      safe(request("/caisses"), []),
      safe(request("/prets"), []),
      safe(request("/sanctions"), []),
      safe(request("/aides-sociales"), []),
      safe(request("/types-sanctions"), []),
      safe(request("/types-aides-sociales"), []),
      safe(request("/comptes-bancaires"), []),
    ]);

    const assocList = Array.isArray(assocRes) ? assocRes.map(normalizeAssociation) : (assocRes?.data || []).map(normalizeAssociation);
    const memberList = Array.isArray(membresRes) ? membresRes.map(normalizeMembre) : (membresRes?.data || []).map(normalizeMembre);
    const tontineList = Array.isArray(tontinesRes) ? tontinesRes.map(normalizeTontine) : (tontinesRes?.data || []).map(normalizeTontine);
    const reunionList = Array.isArray(reunionsRes) ? reunionsRes.map(normalizeReunion) : (reunionsRes?.data || []).map(normalizeReunion);
    const caisseList = Array.isArray(caissesRes) ? caissesRes.map(normalizeCaisse) : (caissesRes?.data || []).map(normalizeCaisse);
    const compteList = Array.isArray(comptesRes) ? comptesRes.map(normalizeCompteBancaire) : (comptesRes?.data || []).map(normalizeCompteBancaire);

    const membersById = Object.fromEntries(memberList.map((m) => [m.id, m]));
    const caissesById = Object.fromEntries(caisseList.map((c) => [c.id, c]));

    const pretList = Array.isArray(pretsRes) ? pretsRes.map((p) => normalizePret(p, membersById, caissesById)) : (pretsRes?.data || []).map((p) => normalizePret(p, membersById, caissesById));
    const sanctionList = Array.isArray(sanctionsRes) ? sanctionsRes.map((s) => normalizeSanction(s, membersById)) : (sanctionsRes?.data || []).map((s) => normalizeSanction(s, membersById));
    const aideList = Array.isArray(aidesRes) ? aidesRes.map((a) => normalizeAide(a, membersById)) : (aidesRes?.data || []).map((a) => normalizeAide(a, membersById));
    const typeSanctionList = Array.isArray(typesSanctionRes) ? typesSanctionRes : (typesSanctionRes?.data || []);
    const typeAideList = Array.isArray(typesAideRes) ? typesAideRes : (typesAideRes?.data || []);

    setAssociations(assocList);
    setMembres(memberList);
    setTontines(tontineList);
    setReunions(reunionList);
    setBanques(caisseList);
    setComptesBanque(compteList);
    setTransfertsCaisse([]);
    setTypesSanction(typeSanctionList);
    setTypesAideSociale(typeAideList);
    setPrets(pretList);
    setSanctions(sanctionList);
    setFondAssurance(aideList);
    const journalResponses = await safe(request("/caisses/journaux"), []);
    const allTransactions = [];
    const allJournalEntries = [];
    journalResponses.forEach((journal) => {
      const caisseId = journal?.caisse?.id || null;
      const txs = journal?.transactions || [];
      txs.forEach((tx) => {
        const item = normalizeTransaction(tx, caisseId);
        allTransactions.push(item);
        allJournalEntries.push({
          id: item.id,
          operation: item.observation || item.typeOperation,
          categorie: item.typeOperation,
          entree: item.entree,
          sortie: item.sortie,
          date: item.dateOperation,
          idBanque: item.idBanque,
          idMembre: item.idMembre,
          nomMembre: item.nomMembre,
        });
      });
    });
    setOperationsBanque(allTransactions);
    setCaisseJournal(allJournalEntries);
    setUtilisateurs(currentUser ? [currentUser] : []);
    setPlanningTours([]);
    setSeanceTransactions([]);
    setEvolutionCaisse([]);
    setRotations([]);
    setEncheres([]);
    setMembresParTontine([]);
    setCurrentAssociationId((prev) => prev || currentUser?.association_id || assocList[0]?.id || null);
  }, []);

  const bootstrap = useCallback(async () => {
    setInitializing(true);
    const storedToken = getApiToken();
    if (!storedToken) {
      await loadWorkspace();
      setInitializing(false);
      return;
    }

    setTokenState(storedToken);
    try {
      const me = await request("/auth/me");
      const currentUser = normalizeUser(me);
      setUser(currentUser);
      await loadWorkspace(currentUser);
    } catch {
      clearApiToken();
      setTokenState(null);
      setUser(null);
      await loadWorkspace();
    } finally {
      setInitializing(false);
    }
  }, [loadWorkspace]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const dashboardStats = useMemo(() => ({
    membresActifs: membres.filter((m) => m.statut === "actif").length,
    totalMembres: membres.length,
    soldeCaisse: banques.reduce((s, c) => s + Number(c.solde ?? c.totalSolde ?? 0), 0),
    totalBanques: banques.reduce((s, c) => s + Number(c.solde ?? c.totalSolde ?? 0), 0),
    totalPrets: prets.filter((p) => p.statut !== "solde").reduce((s, p) => s + Number(p.resteAPayer || 0), 0),
    totalPretsRestants: prets.filter((p) => p.statut !== "solde").reduce((s, p) => s + Number(p.resteAPayer || 0), 0),
    pretsEnCours: prets.filter((p) => p.statut === "en_cours").length,
    pretsEnRetard: prets.filter((p) => p.statut === "en_retard").length,
    tontinesActives: tontines.filter((t) => t.statut === "active" || t.statut === "en_preparation").length,
    fondAssurance: fondAssurance.reduce((s, a) => s + Number(a.montantAide || 0), 0),
    caisseSociale: fondAssurance.reduce((s, a) => s + Number(a.montantAide || 0), 0),
    sanctionsImpayees: sanctions.filter((s) => s.statut === "due" || s.statut === "impayee").length,
    prochaineReunion: reunions
      .filter((r) => r.statutReunion !== "cloturee")
      .sort((a, b) => new Date(a.date ?? a.date_reunion ?? 0) - new Date(b.date ?? b.date_reunion ?? 0))[0]?.date ?? null,
  }), [membres, banques, prets, tontines, fondAssurance, sanctions, reunions]);

  const repartitionBanques = banques.map((b) => ({
    name: b.nom,
    value: Number(b.solde ?? b.totalSolde ?? 0),
  }));

  const refresh = useCallback(async () => {
    await loadWorkspace();
  }, [loadWorkspace]);

  const withRefresh = useCallback(async (action) => {
    const result = await action();
    await loadWorkspace();
    return result;
  }, [loadWorkspace]);

  const login = useCallback(async (credentials) => {
    const response = await request("/auth/login", {
      method: "POST",
      body: credentials,
      auth: false,
    });
    setApiToken(response.token);
    setTokenState(response.token);
    setUser(normalizeUser(response.user || null));
    await loadWorkspace();
    return response;
  }, [loadWorkspace]);

  const logout = useCallback(async () => {
    await safe(request("/auth/logout", { method: "POST" }), null);
    clearApiToken();
    setTokenState(null);
    setUser(null);
    setAssociations([]);
    setCurrentAssociationId(null);
    await loadWorkspace();
  }, [loadWorkspace]);

  const changePassword = useCallback(async (data) => request("/auth/change-password", { method: "POST", body: data }), []);

  const createAssociation = useCallback(async (data) => {
    const payload = {
      nom: data.nom,
      siege_social: data.siege || data.siege_social,
      date_creation: data.date_creation || today(),
      devise: data.devise || "XAF",
      email: data.email || null,
      telephone: data.telephone || null,
      nom_abrege: data.abrege || data.nom_abrege || "",
    };
    return withRefresh(() => request("/associations", { method: "POST", body: payload }));
  }, [withRefresh]);
  const updateAssociation = useCallback(async (id, data) => withRefresh(() => request(`/associations/${id}`, { method: "PUT", body: data })), [withRefresh]);
  const activateAssociation = useCallback(async (id) => withRefresh(() => request(`/associations/${id}/activer`, { method: "POST" })), [withRefresh]);

  const addMembre = useCallback(async (data) => withRefresh(() => request("/membres", {
    method: "POST",
    body: {
      association_id: data.association_id || currentAssociationId,
      nom: data.nom,
      prenom: data.prenom,
      telephone: data.telephone,
      email: data.email || null,
      date_adhesion: data.dateAdhesion || data.date_adhesion || today(),
      statut: data.statut || "actif",
    },
  })), [withRefresh, currentAssociationId]);
  const updateMembre = useCallback(async (id, data) => withRefresh(() => request(`/membres/${id}`, { method: "PUT", body: data })), [withRefresh]);
  const deleteMembre = useCallback(async (id) => withRefresh(() => request(`/membres/${id}`, { method: "DELETE" })), [withRefresh]);
  const importCsv = useCallback(async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return withRefresh(() => request("/membres/import-csv", { method: "POST", body: formData }));
  }, [withRefresh]);
  const memberSituation = useCallback((id) => request(`/membres/${id}/situation`), []);
  const memberPdf = useCallback((id) => request(`/membres/${id}/releve-pdf`), []);

  const addTontine = useCallback(async (data) => withRefresh(() => request("/tontines", {
    method: "POST",
    body: {
      association_id: data.association_id || currentAssociationId,
      libelle: data.nom || data.libelle,
      montant_part: Number(data.cotisation || data.montant_part || 0),
      mode_attribution: data.typeAttribution || data.mode_attribution || "rotation",
      caisse_id: data.caisseId || data.caisse_id,
      avaliste_requis: Boolean(data.avaliste_requis),
      nb_parts_max_par_membre: data.nb_parts_max_par_membre || null,
    },
  })), [withRefresh, currentAssociationId]);
  const updateTontine = useCallback(async (idOrData, maybeData) => {
    const data = maybeData || idOrData;
    const id = maybeData ? idOrData : data.id;
    return withRefresh(() => request(`/tontines/${id}`, {
      method: "PUT",
      body: {
        libelle: data.nom || data.libelle,
        montant_part: Number(data.cotisation || data.montant_part || 0),
        mode_attribution: data.typeAttribution || data.mode_attribution || "rotation",
        avaliste_requis: Boolean(data.avaliste_requis),
        nb_parts_max_par_membre: data.nb_parts_max_par_membre || null,
        statut: data.statut,
      },
    }));
  }, [withRefresh]);
  const addMembreTontine = useCallback(async (data) => {
    const id = data.idTontine || data.tontine_id;
    return withRefresh(() => request(`/tontines/${id}/parts`, {
      method: "POST",
      body: {
        membre_id: data.idMembre || data.membre_id,
        nombre_parts: Number(data.nombreParts || data.nombre_parts || 1),
        date_adhesion: data.dateAdhesion || data.date_adhesion || today(),
        avaliste_id: data.avaliste_id || null,
      },
    }));
  }, [withRefresh]);
  const removeMembreTontine = useCallback(async (id) => setMembresParTontine((prev) => prev.filter((item) => item.id !== id)), []);
  const updateMembreTontine = useCallback(async (idOrData, maybeData) => {
    const data = maybeData || idOrData;
    const id = maybeData ? idOrData : data.id;
    setMembresParTontine((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
  }, []);

  const addReunion = useCallback(async (data) => withRefresh(() => request("/reunions", {
    method: "POST",
    body: {
      association_id: data.association_id || currentAssociationId,
      numero: data.numero || null,
      type: data.type || data.typeReunion || "ordinaire",
      date_reunion: data.date || data.date_reunion,
      heure_debut: data.heure_debut || data.heure || "18:00",
      heure_fin_prevue: data.heure_fin_prevue || null,
      lieu: data.lieu || "",
      est_domicile_membre: Boolean(data.est_domicile_membre),
      hote_membre_id: data.hote_membre_id || null,
      quorum_requis: data.quorum_requis || null,
      notes: data.notes || null,
    },
  })), [withRefresh, currentAssociationId]);
  const updateReunion = useCallback(async (idOrData, maybeData) => {
    const data = maybeData || idOrData;
    const id = maybeData ? idOrData : data.id;
    return withRefresh(() => request(`/reunions/${id}`, { method: "PUT", body: data }));
  }, [withRefresh]);
  const ouvrirReunion = useCallback(async (id) => withRefresh(() => request(`/reunions/${id}/ouvrir`, { method: "POST" })), [withRefresh]);
  const cloturerReunion = useCallback(async (id) => withRefresh(() => request(`/reunions/${id}/cloturer`, { method: "POST" })), [withRefresh]);
  const addSeanceTransaction = useCallback(async (reunionOrData, maybeData) => {
    const data = maybeData ? { ...maybeData, idReunion: reunionOrData } : reunionOrData;
    const tx = { id: uid(), date: new Date().toISOString(), ...data };
    setSeanceTransactions((prev) => [...prev, tx]);
    return tx;
  }, []);
  const enregistrerBeneficiaireSeance = useCallback((data) => {
    const item = { id: uid(), dateAttribution: today(), ...data };
    setRotations((prev) => [...prev, item]);
    return item;
  }, []);
  const tirerAuSort = useCallback((idTontine) => {
    const inscrits = membresParTontine.filter((m) => m.idTontine === idTontine && m.statut === "actif");
    const gagne = inscrits[Math.floor(Math.random() * inscrits.length)];
    const membre = membres.find((m) => m.id === gagne?.idMembre);
    return membre ? `${membre.nom} ${membre.prenom}` : null;
  }, [membres, membresParTontine]);

  const addEnchere = useCallback((data) => setEncheres((prev) => [...prev, { id: uid(), statut: "en_attente", dateEnchere: today(), ...data }]), []);
  const attribuerTour = useCallback((idRotation, idMembre, montant) => {
    setEncheres((prev) => prev.map((e) => ({ ...e, statut: e.idRotation === idRotation ? (e.idMembre === idMembre ? "gagnee" : "perdue") : e.statut })));
    setRotations((prev) => prev.map((r) => (r.id === idRotation ? { ...r, idMembre, montantRecu: montant, dateAttribution: today() } : r)));
  }, []);
  const annulerEncheres = useCallback((idRotation) => setEncheres((prev) => prev.filter((e) => e.idRotation !== idRotation)), []);

  const addBanque = useCallback(async (data) => withRefresh(() => request("/caisses", {
    method: "POST",
    body: {
      association_id: data.association_id || currentAssociationId,
      libelle: data.nom || data.libelle,
      type: data.type === "banque_libre" ? "banque" : (data.type || "autre"),
      solde_initial: Number(data.totalSolde || data.solde_initial || 0),
      pret_autorise: Boolean(data.pretAutorise || data.pret_autorise),
      compte_bancaire_id: data.compte_bancaire_id || null,
    },
  })), [withRefresh, currentAssociationId]);
  const doOperation = useCallback(async (data) => {
    const caisseId = data.idBanque || data.caisseId || data.caisse_id;
    if (caisseId) {
      try {
        return await withRefresh(() => request(`/caisses/${caisseId}/transactions`, {
          method: "POST",
          body: {
            type: data.typeOperation === "retrait" ? "sortie" : "entree",
            montant: Number(data.montant || 0),
            libelle: data.observation || data.libelle || "Opération",
            mode_paiement: data.mode_paiement || "especes",
          },
        }));
      } catch {
        // fallback local
      }
    }
    setOperationsBanque((prev) => [...prev, { id: uid(), date: new Date().toISOString(), ...data }]);
    return null;
  }, [withRefresh]);
  const addMembreBanque = useCallback(async (data) => {
    const payload = {
      association_id: currentAssociationId,
      titulaire: data.nomMembre || data.titulaire || "Titulaire",
      banque: data.nomBanque || data.banque || null,
      actif: true,
      notes: {
        idMembre: data.idMembre || data.id_membre || null,
        idBanque: data.idBanque || data.id_banque || null,
        nomMembre: data.nomMembre || null,
        nomBanque: data.nomBanque || null,
      },
    };
    try {
      return await withRefresh(() => request("/comptes-bancaires", { method: "POST", body: payload }));
    } catch {
      setComptesBanque((prev) => [...prev, { id: uid(), solde: 0, statut: "actif", ...data }]);
      return null;
    }
  }, [withRefresh, currentAssociationId]);
  const transfererCaisse = useCallback(async (data) => withRefresh(() => request("/caisses/transferts", {
    method: "POST",
    body: {
      caisse_source_id: data.caisseSourceId || data.caisse_source_id,
      caisse_destination_id: data.caisseDestinationId || data.caisse_destination_id,
      montant: Number(data.montant || 0),
      libelle: data.motif || data.libelle || "Transfert",
      mode_paiement: data.mode_paiement || "especes",
    },
  })), [withRefresh]);
  const addTypeSanction = useCallback(async (data) => withRefresh(() => request("/types-sanctions", {
    method: "POST",
    body: {
      association_id: data.association_id || currentAssociationId,
      libelle: data.libelle,
      mode_calcul: data.mode_calcul || "fixe",
      montant_fixe: data.montantFixe ?? data.montant_fixe ?? null,
      montant_pct: data.montant_pct ?? null,
      montant_journalier: data.montant_journalier ?? null,
      est_automatique: Boolean(data.estAutomatique ?? data.est_automatique),
      declencheur: data.declencheur || null,
      actif: data.actif ?? true,
      description: data.description || null,
    },
  })), [withRefresh, currentAssociationId]);
  const updateTypeSanction = useCallback((id, data) => setTypesSanction((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t))), []);

  const addPret = useCallback(async (data) => withRefresh(() => request("/prets", {
    method: "POST",
    body: {
      caisse_id: data.caisseId || data.caisse_id,
      emprunteur_id: data.idMembre || data.emprunteur_id,
      montant_principal: Number(data.montantPret || data.montant_principal || 0),
      nb_echeances: Number(data.dureeMois || data.nb_echeances || 1),
      taux_mensuel: Number(data.tauxInteret || data.taux_mensuel || 0),
    },
  })), [withRefresh]);
  const rembourserPret = useCallback(async (id, montant) => withRefresh(() => request(`/prets/${id}/rembourser`, { method: "POST", body: { montant } })), [withRefresh]);
  const distribuerInteretsPret = useCallback(() => showToast("Action à brancher côté backend", "info"), [showToast]);

  const addSanction = useCallback(async (data) => {
    const typeId = data.type_sanction_id || typesSanction.find((t) => t.id === data.typeSanction || t.code === data.typeSanction || t.libelle === data.typeSanction)?.id;
    if (typeId) {
      try {
        return await withRefresh(() => request("/sanctions", {
          method: "POST",
          body: {
            association_id: data.association_id || currentAssociationId,
            membre_id: data.idMembre || data.membre_id,
            type_sanction_id: typeId,
            motif: data.motif || data.libelle || "Sanction",
            montant_ajuste: Number(data.montant || data.montant_ajuste || 0),
          },
        }));
      } catch {
        // fallback local
      }
    }
    setSanctions((prev) => [...prev, { id: uid(), statut: "impayee", dateSanction: today(), ...data }]);
    return null;
  }, [withRefresh, currentAssociationId, typesSanction]);
  const payerSanction = useCallback(async (id, data = {}) => withRefresh(() => request(`/sanctions/${id}/payer`, { method: "POST", body: data })), [withRefresh]);
  const genererBulletin = useCallback(async (data) => withRefresh(() => request(`/tontines/${data.idTontine || data.tontine_id}/bulletin`, {
    method: "POST",
    body: { retenues: data.retenues || [] },
  })), [withRefresh]);
  const ouvrirBulletinPdf = useCallback(async (id) => {
    if (!id) return null;
    const result = await request(`/bulletins/${id}/pdf`);
    showToast("Bulletin généré");
    return result;
  }, [showToast]);
  const addAide = useCallback(async (data) => {
    if (data.type_aide_id || data.typeAideId) {
      try {
        return await withRefresh(() => request("/aides-sociales", {
          method: "POST",
          body: {
            association_id: data.association_id || currentAssociationId,
            membre_id: data.idMembre || data.membre_id,
            type_aide_id: data.type_aide_id || data.typeAideId,
            description: data.description || data.libelle || "Aide sociale",
            date_evenement: data.dateEvenement || data.date_evenement || today(),
            montant_demande: Number(data.montantAide || data.montant_demande || 0),
            notes: data.notes || null,
          },
        }));
      } catch {
        // fallback local
      }
    }
    setFondAssurance((prev) => [...prev, { id: uid(), statut: "verse", dateEvenement: today(), ...data }]);
    return null;
  }, [withRefresh, currentAssociationId]);
  const membreEligibleAssurance = useCallback((idMembre) => membres.some((m) => m.id === idMembre && m.statut === "actif"), [membres]);
  const addCaisseEntry = useCallback((data) => setCaisseJournal((prev) => [...prev, { id: uid(), date: new Date().toISOString(), ...data }]), []);
  const addPlanningTour = useCallback((data) => setPlanningTours((prev) => [...prev, { id: uid(), ...data }]), []);
  const addTourPlanning = addPlanningTour;
  const marquerTourEncaisse = useCallback((id) => setPlanningTours((prev) => prev.map((p) => (p.id === id ? { ...p, statut: "encaisse" } : p))), []);
  const retirerTourPlanning = useCallback((id) => setPlanningTours((prev) => prev.filter((p) => p.id !== id)), []);
  const ouvrirSeance = useCallback(async (id, data) => withRefresh(() => request(`/reunions/${id}/ouvrir`, { method: "POST", body: data || {} })), [withRefresh]);
  const cloturerSeance = useCallback(async (id, data) => withRefresh(() => request(`/reunions/${id}/cloturer`, { method: "POST", body: data || {} })), [withRefresh]);
  const addPointODJ = useCallback(async (reunionId, data) => withRefresh(() => request(`/reunions/${reunionId}/ordre-du-jour`, {
    method: "POST",
    body: {
      item_id: data.id || data.item_id || null,
      libelle_libre: data.titre || data.libelle_libre || data.description || "",
      ordre: data.ordre || null,
      contenu_rapport: data.description || null,
      rapporteur_id: data.rapporteur_id || null,
    },
  })), [withRefresh]);
  const updatePointODJ = useCallback(async (reunionId, pointId, data) => withRefresh(() => request(`/reunions/${reunionId}/ordre-du-jour`, {
    method: "POST",
    body: {
      item_id: pointId,
      libelle_libre: data.titre || data.libelle_libre || "",
      ordre: data.ordre || null,
      contenu_rapport: data.description || null,
      rapporteur_id: data.rapporteur_id || null,
      rapport_valide: data.statut === "traite" || data.rapport_valide || false,
    },
  })), [withRefresh]);
  const removePointODJ = useCallback(async (reunionId, pointId) => withRefresh(() => request(`/reunions/${reunionId}/ordre-du-jour/${pointId}`, { method: "DELETE" })), [withRefresh]);
  const addUtilisateur = useCallback((data) => setUtilisateurs((prev) => [...prev, { id: uid(), statut: "actif", ...data }]), []);
  const desactiverUtilisateur = useCallback((id) => setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: "inactif" } : u))), []);
  const activerUtilisateur = useCallback((id) => setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: "actif" } : u))), []);
  const resetWorkspace = useCallback(async () => {
    clearApiToken();
    setTokenState(null);
    setUser(null);
    await loadWorkspace();
  }, [loadWorkspace]);

  const value = {
    token,
    user,
    associations,
    currentAssociation,
    currentAssociationId,
    setupComplete: associations.length > 0,
    toast,
    loading: initializing,
    membres,
    tontines,
    membresParTontine,
    reunions,
    rotations,
    encheres,
    banques,
    caisses: banques,
    comptesBanque,
    operationsBanque,
    transfertsCaisse,
    typesSanction,
    prets,
    sanctions,
    typesAideSociale,
    fondAssurance,
    aidesAssurance: fondAssurance,
    caisseSociale: fondAssurance,
    caisseJournal,
    utilisateurs,
    planningTours,
    seanceTransactions,
    evolutionCaisse,
    dashboardStats,
    repartitionBanques,
    showToast,
    setCurrentAssociationId,
    login,
    logout,
    changePassword,
    createAssociation,
    updateAssociation,
    activateAssociation,
    refresh,
    addMembre,
    updateMembre,
    deleteMembre,
    importCsv,
    memberSituation,
    memberPdf,
    addTontine,
    updateTontine,
    addMembreTontine,
    removeMembreTontine,
    updateMembreTontine,
    addReunion,
    updateReunion,
    ouvrirReunion,
    cloturerReunion,
    addSeanceTransaction,
    enregistrerBeneficiaireSeance,
    tirerAuSort,
    addEnchere,
    attribuerTour,
    annulerEncheres,
    addBanque,
    addCaisse: addBanque,
    doOperation,
    addMembreBanque,
    transfererCaisse,
    addTypeSanction,
    updateTypeSanction,
    addPret,
    rembourserPret,
    distribuerInteretsPret,
    addSanction,
    payerSanction,
    genererBulletin,
    ouvrirBulletinPdf,
    addAide,
    membreEligibleAssurance,
    addCaisseEntry,
    addTourPlanning,
    marquerTourEncaisse,
    retirerTourPlanning,
    ouvrirSeance,
    cloturerSeance,
    addPointODJ,
    updatePointODJ,
    removePointODJ,
    addPlanningTour,
    addUtilisateur,
    desactiverUtilisateur,
    activerUtilisateur,
    resetWorkspace,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp doit etre utilise dans AppProvider");
  return context;
};
