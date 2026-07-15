export const associations = [
  {
    id: 'asso-tontix-001',
    nom: 'TONTIX Solidarité Cameroun',
    abrege: 'TSC',
    ville: 'Douala',
    pays: 'Cameroun',
    devise: 'XAF',
    siege: 'Akwa, Douala',
    telephone: '+237 6XX XXX XXX',
    email: 'contact@tontix.cm',
    statut: 'active',
  },
];

export const membres = [];
export const tontines = [];
export const membresParTontine = [];
export const reunions = [];
export const rotations = [];
export const encheres = [];
export const banques = [];
export const comptesBanque = [];
export const operationsBanque = [];
export const transfertsCaisse = [];
export const typesSanction = [];
export const prets = [];
export const sanctions = [];
export const fondAssurance = [];
export const caisseSociale = [];
export const caisseJournal = [];
export const utilisateurs = [];
export const evolutionCaisse = [];
export const planningTours = [];

export const fmt = (n) =>
  new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
  }).format(n ?? 0);

export const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const typeEvtLabel = {
  deces_parent: 'Décès parent',
  deces_membre: 'Décès membre',
  maladie: 'Maladie grave',
  mariage: 'Mariage',
  naissance: 'Naissance',
  accident: 'Accident',
  autre: 'Autre',
};

export const typeSancLabel = {
  retard_cotisation: 'Retard de cotisation',
  absence_non_excusee: 'Absence non excusée',
  insubordination: 'Insubordination',
  insulte: 'Insulte',
  non_paiement: 'Non-paiement',
  autre: 'Autre',
};

export const roleLabel = {
  admin: 'Administrateur',
  president: 'Président',
  tresorier: 'Trésorier',
  secretaire: 'Secrétaire',
};

export const periodeLabel = {
  mensuel: 'Mensuelle',
  bimestriel: 'Bimestrielle',
  trimestriel: 'Trimestrielle',
  hebdomadaire: 'Hebdomadaire',
};

export const typeAttrLabel = {
  rotation: 'Rotation',
  tirage: 'Tirage au sort',
  enchere: 'Enchère',
};

// ── Statut des membres (aligné sur l'ENUM DB statut_membre — RG-MBR-003) ──
// Seuls les membres ACTIF participent aux tontines et réunions.
export const STATUTS_MEMBRE = [
  { value: 'actif',      label: 'Actif',      color: 'green' },
  { value: 'suspendu',   label: 'Suspendu',   color: 'amber' },
  { value: 'exclu',      label: 'Exclu',      color: 'red'   },
  { value: 'en_attente', label: 'En attente', color: 'blue'  },
];
export const statutMembreLabel = STATUTS_MEMBRE.reduce((acc, s) => ({ ...acc, [s.value]: s.label }), {});
export const statutMembreColor = STATUTS_MEMBRE.reduce((acc, s) => ({ ...acc, [s.value]: s.color }), {});

export const typePointLabel = {
  administratif: 'Administratif',
  financier: 'Financier',
  attribution: 'Attribution',
  disciplinaire: 'Disciplinaire',
  divers: 'Divers',
};

export const statutPointLabel = {
  prevu: 'Prévu',
  en_cours: 'En cours',
  traite: 'Traité',
  reporte: 'Reporté',
  annule: 'Annulé',
};

// ── Acteurs responsables d'une rubrique d'ordre du jour ────────
// Alignés sur l'enum DB role_utilisateur (sans super_admin, non pertinent ici)
export const ACTEUR_ROLES = [
  { value: 'president',      label: 'Président' },
  { value: 'vice_president', label: 'Vice-Président' },
  { value: 'tresorier',      label: 'Trésorier' },
  { value: 'secretaire',     label: 'Secrétaire' },
  { value: 'controleur',     label: 'Contrôleur' },
  { value: 'membre',         label: 'Membre désigné' },
];
export const acteurRoleLabel = ACTEUR_ROLES.reduce((acc, r) => ({ ...acc, [r.value]: r.label }), {});

// ── Modes de paiement (alignés sur l'ENUM DB mode_paiement + variantes Cameroun) ──
export const MODES_PAIEMENT = [
  { value: 'especes', label: 'Espèces', detail: false },
  { value: 'mtn_money', label: 'MTN Mobile Money', detail: true,
    detailLabel: 'N° de transaction MTN MoMo', detailPlaceholder: 'Ex : TXN2026071512340001' },
  { value: 'orange_money', label: 'Orange Money', detail: true,
    detailLabel: "N° de transaction Orange Money", detailPlaceholder: 'Ex : OM987654321' },
  { value: 'virement', label: 'Virement bancaire', detail: true,
    detailLabel: 'N° de bordereau / référence virement', detailPlaceholder: 'Ex : Bordereau BICEC #00123, IBAN CM21…' },
  { value: 'carte_bancaire', label: 'Carte bancaire', detail: true,
    detailLabel: 'Référence de la transaction carte', detailPlaceholder: 'Ex : 4 derniers chiffres, date' },
  { value: 'cheque', label: 'Chèque', detail: true,
    detailLabel: 'N° de chèque et banque', detailPlaceholder: 'Ex : Chèque #12345, BICEC' },
  { value: 'autre', label: 'Autre', detail: true,
    detailLabel: 'Précisez', detailPlaceholder: 'Ex : Compensation, don en nature valorisé…' },
];
export const modePaiementLabel = MODES_PAIEMENT.reduce((acc, m) => ({ ...acc, [m.value]: m.label }), {});
export const modePaiementConfig = MODES_PAIEMENT.reduce((acc, m) => ({ ...acc, [m.value]: m }), {});

// ── Statuts de présence réunion (alignés sur l'ENUM DB statut_presence) ──
export const STATUTS_PRESENCE = [
  { value: 'present',        label: 'Présent',        color: 'green' },
  { value: 'absent_excuse',  label: 'Absent excusé',  color: 'amber' },
  { value: 'absent',         label: 'Absent',         color: 'red'   },
  { value: 'en_retard',      label: 'En retard',      color: 'blue'  },
];
export const statutPresenceLabel = STATUTS_PRESENCE.reduce((acc, s) => ({ ...acc, [s.value]: s.label }), {});
