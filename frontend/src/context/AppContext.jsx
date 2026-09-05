import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request, getApiToken, setApiToken, clearApiToken, API_BASE } from '../lib/api';
import * as adapt from '../lib/adapters';
import * as mock from '../data/mockData';

// Les 10 valeurs réellement acceptées par le backend (voir SeanceTransactionController::store
// et TYPES_SORTIE) — ce tableau sert à la fois aux boutons de sélection (TypePicker), au
// calcul des totaux/sens du rapport PV (RapportSeance), et aux libellés affichés partout.
// Historique : contenait avant 7 valeurs obsolètes (sanction, pret, remboursement, retrait,
// autre) qui ne correspondaient à aucun type réellement envoyé — les transactions amende /
// aide_sociale / pret_accorde / paiement_sanction / remboursement_pret / attribution_tour /
// divers_entree / divers_sortie étaient donc invisibles dans les totaux et le rapport PV.
// 'paiement_sanction' (distinct de 'amende') a été rajouté à part : c'est le type que
// BulletinGainService::verser() écrit pour la retenue de sanction imputée sur un gain
// (voir son absence d'ici → ligne du PV sans icône ni montant, colonnes Entrée/Sortie vides).
export const TX_TYPES = [
  { value: 'cotisation',         label: 'Cotisation',            dir: 'entree', icon: '💰' },
  { value: 'amende',             label: 'Paiement de sanction',  dir: 'entree', icon: '⚖️' },
  { value: 'paiement_sanction',  label: 'Sanction imputée',      dir: 'entree', icon: '🧾' },
  { value: 'remboursement_pret', label: 'Remboursement prêt',    dir: 'entree', icon: '🏦' },
  { value: 'divers_entree',      label: 'Entrée diverse',        dir: 'entree', icon: '📥' },
  { value: 'depot_banque',       label: 'Dépôt banque',          dir: 'banque', icon: '🏛️' },
  { value: 'pret_accorde',       label: 'Prêt accordé',          dir: 'sortie', icon: '💵' },
  { value: 'aide_sociale',       label: 'Aide sociale',          dir: 'sortie', icon: '❤️' },
  { value: 'attribution_tour',   label: 'Attribution du tour',   dir: 'sortie', icon: '🏆' },
  { value: 'divers_sortie',      label: 'Sortie diverse',        dir: 'sortie', icon: '📤' },
];
export const TX_LABELS = TX_TYPES.reduce((acc, t) => ({ ...acc, [t.value]: t.label }), {});

export const AppContext = createContext(null);

