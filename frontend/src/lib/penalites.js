/**
 * Calcul des pénalités de retard sur un tableau d'amortissement.
 *
 * Règle métier (définie par le gestionnaire) :
 *  - La pénalité est configurable par caisse (équivalent "tontine" côté
 *    métier dans cette app, cf. Banques.jsx : penaliteRetardActive, tauxPenalite).
 *  - Si désactivée : comportement inchangé (aucune pénalité, comme avant).
 *  - Si activée : chaque échéance dont la date est dépassée et qui n'est
 *    pas totalement soldée se voit appliquer UNE pénalité = montant_échéance × taux.
 *    Cette pénalité est fixe par échéance manquée (pas de calcul journalier
 *    composé) et s'additionne à travers les échéances consécutives manquées.
 *  - Les paiements reçus sont alloués aux échéances les plus anciennes
 *    d'abord (FIFO), ce qui couvre capital + intérêt + pénalité déjà due
 *    avant de passer à l'échéance suivante. Une fois une échéance
 *    intégralement couverte, sa pénalité est soldée ; si l'échéance en
 *    cours reste impayée après la date d'échéance, une nouvelle pénalité
 *    s'applique pour CETTE échéance.
 *
 * @param {Array} ficheAmortissement - [{mois, dateEcheance, capital, interet, total, reste}]
 * @param {number} montantRembourseTotal - Cumul de tous les versements reçus sur ce prêt
 * @param {number} tauxPenalite - Ex: 5 pour 5%
 * @param {boolean} penaliteActive - Si false, retourne les échéances sans aucune pénalité
 * @param {Date|string} dateRef - Date de référence ("aujourd'hui"), injectable pour tests
 * @returns {{
 *   echeances: Array,
 *   totalDu: number,
 *   totalPenalites: number,
 *   totalVerse: number,
 *   resteAPayer: number,
 *   nbEcheancesEnRetard: number,
 * }}
 */
export function computeEcheancesAvecPenalites(
  ficheAmortissement = [],
  montantRembourseTotal = 0,
  tauxPenalite = 0,
  penaliteActive = false,
  dateRef = new Date()
) {
  const today = typeof dateRef === 'string' ? new Date(dateRef) : dateRef;
  let remaining = Number(montantRembourseTotal || 0);
  let totalPenalites = 0;
  let totalDu = 0;
  let nbEcheancesEnRetard = 0;

  const echeances = (ficheAmortissement || []).map((ech) => {
    const echeanceDate = ech.dateEcheance ? new Date(ech.dateEcheance) : null;
    const estEnRetardParDate = echeanceDate ? echeanceDate < today : false;

    // Pénalité fixe appliquée si en retard ET (activée par la caisse)
    const montantPenalite = (penaliteActive && estEnRetardParDate)
      ? Math.round((Number(ech.total || 0) * Number(tauxPenalite || 0)) / 100)
      : 0;

    const montantDu = Number(ech.total || 0) + montantPenalite;
    const montantVerse = Math.max(0, Math.min(remaining, montantDu));
    remaining -= montantVerse;

    let statut = 'a_venir';
    if (montantVerse >= montantDu && montantDu > 0) statut = 'payee';
    else if (montantVerse > 0) statut = estEnRetardParDate ? 'partielle_en_retard' : 'partielle';
    else if (estEnRetardParDate) statut = montantPenalite > 0 ? 'en_retard_penalisee' : 'en_retard';

    if (estEnRetardParDate && montantVerse < montantDu) nbEcheancesEnRetard += 1;

    totalPenalites += montantPenalite;
    totalDu += montantDu;

    return {
      ...ech,
      montantPenalite,
      montantDu,
      montantVerse,
      estEnRetard: estEnRetardParDate && montantVerse < montantDu,
      statut,
    };
  });

  const totalVerseEffectif = Math.max(0, Number(montantRembourseTotal || 0) - Math.max(0, remaining));

  return {
    echeances,
    totalDu,
    totalPenalites,
    totalVerse: totalVerseEffectif,
    resteAPayer: Math.max(0, totalDu - totalVerseEffectif),
    nbEcheancesEnRetard,
  };
}

/** Libellés lisibles pour les statuts d'échéance étendus */
export const statutEcheanceLabel = {
  a_venir: 'À venir',
  due: 'Due',
  payee: 'Payée',
  partielle: 'Partielle',
  partielle_en_retard: 'Partielle (en retard)',
  en_retard: 'En retard',
  en_retard_penalisee: 'En retard + pénalité',
};
