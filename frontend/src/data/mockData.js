export const associations = [];

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
  super_admin: 'Super administrateur',
  controleur: 'Contrôleur',
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
