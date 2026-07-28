/**
 * Traduit les objets renvoyés par l'API Laravel (snake_case, noms complets)
 * vers la forme attendue par les pages du frontend (camelCase, héritée du mock),
 * et inversement pour les payloads envoyés. Ça évite de toucher aux 15 pages.
 */

// ── Membre ──────────────────────────────────────────────────────
export const membreFromApi = (m) => !m ? null : ({
  id: m.id,
  matricule: m.matricule,
  nom: m.nom,
  prenom: m.prenom,
  sexe: m.sexe,
  telephone: m.telephone,
  telephone2: m.telephone2,
  email: m.email,
  adresse: m.adresse,
  ville: m.ville,
  profession: m.profession,
  dateAdhesion: m.date_adhesion,
  statut: m.statut,
  estAssure: m.est_assure,
  numero: m.matricule || m.id?.slice(0, 8),
});

export const membreToApi = (m) => ({
  nom: m.nom,
  prenom: m.prenom,
  sexe: m.sexe,
  telephone: m.telephone,
  email: m.email || null,
  adresse: m.adresse || null,
  ville: m.ville || null,
  profession: m.profession || null,
  date_adhesion: m.dateAdhesion || undefined,
  statut: m.statut,
  motif_suspension: m.motifSuspension,
  motif_exclusion: m.motifExclusion,
});

// ── Journal d'audit ──────────────────────────────────────────────
export const auditLogFromApi = (l) => !l ? null : ({
  id: l.id,
  module: l.table_name,
  action: l.action,
  date: l.created_at,
  utilisateur: l.utilisateur?.membre ? `${l.utilisateur.membre.nom} ${l.utilisateur.membre.prenom}` : (l.utilisateur?.email || '—'),
  avant: l.valeur_avant ? JSON.stringify(l.valeur_avant) : null,
  apres: l.valeur_apres ? JSON.stringify(l.valeur_apres) : null,
});

// ── Décisions d'AG ───────────────────────────────────────────────
export const decisionAgFromApi = (d) => !d ? null : ({
  id: d.id,
  numero: d.numero_decision,
  idReunion: d.reunion_id,
  type: d.type,
  objet: d.objet,
  description: d.description,
  dateAG: d.reunion?.date_reunion || d.date_effet,
  pour: d.votes_pour,
  contre: d.votes_contre,
  abstentions: d.votes_abstention,
  quorumPresent: d.quorum_present,
  statut: d.statut,
});

// ── Règlement intérieur ──────────────────────────────────────────
export const reglementFromApi = (r) => !r ? null : ({
  id: r.id,
  version: r.version,
  titre: r.titre,
  fichier: r.fichier_url,
  dateAdoption: r.date_adoption,
  decisionAG: r.numero_decision_ag,
  notes: r.contenu_html,
  statut: r.date_adoption ? 'adopte' : 'brouillon',
});

// ── Rapprochement bancaire ───────────────────────────────────────
export const rapprochementFromApi = (r) => !r ? null : ({
  id: r.id,
  idCaisse: r.caisse_id,
  nomCaisse: r.caisse?.libelle,
  idCompteBancaire: r.compte_bancaire_id,
  soldeLogiciel: Number(r.solde_logiciel ?? 0),
  soldeReleve: Number(r.solde_banque ?? 0),
  ecart: Number(r.ecart ?? 0),
  dateReleve: r.periode_fin,
  periodeDebut: r.periode_debut,
  periodeFin: r.periode_fin,
  statut: Number(r.ecart ?? 0) === 0 ? 'ok' : 'ecart',
  justifie: !!r.valide_at,
  motifEcart: r.justification,
});

export const mandatFromApi = (m) => !m ? null : ({
  id: m.id,
  idPoste: m.poste_id,
  idMembre: m.membre_id,
  poste: m.poste?.libelle,
  nomMembre: m.membre ? `${m.membre.nom} ${m.membre.prenom}` : undefined,
  dateDebut: m.date_debut,
  dateFin: m.date_fin,
});

export const posteFromApi = (p) => !p ? null : ({
  id: p.id,
  libelle: p.libelle,
  code: p.code,
  estBureau: p.est_bureau,
  estObligatoire: p.est_obligatoire,
  mandats: (p.mandats || []).map(mandatFromApi),
});

