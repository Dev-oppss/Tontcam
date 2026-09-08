// Extrait de Prets.jsx pour être partagé avec le formulaire d'octroi de prêt
// intégré dans Reunions.jsx (onglet « Prêt »), qui doit rester rigoureusement
// identique à la page Prêts — même simulation, même fiche d'amortissement.

export const calcEcheance = (datePret, dureeMois) => {
  if (!datePret || !dureeMois) return '';
  const d = new Date(datePret);
  d.setMonth(d.getMonth() + Number(dureeMois));
  return d.toISOString().split('T')[0];
};

export const buildAmortization = (capitalValue, tauxValue, dureeValue, dateValue) => {
  const capital = Number(capitalValue || 0);
  const taux = Number(tauxValue || 0);
  const duree = Math.max(1, Number(dureeValue || 0));
  if (capital <= 0 || duree <= 0) return null;

  const totalInteret = Math.round((capital * taux) / 100);
  const montantTotal = capital + totalInteret;
  const baseCapital = Math.floor(capital / duree);
  const resteCapital = capital - baseCapital * duree;
  const mensualiteBase = Math.floor(montantTotal / duree);
  const resteMensualite = montantTotal - mensualiteBase * duree;

  let soldeRestant = capital;
  const ficheAmortissement = Array.from({ length: duree }, (_, index) => {
    const capitalMois = baseCapital + (index < resteCapital ? 1 : 0);
    const totalMois = mensualiteBase + (index < resteMensualite ? 1 : 0);
    const interetMois = Math.max(0, totalMois - capitalMois);
    soldeRestant = Math.max(0, soldeRestant - capitalMois);

    return {
      mois: index + 1,
      dateEcheance: calcEcheance(dateValue, index + 1),
      capital: capitalMois,
      interet: interetMois,
      total: totalMois,
      reste: soldeRestant,
    };
  });

  return {
    capital,
    taux,
    duree,
    totalInteret,
    montantTotal,
    mensualiteMoyenne: mensualiteBase + (resteMensualite > 0 ? 1 : 0),
    dateEcheance: calcEcheance(dateValue, duree),
    ficheAmortissement,
  };
};

export const simulerRepartitionInterets = (comptesBanque, montantInteret) => {
  const parMembre = {};
  (comptesBanque || []).forEach((c) => {
    if (c.solde > 0) {
      if (!parMembre[c.idMembre]) parMembre[c.idMembre] = { nomMembre: c.nomMembre, totalSolde: 0 };
      parMembre[c.idMembre].totalSolde += c.solde;
    }
  });
  const totalSolde = Object.values(parMembre).reduce((s, m) => s + m.totalSolde, 0);
  if (totalSolde === 0) return [];
  return Object.values(parMembre).map((m) => ({
    ...m,
    pourcentage: Math.round((m.totalSolde / totalSolde) * 10000) / 100,
    montantInterets: Math.round((montantInteret * m.totalSolde) / totalSolde),
  }));
};

export const FORM_PRET_VIDE = {
  idMembre: '', caisseId: '', montantPret: '', tauxInteret: 10, dureeMois: 3,
  datePret: new Date().toISOString().split('T')[0],
  dateEcheance: '', garantie: 'caution_membre', idAvaliste: '', observation: '',
};
