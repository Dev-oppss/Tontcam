import { useMemo, useState } from 'react';
import { Plus, HandCoins, CreditCard, ChevronDown, ChevronUp, Coins, TrendingUp, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import { ModePaiementFields, isModePaiementValid } from '../components/ui/ModePaiement';
import { computeEcheancesAvecPenalites, statutEcheanceLabel } from '../lib/penalites';

export default function Prets() {
  const { membres, prets, comptesBanque, caisses, addPret, validerPret, approuverPret, refuserPret, decaisserPret, rembourserPret, distribuerInteretsPret } = useApp();

  const [add,        setAdd]        = useState(false);
  const [remModal,   setRemModal]   = useState(null);
  const [detailPret, setDetailPret] = useState(null);
  const [form,       setForm]       = useState({
    idMembre: '', caisseId: '', montantPret: '', tauxInteret: 10, dureeMois: 3,
    datePret: new Date().toISOString().split('T')[0],
    dateEcheance: '', garantie: "Caution d'un membre", observation: '',
  });
  const [remMontant, setRemMontant] = useState('');
  const [remModePaiement, setRemModePaiement] = useState('especes');
  const [remDetailsPaiement, setRemDetailsPaiement] = useState('');

  const sMap = { demande: 'gray', en_attente_validation: 'amber', approuve: 'blue', en_cours: 'blue', en_retard: 'red', rembourse: 'green', refuse: 'red', defaut: 'red' };
  const sLbl = { demande: 'Demande déposée', en_attente_validation: 'À approuver', approuve: 'Approuvé — à décaisser', en_cours: 'En cours', en_retard: 'En retard', rembourse: 'Remboursé', refuse: 'Refusé', defaut: 'Défaut' };
  const formatAmortissement = (value) => (value === 'echelonne' ? 'Échelonné' : 'Remboursement unique');

  const calcEcheance = (datePret, dureeMois) => {
    if (!datePret || !dureeMois) return '';
    const d = new Date(datePret);
    d.setMonth(d.getMonth() + Number(dureeMois));
    return d.toISOString().split('T')[0];
  };

  const buildAmortization = (capitalValue, tauxValue, dureeValue, dateValue) => {
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

  const onDureeChange = (val) => setForm(f => ({ ...f, dureeMois: val, dateEcheance: calcEcheance(f.datePret, val) }));
  const onDateChange  = (val) => setForm(f => ({ ...f, datePret: val, dateEcheance: calcEcheance(val, f.dureeMois) }));

  const simulerRepartition = (montantInteret) => {
    const parMembre = {};
    comptesBanque.forEach(c => {
      if (c.solde > 0) {
        if (!parMembre[c.idMembre]) parMembre[c.idMembre] = { nomMembre: c.nomMembre, totalSolde: 0 };
        parMembre[c.idMembre].totalSolde += c.solde;
      }
    });
    const totalSolde = Object.values(parMembre).reduce((s, m) => s + m.totalSolde, 0);
    if (totalSolde === 0) return [];
    return Object.values(parMembre).map(m => ({
      ...m,
      pourcentage: Math.round(m.totalSolde / totalSolde * 10000) / 100,
      montantInterets: Math.round(montantInteret * m.totalSolde / totalSolde),
    }));
  };

  const pretSimule = useMemo(
    () => buildAmortization(form.montantPret, form.tauxInteret, form.dureeMois, form.datePret),
    [form.montantPret, form.tauxInteret, form.dureeMois, form.datePret]
  );
  const montantInteret = pretSimule?.totalInteret || 0;
  const repartitionSimulee = montantInteret > 0 ? simulerRepartition(montantInteret) : [];
  const caissesPret = (caisses || []).filter((c) => c.pretAutorise);
  const caisseSelectionnee = caissesPret.find((c) => c.id === form.caisseId);
  const caissesMap = Object.fromEntries((caisses || []).map((c) => [c.id, c]));

  // Recalcul "live" des pénalités à l'affichage : ne dépend pas d'un
  // remboursement pour refléter un retard qui vient d'apparaître (date dépassée).
  const pretsLive = useMemo(() => prets.map((p) => {
    const caisse = caissesMap[p.caisseId];
    const penaliteActive = Boolean(caisse?.penaliteRetardActive);
    const tauxPenalite = Number(caisse?.tauxPenalite || 0);
    if (!Array.isArray(p.ficheAmortissement) || p.ficheAmortissement.length === 0 || p.statut === 'rembourse') {
      return { ...p, resteActuel: p.resteAPayer, penaliteActuelle: 0, nbEcheancesEnRetard: 0, penaliteActive };
    }
    const calc = computeEcheancesAvecPenalites(p.ficheAmortissement, p.montantRembourse, tauxPenalite, penaliteActive);
    return {
      ...p,
      resteActuel: calc.resteAPayer,
      penaliteActuelle: calc.totalPenalites,
      nbEcheancesEnRetard: calc.nbEcheancesEnRetard,
      ficheAmortissementLive: calc.echeances,
      penaliteActive,
    };
  }), [prets, caissesMap]);

  const enAttente = pretsLive.filter(p => p.statut === 'demande' || p.statut === 'en_attente_validation');
  const approuves = pretsLive.filter(p => p.statut === 'approuve');
  const enCours   = pretsLive.filter(p => p.statut === 'en_cours');
  const enRetard  = pretsLive.filter(p => p.statut === 'en_cours' && p.nbEcheancesEnRetard > 0);
  const rembourse = pretsLive.filter(p => p.statut === 'rembourse');

  const handleAdd = () => {
    if (!form.idMembre || !form.montantPret || !form.caisseId) return;
    if (!pretSimule) return;
    const m = membres.find(x => x.id === form.idMembre);
    addPret({
      ...form,
      montantPret: Number(form.montantPret),
      tauxInteret: Number(form.tauxInteret),
      dureeMois: Number(form.dureeMois),
      nomMembre: `${m.nom} ${m.prenom}`,
      idMembre: form.idMembre,
      caisseId: form.caisseId,
      dateEcheance: pretSimule.dateEcheance,
      montantInteret: pretSimule.totalInteret,
      montantTotal: pretSimule.montantTotal,
      montantMensuel: pretSimule.mensualiteMoyenne,
      ficheAmortissement: pretSimule.ficheAmortissement,
      amortissementPret: caisseSelectionnee?.amortissementPret || 'unique',
      echeancesPret: caisseSelectionnee?.echeancesPret || 'mensuel',
    });
    setAdd(false);
    setForm({ idMembre: '', caisseId: '', montantPret: '', tauxInteret: 10, dureeMois: 3, datePret: new Date().toISOString().split('T')[0], dateEcheance: '', garantie: "Caution d'un membre", observation: '' });
  };

  const handleRembourser = () => {
    if (!remMontant || Number(remMontant) <= 0) return;
    if (!isModePaiementValid(remModePaiement, remDetailsPaiement)) return;
    const reste = remModal.resteAPayer - Number(remMontant);
    rembourserPret(remModal.id, Number(remMontant), { modePaiement: remModePaiement, detailsPaiement: remDetailsPaiement });
    if (reste <= 0 && !remModal.interetsDistribues) {
      setTimeout(() => distribuerInteretsPret(remModal.id), 200);
    }
    setRemModal(null);
    setRemMontant('');
    setRemModePaiement('especes');
    setRemDetailsPaiement('');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Prêts & Crédits"
        subtitle="Prêts ouverts uniquement depuis les caisses autorisées"
        action={<button onClick={() => setAdd(true)} className="btn-primary"><Plus size={15}/> Nouveau prêt</button>}/>

      <div className="card border-l-4 border-l-primary-500">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">Caisses autorisées au prêt</p>
            <p className="text-xs text-ink-600/60 mt-1">Chaque caisse peut définir son taux, sa durée maximale et son mode d’amortissement.</p>
          </div>
          <p className="text-sm font-bold text-primary-700">{caissesPret.length} caisse(s)</p>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {caissesPret.map((c) => (
            <div key={c.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="font-semibold text-ink-900">{c.nom}</p>
              <p className="text-xs text-ink-600/55 mt-1">Taux: {c.tauxInteretPret || 0}% · Durée max: {c.dureeMaxPretMois || 0} mois</p>
              <p className="text-xs text-ink-600/55 mt-1">Amortissement: {formatAmortissement(c.amortissementPret)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card text-center border-t-4 border-t-amber-400">
          <p className="text-2xl font-bold text-amber-600">{enAttente.length}</p>
          <p className="text-xs text-gray-400 mt-1">À valider / approuver</p>
        </div>
        <div className="card text-center border-t-4 border-t-indigo-400">
          <p className="text-2xl font-bold text-indigo-600">{approuves.length}</p>
          <p className="text-xs text-gray-400 mt-1">Approuvés — à décaisser</p>
        </div>
        <div className="card text-center border-t-4 border-t-primary-400">
          <p className="text-2xl font-bold text-primary-700">{enCours.length}</p>
          <p className="text-xs text-gray-400 mt-1">En cours</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">{fmt(enCours.reduce((s, p) => s + p.resteAPayer, 0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-red-400">
          <p className="text-2xl font-bold text-red-600">{enRetard.length}</p>
          <p className="text-xs text-gray-400 mt-1">En retard</p>
          <p className="text-sm font-semibold text-gray-700 mt-0.5">{fmt(enRetard.reduce((s, p) => s + p.resteAPayer, 0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-purple-400">
          <TrendingUp size={18} className="mx-auto mb-1 text-purple-500"/>
          <p className="text-sm font-bold text-purple-600">{fmt(rembourse.reduce((s, p) => s + p.montantInteret, 0))}</p>
          <p className="text-xs text-gray-400">Intérêts encaissés</p>
        </div>
      </div>

      {enAttente.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700 mb-2">Demandes en attente — Action requise</p>
          {enAttente.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-amber-100 last:border-0">
              <span className="font-medium text-amber-900">{p.nomMembre} <span className="text-amber-500 font-normal">— {fmt(p.montantPret)}</span></span>
              <div className="flex items-center gap-2">
                {p.statut === 'demande' && (
                  <button onClick={() => validerPret(p.id)} className="btn-secondary py-1 px-2.5 text-xs">Valider (Trésorier)</button>
                )}
                {p.statut === 'en_attente_validation' && (
                  <>
                    <button onClick={() => approuverPret(p.id)} className="btn-primary py-1 px-2.5 text-xs">Approuver</button>
                    <button onClick={() => refuserPret(p.id, 'Refusé par le bureau')} className="btn-secondary py-1 px-2.5 text-xs text-red-600">Refuser</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {approuves.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-indigo-700 mb-2">Approuvés — en attente de décaissement</p>
          {approuves.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-indigo-100 last:border-0">
              <span className="font-medium text-indigo-900">{p.nomMembre} <span className="text-indigo-500 font-normal">— {fmt(p.montantPret)}</span></span>
              <button onClick={() => decaisserPret(p.id)} className="btn-primary py-1 px-2.5 text-xs">Décaisser</button>
            </div>
          ))}
        </div>
      )}

      {enRetard.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2"> Prêts en retard — Action requise</p>
          {enRetard.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-red-100 last:border-0">
              <span className="font-medium text-red-800">{p.nomMembre}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-red-500">{p.nbEcheancesEnRetard} échéance(s) en retard</span>
                <span className="text-red-600 font-bold">{fmt(p.resteActuel)} restant{p.penaliteActuelle > 0 ? ` (dont ${fmt(p.penaliteActuelle)} pénalité)` : ''}</span>
                <button onClick={() => { setRemModal(p); setRemMontant(''); }} className="btn-primary py-1 px-2.5 text-xs">Rembourser</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Membre','Montant prêt','Taux','Intérêts','Total','Progression','Reste','Statut','Actions'].map(h=>(
                <th key={h} className="th">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pretsLive.map(p => {
                const pct = Math.round((p.montantRembourse / p.montantTotal) * 100);
                const isOpen = detailPret === p.id;
                const enRetardLive = p.statut === 'en_cours' && p.nbEcheancesEnRetard > 0;
                return (
                  <>
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{p.nomMembre[0]}</div>
                          <div>
                            <p className="font-medium text-gray-800">{p.nomMembre}</p>
                            <p className="text-xs text-gray-400">{fmtDate(p.datePret)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td font-medium">{fmt(p.montantPret)}</td>
                      <td className="td text-amber-600 font-semibold">{p.tauxInteret}%</td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-purple-600">{fmt(p.montantInteret)}</span>
                          {p.interetsDistribues && <CheckCircle size={12} className="text-green-500"/>}
                        </div>
                      </td>
                      <td className="td font-semibold">{fmt(p.montantTotal)}</td>
                      <td className="td">
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{fmt(p.montantRembourse)}</span><span>{pct}%</span></div>
                          <div className="w-28 bg-gray-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${enRetardLive ? 'bg-red-500' : 'bg-primary-500'}`} style={{width:`${pct}%`}}/>
                          </div>
                        </div>
                      </td>
                      <td className="td font-bold text-gray-800">
                        {p.resteActuel > 0 ? (
                          <div>
                            <p>{fmt(p.resteActuel)}</p>
                            {p.penaliteActuelle > 0 && (
                              <p className="text-[11px] text-red-500 font-normal flex items-center gap-0.5">
                                <AlertTriangle size={10}/> dont {fmt(p.penaliteActuelle)} pénalité
                              </p>
                            )}
                          </div>
                        ) : <span className="text-primary-600">OK Soldé</span>}
                      </td>
                      <td className="td">
                        <Badge variant={enRetardLive ? 'red' : sMap[p.statut]}>{enRetardLive ? 'En retard' : sLbl[p.statut]}</Badge>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          {(p.statut === 'en_cours' || p.statut === 'en_retard') && (
                            <button onClick={() => { setRemModal(p); setRemMontant(''); }}
                              className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                              <CreditCard size={12}/>Payer
                            </button>
                          )}
                          {!p.interetsDistribues && p.statut === 'rembourse' && (
                            <button onClick={() => distribuerInteretsPret(p.id)}
                              className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1">
                              <Coins size={12}/>Distribuer
                            </button>
                          )}
                          <button onClick={() => setDetailPret(isOpen ? null : p.id)}
                            className="p-1 text-gray-400 hover:text-gray-600">
                            {isOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${p.id}-detail`}>
                        <td colSpan={9} className="bg-purple-50 px-6 py-4 border-b border-purple-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Users size={14} className="text-purple-600"/>
                            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                              Répartition intérêts ({fmt(p.montantInteret)}) — {p.interetsDistribues ? ' Distribués aux comptes' : ' En attente'}
                            </p>
                          </div>
                          {(p.repartitionInterets || []).length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Aucune répartition — aucun membre avec solde en caisse au moment du prêt.</p>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                {p.repartitionInterets.map((r, i) => (
                                  <div key={i} className={`p-2.5 rounded-lg border text-xs ${p.interetsDistribues ? 'bg-green-50 border-green-200' : 'bg-white border-purple-200'}`}>
                                    <p className="font-semibold text-gray-800">{r.nomMembre}</p>
                                    <p className="text-gray-500 mt-0.5">Part : {r.pourcentage}% — Base : {fmt(r.soldeBase)}</p>
                                    <p className={`font-bold mt-0.5 ${p.interetsDistribues ? 'text-green-600' : 'text-purple-600'}`}>
                                      {fmt(r.montantInterets)}{p.interetsDistribues ? ' OK' : ''}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              {!p.interetsDistribues && (
                                <div className="mt-3 flex items-center gap-3">
                                  {p.statut === 'rembourse' ? (
                                    <button onClick={() => distribuerInteretsPret(p.id)}
                                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                                      <Coins size={13}/> Distribuer les intérêts maintenant
                                    </button>
                                  ) : (
                                    <p className="text-xs text-purple-500 italic"> Distribution automatique à la clôture du remboursement.</p>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          <div className="mt-4 pt-4 border-t border-purple-100">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Fiche d'amortissement</p>
                              <p className="text-xs text-purple-500">
                                {p.montantMensuel ? `${fmt(p.montantMensuel)} / mois` : `${fmt(Math.round((p.montantTotal || 0) / Math.max(1, p.dureeMois || 1)))} / mois`}
                              </p>
                            </div>
                            {(() => {
                              const fichePret = (p.ficheAmortissementLive && p.ficheAmortissementLive.length > 0)
                                ? p.ficheAmortissementLive
                                : (p.ficheAmortissement && p.ficheAmortissement.length > 0)
                                ? p.ficheAmortissement
                                : (buildAmortization(p.montantPret, p.tauxInteret, p.dureeMois, p.datePret)?.ficheAmortissement || []);
                              return fichePret.length > 0 ? (
                                <div className="rounded-xl border border-purple-100 bg-white overflow-hidden">
                                  <div className="overflow-x-auto max-h-56 overflow-y-auto">
                                    <table className="w-full text-[11px]">
                                      <thead className="bg-purple-50 sticky top-0 z-10">
                                        <tr>
                                          <th className="th">Mois</th>
                                          <th className="th">Échéance</th>
                                          <th className="th">Capital</th>
                                          <th className="th">Intérêt</th>
                                          <th className="th">Mensualité</th>
                                          {p.penaliteActive && <th className="th text-red-600">Pénalité</th>}
                                          <th className="th">Reste</th>
                                          {p.penaliteActive && <th className="th">Statut</th>}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-purple-50">
                                        {fichePret.map((ligne) => (
                                          <tr key={ligne.mois} className="tr">
                                            <td className="td font-semibold">{ligne.mois}</td>
                                            <td className="td text-ink-600/70">{fmtDate(ligne.dateEcheance)}</td>
                                            <td className="td font-medium">{fmt(ligne.capital)}</td>
                                            <td className="td font-medium text-amber-600">{fmt(ligne.interet)}</td>
                                            <td className="td font-semibold text-primary-700">{fmt(ligne.total)}</td>
                                            {p.penaliteActive && (
                                              <td className="td font-semibold text-red-600">
                                                {ligne.montantPenalite > 0 ? fmt(ligne.montantPenalite) : '—'}
                                              </td>
                                            )}
                                            <td className="td font-semibold text-ink-800">{fmt(ligne.reste)}</td>
                                            {p.penaliteActive && (
                                              <td className="td">
                                                {ligne.statut ? (
                                                  <Badge variant={ligne.statut === 'payee' ? 'green' : ligne.estEnRetard ? 'red' : 'gray'}>
                                                    {statutEcheanceLabel[ligne.statut] || ligne.statut}
                                                  </Badge>
                                                ) : '—'}
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-purple-500 italic">Aucune fiche d'amortissement disponible.</p>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal remboursement */}
      <Modal open={!!remModal} onClose={() => setRemModal(null)} title="Enregistrer un remboursement"
        footer={<>
          <button onClick={() => setRemModal(null)} className="btn-secondary">Annuler</button>
          <button
            onClick={handleRembourser}
            disabled={!remMontant || Number(remMontant) <= 0 || !isModePaiementValid(remModePaiement, remDetailsPaiement)}
            className={`btn-primary ${(!remMontant || Number(remMontant) <= 0 || !isModePaiementValid(remModePaiement, remDetailsPaiement)) ? 'opacity-40 cursor-not-allowed' : ''}`}
          ><CreditCard size={14}/>Valider</button>
        </>}>
        {remModal && (() => {
          const caisseDuPret = caissesMap[remModal.caisseId];
          const penaliteActive = Boolean(caisseDuPret?.penaliteRetardActive);
          const live = Array.isArray(remModal.ficheAmortissement) && remModal.ficheAmortissement.length > 0
            ? computeEcheancesAvecPenalites(remModal.ficheAmortissement, remModal.montantRembourse, Number(caisseDuPret?.tauxPenalite || 0), penaliteActive)
            : null;
          const resteActuel = live ? live.resteAPayer : remModal.resteAPayer;
          const penaliteDue = live ? live.totalPenalites : 0;
          return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl space-y-1.5">
              <p className="text-sm font-semibold text-gray-800">{remModal.nomMembre}</p>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Capital :</span><span>{fmt(remModal.montantPret)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Intérêts ({remModal.tauxInteret}%) :</span><span className="text-purple-600 font-medium">{fmt(remModal.montantInteret)}</span></div>
              {penaliteActive && penaliteDue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={12}/>Pénalité de retard :</span>
                  <span className="text-red-600 font-medium">{fmt(penaliteDue)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm"><span className="text-gray-500">Déjà remboursé :</span><span className="text-primary-600 font-medium">{fmt(remModal.montantRembourse)}</span></div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200"><span className="font-semibold text-gray-700">Reste à payer :</span><span className="font-bold text-red-600">{fmt(resteActuel)}</span></div>
            </div>
            <FormField label="Montant (FCFA)" required>
              <input type="number" className="input" value={remMontant}
                onChange={e => setRemMontant(e.target.value)} min="1" max={resteActuel}/>
            </FormField>
            <button onClick={() => setRemMontant(String(resteActuel))} className="text-xs text-primary-600 hover:underline">
              - Solder en totalité ({fmt(resteActuel)})
            </button>
            <ModePaiementFields
              modePaiement={remModePaiement}
              detailsPaiement={remDetailsPaiement}
              onModeChange={(v) => { setRemModePaiement(v); setRemDetailsPaiement(''); }}
              onDetailsChange={setRemDetailsPaiement}
            />
            {(remModal.repartitionInterets || []).length > 0 && Number(remMontant) >= resteActuel && !remModal.interetsDistribues && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs">
                <p className="font-semibold text-purple-700 flex items-center gap-1"><Coins size={12}/> Distribution automatique des intérêts</p>
                <p className="text-purple-600 mt-1">{fmt(remModal.montantInteret)} répartis entre {remModal.repartitionInterets.length} membre(s) selon leurs parts.</p>
              </div>
            )}
          </div>
          );
        })()}
      </Modal>

      {/* Modal nouveau prêt */}
      <Modal open={add} onClose={() => setAdd(false)} title="Nouveau prêt"
        footer={<><button onClick={() => setAdd(false)} className="btn-secondary">Annuler</button><button onClick={handleAdd} className="btn-primary"><HandCoins size={14}/>Accorder le prêt</button></>}>
        <div className="space-y-4">
          <FormField label="Membre bénéficiaire" required>
            <select className="select" value={form.idMembre} onChange={e => setForm(f => ({ ...f, idMembre: e.target.value }))}>
              <option value="">Sélectionner un membre…</option>
              {membres.filter(m => m.statut === 'actif').map(m => (
                <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Caisse source" required>
            <select className="select" value={form.caisseId} onChange={e => {
              const caisse = caissesPret.find((c) => c.id === e.target.value);
              setForm(f => ({
                ...f,
                caisseId: e.target.value,
                tauxInteret: caisse?.tauxInteretPret ?? f.tauxInteret,
                dureeMois: caisse?.dureeMaxPretMois || f.dureeMois,
                dateEcheance: caisse?.dureeMaxPretMois ? calcEcheance(f.datePret, caisse.dureeMaxPretMois) : f.dateEcheance,
              }));
            }}>
              <option value="">Sélectionner une caisse…</option>
              {caissesPret.map(c => (
                <option key={c.id} value={c.id}>{c.nom} · {c.tauxInteretPret || 0}% · {c.dureeMaxPretMois || 0} mois</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant (FCFA)" required>
              <input type="number" className="input" placeholder="500000" value={form.montantPret}
                onChange={e => setForm(f => ({ ...f, montantPret: e.target.value }))}/>
            </FormField>
            <FormField label="Taux d'intérêt (%)">
              <input type="number" className="input" value={form.tauxInteret}
                onChange={e => setForm(f => ({ ...f, tauxInteret: e.target.value }))} min="0" max="100"/>
            </FormField>
          </div>
          {form.montantPret && (
            <div className="p-3 bg-primary-50 rounded-xl space-y-1">
              <div className="flex justify-between text-sm"><span className="text-gray-600">Capital :</span><span className="font-medium">{fmt(Number(form.montantPret))}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-600">Intérêts ({form.tauxInteret}%) :</span><span className="font-medium text-purple-600">{fmt(montantInteret)}</span></div>
              <div className="flex justify-between text-sm pt-1 border-t border-primary-200"><span className="font-bold text-gray-700">Total :</span><span className="font-bold text-primary-700">{fmt(Number(form.montantPret) + montantInteret)}</span></div>
              {caisseSelectionnee && (
                <p className="text-xs text-primary-700 mt-1">Caisse source: {caisseSelectionnee.nom}</p>
              )}
              {caisseSelectionnee?.penaliteRetardActive && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11}/> Pénalité de {caisseSelectionnee.tauxPenalite}% par échéance manquée sur cette caisse
                </p>
              )}
            </div>
          )}
          {repartitionSimulee.length > 0 && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1"><Coins size={12}/> Répartition des intérêts selon parts en caisse</p>
              <div className="space-y-1">
                {repartitionSimulee.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-700">{r.nomMembre} <span className="text-gray-400">({r.pourcentage}%)</span></span>
                    <span className="font-semibold text-purple-600">{fmt(r.montantInterets)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {repartitionSimulee.length === 0 && form.montantPret && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
               Aucun membre avec solde en caisse. Les intérêts ne seront pas distribués automatiquement.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Durée (mois)">
              <input type="number" className="input" value={form.dureeMois} onChange={e => onDureeChange(e.target.value)}/>
            </FormField>
            <FormField label="Date du prêt">
              <input type="date" className="input" value={form.datePret} onChange={e => onDateChange(e.target.value)}/>
            </FormField>
          </div>
          <FormField label="Date d'échéance">
            <input type="date" className="input" value={form.dateEcheance}
              onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))}/>
            {form.datePret && form.dureeMois && <p className="text-xs text-primary-600 mt-1"> Auto: {fmtDate(calcEcheance(form.datePret, form.dureeMois))}</p>}
          </FormField>
          {pretSimule && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
                  <p className="text-[11px] uppercase tracking-wide text-primary-700 font-semibold">Montant du prêt</p>
                  <p className="text-sm font-bold text-primary-800 mt-1">{fmt(pretSimule.capital)}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Total intérêts</p>
                  <p className="text-sm font-bold text-amber-800 mt-1">{fmt(pretSimule.totalInteret)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-[11px] uppercase tracking-wide text-green-700 font-semibold">Total à rembourser</p>
                  <p className="text-sm font-bold text-green-800 mt-1">{fmt(pretSimule.montantTotal)}</p>
                </div>
                <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
                  <p className="text-[11px] uppercase tracking-wide text-ink-600 font-semibold">Montant par mois</p>
                  <p className="text-sm font-bold text-ink-900 mt-1">{fmt(pretSimule.mensualiteMoyenne)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-surface-200 overflow-hidden bg-white">
                <div className="flex items-center justify-between px-3 py-2.5 bg-surface-50 border-b border-surface-200">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-700">Fiche d'amortissement</p>
                  <p className="text-[11px] text-ink-600/50">{pretSimule.duree} mois</p>
                </div>
                <div className="overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="border-b border-surface-100">
                        <th className="th">Mois</th>
                        <th className="th">Échéance</th>
                        <th className="th">Capital</th>
                        <th className="th">Intérêt</th>
                        <th className="th">Mensualité</th>
                        <th className="th">Reste</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {pretSimule.ficheAmortissement.map((ligne) => (
                        <tr key={ligne.mois} className="tr">
                          <td className="td font-semibold">{ligne.mois}</td>
                          <td className="td text-ink-600/70">{fmtDate(ligne.dateEcheance)}</td>
                          <td className="td font-medium">{fmt(ligne.capital)}</td>
                          <td className="td font-medium text-amber-600">{fmt(ligne.interet)}</td>
                          <td className="td font-semibold text-primary-700">{fmt(ligne.total)}</td>
                          <td className="td font-semibold text-ink-800">{fmt(ligne.reste)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {caisseSelectionnee && (
                <p className="text-xs text-primary-700">Caisse source: {caisseSelectionnee.nom}</p>
              )}
            </div>
          )}
          <FormField label="Garantie">
            <select className="select" value={form.garantie} onChange={e => setForm(f => ({ ...f, garantie: e.target.value }))}>
              <option>Caution d'un membre</option>
              <option>Blocage épargne</option>
              <option>Retenue sur tontine</option>
              <option>Aucune</option>
            </select>
          </FormField>
          <FormField label="Observation">
            <textarea className="input h-14 resize-none" value={form.observation}
              onChange={e => setForm(f => ({ ...f, observation: e.target.value }))}/>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