// ── Tontine ─────────────────────────────────────────────────────
export const tontineFromApi = (t) => !t ? null : ({
  id: t.id,
  nom: t.libelle,
  description: t.description,
  cotisation: Number(t.montant_part),
  typeAttribution: t.mode_attribution === 'tirage_sort' ? 'tirage' : t.mode_attribution,
  avalisteRequis: t.exige_avaliste,
  pretAutorise: t.pret_autorise,
  miseMinEnchere: Number(t.mise_min_enchere || 0),
  optionSurplus: t.option_surplus,
  statut: t.statut === 'active' ? 'active' : t.statut,
  totalParts: t.parts_count ?? t.parts?.length ?? 0,
  nbTours: t.nb_parts_total ?? t.parts_count ?? t.parts?.length ?? 0,
  idCaisse: t.caisse_id,
  dateDebut: t.date_debut,
});

export const cycleFromApi = (c) => !c ? null : ({
  id: c.id,
  idTontine: c.tontine_id,
  idReunion: c.reunion_id,
  numeroCycle: c.numero_cycle,
  statut: c.statut,
  montantCollectePrevu: Number(c.montant_collecte_prevu || 0),
  montantCollecteReel: Number(c.montant_collecte_reel || 0),
  gagnantNom: c.gagnant?.membre ? `${c.gagnant.membre.nom} ${c.gagnant.membre.prenom}` : null,
  idGagnantPart: c.gagnant_part_id || null,
  montantEnchere: Number(c.montant_enchere || 0),
  idBulletin: c.bulletin?.id || null,
  dateOuverture: c.date_ouverture,
  dateCloture: c.date_cloture,
  cotisations: (c.cotisations || []).map(cotisationFromApi),
});

// ── Cotisation de cycle (écran 4 du cahier des charges) ─────────
export const cotisationFromApi = (co) => !co ? null : ({
  id: co.id,
  idCycle: co.cycle_id,
  idPart: co.tontine_part_id,
  idMembre: co.membre_id,
  nomMembre: co.membre ? `${co.membre.nom} ${co.membre.prenom}` : undefined,
  montantDu: Number(co.montant_du || 0),
  montantVerse: Number(co.montant_verse || 0),
  statut: co.statut, // due | partielle | payee | impayee
  modePaiement: co.mode_paiement,
  referencePaiement: co.reference_paiement,
  dateVersement: co.date_versement,
});

export const tontineToApi = (t) => ({
  libelle: t.nom,
  description: t.description || null,
  montant_part: Number(t.cotisation),
  mode_attribution: t.typeAttribution === 'tirage' ? 'tirage_sort' : t.typeAttribution,
  nb_parts_total: Number(t.nbTours || t.totalParts || t.nbPartsTotal || 1),
  exige_avaliste: !!t.avalisteRequis,
  pret_autorise: !!t.pretAutorise,
  mise_min_enchere: t.miseMinEnchere ?? undefined,
  option_surplus: t.optionSurplus,
  date_debut: t.dateDebut || undefined,
  caisse_id: t.idCaisse || undefined,
});

// ── Part de tontine (membresParTontine) ────────────────────────
export const partFromApi = (p) => !p ? null : ({
  id: p.id,
  idTontine: p.tontine_id,
  idMembre: p.membre_id,
  numeroPart: p.numero_part,
  nombreParts: 1, // le backend modélise chaque part individuellement (RG-TON parts multiples)
  ordreRotation: p.ordre_rotation,
  dateGainCalendrier: p.date_gain_calendrier,
  idAvaliste: p.avaliste_id,
  statut: p.statut === 'disponible' ? 'actif' : p.statut,
  dateAdhesion: p.created_at,
});

export const partToApi = (p) => ({
  membre_id: p.idMembre,
  numero_part: Number(p.numeroPart || p.numero || 1),
  ordre_rotation: p.ordreRotation ?? undefined,
  date_gain_calendrier: p.dateGainCalendrier || undefined,
  avaliste_id: p.idAvaliste || undefined,
});

// ── Réunion ─────────────────────────────────────────────────────
export const reunionFromApi = (r) => !r ? null : ({
  id: r.id,
  numero: r.numero,
  numReunion: r.numero,
  type: r.type,
  date: r.date_reunion,
  heureDebut: r.heure_debut,
  lieu: r.lieu,
  statutReunion: { ouverte: 'en_cours', cloturee: 'cloturee', tenue: 'tenue', annulee: 'annulee' }[r.statut] || 'planifiee',
  verrouillee: r.statut === 'cloturee',
  quorumRequis: r.quorum_requis,
  quorumAtteint: r.quorum_atteint,
  pointsOrdreJour: (r.ordre_du_jour || []).map((it) => ({
    id: it.id,
    titre: it.rubrique?.libelle || it.libelle_libre,
    type: it.type || 'divers',
    description: it.contenu_rapport,
    statut: it.rapport_valide ? 'traite' : 'prevu',
    idRapporteur: it.rapporteur_id,
    acteurRole: it.acteur_role,
    ordre: it.ordre,
  })),
  signatures: (r.signataires || []).map((s) => ({ idMembre: s.membre_id, nom: s.membre?.nom, role: s.role_signature, signeLe: s.signed_at })),
  presencesReunion: (r.presences || []).map((p) => ({
    reunionId: r.id, idMembre: p.membre_id, statut: p.statut,
    heureArrivee: p.heure_arrivee, motifAbsence: p.motif_absence,
  })),
});