const PARAMETRES_VERS_UI = {
  seuil_approbation_pret: 'seuilApprobationPret', nb_signataires_pv: 'nbSignatairesPV',
  delai_rappel_j7: 'delaiRappelJ7', delai_rappel_j3: 'delaiRappelJ3', delai_rappel_j1: 'delaiRappelJ1',
  plafond_cumul_postes: 'plafondCumulPostes', taux_penalite_retard: 'tauxPenaliteRetard',
  duree_max_pret_mois: 'dureeMaxPretMois', tolerance_retard_minutes: 'toleranceRetardMinutes',
  seuil_suspension_sanctions: 'seuilSuspensionSanctions', cycles_impayes_avant_suspension: 'cyclesImpayesAvantSuspension',
  aide_naissance: 'aideNaissance', aide_mariage: 'aideMariage', aide_deces_membre: 'aideDecesMembre',
  aide_deces_famille: 'aideDecesFamille', max_aides_par_categorie_an: 'maxAidesParCategorieAn',
};
const PARAMETRES_VERS_API = Object.fromEntries(Object.entries(PARAMETRES_VERS_UI).map(([api, ui]) => [ui, api]));
const parametresDepuisApi = (data) => Object.fromEntries(
  Object.entries({ ...(data?.coeur || {}), ...(data?.etendus || {}) }).map(([key, value]) => [PARAMETRES_VERS_UI[key] || key, value])
);
const transfertDepuisApi = (t) => ({
  ...t,
  caisseSourceId: t.caisse_source_id,
  caisseDestinationId: t.caisse_destination_id,
  dateTransfert: t.created_at,
  statut: t.statut || 'execute',
});

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
  const [caisseJournalPagination, setCaisseJournalPagination] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [planningTours, setPlanningTours] = useState([]);
  const [cyclesTontine, setCyclesTontine] = useState([]);
  const [portailMoi, setPortailMoi] = useState(null);
  const [parametres, setParametres] = useState({});
  const [rubriquesODJ, setRubriquesODJ] = useState([]);

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
            telephone: asso.telephone, email: asso.email, profilComplete: !!asso.profil_complete, statutsUrl: asso.statuts_url,
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

  const chargerPortailMoi = async () => {
    try {
      const res = await request('/portail/moi');
      setPortailMoi(res);
      return res;
    } catch (err) {
      setPortailMoi(null);
    }
  };

  const chargerRubriquesODJ = useCallback(async () => {
    try {
      const rubriques = await request('/ordre-du-jour-rubriques');
      setRubriquesODJ(rubriques || []);
      return rubriques || [];
    } catch (err) {
      showToast(err.message || 'Impossible de charger les rubriques d’ordre du jour', 'error');
      return [];
    }
  }, [showToast]);

  const creerRubriqueODJ = async (libelle) => {
    try {
      const rubrique = await request('/ordre-du-jour-rubriques', {
        method: 'POST',
        body: { libelle, ordre_defaut: rubriquesODJ.length + 1, est_obligatoire: false },
      });
      setRubriquesODJ((prev) => [...prev, rubrique].sort((a, b) => a.ordre_defaut - b.ordre_defaut));
      showToast('Rubrique enregistrée pour les prochaines réunions');
      return rubrique;
    } catch (err) { return handleError(err); }
  };

  const importerHistorique = async (type, payload) => {
    try {
      const routes = {
        transactions: '/caisses/import-historique',
        decisions: '/decisions-ag/import-historique',
        prets: '/prets/import-historique',
        sanctions: '/sanctions/import-historique',
      };
      if (type === 'cycles') {
        const { tontine_id, ...cycle } = payload;
        const resultat = await request(`/tontines/${tontine_id}/cycles/import-historique`, { method: 'POST', body: cycle });
        const cycleAdapte = adapt.cycleFromApi(resultat);
        setCyclesTontine((prev) => [...prev.filter((item) => item.id !== cycleAdapte.id), cycleAdapte]);
        showToast('Cycle historique importé');
        return resultat;
      }
      const resultat = await request(routes[type], { method: 'POST', body: payload });
      if (type === 'decisions') setDecisionsAG((prev) => [...prev, ...(Array.isArray(resultat) ? resultat : [resultat]).map(adapt.decisionAgFromApi)]);
      if (type === 'prets') setPrets((prev) => [...prev, adapt.pretFromApi(resultat)]);
      if (type === 'sanctions') setSanctions((prev) => [...prev, adapt.sanctionFromApi(resultat)]);
      showToast('Historique importé');
      return resultat;
    } catch (err) { return handleError(err); }
  };

  // Pendant CSV/XLSX : le backend traite chaque ligne/groupe independamment et renvoie
  // {crees, erreurs}, pas de ressources completes comme en JSON — donc pas de mise a jour
  // des listes locales ici, juste le compte-rendu (voir TabularFileReader, PR du 24/08).
  const importerHistoriqueFichier = async (type, fichier, tontineId) => {
    try {
      const routes = {
        transactions: '/caisses/import-historique/fichier',
        decisions: '/decisions-ag/import-historique/fichier',
        prets: '/prets/import-historique/fichier',
        sanctions: '/sanctions/import-historique/fichier',
      };
      if (type === 'cycles' && !tontineId) {
        showToast('Choisissez la tontine concernée par ce fichier.', 'error');
        return;
      }
      const chemin = type === 'cycles' ? `/tontines/${tontineId}/cycles/import-historique/fichier` : routes[type];
      const fd = new FormData();
      fd.append('fichier', fichier);
      const resultat = await request(chemin, { method: 'POST', body: fd });
      const nbErreurs = resultat?.erreurs?.length || 0;
      showToast(`${resultat.crees} ligne(s) importée(s)${nbErreurs ? `, ${nbErreurs} en erreur` : ''}`, nbErreurs ? 'info' : 'success');
      return resultat;
    } catch (err) { return handleError(err); }
  };

  // ── Mode cagnotte (RG-TON) : remise de gains à un nombre libre de bénéficiaires ──
  const activerCagnotte = async (tontineId) => {
    try {
      const t = await request(`/tontines/${tontineId}/activer-cagnotte`, { method: 'POST' });
      setTontines((prev) => prev.map((x) => (x.id === tontineId ? { ...x, modeCagnotte: true } : x)));
      showToast('Mode cagnotte activé.', 'success');
      return t;
    } catch (err) { return handleError(err); }
  };

  const chargerPropositionCagnotte = async (tontineId) => {
    try { return await request(`/tontines/${tontineId}/cagnotte/proposition`); } catch (err) { return handleError(err); }
  };

  const chargerRemisesGain = async (tontineId) => {
    try { return await request(`/tontines/${tontineId}/remises-gain`); } catch (err) { return handleError(err); }
  };

  const creerRemiseGain = async (tontineId, payload) => {
    try {
      const res = await request(`/tontines/${tontineId}/remises-gain`, { method: 'POST', body: payload });
      showToast('Remise de gains enregistrée.', 'success');
      return res;
    } catch (err) { return handleError(err); }
  };

  // ── Initialisation membre (RG-INIT) : point de départ résumé, distinct de l'import historique ──
  const chargerInitialisationMembre = async (membreId) => {
    try { return await request(`/membres/${membreId}/initialisation`); } catch (err) { return handleError(err); }
  };

  const enregistrerInitialisationMembre = async (membreId, payload) => {
    try {
      const res = await request(`/membres/${membreId}/initialisation`, { method: 'POST', body: payload });
      showToast('Point de départ enregistré.', 'success');
      return res;
    } catch (err) { return handleError(err); }
  };

  // ── Épargne (RG-EPA) : caisse "tirelire commune", voir EpargneService ──
  const activerEpargne = async (caisseId) => {
    try {
      const res = await request(`/caisses/${caisseId}/activer-epargne`, { method: 'POST' });
      setBanques((prev) => prev.map((b) => (b.id === caisseId ? { ...b, suiviEpargne: true } : b)));
      showToast('Suivi épargne activé.', 'success');
      return res;
    } catch (err) { return handleError(err); }
  };

  const chargerSoldesEpargne = async (caisseId) => {
    try { return await request(`/caisses/${caisseId}/epargne/soldes`); } catch (err) { return handleError(err); }
  };

  const deposerEpargne = async (caisseId, payload) => {
    try {
      const res = await request(`/caisses/${caisseId}/epargne/depots`, { method: 'POST', body: payload });
      showToast('Dépôt enregistré.', 'success');
      // Rafraîchit le solde affiché de la caisse et le cache des membres
      // connus (utilisé pour restreindre le sélecteur de déposant — pt.9).
      const c = await request(`/caisses/${caisseId}`).catch(() => null);
      if (c) setBanques((prev) => prev.map((b) => (b.id === caisseId ? adapt.caisseFromApi(c) : b)));
      await chargerMembresEpargneCaisse(caisseId).catch(() => {});
      return res;
    } catch (err) { return handleError(err); }
  };

  const cassationEpargne = async (caisseId) => {
    try {
      const res = await request(`/caisses/${caisseId}/epargne/cassation`, { method: 'POST' });
      showToast('Cassation générale effectuée.', 'success');
      return res;
    } catch (err) { return handleError(err); }
  };

  const couperGarantieEpargne = async (caisseId, payload) => {
    try {
      const res = await request(`/caisses/${caisseId}/epargne/couper-garantie`, { method: 'POST', body: payload });
      showToast('Montant prélevé sur l\u2019épargne.', 'success');
      return res;
    } catch (err) { return handleError(err); }
  };

  // ── Charge toutes les données de l'association une fois connecté ──
  useEffect(() => {
    if (!user || !currentAssociation) return;

    // Le rôle "membre" n'a par défaut aucune permission sur /membres, /prets,
    // /sanctions... (RG-SEC-006/007, appliqué côté serveur — vérifié fail-closed
    // dans PermissionsRolesSeeder). Sans cette branche, le Promise.all ci-dessous
    // rejetait dès le premier 403 et TOUT le bootstrap échouait pour ce rôle —
    // y compris les réunions/tontines qu'il est pourtant autorisé à consulter.
    if (user.role === 'membre') {
      chargerPortailMoi();
      return;
    }

    (async () => {
      try {
        const [mRes, tRes, rRes, cRes, pRes, sRes, paramRes, aRes, uRes, typeSancRes, typeAideRes, comptesRes, postesRes, decAgRes, reglRes, rapproRes, transfRes] = await Promise.all([
          request('/membres?per_page=200'),
          request('/tontines?with_details=1'),
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
          request('/postes?with_history=1').catch(() => []),
          request('/decisions-ag?per_page=200').catch(() => ({ data: [] })),
          request('/reglements').catch(() => []),
          request('/rapprochements').catch(() => []),
          request('/caisses/transferts').catch(() => []),
        ]);

        setMembres((mRes.data || mRes).map(adapt.membreFromApi));
        setTontines((tRes.data || tRes).map(adapt.tontineFromApi));
        setReunions((rRes.data || rRes).map(adapt.reunionFromApi));
        setBanques((cRes.data || cRes).map(adapt.caisseFromApi));
        setPrets((pRes.data || pRes).map(adapt.pretFromApi));
        setSanctions((sRes.data || sRes).map(adapt.sanctionFromApi));
        setParametres(parametresDepuisApi(paramRes));
        setFondAssurance((aRes.data || []).map(adapt.aideFromApi));
        setUtilisateurs((uRes || []).map(adapt.utilisateurFromApi));
        setTypesSanction((typeSancRes || []).map(adapt.typeSanctionFromApi));
        setTypesAideSociale((typeAideRes || []).map((t) => ({
          id: t.id, libelle: t.libelle, typeEvenement: t.type_evenement,
          montantFixe: Number(t.montant_fixe || 0), nbMaxParAn: t.nb_max_par_an, nbMaxVie: t.nb_max_vie,
          justificatifRequis: t.justificatif_requis, caisseSourceId: t.caisse_source_id,
        })));
        setComptesBancaire((comptesRes || []).map((c) => ({
          id: c.id, banque: c.banque, agence: c.agence, numeroCompte: c.numero_compte,
          titulaire: c.titulaire, actif: c.actif,
        })));

        const postesAdapted = (postesRes || []).map(adapt.posteFromApi);
        setPostes(postesAdapted);
        // Optimisation N+1 : les mandats de TOUS les postes sont déjà inclus dans
        // /postes?with_history=1 (voir ci-dessus) — plus besoin d'une requête
        // GET /postes/{id}/mandats par poste (jusqu'à 30s de latence en plus au
        // démarrage sur hébergement mutualisé avec peu de workers PHP-FPM).
        setMandats((postesRes || []).flatMap((p) => (p.mandats || []).map(adapt.mandatFromApi)));

        setDecisionsAG((decAgRes.data || decAgRes).map(adapt.decisionAgFromApi));
        setReglements((reglRes || []).map(adapt.reglementFromApi));
        setRapprochements((rapproRes || []).map(adapt.rapprochementFromApi));
        setTransfertsCaisse((transfRes || []).map(transfertDepuisApi));

        // Optimisation N+1 : parts + cycles de TOUTES les tontines sont déjà inclus
        // dans /tontines?with_details=1 (voir ci-dessus) — plus besoin d'une requête
        // GET /tontines/{id} par tontine.
        const tontinesBrutes = tRes.data || tRes;
        const parts = tontinesBrutes.flatMap((t) => (t.parts || []).map(adapt.partFromApi));
        setMembresParTontine(parts);

        // Cycles de tontine : chargés ici une fois pour toutes (Rotations, Encheres, Caisse,
        // Tontines en dépendent tous) plutôt que de dépendre de la page visitée en premier —
        // /tontines?with_details=1 charge déjà 'cycles.encherites.membre, cycles.gagnant.membre'.
        const cycles = tontinesBrutes.flatMap((t) => (t.cycles || []).map(adapt.cycleFromApi));
        setCyclesTontine(cycles);
        setRotations(cycles.map(adapt.cycleToRotation));

        // Tours planifiés (rotation) : même logique — Reunions.jsx les lit (bénéficiaire
        // planifié pour la tontine sélectionnée) sans jamais déclencher leur chargement.
        await Promise.all(
          (tRes.data || tRes).filter((t) => t.mode_attribution === 'rotation').map((t) => chargerPlanningTours(t.id))
        );
      } catch (err) {
        showToast(err.message || 'Impossible de charger les données', 'error');
      }
    })();
  }, [user, currentAssociation, showToast]);

  useEffect(() => {
    if (user && currentAssociation) chargerRubriquesODJ();
  }, [user, currentAssociation, chargerRubriquesODJ]);

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
          telephone: asso.telephone, email: asso.email, profilComplete: !!asso.profil_complete, statutsUrl: asso.statuts_url,
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
          telephone: asso.telephone, email: asso.email, profilComplete: !!asso.profil_complete, statutsUrl: asso.statuts_url,
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

  const uploadStatutsAssociation = async (id, file, { version, dateAdoption, signataires } = {}) => {
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      fd.append('version', version);
      fd.append('date_adoption', dateAdoption);
      if (signataires?.length) signataires.forEach((signataire, index) => fd.append(`signataires[${index}]`, signataire));
      const asso = await request(`/associations/${id}/statuts`, { method: 'POST', body: fd });
      setCurrentAssociationState((prev) => ({ ...prev, statutsUrl: asso.statuts_url }));
      showToast('Statuts déposés');
      return asso;
    } catch (err) { return handleError(err); }
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
        profilComplete: !!asso.profil_complete, statutsUrl: asso.statuts_url,
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
      const fd = new FormData();
      fd.append('version', data.version);
      if (data.titre) fd.append('titre', data.titre);
      if (data.notes) fd.append('contenu_html', data.notes);
      if (data.fichierFile instanceof File) fd.append('fichier', data.fichierFile);
      else if (data.fichier) fd.append('fichier_url', data.fichier);
      fd.append('date_adoption', data.dateAdoption);
      fd.append('numero_decision_ag', data.decisionAG);
      const r = await request('/reglements', { method: 'POST', body: fd });
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
      setTontines((prev) => prev.map((t) => {
        if (t.id !== data.idTontine) return t;
        const totalParts = Number(t.totalParts || 0) + 1;
        return { ...t, totalParts, nbTours: Math.max(Number(t.nbTours || 0), totalParts) };
      }));
      showToast('Part ajoutée');
      return part;
    } catch (err) { return handleError(err); }
  };
  const removeMembreTontine = async (id, idTontine) => {
    try {
      const part = membresParTontine.find((p) => p.id === id);
      const idT = idTontine || part?.idTontine;
      await request(`/tontines/${idT}/parts/${id}`, { method: 'DELETE' });
      setMembresParTontine((prev) => prev.filter((p) => p.id !== id));
      setTontines((prev) => prev.map((t) => t.id === idT ? { ...t, totalParts: Math.max(0, Number(t.totalParts || 0) - 1) } : t));
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
  const chargerReunion = async (id) => {
    try {
      const r = await request(`/reunions/${id}`);
      const reunion = adapt.reunionFromApi(r);
      setReunions((prev) => (prev.some((x) => x.id === id) ? prev.map((x) => (x.id === id ? reunion : x)) : [...prev, reunion]));
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
  const ouvrirReunion = async (id, details = {}) => {
    try {
      const r = await request(`/reunions/${id}/ouvrir`, { method: 'POST', body: {
        heure_ouverture_reelle: details.heureOuverture || undefined,
        president_seance: details.presidentSeance || undefined,
        secretaire_seance: details.secretaireSeance || undefined,
        mot_ouverture: details.motOuverture || undefined,
      } });
      setReunions((prev) => prev.map((x) => (x.id === id ? adapt.reunionFromApi(r) : x)));
      showToast('Réunion ouverte');
    } catch (err) { return handleError(err); }
  };
  const cloturerReunion = async (id) => {
    try {
      await request(`/reunions/${id}/signer`, { method: 'POST', body: { membre_id: user?.membre_id, role_signature: user?.role } });
      // La réponse de /signer est une SIGNATURE, pas une réunion — on recharge la vraie
      // réunion pour ne jamais corrompre son id en state (bug corrigé : reunionFromApi
      // était appliqué directement sur l'objet signature).
      const r = await request(`/reunions/${id}`);
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
        body: {
          titre: data.titre,
          rubrique_id: data.rubriqueId || undefined,
          type: data.type,
          description: data.description,
          acteur_role: data.acteurRole || undefined,
        },
      });
      const point = {
        id: item.id,
        idRubrique: item.rubrique_id || null,
        titre: item.rubrique?.libelle ?? item.libelle_libre ?? data.titre,
        type: item.type ?? data.type,
        description: item.contenu_rapport ?? data.description,
        acteurRole: item.acteur_role,
        statut: item.rapport_valide ? 'traite' : (data.statut || 'prevu'),
        ordre: item.ordre,
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
        body: {
          titre: data.titre, description: data.description,
          type: data.type, acteur_role: data.acteurRole || null,
          statut: data.statut,
        },
      });
      setReunions((prev) => prev.map((r) => (r.id === reunionId
        ? {
            ...r,
            pointsOrdreJour: (r.pointsOrdreJour || []).map((p) => (p.id === pointId
              ? {
                  ...p,
                  titre: item.libelle_libre ?? data.titre,
                  description: item.contenu_rapport ?? data.description,
                  type: item.type ?? data.type ?? p.type,
                  acteurRole: item.acteur_role ?? data.acteurRole,
                  statut: item.rapport_valide ? 'traite' : (data.statut ?? p.statut),
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

  const movePointODJ = (reunionId, pointId, direction) => {
    setReunions((prev) => prev.map((r) => {
      if (r.id !== reunionId) return r;
      const points = (r.pointsOrdreJour || []).slice().sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      const idx = points.findIndex((p) => p.id === pointId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= points.length) return r;
      [points[idx], points[swapIdx]] = [points[swapIdx], points[idx]];
      const reordered = points.map((p, i) => ({ ...p, ordre: i + 1 }));
      return { ...r, pointsOrdreJour: reordered };
    }));
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
      // Un même membre peut participer à plusieurs tontines. La part doit donc
      // être résolue dans la tontine du cycle, jamais dans la première part
      // trouvée globalement.
      const idTontine = data.idTontine || rotations.find((r) => r.id === data.idRotation)?.idTontine;
      const part = membresParTontine.find((p) => p.idTontine === idTontine && p.idMembre === data.idMembre && p.statut === 'actif');
      if (!part) throw new Error('Ce membre ne possède aucune part disponible dans cette tontine.');
      const e = await request(`/cycles/${data.idRotation}/encheres`, { method: 'POST', body: {
        tontine_part_id: part?.id, membre_id: data.idMembre, montant_offre: Number(data.montantEnchere), caisse_id: data.idCaisse,
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
      setTransfertsCaisse((list || []).map(transfertDepuisApi));
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
        idPret: t.reference_pret_id, idBanque: t.caisse_id, idCaisse: t.caisse_id,
        nomCaisse: t.caisse?.libelle || null, note: t.note,
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
          reference_pret_id: data.idPret || undefined, caisse_id: data.idBanque || undefined,
          // BUGFIX : sans ce lien, une transaction de cotisation saisie en Feuille
          // de cotisation reste orpheline vis-à-vis du cycle qui la motive — voir
          // TontineCycleService::annulerCycleAvantVersement.
          cycle_tontine_id: data.idCycle || undefined,
          note: data.note || undefined,
        },
      });
      const item = {
        id: t.id, idReunion, type: t.type, idMembre: t.membre_id,
        nomMembre: t.membre ? `${t.membre.nom} ${t.membre.prenom}` : null,
        montant: Number(t.montant), libelle: t.libelle,
        idBanque: t.caisse_id, idCaisse: t.caisse_id, nomCaisse: t.caisse?.libelle || null,
      };
      setSeanceTransactionsState((prev) => [...prev, item]);
      showToast('Transaction enregistrée');
      return item;
    } catch (err) { return handleError(err); }
  };
  const updateSeanceTransaction = async (idReunion, id, data) => {
    try {
      const t = await request(`/reunions/${idReunion}/transactions/${id}`, {
        method: 'PUT',
        body: {
          type: data.type, membre_id: data.idMembre || undefined, montant: Number(data.montant),
          libelle: data.libelle || undefined, caisse_id: data.idBanque || undefined,
          note: data.note || undefined,
        },
      });
      const item = {
        id: t.id, idReunion, type: t.type, idMembre: t.membre_id,
        nomMembre: t.membre ? `${t.membre.nom} ${t.membre.prenom}` : null,
        montant: Number(t.montant), libelle: t.libelle,
        idBanque: t.caisse_id, idCaisse: t.caisse_id, nomCaisse: t.caisse?.libelle || null,
      };
      setSeanceTransactionsState((prev) => prev.map((x) => (x.id === id ? item : x)));
      showToast('Transaction modifiée');
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
  const enregistrerBeneficiaireSeance = async (idReunion, data) => {
    try {
      const c = await request(`/tontines/${data.idTontine}/enregistrer-beneficiaire`, {
        method: 'POST', body: { reunion_id: idReunion, membre_id: data.idMembre || undefined },
      });
      // BUG corrigé : cette fonction ne mettait à jour AUCUN état après l'appel — le
      // bénéficiaire désigné restait invisible dès qu'on changeait d'onglet ou de
      // composant (il ne vivait que dans le state local du composant appelant).
      const cycle = adapt.cycleFromApi(c);
      setCyclesTontine((prev) => [...prev.filter((x) => x.id !== cycle.id), cycle]);
      showToast('Bénéficiaire enregistré, bulletin généré');
      return c;
    } catch (err) { return handleError(err); }
  };
  const ouvrirSeance = (id, details) => ouvrirReunion(id, details);
  const cloturerSeance = async (id, data) => {
    try {
      await request(`/reunions/${id}`, {
        method: 'PUT',
        body: {
          statut: 'tenue',
          notes: `Présents: ${data?.presents ?? '-'} / Absents: ${data?.absents ?? '-'}. ${data?.observation || ''}`,
        },
      });
      // La clôture réelle (verrouillage du PV) exige 3 signatures distinctes (Président +
      // Secrétaire + 1 membre élu — RG-REU-021) : cet appel n'enregistre QUE la signature
      // de l'utilisateur courant. On ne peut donc jamais prétendre que « la séance est
      // clôturée » après ce seul clic — les 2 autres signataires doivent encore passer
      // par l'onglet Signatures.
      await request(`/reunions/${id}/signer`, { method: 'POST', body: { membre_id: user?.membre_id, role_signature: user?.role } });
      const r = await request(`/reunions/${id}`);
      const reunion = adapt.reunionFromApi(r);
      setReunions((prev) => prev.map((x) => (x.id === id ? reunion : x)));
      if (reunion.statutReunion === 'cloturee') {
        showToast('Séance clôturée — PV verrouillé (3 signatures réunies)');
      } else {
        const nb = (reunion.signatures || []).length;
        showToast(`Séance tenue, votre signature enregistrée (${nb}/3) — les autres signataires doivent encore signer dans l'onglet Signatures.`, 'info');
      }
      return reunion;
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
  const modifierBanque = async (id, data) => {
    try {
      const c = await request(`/caisses/${id}`, { method: 'PUT', body: adapt.caisseUpdateToApi(data) });
      const caisse = adapt.caisseFromApi(c);
      setBanques((prev) => prev.map((b) => (b.id === id ? caisse : b)));
      showToast('Caisse modifiée');
      return caisse;
    } catch (err) { return handleError(err); }
  };
  const chargerJournalCaisse = async (idCaisse, filtres = {}) => {
    try {
      const qs = new URLSearchParams({ per_page: '100', ...filtres }).toString();
      const res = await request(`/caisses/${idCaisse}/journal?${qs}`);
      const lignes = (res.data || res).map(adapt.transactionFromApi);
      setCaisseJournal((prev) => [...prev.filter((t) => t.idCaisse !== idCaisse), ...lignes]);
      return lignes;
    } catch (err) { return handleError(err); }
  };
  const doOperation = async (data) => {
    try {
      const sens = data.type && TX_TYPES.find((t) => t.value === data.type)?.dir === 'sortie' ? 'sortie' : 'entree';
      const t = await request(`/caisses/${data.idBanque || data.idCaisse}/transactions`, { method: 'POST', body: {
        sens, montant: Number(data.montant), libelle: data.libelle || TX_LABELS[data.type] || 'Opération', mode_paiement: data.modePaiement || 'especes',
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
      if (res.statut === 'en_attente') {
        await chargerTransferts();
        showToast('Demande de transfert envoyée au Président pour approbation', 'info');
        return res;
      }
      const txSource = adapt.transactionFromApi(res.transaction_source);
      const txDestination = adapt.transactionFromApi(res.transaction_destination);
      setCaisseJournal((prev) => [...prev, txSource, txDestination].filter(Boolean));
      setBanques((prev) => prev.map((caisse) => {
        if (caisse.id === data.idSource) return { ...caisse, totalSolde: caisse.totalSolde - Number(data.montant) };
        if (caisse.id === data.idDestination) return { ...caisse, totalSolde: caisse.totalSolde + Number(data.montant) };
        return caisse;
      }));
      await chargerTransferts();
      showToast('Transfert enregistré');
      return res;
    } catch (err) { return handleError(err); }
  };
  // ── Épargne caisse (RG-EPA) — suivi des membres pour le dépôt banque ──
  // Remplace l'ancien addMembreBanque (stub qui n'écrivait rien côté serveur)
  // et l'ancien comptesBanque (toujours []). "Inscrire un membre" n'existe
  // plus comme étape séparée : un membre devient suivi dès son premier
  // dépôt épargne dans la caisse. epargneMembresParCaisse met en cache la
  // liste des membres déjà suivis par caisse (id -> [{membre_id, membre_nom}]),
  // utilisée notamment pour restreindre le sélecteur "Membre déposant" du
  // formulaire de dépôt en banque aux membres réellement connus de la caisse.
  // activerEpargne/chargerSoldesEpargne/deposerEpargne existent déjà plus haut
  // (module Épargne) — on ne les redéclare pas ici, seul chargerMembresEpargneCaisse
  // est nouveau (endpoint /epargne/membres, absent du module d'origine).
  const [epargneMembresParCaisse, setEpargneMembresParCaisse] = useState({});

  const chargerMembresEpargneCaisse = async (caisseId) => {
    try {
      const membres = await request(`/caisses/${caisseId}/epargne/membres`);
      setEpargneMembresParCaisse((prev) => ({ ...prev, [caisseId]: membres }));
      return membres;
    } catch (err) { return handleError(err); }
  };

  // ── Sanctions ─────────────────────────────────────────────────
  const addTypeSanction = async (data) => {
    try {
      const t = await request('/types-sanction', { method: 'POST', body: {
        libelle: data.libelle, mode_calcul: data.modeCalcul || 'fixe', montant_fixe: data.montantFixe,
        declencheur: data.declencheur || undefined, est_automatique: !!data.estAutomatique, description: data.description,
        paliers_retard: data.paliersRetard?.length ? data.paliersRetard.map(p => ({ minutes: Number(p.minutes), montant: Number(p.montant) })) : undefined,
        paliers_absence: data.paliersAbsence?.length ? data.paliersAbsence.map(p => ({ nombre: Number(p.nombre), montant: Number(p.montant) })) : undefined,
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
        declencheur: data.declencheur !== undefined ? (data.declencheur || null) : undefined,
        est_automatique: data.estAutomatique !== undefined ? !!data.estAutomatique : undefined,
        paliers_retard: data.paliersRetard !== undefined
          ? (data.paliersRetard?.length ? data.paliersRetard.map(p => ({ minutes: Number(p.minutes), montant: Number(p.montant) })) : null)
          : undefined,
        paliers_absence: data.paliersAbsence !== undefined
          ? (data.paliersAbsence?.length ? data.paliersAbsence.map(p => ({ nombre: Number(p.nombre), montant: Number(p.montant) })) : null)
          : undefined,
      } });
      setTypesSanction((prev) => prev.map((x) => (x.id === id ? adapt.typeSanctionFromApi(t) : x)));
      showToast('Type de sanction modifié');
    } catch (err) { return handleError(err); }
  };
  const deleteTypeSanction = async (id) => {
    try {
      await request(`/types-sanction/${id}`, { method: 'DELETE' });
      setTypesSanction((prev) => prev.filter((x) => x.id !== id));
      showToast('Type de sanction supprimé');
    } catch (err) { return handleError(err); }
  };

  const addSanction = async (data) => {
    try {
      // data.typeSanction peut être un UUID direct ou un code catalogue (non_paiement, retard...) —
      // dans ce 2e cas on résout vers le type réel (même logique que addAide pour les aides sociales).
      const typeId = typesSanction.some((t) => t.id === data.typeSanction)
        ? data.typeSanction
        : typesSanction.find((t) => t.code === data.typeSanction)?.id;

      if (!typeId) {
        showToast("Aucun type de sanction configuré pour ce motif. Créez-le d'abord dans Paramètres → Sanctions.", 'error');
        return;
      }

      const s = await request('/sanctions', { method: 'POST', body: {
        membre_id: data.idMembre, type_sanction_id: typeId, motif: data.motif,
        reunion_id: data.numReunion || data.reunionId || undefined,
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
      const reunionOuverte = reunions.find((r) => r.statutReunion === 'en_cours');
      if (!reunionOuverte) { showToast?.('Ouvrez une séance de réunion avant de décaisser un prêt.', 'error'); return; }
      const res = await request(`/prets/${id}/decaisser`, { method: 'POST', body: { reunion_id: reunionOuverte.id } });
      setPrets((prev) => prev.map((x) => (x.id === id ? adapt.pretFromApi(res.pret) : x)));
      showToast('Prêt décaissé');
      // pt.15 : avant, si la caisse ne suivait pas l'épargne, aucun snapshot
      // n'était pris et l'intérêt du prêt ne serait jamais réparti au
      // remboursement — silencieusement. On avertit désormais le trésorier
      // tout de suite, au moment où il peut encore agir (activer le suivi).
      if (res.avertissement) showToast(res.avertissement, 'warning');
    } catch (err) { return handleError(err); }
  };
  // `options` peut contenir { echeanceId, modePaiement, detailsPaiement }. Auparavant,
  // Prets.jsx passait cet objet directement à la place d'un id d'échéance : la
  // comparaison e.id === {objet} ne matchait jamais et le remboursement échouait
  // systématiquement. On isole désormais explicitement l'id d'échéance.
  const rembourserPret = async (id, montant, options) => {
    try {
      const echeanceId = typeof options === 'string' ? options : options?.echeanceId;
      // Si une échéance précise est visée, on impute directement dessus (cas d'usage
      // ponctuel). Sinon — cas courant du modal "Enregistrer un remboursement" — on
      // passe par /rembourser-libre qui répartit le montant sur les échéances
      // impayées les plus anciennes d'abord (capital + intérêt inclus). Avant ce
      // correctif, un paiement couvrant 2 mensualités ou plus n'en soldait qu'une
      // seule : les suivantes restaient affichées comme dues alors que l'argent
      // avait déjà été intégralement encaissé.
      if (echeanceId) {
        await request(`/prets/${id}/rembourser`, { method: 'POST', body: { echeance_id: echeanceId, montant_verse: Number(montant) } });
      } else {
        await request(`/prets/${id}/rembourser-libre`, { method: 'POST', body: {
          montant: Number(montant),
          mode_paiement: options?.modePaiement || undefined,
          reference_paiement: options?.referencePaiement || options?.detailsPaiement || undefined,
        } });
      }
      const p = await request(`/prets/${id}`);
      setPrets((prev) => prev.map((x) => (x.id === id ? adapt.pretFromApi(p) : x)));
      showToast('Remboursement enregistré');
    } catch (err) { return handleError(err); }
  };
  const distribuerInteretsPret = () => showToast('Non applicable : les intérêts sont calculés par échéance (amortissement linéaire).', 'info');

  // ── Social ────────────────────────────────────────────────────
  const uploadFichier = async (file) => {
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      const res = await request('/uploads', { method: 'POST', body: fd });
      return res.url;
    } catch (err) { return handleError(err); }
  };

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

      let pieces = data.piecesJointes?.length ? data.piecesJointes : [];
      if (data.justificatifFile instanceof File) {
        const url = await uploadFichier(data.justificatifFile);
        if (url) pieces = [url];
      } else if (data.justificatif) {
        pieces = [data.justificatif];
      }
      if (!pieces.length) {
        showToast('Merci de joindre un justificatif.', 'error');
        return;
      }

      const a = await request('/aides-sociales', { method: 'POST', body: {
        membre_id: data.idMembre, type_aide_id: typeId, description: data.description,
        date_evenement: data.dateDeclaration ?? data.dateEvenement, montant_demande: data.montant ?? data.montantAide,
        pieces_jointes: pieces,
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
      const reunionOuverte = reunions.find((r) => r.statutReunion === 'en_cours');
      if (!reunionOuverte) { showToast?.('Ouvrez une séance de réunion avant de verser une aide sociale.', 'error'); return; }
      const a = await request(`/aides-sociales/${id}/verser`, { method: 'POST', body: {
        reunion_id: reunionOuverte.id,
        // Caisse choisie au moment du versement si le type n'en a pas une par défaut
        // (paramétrage du type = barème, pas caisse ; cf addTypeAideSociale).
        caisse_id: options.idCaisse || undefined,
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
      // La caisse N'EST PAS demandée ici : comme pour les sanctions, paramétrer un
      // type d'aide (libellé + catégorie + montant) ne doit pas exiger de choisir une
      // caisse -- ce choix a lieu plus tard, lors du versement réel en réunion
      // (verserAideSociale). Si data.caisseSourceId est fourni malgré tout (caisse
      // par défaut optionnelle), on le transmet, sinon on l'omet complètement.
      const t = await request('/types-aide-sociale', { method: 'POST', body: {
        libelle: data.libelle, type_evenement: data.typeEvenement, montant_fixe: data.montantFixe,
        caisse_source_id: data.caisseSourceId || undefined, nb_max_par_an: data.nbMaxParAn || 3,
        nb_max_vie: data.nbMaxVie || undefined,
        justificatif_requis: data.justificatifRequis ?? true,
      } });
      const type = {
        id: t.id, libelle: t.libelle, typeEvenement: t.type_evenement,
        montantFixe: Number(t.montant_fixe || 0), nbMaxParAn: t.nb_max_par_an, nbMaxVie: t.nb_max_vie,
        caisseSourceId: t.caisse_source_id, actif: t.actif,
      };
      setTypesAideSociale((prev) => [...prev, type]);
      showToast('Type d\'aide sociale créé');
      return type;
    } catch (err) { return handleError(err); }
  };
  const updateTypeAideSociale = async (id, data) => {
    try {
      const t = await request(`/types-aide-sociale/${id}`, { method: 'PUT', body: {
        libelle: data.libelle, type_evenement: data.typeEvenement, montant_fixe: data.montantFixe,
        caisse_source_id: data.caisseSourceId, actif: data.actif,
        nb_max_par_an: data.nbMaxParAn, nb_max_vie: data.nbMaxVie ?? null,
      } });
      const type = {
        id: t.id, libelle: t.libelle, typeEvenement: t.type_evenement,
        montantFixe: Number(t.montant_fixe || 0), nbMaxParAn: t.nb_max_par_an, nbMaxVie: t.nb_max_vie,
        caisseSourceId: t.caisse_source_id, actif: t.actif,
      };
      setTypesAideSociale((prev) => prev.map((x) => (x.id === id ? type : x)));
      showToast('Type d\'aide sociale modifié');
      return type;
    } catch (err) { return handleError(err); }
  };
  const deleteTypeAideSociale = async (id) => {
    try {
      await request(`/types-aide-sociale/${id}`, { method: 'DELETE' });
      setTypesAideSociale((prev) => prev.filter((x) => x.id !== id));
      showToast('Type d\'aide sociale supprimé');
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

  // Recharge les parts d'UNE tontine (statut disponible/réservée/gagnée) — nécessaire
  // après la clôture d'un cycle : la part gagnante passe à 'gagnee' en base, mais
  // membresParTontine restait figé en mémoire jusqu'au prochain F5 complet, ce qui
  // pouvait faire réapparaître (ou disparaître à tort) un membre selon un état obsolète.
  const rechargerPartsTontine = async (idTontine) => {
    try {
      const t = await request(`/tontines/${idTontine}`);
      const parts = (t.parts || []).map(adapt.partFromApi);
      setMembresParTontine((prev) => [...prev.filter((p) => p.idTontine !== idTontine), ...parts]);
      return parts;
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
      await chargerPlanningTours(cycle.idTontine);
      await rechargerPartsTontine(cycle.idTontine);
      return cycle;
    } catch (err) { return handleError(err); }
  };
  const genererBulletin = async (idCycle) => {
    try {
      const data = await request(`/cycles/${idCycle}/bulletin`);
      return data;
    } catch (err) { return handleError(err); }
  };
  // Résout data.pdf_url en URL absolue même si le backend le renvoie en relatif
  // (dépend d'APP_URL dans le .env Laravel, pas toujours configuré correctement
  // en local) — sinon window.open ouvre par rapport à l'origine du frontend
  // (Vite, port 5173) au lieu du backend, et la SPA React redirige vers le
  // dashboard faute de route connue pour ce chemin.
  // Retourne l'URL résolue au lieu de faire window.open : affichée dans une
  // vraie modale intégrée (iframe), pas une popup navigateur potentiellement bloquée.
  const resolveBulletinUrl = (pdfUrl) => {
    if (!pdfUrl) return null;
    if (/^https?:\/\//i.test(pdfUrl)) return pdfUrl;
    const origin = API_BASE.replace(/\/api\/?$/, '');
    return `${origin}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`;
  };
  const ouvrirBulletinPdf = async (idBulletin) => {
    try {
      const data = await request(`/bulletins/${idBulletin}/pdf`);
      return resolveBulletinUrl(data.pdf_url);
    } catch (err) { return handleError(err); }
  };

  // Retenue manuelle « priorité 5 » (frais d'organisation, décision d'AG...) — rien
  // ne la calcule automatiquement, le trésorier/président la saisit à la main avant
  // de signer. Refusé côté serveur si le bulletin a déjà au moins une signature.
  const ajouterRetenueBulletin = async (idBulletin, libelle, montant, idCaisse) => {
    try {
      const b = await request(`/bulletins/${idBulletin}/retenues`, {
        method: 'POST', body: { libelle, montant: Number(montant), caisse_id: idCaisse },
      });
      showToast('Retenue ajoutée : elle sera imputée dans la caisse choisie lors du versement du gain');
      return b;
    } catch (err) { return handleError(err); }
  };
  // Retour des fonds : contre-passation d'un bulletin déjà versé (préalable
  // obligatoire côté serveur avant de pouvoir annuler le cycle correspondant).
  const annulerVersementBulletin = async (idBulletin, motif = '') => {
    try {
      const bulletin = await request(`/bulletins/${idBulletin}/annuler-versement`, {
        method: 'POST', body: { motif: motif || null },
      });
      if (bulletin.cycle?.reunion_id) await chargerSeanceTransactions(bulletin.cycle.reunion_id);
      showToast('Retour des fonds enregistré : le gain et les retenues ont été contre-passés');
      return bulletin;
    } catch (err) { return handleError(err); }
  };

  const annulerCycle = async (idCycle, idBulletin) => {
    try {
      await request(`/cycles/${idCycle}`, { method: 'DELETE' });
      // BUGFIX : le backend contre-passe désormais aussi les transactions de
      // cotisation liées au cycle (cycle_tontine_id) et le surplus d'enchère,
      // mais côté client seanceTransactionsState garde encore ces entrées en
      // mémoire tant qu'on ne recharge pas — elles restaient visibles dans
      // Caisse, l'historique et le rapport PV malgré l'annulation.
      const cycleAnnule = cyclesTontine.find((cycle) => cycle.id === idCycle);
      setCyclesTontine((prev) => prev.filter((cycle) => cycle.id !== idCycle));
      setRotations((prev) => prev.filter((rotation) => rotation.id !== idCycle));
      if (cycleAnnule?.idReunion) await chargerSeanceTransactions(cycleAnnule.idReunion);
      showToast('Cycle annulé : le bénéficiaire et la feuille peuvent être saisis à nouveau');
      return true;
    } catch (err) {
      // Le bulletin de ce cycle a déjà été versé : le serveur refuse l'annulation
      // tant que le retour des fonds n'a pas été enregistré (voir
      // TontineCycleService::annulerCycleAvantVersement). On propose de l'enchaîner
      // automatiquement plutôt que de laisser l'utilisateur bloqué.
      const message = err?.message || '';
      if (idBulletin && message.includes('gain a déjà été versé')) {
        const confirmer = window.confirm(
          `${message}\n\nVoulez-vous enregistrer maintenant le retour des fonds (contre-passation du versement et des retenues), puis annuler le cycle ?`
        );
        if (confirmer) {
          const bulletin = await annulerVersementBulletin(idBulletin);
          if (bulletin) {
            return annulerCycle(idCycle, idBulletin);
          }
        }
        return false;
      }
      return handleError(err);
    }
  };
  const addPoste = async (data) => {
    try {
      const poste = adapt.posteFromApi(await request('/postes', { method: 'POST', body: data }));
      setPostes((prev) => [...prev, { ...poste, mandats: [] }]);
      showToast('Poste créé');
      return poste;
    } catch (err) { return handleError(err); }
  };
  const approuverTransfertCaisse = async (idTransfert) => {
    try {
      const res = await request(`/caisses/transferts/${idTransfert}/approuver`, { method: 'POST' });
      const txSource = adapt.transactionFromApi(res.transaction_source);
      const txDestination = adapt.transactionFromApi(res.transaction_destination);
      setCaisseJournal((prev) => [...prev, txSource, txDestination].filter(Boolean));
      setBanques((prev) => prev.map((caisse) => {
        if (caisse.id === txSource?.idCaisse) return { ...caisse, totalSolde: caisse.totalSolde - txSource.sortie };
        if (caisse.id === txDestination?.idCaisse) return { ...caisse, totalSolde: caisse.totalSolde + txDestination.entree };
        return caisse;
      }));
      await chargerTransferts();
      showToast('Transfert approuvé et exécuté');
      return res;
    } catch (err) { return handleError(err); }
  };
  const chargerJournalGlobal = async (filtres = {}) => {
    try {
      const qs = new URLSearchParams({ per_page: '500', ...filtres }).toString();
      const res = await request(`/caisses/journal-global?${qs}`);
      const lignes = (res.data || res).map(adapt.transactionFromApi);
      setCaisseJournal(lignes);
      setCaisseJournalPagination({ currentPage: res.current_page || 1, lastPage: res.last_page || 1, total: res.total || lignes.length });
      return lignes;
    } catch (err) { return handleError(err); }
  };

  const updateParametres = async (data) => {
    try {
      const coeur = {};
      const etendus = {};
      Object.entries(data).forEach(([key, value]) => {
        const apiKey = PARAMETRES_VERS_API[key] || key;
        if (['devise', 'seuil_approbation_pret', 'nb_signataires_pv', 'delai_rappel_j7', 'delai_rappel_j3', 'delai_rappel_j1'].includes(apiKey)) coeur[apiKey] = value;
        else etendus[apiKey] = value;
      });
      const resultat = await request('/parametres', { method: 'PUT', body: { ...coeur, etendus } });
      setParametres(parametresDepuisApi(resultat));
      if (resultat.coeur?.devise) {
        setCurrentAssociationState((association) => association ? { ...association, devise: resultat.coeur.devise } : association);
      }
      showToast('Paramètres enregistrés');
      return resultat;
    } catch (err) { return handleError(err); }
  };
  const payerBulletin = async (idBulletin, modePaiement = 'especes', referenceVersement = '') => {
    try {
      const bulletin = await request(`/bulletins/${idBulletin}/payer`, { method: 'POST', body: { mode_paiement: modePaiement, reference_versement: referenceVersement || null } });
      if (bulletin.cycle?.reunion_id) await chargerSeanceTransactions(bulletin.cycle.reunion_id);
      showToast('Gain versé et mouvement de caisse enregistré');
      return bulletin;
    } catch (err) { return handleError(err); }
  };

  const resetWorkspace = async () => { await logout(); };

  const value = {
    booting, user, currentAssociation, setupComplete, toast, parametres, rubriquesODJ,
    membres, tontines, membresParTontine, reunions, rotations, encheres,
    presences: reunions.flatMap((r) => r.presencesReunion || []),
    postes, mandats,
    banques, caisses: banques, prets, sanctions, typesSanction,
    fondAssurance, aidesAssurance: fondAssurance, caisseSociale: fondAssurance, caisseJournal, caisseJournalPagination,
    typesAideSociale, comptesBancaire,
    aidesSociales: fondAssurance,
    auditLog, decisionsAG, reglements, rapprochements,
    // Concepts hérités du mock sans équivalent backend réel pour l'instant (RG ne modélise
    // que des caisses partagées, pas de sous-comptes individuels par membre, ni de journal
    // de transactions par réunion distinct du journal de caisse) — exposés vides pour éviter
    // les crashs sur Membres.jsx/Rapports.jsx ; à construire côté backend si le besoin est confirmé.
    comptesBanque: [], operationsBanque: [], seanceTransactions: seanceTransactionsState, transfertsCaisse, chargerJournalCaisse, chargerJournalGlobal,
    utilisateurs, planningTours, cyclesTontine, chargerCycles, rechargerPartsTontine, dashboardStats, repartitionBanques, evolutionCaisse: mock.evolutionCaisse,
    portailMoi, chargerPortailMoi,
    showToast, importerHistorique, importerHistoriqueFichier,
    activerCagnotte, chargerPropositionCagnotte, chargerRemisesGain, creerRemiseGain,
    chargerInitialisationMembre, enregistrerInitialisationMembre,
    activerEpargne, chargerSoldesEpargne, deposerEpargne, cassationEpargne, couperGarantieEpargne,
    login, logout, changePassword, updateMonProfil, register, updateAssociation, uploadStatutsAssociation, updateParametres,
    addMembre, updateMembre, deleteMembre,
    addPoste, addMandat, cloturerMandat,
    logAuditConsultation, addDecisionAG, addReglement, addRapprochement, justifierEcart,
    addTontine, updateTontine, addMembreTontine, removeMembreTontine, updateMembreTontine,
    addReunion, updateReunion, chargerReunion, ouvrirReunion, cloturerReunion, ouvrirSeance, cloturerSeance,
    addPointODJ, updatePointODJ, removePointODJ, movePointODJ, chargerRubriquesODJ, creerRubriqueODJ,
    setPresenceMembre, signerPV,
    chargerRotations, tirerAuSort, addEnchere, attribuerTour, annulerEncheres, annulerCycle, annulerVersementBulletin,
    addBanque, addCaisse: addBanque, modifierBanque, modifierCaisse: modifierBanque, doOperation, transfererCaisse, approuverTransfertCaisse, addCompteBancaire, chargerTransferts,
    epargneMembresParCaisse, chargerMembresEpargneCaisse,
    addTypeSanction, updateTypeSanction, deleteTypeSanction, addSanction, payerSanction,
    addPret, validerPret, approuverPret, refuserPret, decaisserPret, rembourserPret, distribuerInteretsPret,
    addAide, addAideSociale: addAide, validerAideSociale, verserAideSociale, addTypeAideSociale, updateTypeAideSociale, deleteTypeAideSociale, membreEligibleAssurance, addCaisseEntry, uploadFichier,
    addTourPlanning, marquerTourEncaisse, retirerTourPlanning, chargerPlanningTours,
    addSeanceTransaction, updateSeanceTransaction, deleteSeanceTransaction, enregistrerBeneficiaireSeance, chargerSeanceTransactions,
    addUtilisateur, updateUtilisateur, desactiverUtilisateur, activerUtilisateur,
    genererBulletin, ouvrirBulletinPdf, ajouterRetenueBulletin, payerBulletin,
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
