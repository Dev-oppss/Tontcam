import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request, getApiToken, setApiToken, clearApiToken } from '../lib/api';
import * as adapt from '../lib/adapters';
import * as mock from '../data/mockData';

export const TX_TYPES = [
  { value: 'cotisation', label: 'Cotisation', dir: 'entree', icon: '' },
  { value: 'depot_banque', label: 'Dépôt caisse', dir: 'entree', icon: '' },
  { value: 'sanction', label: 'Sanction', dir: 'entree', icon: '' },
  { value: 'pret', label: 'Prêt accordé', dir: 'sortie', icon: '' },
  { value: 'remboursement', label: 'Remboursement prêt', dir: 'entree', icon: '' },
  { value: 'retrait', label: 'Retrait', dir: 'sortie', icon: '' },
  { value: 'autre', label: 'Autre', dir: 'entree', icon: '' },
];
export const TX_LABELS = TX_TYPES.reduce((acc, t) => ({ ...acc, [t.value]: t.label }), {});

export const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [currentAssociation, setCurrentAssociationState] = useState(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [toast, setToast] = useState(null);

  const [membres, setMembres] = useState([]);
  const [postes, setPostes] = useState([]);
  const [mandats, setMandats] = useState([]);
  const [tontines, setTontines] = useState([]);
  const [membresParTontine, setMembresParTontine] = useState([]);
  const [reunions, setReunions] = useState([]);
  const [rotations, setRotations] = useState([]);
  const [encheres, setEncheres] = useState([]);
  const [banques, setBanques] = useState([]);
  const [prets, setPrets] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [typesSanction, setTypesSanction] = useState([]);
  const [fondAssurance, setFondAssurance] = useState([]);
  const [typesAideSociale, setTypesAideSociale] = useState([]);
  const [comptesBancaire, setComptesBancaire] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [decisionsAG, setDecisionsAG] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [rapprochements, setRapprochements] = useState([]);
  const [caisseJournal, setCaisseJournal] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [planningTours, setPlanningTours] = useState([]);
  const [cyclesTontine, setCyclesTontine] = useState([]);
  const [parametres, setParametres] = useState({});

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleError = useCallback((err, fallback = 'Une erreur est survenue') => {
    if (err?.status === 401) {
      clearApiToken();
      setUser(null);
      setCurrentAssociationState(null);
    }
    showToast(err?.message || fallback, 'error');
    throw err;
  }, [showToast]);

  // ── Bootstrap : token existant → /auth/me → charge l'association ──
  useEffect(() => {
    (async () => {
      const token = getApiToken();
      if (!token) { setBooting(false); return; }
      try {
        const data = await request('/auth/me');
        setUser(data);
        if (data.membre?.association) {
          const asso = data.membre.association;
          setCurrentAssociationState({
            id: asso.id, nom: asso.nom, abrege: asso.nom_abrege, ville: asso.ville,
            pays: asso.pays, devise: asso.devise, siege: asso.siege_social,
            telephone: asso.telephone, email: asso.email, profilComplete: !!asso.profil_complete,
          });
          setSetupComplete(!!asso.profil_complete);
        }
      } catch {
        clearApiToken();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // ── Charge toutes les données de l'association une fois connecté ──
  useEffect(() => {
    if (!user || !currentAssociation) return;
    (async () => {
      try {
        const [mRes, tRes, rRes, cRes, pRes, sRes, paramRes, aRes, uRes, typeSancRes, typeAideRes, comptesRes, postesRes, decAgRes, reglRes, rapproRes] = await Promise.all([
          request('/membres?per_page=200'),
          request('/tontines'),
          request('/reunions?per_page=100'),
          request('/caisses'),
          request('/prets?per_page=200'),
          request('/sanctions?per_page=200'),
          request('/parametres').catch(() => ({ coeur: {}, etendus: {} })),
          request('/aides-sociales?per_page=200').catch(() => ({ data: [] })),
          request('/utilisateurs').catch(() => []),
          request('/types-sanction').catch(() => []),
          request('/types-aide-sociale').catch(() => []),
          request('/comptes-bancaires').catch(() => []),
          request('/postes').catch(() => []),
          request('/decisions-ag?per_page=200').catch(() => ({ data: [] })),
          request('/reglements').catch(() => []),
          request('/rapprochements').catch(() => []),
        ]);

        setMembres((mRes.data || mRes).map(adapt.membreFromApi));
        setTontines((tRes.data || tRes).map(adapt.tontineFromApi));
        setReunions((rRes.data || rRes).map(adapt.reunionFromApi));
        setBanques((cRes.data || cRes).map(adapt.caisseFromApi));
        setPrets((pRes.data || pRes).map(adapt.pretFromApi));
        setSanctions((sRes.data || sRes).map(adapt.sanctionFromApi));
        setParametres({ ...paramRes.coeur, ...paramRes.etendus });
        setFondAssurance((aRes.data || []).map(adapt.aideFromApi));
        setUtilisateurs((uRes || []).map(adapt.utilisateurFromApi));
        setTypesSanction((typeSancRes || []).map(adapt.typeSanctionFromApi));
        setTypesAideSociale((typeAideRes || []).map((t) => ({
          id: t.id, libelle: t.libelle, typeEvenement: t.type_evenement,
          montantFixe: Number(t.montant_fixe || 0), nbMaxParAn: t.nb_max_par_an,
          justificatifRequis: t.justificatif_requis, caisseSourceId: t.caisse_source_id,
        })));
        setComptesBancaire((comptesRes || []).map((c) => ({
          id: c.id, banque: c.banque, agence: c.agence, numeroCompte: c.numero_compte,
          titulaire: c.titulaire, actif: c.actif,
        })));

        const postesAdapted = (postesRes || []).map(adapt.posteFromApi);
        setPostes(postesAdapted);
        const histories = await Promise.all(
          postesAdapted.map((p) => request(`/postes/${p.id}/mandats`).catch(() => []))
        );
        setMandats(histories.flatMap((h) => h.map(adapt.mandatFromApi)));

        setDecisionsAG((decAgRes.data || decAgRes).map(adapt.decisionAgFromApi));
        setReglements((reglRes || []).map(adapt.reglementFromApi));
        setRapprochements((rapproRes || []).map(adapt.rapprochementFromApi));

        // Parts de tontine : agrégées depuis le détail de chaque tontine
        const tontinesDetail = await Promise.all(
          (tRes.data || tRes).map((t) => request(`/tontines/${t.id}`))
        );
        const parts = tontinesDetail.flatMap((t) => (t.parts || []).map(adapt.partFromApi));
        setMembresParTontine(parts);
      } catch (err) {
        showToast(err.message || 'Impossible de charger les données', 'error');
      }
    })();
  }, [user, currentAssociation, showToast]);

  const dashboardStats = useMemo(() => ({
    membresActifs: membres.filter((m) => m.statut === 'actif').length,
    totalMembres: membres.length,
    soldeCaisse: banques.reduce((s, b) => s + Number(b.totalSolde || 0), 0),
    totalBanques: banques.reduce((s, b) => s + Number(b.totalSolde || 0), 0),
    totalPretsRestants: prets.filter((p) => p.statut !== 'rembourse').reduce((s, p) => s + Number(p.resteAPayer || 0), 0),
    pretsEnCours: prets.filter((p) => p.statut === 'en_cours').length,
    pretsEnRetard: prets.filter((p) => p.statut === 'en_retard').length,
    tontinesActives: tontines.filter((t) => t.statut === 'active').length,
    sanctionsImpayees: sanctions.filter((s) => s.statut === 'impayee').length,
    prochaineReunion: reunions.filter((r) => r.statutReunion !== 'cloturee').sort((a, b) => new Date(a.date) - new Date(b.date))[0]?.date || null,
  }), [membres, banques, prets, tontines, sanctions, reunions]);

  const repartitionBanques = banques.map((b) => ({ name: b.nom, value: Number(b.totalSolde || 0) }));

  // ── Auth ──────────────────────────────────────────────────────
  const login = async ({ email, password }) => {
    try {
      const data = await request('/auth/login', { method: 'POST', body: { email, password } });
      setApiToken(data.token);
      setUser(data.user);
      if (data.user.membre?.association) {
        const asso = data.user.membre.association;
        setCurrentAssociationState({
          id: asso.id, nom: asso.nom, abrege: asso.nom_abrege, ville: asso.ville,
          pays: asso.pays, devise: asso.devise, siege: asso.siege_social,
          telephone: asso.telephone, email: asso.email, profilComplete: !!asso.profil_complete,
        });
        setSetupComplete(!!asso.profil_complete);
      }
      showToast('Connexion réussie');
      return { user: data.user, must_change_password: data.must_change_password };
    } catch (err) {
      return handleError(err, 'Connexion impossible');
    }
  };

  // ── Inscription : crée le compte + une association minimale, puis connecte ──
  const register = async (data) => {
    try {
      const res = await request('/auth/register', { method: 'POST', body: {
        nom: data.nom, prenom: data.prenom, telephone: data.telephone,
        email: data.email, password: data.password, password_confirmation: data.passwordConfirmation,
      } });
      setApiToken(res.token);
      setUser(res.user);
      const asso = res.user.membre?.association;
      if (asso) {
        setCurrentAssociationState({
          id: asso.id, nom: asso.nom, abrege: asso.nom_abrege, ville: asso.ville,
          pays: asso.pays, devise: asso.devise, siege: asso.siege_social,
          telephone: asso.telephone, email: asso.email, profilComplete: !!asso.profil_complete,
        });
        setSetupComplete(!!asso.profil_complete);
      }
      showToast('Compte créé — complétez la fiche de votre association');
      return res;
    } catch (err) {
      return handleError(err, 'Inscription impossible');
    }
  };

  const changePassword = async (payload) => {
    try {
      await request('/auth/change-password', { method: 'POST', body: payload });
      showToast('Mot de passe mis à jour');
    } catch (err) {
      return handleError(err);
    }
  };

  // Permet à l'utilisateur connecté de corriger ses propres informations (email de
  // connexion, nom/prénom/téléphone/adresse... de sa fiche membre) — utile notamment
  // après une création de compte par un admin avec un mot de passe provisoire.
  const updateMonProfil = async (data) => {
    try {
      const body = {};
      if (data.email) body.email = data.email;
      if (data.nom) body.nom = data.nom;
      if (data.prenom) body.prenom = data.prenom;
      if (data.telephone) body.telephone = data.telephone;
      if ('telephone2' in data) body.telephone2 = data.telephone2 || null;
      if ('adresse' in data) body.adresse = data.adresse || null;
      if ('ville' in data) body.ville = data.ville || null;
      if ('profession' in data) body.profession = data.profession || null;

      const updated = await request('/auth/me', { method: 'PUT', body });
      setUser(updated);
      showToast('Profil mis à jour');
      return updated;
    } catch (err) {
      return handleError(err);
    }
  };

  const logout = async () => {
    try { await request('/auth/logout', { method: 'POST' }); } catch { /* token déjà invalide, on ignore */ }
    clearApiToken();
    setUser(null);
    setCurrentAssociationState(null);
    showToast('Déconnecté');
  };

  const updateAssociation = async (id, data) => {
    try {
      const asso = await request(`/associations/${id}`, { method: 'PUT', body: {
        nom: data.nom, nom_abrege: data.abrege, siege_social: data.siege,
        ville: data.ville, pays: data.pays, telephone: data.telephone,
        email: data.email, devise: data.devise || 'XAF',
        ...(data.profilComplete !== undefined ? { profil_complete: data.profilComplete } : {}),
      } });
      setCurrentAssociationState({
        id: asso.id, nom: asso.nom, abrege: asso.nom_abrege, ville: asso.ville, pays: asso.pays,
        devise: asso.devise, siege: asso.siege_social, telephone: asso.telephone, email: asso.email,
        profilComplete: !!asso.profil_complete,
      });
      if (asso.profil_complete) setSetupComplete(true);
      showToast('Association mise à jour');
      return asso;
    } catch (err) {
      return handleError(err);
    }
  };

  // ── Membres ───────────────────────────────────────────────────
  const addMembre = async (data) => {
    try {
      const m = await request('/membres', { method: 'POST', body: adapt.membreToApi(data) });
      const membre = adapt.membreFromApi(m);
      setMembres((prev) => [...prev, membre]);
      showToast('Membre ajouté');
      return membre;
    } catch (err) { return handleError(err); }
  };
  const updateMembre = async (id, data) => {
    try {
      const m = await request(`/membres/${id}`, { method: 'PUT', body: adapt.membreToApi(data) });
      setMembres((prev) => prev.map((x) => (x.id === id ? adapt.membreFromApi(m) : x)));
      showToast('Membre modifié');
    } catch (err) { return handleError(err); }
  };
  const deleteMembre = async (id) => {
    try {
      await request(`/membres/${id}`, { method: 'DELETE' });
      setMembres((prev) => prev.filter((m) => m.id !== id));
      showToast('Membre supprimé');
    } catch (err) { return handleError(err); }
  };

  // ── Postes & mandats ────────────────────────────────────────────
  const addMandat = async ({ idPoste, idMembre, dateDebut }) => {
    try {
      const m = await request(`/postes/${idPoste}/mandats`, { method: 'POST', body: { membre_id: idMembre, date_debut: dateDebut } });
      const mandat = adapt.mandatFromApi(m);
      setMandats((prev) => [mandat, ...prev.map((x) => (x.idPoste === idPoste && !x.dateFin ? { ...x, dateFin: dateDebut } : x))]);
      setPostes((prev) => prev.map((p) => (p.id === idPoste ? { ...p, mandats: [mandat] } : p)));
      showToast('Poste attribué');
      return mandat;
    } catch (err) { return handleError(err, err?.message); }
  };
  const cloturerMandat = async (mandatId, dateFin) => {
    try {
      const m = await request(`/mandats/${mandatId}/cloturer`, { method: 'PUT', body: { date_fin: dateFin } });
      const mandat = adapt.mandatFromApi(m);
      setMandats((prev) => prev.map((x) => (x.id === mandatId ? mandat : x)));
      setPostes((prev) => prev.map((p) => (p.id === mandat.idPoste ? { ...p, mandats: [] } : p)));
      showToast('Mandat clôturé');
      return mandat;
    } catch (err) { return handleError(err); }
  };

  // ── Journal d'audit (lecture seule, accès restreint côté backend) ──
  const logAuditConsultation = async () => {
    try {
      const res = await request('/audit-log?per_page=200');
      setAuditLog((res.data || res).map(adapt.auditLogFromApi));
    } catch { /* 403 si rôle non autorisé : on laisse la page gérer l'affichage */ }
  };

  // ── Décisions d'AG ────────────────────────────────────────────────
  const addDecisionAG = async (data) => {
    try {
      const d = await request('/decisions-ag', { method: 'POST', body: {
        reunion_id: data.idReunion,
        type: data.type,
        objet: data.objet,
        description: data.description || null,
        quorum_present: Number(data.quorumPresent) || 0,
        votes_pour: Number(data.pour) || 0,
        votes_contre: Number(data.contre) || 0,
        votes_abstention: Number(data.abstentions) || 0,
        date_effet: data.dateAG || null,
      } });
      const decision = adapt.decisionAgFromApi(d);
      setDecisionsAG((prev) => [decision, ...prev]);
      showToast('Décision d\'AG enregistrée');
      return decision;
    } catch (err) { return handleError(err); }
  };

  // ── Règlement intérieur ───────────────────────────────────────────
  const addReglement = async (data) => {
    try {
      const r = await request('/reglements', { method: 'POST', body: {
        version: data.version,
        titre: data.titre || null,
        contenu_html: data.notes || null,
        fichier_url: data.fichier,
        date_adoption: data.dateAdoption,
        numero_decision_ag: data.decisionAG,
        signataires: null,
      } });
      const reglement = adapt.reglementFromApi(r);
      setReglements((prev) => [reglement, ...prev]);
      showToast('Version publiée');
      return reglement;
    } catch (err) { return handleError(err); }
  };

  // ── Rapprochement bancaire ────────────────────────────────────────
  const addRapprochement = async (data) => {
    try {
      const r = await request('/rapprochements', { method: 'POST', body: {
        compte_bancaire_id: data.idCompteBancaire,
        caisse_id: data.idCaisse,
        solde_banque: Number(data.soldeReleve),
        periode_debut: data.periodeDebut,
        periode_fin: data.periodeFin,
      } });
      const rapprochement = adapt.rapprochementFromApi(r);
      setRapprochements((prev) => [rapprochement, ...prev]);
      showToast(rapprochement.ecart === 0 ? 'Rapprochement conforme' : 'Écart détecté');
      return rapprochement;
    } catch (err) { return handleError(err); }
  };
  const justifierEcart = async (id, motif) => {
    try {
      const r = await request(`/rapprochements/${id}/justifier`, { method: 'POST', body: { motif } });
      const rapprochement = adapt.rapprochementFromApi(r);
      setRapprochements((prev) => prev.map((x) => (x.id === id ? rapprochement : x)));
      showToast('Écart justifié');
      return rapprochement;
    } catch (err) { return handleError(err); }
  };

  // ── Tontines ──────────────────────────────────────────────────
  const addTontine = async (data) => {
    try {
      const t = await request('/tontines', { method: 'POST', body: adapt.tontineToApi(data) });
      const tontine = adapt.tontineFromApi(t);
      setTontines((prev) => [...prev, tontine]);
      showToast('Tontine créée');
      return tontine;
    } catch (err) { return handleError(err); }
  };
  const updateTontine = async (data) => {
    try {
      const t = await request(`/tontines/${data.id}`, { method: 'PUT', body: adapt.tontineToApi(data) });
      setTontines((prev) => prev.map((x) => (x.id === data.id ? adapt.tontineFromApi(t) : x)));
      showToast('Tontine modifiée');
    } catch (err) { return handleError(err); }
  };
  const addMembreTontine = async (data) => {
    try {
      const p = await request(`/tontines/${data.idTontine}/parts`, { method: 'POST', body: adapt.partToApi(data) });
      const part = adapt.partFromApi(p);
      setMembresParTontine((prev) => [...prev, part]);
      showToast('Part ajoutée');
      return part;
    } catch (err) { return handleError(err); }
  };
  const removeMembreTontine = async (id, idTontine) => {
    try {
      const part = membresParTontine.find((p) => p.id === id);
      await request(`/tontines/${idTontine || part?.idTontine}/parts/${id}`, { method: 'DELETE' });
      setMembresParTontine((prev) => prev.filter((p) => p.id !== id));
      showToast('Part retirée');
    } catch (err) { return handleError(err); }
  };
  const updateMembreTontine = async (idOrData, maybeData) => {
    const data = maybeData || idOrData;
    const id = maybeData ? idOrData : data.id;
    const part = membresParTontine.find((p) => p.id === id);
    try {
      const p = await request(`/tontines/${data.idTontine || part?.idTontine}/parts/${id}`, { method: 'PUT', body: {
        ordre_rotation: data.ordreRotation,
        date_gain_calendrier: data.dateGainCalendrier,
        avaliste_id: data.idAvaliste,
      } });
      const updated = adapt.partFromApi(p);
      setMembresParTontine((prev) => prev.map((x) => (x.id === id ? updated : x)));
      showToast('Part modifiée');
    } catch (err) { return handleError(err); }
  };

  // ── Réunions ──────────────────────────────────────────────────
  const addReunion = async (data) => {
    try {
      const r = await request('/reunions', { method: 'POST', body: adapt.reunionToApi(data) });
      const reunion = adapt.reunionFromApi(r);
      setReunions((prev) => [reunion, ...prev]);
      showToast('Réunion planifiée');
      return reunion;
    } catch (err) { return handleError(err); }
  };
  const updateReunion = async (idOrData, maybeData) => {
    const dataIn = maybeData || idOrData;
    const id = maybeData ? idOrData : dataIn.id;
    try {
      const r = await request(`/reunions/${id}`, { method: 'PUT', body: adapt.reunionToApi(dataIn) });
      setReunions((prev) => prev.map((x) => (x.id === id ? adapt.reunionFromApi(r) : x)));
    } catch (err) { return handleError(err); }
  };
  const ouvrirReunion = async (id) => {
    try {
      const r = await request(`/reunions/${id}/ouvrir`, { method: 'POST' });
      setReunions((prev) => prev.map((x) => (x.id === id ? adapt.reunionFromApi(r) : x)));
      showToast('Réunion ouverte');
    } catch (err) { return handleError(err); }
  };
  const cloturerReunion = async (id) => {
    try {
      const r = await request(`/reunions/${id}/signer`, { method: 'POST', body: { membre_id: user?.membre_id, role_signature: user?.role } });
      setReunions((prev) => prev.map((x) => (x.id === id ? adapt.reunionFromApi(r) : x)));
      showToast('Signature enregistrée');
    } catch (err) { return handleError(err); }
  };

  const setPresenceMembre = async (idReunion, idMembre, { statut, heureArrivee, motifAbsence }) => {
    try {
      const res = await request(`/reunions/${idReunion}/presences`, { method: 'POST', body: { presences: [{
        membre_id: idMembre, statut, heure_arrivee: heureArrivee || null, motif_absence: motifAbsence || null,
      }] } });
      const p = res[0];
      const entry = { reunionId: idReunion, idMembre, statut: p?.statut || statut, heureArrivee: p?.heure_arrivee, motifAbsence: p?.motif_absence };
      setReunions((prev) => prev.map((r) => (r.id === idReunion
        ? { ...r, presencesReunion: [...(r.presencesReunion || []).filter((x) => x.idMembre !== idMembre), entry] }
        : r)));
    } catch (err) { return handleError(err); }
  };
  const signerPV = async (idReunion, { idMembre, role }) => {
    try {
      const s = await request(`/reunions/${idReunion}/signer`, { method: 'POST', body: { membre_id: idMembre, role_signature: role } });
      const signature = { idMembre: s.membre_id, nom: s.membre?.nom, role: s.role_signature, signeLe: s.signed_at };
      setReunions((prev) => prev.map((r) => (r.id === idReunion
        ? { ...r, signatures: [...(r.signatures || []).filter((x) => x.idMembre !== idMembre), signature] }
        : r)));
      showToast('PV signé');
    } catch (err) { return handleError(err); }
  };

  // ── Ordre du jour (points de réunion) ───────────────────────────
  const addPointODJ = async (reunionId, data) => {
    try {
      const item = await request(`/reunions/${reunionId}/points`, {
        method: 'POST',
        body: { titre: data.titre, type: data.type, description: data.description },
      });
      const point = {
        id: item.id,
        titre: item.libelle_libre ?? data.titre,
        type: data.type,
        description: item.contenu_rapport ?? data.description,
        statut: data.statut || 'prevu',
      };
      setReunions((prev) => prev.map((r) => (r.id === reunionId
        ? { ...r, pointsOrdreJour: [...(r.pointsOrdreJour || []), point] }
        : r)));
      showToast('Point ajouté à l\'ordre du jour');
      return point;
    } catch (err) { return handleError(err); }
  };
  const updatePointODJ = async (reunionId, pointId, data) => {
    try {
      const item = await request(`/reunions/${reunionId}/points/${pointId}`, {
        method: 'PUT',
        body: { titre: data.titre, description: data.description },
      });
      setReunions((prev) => prev.map((r) => (r.id === reunionId
        ? {
            ...r,
            pointsOrdreJour: (r.pointsOrdreJour || []).map((p) => (p.id === pointId
              ? {
                  ...p,
                  titre: item.libelle_libre ?? data.titre,
                  description: item.contenu_rapport ?? data.description,
                  type: data.type ?? p.type,
                  statut: data.statut ?? p.statut,
                }
              : p)),
          }
        : r)));
      showToast('Point modifié');
    } catch (err) { return handleError(err); }
  };
  const removePointODJ = async (reunionId, pointId) => {
    try {
      await request(`/reunions/${reunionId}/points/${pointId}`, { method: 'DELETE' });
      setReunions((prev) => prev.map((r) => (r.id === reunionId
        ? { ...r, pointsOrdreJour: (r.pointsOrdreJour || []).filter((p) => p.id !== pointId) }
        : r)));
      showToast('Point supprimé');
    } catch (err) { return handleError(err); }
  };

  // ── Rotations / Enchères : dérivées des cycles de tontine ──────
  const chargerRotations = useCallback(async (idTontine) => {
    try {
      const t = await request(`/tontines/${idTontine}`);
      const cycles = t.cycles || [];
      setRotations((prev) => [...prev.filter((r) => r.idTontine !== idTontine), ...cycles.map(adapt.cycleToRotation)]);
      const nouvellesEncheres = cycles.flatMap((c) => (c.encherites || []).map(adapt.enchereFromApi));
      setEncheres((prev) => [...prev.filter((e) => !cycles.some((c) => c.id === e.idRotation)), ...nouvellesEncheres]);
    } catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);

  const tirerAuSort = async (idTontine, idCycle) => {
    try {
      const cycle = await request(`/cycles/${idCycle}/designer-gagnant`, { method: 'POST' });
      const rotation = adapt.cycleToRotation(cycle);
      setRotations((prev) => [...prev.filter((r) => r.id !== rotation.id), rotation]);
      showToast('Gagnant désigné');
      return rotation.beneficiaire;
    } catch (err) { return handleError(err); }
  };

  const addEnchere = async (data) => {
    try {
      const part = membresParTontine.find((p) => p.idMembre === data.idMembre);
      const e = await request(`/cycles/${data.idRotation}/encheres`, { method: 'POST', body: {
        tontine_part_id: part?.id, membre_id: data.idMembre, montant_offre: Number(data.montantEnchere),
      } });
      const enchere = adapt.enchereFromApi(e);
      setEncheres((prev) => [...prev.filter((x) => !(x.idRotation === enchere.idRotation && x.idMembre === enchere.idMembre)), enchere]);
      showToast('Enchère enregistrée');
      return enchere;
    } catch (err) { return handleError(err); }
  };
  const attribuerTour = async (idRotation) => {
    try {
      const cycle = await request(`/cycles/${idRotation}/designer-gagnant`, { method: 'POST' });
      const rotation = adapt.cycleToRotation(cycle);
      setRotations((prev) => [...prev.filter((r) => r.id !== rotation.id), rotation]);
      showToast('Tour attribué');
    } catch (err) { return handleError(err); }
  };
  const annulerEncheres = async (idRotation) => {
    try {
      await request(`/cycles/${idRotation}/encheres`, { method: 'DELETE' });
      setEncheres((prev) => prev.filter((e) => e.idRotation !== idRotation));
      showToast('Enchères annulées');
    } catch (err) { return handleError(err); }
  };

  // ── Transferts entre caisses ────────────────────────────────────
  const [transfertsCaisse, setTransfertsCaisse] = useState([]);
  const chargerTransferts = useCallback(async () => {
    try {
      const list = await request('/caisses/transferts');
      setTransfertsCaisse(list || []);
    } catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);

  // ── Planning des tours (prévisionnel, par tontine) ──────────────
  const chargerPlanningTours = useCallback(async (idTontine) => {
    try {
      const list = await request(`/tontines/${idTontine}/planning`);
      setPlanningTours((prev) => [...prev.filter((t) => t.idTontine !== idTontine), ...(list || []).map((t) => ({
        id: t.id, idTontine: t.tontine_id, numeroTour: t.numero_tour,
        idPart: t.tontine_part_id, numeroPart: t.part?.numero_part,
        idMembre: t.beneficiaire_membre_id, nomMembre: t.beneficiaire ? `${t.beneficiaire.nom} ${t.beneficiaire.prenom}` : null,
        montantPot: Number(t.montant_prevu), datePrevue: t.date_prevue, statut: t.statut, note: t.notes,
      }))]);
    } catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);
  const addTourPlanning = async (data) => {
    try {
      // RG-TON : le tour est toujours rattaché à une PART précise (data.idPart), jamais
      // directement au membre — un membre avec plusieurs parts occupe plusieurs tours distincts.
      if (!data.idPart) {
        showToast('Aucune part sélectionnée pour ce tour.', 'error');
        return;
      }
      const t = await request(`/tontines/${data.idTontine}/planning`, {
        method: 'POST',
        body: { numero_tour: Number(data.numeroTour), tontine_part_id: data.idPart, montant_prevu: Number(data.montantPot || 0), date_prevue: data.datePrevue || undefined, notes: data.note },
      });
      const item = {
        id: t.id, idTontine: data.idTontine, numeroTour: t.numero_tour,
        idPart: t.tontine_part_id, numeroPart: t.part?.numero_part,
        idMembre: t.beneficiaire_membre_id, nomMembre: t.beneficiaire ? `${t.beneficiaire.nom} ${t.beneficiaire.prenom}` : data.nomMembre,
        montantPot: Number(t.montant_prevu), datePrevue: t.date_prevue, statut: t.statut, note: t.notes,
      };
      setPlanningTours((prev) => [...prev, item]);
      showToast('Tour planifié');
      return item;
    } catch (err) { return handleError(err); }
  };
  const marquerTourEncaisse = async (idTontine, id) => {
    try {
      await request(`/tontines/${idTontine}/planning/${id}/encaisser`, { method: 'POST' });
      setPlanningTours((prev) => prev.map((t) => (t.id === id ? { ...t, statut: 'encaisse' } : t)));
      showToast('Tour marqué encaissé');
    } catch (err) { return handleError(err); }
  };
  const retirerTourPlanning = async (idTontine, id) => {
    try {
      await request(`/tontines/${idTontine}/planning/${id}`, { method: 'DELETE' });
      setPlanningTours((prev) => prev.filter((t) => t.id !== id));
      showToast('Tour retiré du planning');
    } catch (err) { return handleError(err); }
  };

  // ── Journal de transactions en direct pendant une réunion ───────
  const [seanceTransactionsState, setSeanceTransactionsState] = useState([]);
  const chargerSeanceTransactions = useCallback(async (idReunion) => {
    try {
      const list = await request(`/reunions/${idReunion}/transactions`);
      setSeanceTransactionsState((prev) => [...prev.filter((t) => t.idReunion !== idReunion), ...(list || []).map((t) => ({
        id: t.id, idReunion: t.reunion_id, type: t.type, idMembre: t.membre_id,
        nomMembre: t.membre ? `${t.membre.nom} ${t.membre.prenom}` : null,
        montant: Number(t.montant), libelle: t.libelle, idSanction: t.reference_sanction_id,
        idPret: t.reference_pret_id, idBanque: t.caisse_id, note: t.note,
      }))]);
    } catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);
  const addSeanceTransaction = async (idReunion, data) => {
    try {
      const t = await request(`/reunions/${idReunion}/transactions`, {
        method: 'POST',
        body: {
          type: data.type, membre_id: data.idMembre || undefined, montant: Number(data.montant),
          libelle: data.libelle || undefined, reference_sanction_id: data.idSanction || undefined,
          reference_pret_id: data.idPret || undefined, caisse_id: data.idBanque || undefined, note: data.note || undefined,
        },
      });
      const item = { id: t.id, idReunion, type: t.type, idMembre: t.membre_id, montant: Number(t.montant), libelle: t.libelle };
      setSeanceTransactionsState((prev) => [...prev, item]);
      showToast('Transaction enregistrée');
      return item;
    } catch (err) { return handleError(err); }
  };
  const deleteSeanceTransaction = async (idReunion, id) => {
    try {
      await request(`/reunions/${idReunion}/transactions/${id}`, { method: 'DELETE' });
      setSeanceTransactionsState((prev) => prev.filter((t) => t.id !== id));
      showToast('Transaction supprimée');
    } catch (err) { return handleError(err); }
  };

  // ── Désignation du bénéficiaire directement depuis l'écran de réunion ──
  const enregistrerBeneficiaireSeance = async (idTontine, idReunion, idMembre) => {
    try {
      const cycle = await request(`/tontines/${idTontine}/enregistrer-beneficiaire`, {
        method: 'POST', body: { reunion_id: idReunion, membre_id: idMembre || undefined },
      });
      showToast('Bénéficiaire enregistré, bulletin généré');
      return cycle;
    } catch (err) { return handleError(err); }
  };
  const ouvrirSeance = (id) => ouvrirReunion(id);
  const cloturerSeance = async (id, data) => {
    try {
      await request(`/reunions/${id}`, {
        method: 'PUT',
        body: { notes: `Présents: ${data?.presents ?? '-'} / Absents: ${data?.absents ?? '-'}. ${data?.observation || ''}` },
      });
      const r = await request(`/reunions/${id}/signer`, { method: 'POST', body: { membre_id: user?.membre_id, role_signature: user?.role } });
      setReunions((prev) => prev.map((x) => (x.id === id ? adapt.reunionFromApi(r) : x)));
      showToast('Séance clôturée');
    } catch (err) { return handleError(err); }
  };

  // ── Caisses / Banques ─────────────────────────────────────────
  const addBanque = async (data) => {
    try {
      const c = await request('/caisses', { method: 'POST', body: adapt.caisseToApi(data) });
      const caisse = adapt.caisseFromApi(c);
      setBanques((prev) => [...prev, caisse]);
      showToast('Caisse créée');
      return caisse;
    } catch (err) { return handleError(err); }
  };
  const doOperation = async (data) => {
    try {
      const sens = data.type && TX_TYPES.find((t) => t.value === data.type)?.dir === 'sortie' ? 'sortie' : 'entree';
      const t = await request(`/caisses/${data.idBanque || data.idCaisse}/transactions`, { method: 'POST', body: {
        sens, montant: Number(data.montant), libelle: data.libelle || TX_LABELS[data.type] || 'Opération', mode_paiement: data.modePaiement,
      } });
      const tx = adapt.transactionFromApi(t);
      setCaisseJournal((prev) => [...prev, tx]);
      setBanques((prev) => prev.map((b) => (b.id === tx.idCaisse ? { ...b, totalSolde: sens === 'entree' ? b.totalSolde + tx.montant : b.totalSolde - tx.montant } : b)));
      showToast('Opération enregistrée');
    } catch (err) { return handleError(err); }
  };
  const transfererCaisse = async (data) => {
    try {
      const res = await request('/caisses/transferts', { method: 'POST', body: {
        caisse_source_id: data.idSource, caisse_destination_id: data.idDestination,
        montant: Number(data.montant), motif: data.motif || 'Transfert',
      } });
      showToast('Transfert enregistré');
      return res;
    } catch (err) { return handleError(err); }
  };
  const addMembreBanque = () => showToast('Comptes bancaires individuels non modélisés côté serveur (RG-CAI = caisses uniquement).', 'warning');

  // ── Sanctions ─────────────────────────────────────────────────
  const addTypeSanction = async (data) => {
    try {
      const t = await request('/types-sanction', { method: 'POST', body: {
        libelle: data.libelle, mode_calcul: data.modeCalcul || 'fixe', montant_fixe: data.montantFixe,
        declencheur: data.declencheur || undefined, est_automatique: !!data.estAutomatique, description: data.description,
      } });
      const type = adapt.typeSanctionFromApi(t);
      setTypesSanction((prev) => [...prev, type]);
      showToast('Type de sanction ajouté');
      return type;
    } catch (err) { return handleError(err); }
  };
  const updateTypeSanction = async (id, data) => {
    try {
      const t = await request(`/types-sanction/${id}`, { method: 'PUT', body: {
        libelle: data.libelle, montant_fixe: data.montantFixe, actif: data.actif,
      } });
      setTypesSanction((prev) => prev.map((x) => (x.id === id ? adapt.typeSanctionFromApi(t) : x)));
      showToast('Type de sanction modifié');
    } catch (err) { return handleError(err); }
  };

  const addSanction = async (data) => {
    try {
      const s = await request('/sanctions', { method: 'POST', body: {
        membre_id: data.idMembre, type_sanction_id: data.typeSanction, motif: data.motif, reunion_id: data.numReunion || undefined,
      } });
      const sanction = adapt.sanctionFromApi(s);
      setSanctions((prev) => [...prev, sanction]);
      showToast('Sanction ajoutée');
      return sanction;
    } catch (err) { return handleError(err); }
  };
  const payerSanction = async (id, options = {}) => {
    try {
      // Sanctions.jsx appelle payerSanction(id, { modePaiement, detailsPaiement }) — pas un
      // id de caisse. La caisse est optionnelle (le serveur prend la 1ère caisse par défaut).
      const idCaisse = typeof options === 'string' ? options : options?.idCaisse;
      const s = await request(`/sanctions/${id}/payer`, { method: 'POST', body: {
        caisse_id: idCaisse || undefined,
        mode_paiement: options?.modePaiement,
        details_paiement: options?.detailsPaiement,
      } });
      setSanctions((prev) => prev.map((x) => (x.id === id ? adapt.sanctionFromApi(s) : x)));
      showToast('Sanction réglée');
    } catch (err) { return handleError(err); }
  };

  // ── Prêts ─────────────────────────────────────────────────────
  const addPret = async (data) => {
    try {
      const p = await request('/prets', { method: 'POST', body: adapt.pretToApi(data) });
      const pret = adapt.pretFromApi(p);
      setPrets((prev) => [...prev, pret]);
      showToast('Demande de prêt enregistrée');
      return pret;
    } catch (err) { return handleError(err); }
  };
  // RG-ORG-012 — revue Trésorier avant transmission au Président : demande → en_attente_validation.
  const validerPret = async (id) => {
    try {
      const p = await request(`/prets/${id}/valider`, { method: 'POST' });
      setPrets((prev) => prev.map((x) => (x.id === id ? adapt.pretFromApi(p) : x)));
      showToast('Prêt transmis pour approbation');
    } catch (err) { return handleError(err); }
  };
  const approuverPret = async (id) => {
    try {
      const p = await request(`/prets/${id}/approuver`, { method: 'POST' });
      setPrets((prev) => prev.map((x) => (x.id === id ? adapt.pretFromApi(p) : x)));
      showToast('Prêt approuvé');
    } catch (err) { return handleError(err); }
  };
  const refuserPret = async (id, motif) => {
    try {
      const p = await request(`/prets/${id}/refuser`, { method: 'POST', body: { motif: motif || 'Refusé par le bureau' } });
      setPrets((prev) => prev.map((x) => (x.id === id ? adapt.pretFromApi(p) : x)));
      showToast('Prêt refusé');
    } catch (err) { return handleError(err); }
  };
  const decaisserPret = async (id) => {
    try {
      const p = await request(`/prets/${id}/decaisser`, { method: 'POST' });
      setPrets((prev) => prev.map((x) => (x.id === id ? adapt.pretFromApi(p) : x)));
      showToast('Prêt décaissé');
    } catch (err) { return handleError(err); }
  };
  // `options` peut contenir { echeanceId, modePaiement, detailsPaiement }. Auparavant,
  // Prets.jsx passait cet objet directement à la place d'un id d'échéance : la
  // comparaison e.id === {objet} ne matchait jamais et le remboursement échouait
  // systématiquement. On isole désormais explicitement l'id d'échéance.
  const rembourserPret = async (id, montant, options) => {
    try {
      const echeanceId = typeof options === 'string' ? options : options?.echeanceId;
      const pret = await request(`/prets/${id}`);
      const echeance = echeanceId
        ? pret.echeances.find((e) => e.id === echeanceId)
        : pret.echeances.find((e) => e.statut !== 'payee');
      if (!echeance) return showToast('Aucune échéance à rembourser.', 'error');

      await request(`/prets/${id}/rembourser`, { method: 'POST', body: { echeance_id: echeance.id, montant_verse: Number(montant) } });
      const p = await request(`/prets/${id}`);
      setPrets((prev) => prev.map((x) => (x.id === id ? adapt.pretFromApi(p) : x)));
      showToast('Remboursement enregistré');
    } catch (err) { return handleError(err); }
  };
  const distribuerInteretsPret = () => showToast('Non applicable : les intérêts sont calculés par échéance (amortissement linéaire).', 'info');

  // ── Social ────────────────────────────────────────────────────
  const addAide = async (data) => {
    try {
      // Social.jsx envoie data.categorie (code catégorie : naissance, mariage...) — on résout
      // vers le premier type actif correspondant dans le catalogue réel des barèmes.
      const typeId = typesAideSociale.some((t) => t.id === (data.categorie ?? data.typeEvenement))
        ? (data.categorie ?? data.typeEvenement)
        : typesAideSociale.find((t) => t.typeEvenement === (data.categorie ?? data.typeEvenement))?.id;

      if (!typeId) {
        showToast("Aucun barème configuré pour cette catégorie. Créez-le d'abord dans Paramètres → Social.", 'error');
        return;
      }

      const a = await request('/aides-sociales', { method: 'POST', body: {
        membre_id: data.idMembre, type_aide_id: typeId, description: data.description,
        date_evenement: data.dateDeclaration ?? data.dateEvenement, montant_demande: data.montant ?? data.montantAide,
        pieces_jointes: data.justificatif ? [data.justificatif] : (data.piecesJointes?.length ? data.piecesJointes : ['justificatif.pdf']),
      } });
      const aide = adapt.aideFromApi(a);
      setFondAssurance((prev) => [...prev, aide]);
      showToast('Aide déclarée');
      return aide;
    } catch (err) { return handleError(err); }
  };
  const validerAideSociale = async (id, decisionOuMontant) => {
    try {
      // Social.jsx appelle validerAideSociale(id, 'approuvee' | 'refusee').
      if (decisionOuMontant === 'refusee') {
        const a = await request(`/aides-sociales/${id}/refuser`, { method: 'POST' });
        const aide = adapt.aideFromApi(a);
        setFondAssurance((prev) => prev.map((x) => (x.id === id ? aide : x)));
        showToast('Aide refusée');
        return aide;
      }
      // 'approuvee' (ou un montant explicite fourni par un autre appelant) : le montant
      // accordé par défaut est le montant demandé, modifiable ensuite si besoin.
      const montantAccorde = typeof decisionOuMontant === 'number'
        ? decisionOuMontant
        : fondAssurance.find((x) => x.id === id)?.montant ?? fondAssurance.find((x) => x.id === id)?.montantDemande ?? 0;
      const a = await request(`/aides-sociales/${id}/valider`, { method: 'POST', body: { montant_accorde: Number(montantAccorde) } });
      const aide = adapt.aideFromApi(a);
      setFondAssurance((prev) => prev.map((x) => (x.id === id ? aide : x)));
      showToast('Aide approuvée');
      return aide;
    } catch (err) { return handleError(err); }
  };
  const verserAideSociale = async (id, options = {}) => {
    try {
      const a = await request(`/aides-sociales/${id}/verser`, { method: 'POST', body: {
        mode_paiement: options.modePaiement, details_paiement: options.detailsPaiement,
      } });
      const aide = adapt.aideFromApi(a);
      setFondAssurance((prev) => prev.map((x) => (x.id === id ? aide : x)));
      showToast('Aide versée');
      return aide;
    } catch (err) { return handleError(err); }
  };
  const addTypeAideSociale = async (data) => {
    try {
      const t = await request('/types-aide-sociale', { method: 'POST', body: {
        libelle: data.libelle, type_evenement: data.typeEvenement, montant_fixe: data.montantFixe,
        caisse_source_id: data.caisseSourceId, nb_max_par_an: data.nbMaxParAn || 3,
        justificatif_requis: data.justificatifRequis ?? true,
      } });
      const type = { id: t.id, libelle: t.libelle, typeEvenement: t.type_evenement, montantFixe: Number(t.montant_fixe || 0) };
      setTypesAideSociale((prev) => [...prev, type]);
      showToast('Type d\'aide sociale créé');
      return type;
    } catch (err) { return handleError(err); }
  };
  const addCompteBancaire = async (data) => {
    try {
      const c = await request('/comptes-bancaires', { method: 'POST', body: {
        banque: data.banque, agence: data.agence, numero_compte: data.numeroCompte,
        iban: data.iban, titulaire: data.titulaire,
      } });
      const compte = { id: c.id, banque: c.banque, agence: c.agence, numeroCompte: c.numero_compte, titulaire: c.titulaire, actif: c.actif };
      setComptesBancaire((prev) => [...prev, compte]);
      showToast('Compte bancaire ajouté');
      return compte;
    } catch (err) { return handleError(err); }
  };
  const membreEligibleAssurance = (idMembre) => membres.some((m) => m.id === idMembre && m.statut === 'actif');

  const addCaisseEntry = async (data) => doOperation(data);

  // ── Utilisateurs ──────────────────────────────────────────────
  const addUtilisateur = async (data) => {
    try {
      const res = await request('/utilisateurs', { method: 'POST', body: { membre_id: data.idMembre, email: data.email, role: data.role } });
      const utilisateur = adapt.utilisateurFromApi(res.utilisateur);
      setUtilisateurs((prev) => [...prev, utilisateur]);
      return { utilisateur, motDePasseProvisoire: res.mot_de_passe_provisoire };
    } catch (err) { return handleError(err); }
  };
  const updateUtilisateur = async (id, data) => {
    try {
      const res = await request(`/utilisateurs/${id}`, { method: 'PUT', body: { role: data.role } });
      const utilisateur = adapt.utilisateurFromApi(res);
      setUtilisateurs((prev) => prev.map((u) => (u.id === id ? utilisateur : u)));
      showToast('Utilisateur mis à jour');
      return utilisateur;
    } catch (err) { return handleError(err); }
  };
  const desactiverUtilisateur = async (id) => {
    try {
      await request(`/utilisateurs/${id}/desactiver`, { method: 'POST' });
      setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: 'inactif' } : u)));
      showToast('Utilisateur désactivé');
    } catch (err) { return handleError(err); }
  };
  const activerUtilisateur = async (id) => {
    try {
      await request(`/utilisateurs/${id}/activer`, { method: 'POST' });
      setUtilisateurs((prev) => prev.map((u) => (u.id === id ? { ...u, statut: 'actif' } : u)));
      showToast('Utilisateur activé');
    } catch (err) { return handleError(err); }
  };

  // ── Bulletins / rapports (génération PDF déléguée au backend) ──
  const chargerCycles = async (idTontine) => {
    try {
      const list = await request(`/tontines/${idTontine}/cycles`);
      const cycles = (list || []).map(adapt.cycleFromApi);
      setCyclesTontine((prev) => [...prev.filter((c) => c.idTontine !== idTontine), ...cycles]);
      return cycles;
    } catch (err) { return handleError(err); }
  };

  // ── Cycle de tontine — écran 4 « Saisie d'un cycle » ────────────
  // Ces quatre routes existaient côté backend mais n'étaient appelées nulle part
  // côté frontend : impossible d'ouvrir un cycle, de saisir une cotisation ou de
  // le clôturer autrement que via le raccourci « enregistrer-beneficiaire », qui
  // clôture avec des cotisations à 0 (bulletin toujours à montant brut nul).
  const ouvrirCycle = async (idTontine, idReunion) => {
    try {
      const c = await request(`/tontines/${idTontine}/cycles/ouvrir`, { method: 'POST', body: { reunion_id: idReunion } });
      const cycle = adapt.cycleFromApi(c);
      setCyclesTontine((prev) => [...prev.filter((x) => x.id !== cycle.id), cycle]);
      showToast('Cycle ouvert — saisissez les cotisations');
      return cycle;
    } catch (err) { return handleError(err); }
  };
  const chargerCycle = async (idCycle) => {
    try {
      const c = await request(`/cycles/${idCycle}`);
      const cycle = adapt.cycleFromApi(c);
      setCyclesTontine((prev) => [...prev.filter((x) => x.id !== cycle.id), cycle]);
      return cycle;
    } catch (err) { return handleError(err); }
  };
  const saisirCotisationCycle = async (idCycle, idCotisation, montantVerse, options = {}) => {
    try {
      await request(`/cycles/${idCycle}/cotisations`, { method: 'POST', body: {
        cotisation_id: idCotisation,
        montant_verse: Number(montantVerse),
        mode_paiement: options.modePaiement || undefined,
        reference_paiement: options.referencePaiement || undefined,
      } });
      return await chargerCycle(idCycle);
    } catch (err) { return handleError(err); }
  };
  const designerGagnantCycle = async (idCycle, idPartForcee) => {
    try {
      await request(`/cycles/${idCycle}/designer-gagnant`, { method: 'POST', body: idPartForcee ? { part_id: idPartForcee } : {} });
      showToast('Gagnant désigné');
      return await chargerCycle(idCycle);
    } catch (err) { return handleError(err); }
  };
  const cloturerCycle = async (idCycle) => {
    try {
      await request(`/cycles/${idCycle}/cloturer`, { method: 'POST' });
      showToast('Cycle clôturé — bulletin de gain généré');
      const cycle = await chargerCycle(idCycle);
      await chargerCycles(cycle.idTontine);
      return cycle;
    } catch (err) { return handleError(err); }
  };
  const genererBulletin = async (idCycle) => {
    try {
      const data = await request(`/cycles/${idCycle}/bulletin`);
      return data;
    } catch (err) { return handleError(err); }
  };
  const ouvrirBulletinPdf = async (idBulletin) => {
    try {
      const data = await request(`/bulletins/${idBulletin}/pdf`);
      window.open(data.pdf_url, '_blank');
    } catch (err) { return handleError(err); }
  };

  const resetWorkspace = async () => { await logout(); };

  const value = {
    booting, user, currentAssociation, setupComplete, toast, parametres,
    membres, tontines, membresParTontine, reunions, rotations, encheres,
    presences: reunions.flatMap((r) => r.presencesReunion || []),
    postes, mandats,
    banques, caisses: banques, prets, sanctions, typesSanction,
    fondAssurance, aidesAssurance: fondAssurance, caisseSociale: fondAssurance, caisseJournal,
    typesAideSociale, comptesBancaire,
    aidesSociales: fondAssurance,
    auditLog, decisionsAG, reglements, rapprochements,
    // Concepts hérités du mock sans équivalent backend réel pour l'instant (RG ne modélise
    // que des caisses partagées, pas de sous-comptes individuels par membre, ni de journal
    // de transactions par réunion distinct du journal de caisse) — exposés vides pour éviter
    // les crashs sur Membres.jsx/Rapports.jsx ; à construire côté backend si le besoin est confirmé.
    comptesBanque: [], operationsBanque: [], seanceTransactions: seanceTransactionsState, transfertsCaisse,
    utilisateurs, planningTours, cyclesTontine, chargerCycles, dashboardStats, repartitionBanques, evolutionCaisse: mock.evolutionCaisse,
    showToast,
    login, logout, changePassword, updateMonProfil, register, updateAssociation,
    addMembre, updateMembre, deleteMembre,
    addMandat, cloturerMandat,
    logAuditConsultation, addDecisionAG, addReglement, addRapprochement, justifierEcart,
    addTontine, updateTontine, addMembreTontine, removeMembreTontine, updateMembreTontine,
    addReunion, updateReunion, ouvrirReunion, cloturerReunion, ouvrirSeance, cloturerSeance,
    addPointODJ, updatePointODJ, removePointODJ,
    setPresenceMembre, signerPV,
    chargerRotations, tirerAuSort, addEnchere, attribuerTour, annulerEncheres,
    addBanque, addCaisse: addBanque, doOperation, addMembreBanque, transfererCaisse, addCompteBancaire, chargerTransferts,
    addTypeSanction, updateTypeSanction, addSanction, payerSanction,
    addPret, validerPret, approuverPret, refuserPret, decaisserPret, rembourserPret, distribuerInteretsPret,
    addAide, addAideSociale: addAide, validerAideSociale, verserAideSociale, addTypeAideSociale, membreEligibleAssurance, addCaisseEntry,
    addTourPlanning, marquerTourEncaisse, retirerTourPlanning, chargerPlanningTours,
    addSeanceTransaction, deleteSeanceTransaction, enregistrerBeneficiaireSeance, chargerSeanceTransactions,
    addUtilisateur, updateUtilisateur, desactiverUtilisateur, activerUtilisateur,
    genererBulletin, ouvrirBulletinPdf,
    ouvrirCycle, chargerCycle, saisirCotisationCycle, designerGagnantCycle, cloturerCycle,
    resetWorkspace,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp doit etre utilise dans AppProvider');
  return context;
};