export const reunionToApi = (r) => ({
  type: r.type || 'ordinaire',
  date_reunion: r.date,
  heure_debut: r.heureDebut || '18:00',
  lieu: r.lieu,
  est_domicile_membre: !!r.estDomicileMembre,
  hote_membre_id: r.idHote || undefined,
  quorum_requis: r.quorumRequis ?? undefined,
});

// ── Prêt ────────────────────────────────────────────────────────
export const pretFromApi = (p) => !p ? null : ({
  id: p.id,
  idMembre: p.emprunteur_id,
  nomMembre: p.emprunteur ? `${p.emprunteur.nom} ${p.emprunteur.prenom}` : undefined,
  idCaisse: p.caisse_id,
  montantPret: Number(p.montant_principal),
  tauxInteret: Number(p.taux_interet_mensuel) * 100,
  nbEcheances: p.nb_echeances,
  montantInteret: Number(p.interet_total),
  montantTotal: Number(p.montant_total_du),
  montantRembourse: Number(p.montant_rembourse),
  resteAPayer: Number(p.capital_restant),
  datePret: p.date_debut || p.date_demande,
  statut: mapStatutPret(p.statut),
  echeances: (p.echeances || []).map((e) => ({
    id: e.id,
    numero: e.numero_echeance,
    date: e.date_echeance,
    montantTotal: Number(e.montant_total),
    montantVerse: Number(e.montant_verse),
    statut: e.statut,
  })),
});

function mapStatutPret(s) {
  // RG-PRT — chaque état du cycle de vie doit rester distinguable pour piloter
  // les actions (Valider / Approuver / Décaisser) : ne pas les fusionner.
  return { demande: 'demande', en_attente_validation: 'en_attente_validation', approuve: 'approuve', en_cours: 'en_cours', en_retard: 'en_retard', defaut: 'defaut', solde: 'rembourse', refuse: 'refuse' }[s] || s;
}

export const pretToApi = (p) => ({
  caisse_id: p.idCaisse,
  emprunteur_id: p.idMembre,
  montant_principal: Number(p.montantPret),
  nb_echeances: Number(p.nbEcheances || p.dureeMois || 12),
  avaliste_id: p.idAvaliste || undefined,
  notes: p.notes || undefined,
});

// ── Sanction ────────────────────────────────────────────────────
export const sanctionFromApi = (s) => !s ? null : ({
  id: s.id,
  idMembre: s.membre_id,
  nomMembre: s.membre ? `${s.membre.nom} ${s.membre.prenom}` : undefined,
  typeSanction: s.type?.code || s.type_sanction_id,
  motif: s.motif,
  montant: Number(s.montant),
  numReunion: s.reunion_id,
  dateSanction: s.created_at,
  statut: s.statut === 'due' ? 'impayee' : s.statut === 'payee' ? 'payee' : s.statut,
});

export const typeSanctionFromApi = (t) => !t ? null : ({
  id: t.id,
  code: t.code || t.id,
  libelle: t.libelle,
  montantFixe: Number(t.montant_fixe || 0),
  modeCalcul: t.mode_calcul,
  estAutomatique: t.est_automatique,
});

// ── Aide sociale (FondAssurance) ───────────────────────────────
export const aideFromApi = (a) => !a ? null : ({
  id: a.id,
  idMembre: a.membre_id,
  nomMembre: a.membre ? `${a.membre.nom} ${a.membre.prenom}` : undefined,
  typeAideId: a.type_aide_id,
  typeEvenement: a.type_aide?.type_evenement || a.type_aide_id,
  categorie: a.type_aide?.type_evenement || a.type_aide_id, // alias utilisé par Social.jsx
  description: a.description,
  dateEvenement: a.date_evenement,
  dateDeclaration: a.date_declaration || a.date_evenement, // alias utilisé par Social.jsx
  montantDemande: Number(a.montant_demande || 0),
  montant: Number(a.montant_demande || 0), // alias utilisé par Social.jsx
  montantAccorde: a.montant_accorde != null ? Number(a.montant_accorde) : null,
  montantAide: Number(a.montant_accorde || a.montant_demande || 0),
  piecesJointes: a.pieces_jointes || [],
  justificatif: (a.pieces_jointes || []).length > 0,
  // statut_aide (Postgres) : 'demandee' | 'en_validation' | 'approuvee' | 'refusee' | 'versee'.
  // Passé tel quel (pas de remap) — Social.jsx doit filtrer sur ces valeurs exactes.
  statut: a.statut,
  modePaiement: a.transaction?.mode_paiement,
  detailsPaiement: a.transaction?.cheque_numero,
});

// ── Caisses (banques) ──────────────────────────────────────────
export const caisseFromApi = (c) => !c ? null : ({
  id: c.id,
  nom: c.libelle,
  type: c.type,
  totalSolde: Number(c.solde_actuel),
  soldeInitial: Number(c.solde_initial),
  pretAutorise: c.pret_autorise,
  tauxInteret: Number(c.taux_interet_mensuel || 0) * 100,
  statut: c.actif ? 'active' : 'inactive',
  dateCreation: c.date_ouverture || c.created_at,
  compteBancaireId: c.compte_bancaire_id || null,
});

export const caisseToApi = (c) => ({
  libelle: c.nom,
  description: c.description || null,
  type: c.type || 'autre',
  compte_bancaire_id: c.compteBancaireId || null,
  solde_initial: Number(c.soldeInitial || 0),
  pret_autorise: !!c.pretAutorise,
  taux_interet_mensuel: c.tauxInteret ? Number(c.tauxInteret) / 100 : undefined,
});

const CATEGORIE_PAR_REFERENCE = {
  sanction_membre: 'amende',
  echeance_pret: 'remboursement_pret',
  pret: 'pret_accorde',
  evenement_social: 'aide_sociale',
  transfert_caisse: 'depot_banque',
  cotisation_tontine: 'cotisation',
};

const deriveCategorie = (t) => {
  if (CATEGORIE_PAR_REFERENCE[t.reference_type]) return CATEGORIE_PAR_REFERENCE[t.reference_type];
  // Les transactions saisies depuis une réunion (cotisation, versement de pot, enchère...)
  // partagent toutes reference_type='seance_transaction' — on affine via le libellé,
  // faute d'un sous-type exposé directement sur la table transactions.
  const lib = (t.libelle || '').toLowerCase();
  if (lib.includes('cotisation')) return 'cotisation';
  if (lib.includes('enchère') || lib.includes('enchere')) return 'enchere';
  if (lib.includes('remboursement')) return 'remboursement';
  return undefined;
};

export const transactionFromApi = (t) => !t ? null : ({
  id: t.id,
  idCaisse: t.caisse_id,
  date: t.date_transaction,
  type: t.type === 'entree' ? 'entree' : 'sortie',
  montant: Number(t.montant),
  entree: t.type === 'entree' ? Number(t.montant) : 0,
  sortie: t.type !== 'entree' ? Number(t.montant) : 0,
  libelle: t.libelle,
  modePaiement: t.mode_paiement,
  categorie: deriveCategorie(t),
});

// ── Utilisateurs ────────────────────────────────────────────────
export const utilisateurFromApi = (u) => !u ? null : ({
  id: u.id,
  nomUtilisateur: u.email,
  email: u.email,
  idMembre: u.membre_id,
  nomMembre: u.membre ? `${u.membre.nom} ${u.membre.prenom}` : undefined,
  role: u.role,
  statut: u.actif ? 'actif' : 'inactif',
  derniereConnexion: u.derniere_connexion || '—',
});

// ── Cycle de tontine → Rotation (forme attendue par Rotations.jsx) ──
export const cycleToRotation = (c) => !c ? null : ({
  id: c.id,
  idTontine: c.tontine_id,
  numeroTour: c.numero_cycle,
  beneficiaire: c.gagnant?.membre ? `${c.gagnant.membre.nom} ${c.gagnant.membre.prenom}` : null,
  idMembre: c.gagnant?.membre_id,
  montantTotal: Number(c.montant_collecte_reel || c.montant_collecte_prevu || 0),
  enchere: Number(c.montant_enchere || 0),
  montantRecu: Number(c.montant_collecte_reel || 0) - Number(c.montant_enchere || 0),
  dateAttribution: c.date_cloture,
});

export const enchereFromApi = (e) => !e ? null : ({
  id: e.id,
  idRotation: e.cycle_id,
  idMembre: e.membre_id,
  nomMembre: e.membre ? `${e.membre.nom} ${e.membre.prenom}` : undefined,
  montantEnchere: Number(e.montant_offre),
  dateEnchere: e.created_at,
});
