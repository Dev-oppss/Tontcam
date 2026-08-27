import { useMemo, useState } from 'react';
import { Plus, HandCoins, CreditCard, ChevronDown, ChevronUp, Coins, TrendingUp, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import { ModePaiementFields, isModePaiementValid } from '../components/ui/ModePaiement';
import { computeEcheancesAvecPenalites, statutEcheanceLabel } from '../lib/penalites';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';
import { buildAmortization, simulerRepartitionInterets, FORM_PRET_VIDE } from '../lib/amortissement';
import { PretFormFields } from '../components/shared/PretFormFields';

export default function Prets() {
  const { membres, prets, comptesBanque, caisses, addPret, validerPret, approuverPret, refuserPret, decaisserPret, rembourserPret, distribuerInteretsPret, showToast } = useApp();

  const [add,        setAdd]        = useState(false);
  const [remModal,   setRemModal]   = useState(null);
  const [detailPret, setDetailPret] = useState(null);
  const [form,       setForm]       = useState({ ...FORM_PRET_VIDE });
  const [remMontant, setRemMontant] = useState('');
  const [remModePaiement, setRemModePaiement] = useState('especes');
  const [remDetailsPaiement, setRemDetailsPaiement] = useState('');

  const sMap = { demande: 'gray', en_attente_validation: 'amber', approuve: 'blue', en_cours: 'blue', en_retard: 'red', rembourse: 'green', refuse: 'red', defaut: 'red' };
  const sLbl = { demande: 'Demande déposée', en_attente_validation: 'À approuver', approuve: 'Approuvé — à décaisser', en_cours: 'En cours', en_retard: 'En retard', rembourse: 'Remboursé', refuse: 'Refusé', defaut: 'Défaut' };
  const formatAmortissement = (value) => (value === 'echelonne' ? 'Échelonné' : 'Remboursement unique');

  const simulerRepartition = (montantInteret) => simulerRepartitionInterets(comptesBanque, montantInteret);

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

  const handleAdd = async () => {
    const missing = getMissingFields(form, [
      { key: 'idMembre', label: 'Membre bénéficiaire' },
      { key: 'caisseId', label: 'Caisse source' },
      { key: 'montantPret', label: 'Montant' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    if (!pretSimule) { showToast?.('Simulation du prêt indisponible — vérifiez les paramètres saisis.', 'error'); return; }
    const m = membres.find(x => x.id === form.idMembre);
    await addPret({
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
  const [guardedHandleAdd, addingPret] = useAsyncGuard(handleAdd);

  const handleRembourser = async () => {
    if (!remMontant || Number(remMontant) <= 0) { showToast?.('Montant reçu requis.', 'error'); return; }
    if (!isModePaiementValid(remModePaiement, remDetailsPaiement)) { showToast?.('Référence de paiement requise pour ce mode de versement.', 'error'); return; }
    const reste = remModal.resteAPayer - Number(remMontant);
    await rembourserPret(remModal.id, Number(remMontant), { modePaiement: remModePaiement, detailsPaiement: remDetailsPaiement });
    if (reste <= 0 && !remModal.interetsDistribues) {
      setTimeout(() => distribuerInteretsPret(remModal.id), 200);
    }
    setRemModal(null);
    setRemMontant('');
    setRemModePaiement('especes');
    setRemDetailsPaiement('');
  };
  const [guardedHandleRembourser, remboursing] = useAsyncGuard(handleRembourser);

  return (
    <div className="space-y-6">
      <PageHeader title="Prêts & Crédits"
        subtitle="Prêts ouverts uniquement depuis les caisses autorisées"
        action={<button onClick={() => setAdd(true)} className="btn-primary"><Plus size={15}/> Nouveau prêt</button>}/>

      <div className="card border-l-4 border-l-primary-500">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">Caisses autorisées au prêt</p>
            <p className="text-xs text-ink-600/60 mt-1">Chaque caisse définit son propre taux d'intérêt mensuel.</p>
          </div>
          <p className="text-sm font-bold text-primary-700">{caissesPret.length} caisse(s)</p>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {caissesPret.map((c) => (
            <div key={c.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="font-semibold text-ink-900">{c.nom}</p>
              {/* Bug corrigé : ce bloc lisait c.tauxInteretPret (n'existe pas —
                  l'adaptateur produit c.tauxInteret), et affichait Durée
                  max/Amortissement par caisse — deux réglages qui n'existent
                  nulle part côté backend (aucune colonne, aucun champ dans le
                  formulaire "Modifier la caisse") : toujours une fausse valeur
                  par défaut ("0 mois", "Remboursement unique"), jamais la
                  vraie config. */}
              <p className="text-xs text-ink-600/55 mt-1">Taux : {c.tauxInteret || 0}%</p>
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
          <button onClick={() => setRemModal(null)} disabled={remboursing} className="btn-secondary">Annuler</button>
          <button
            onClick={guardedHandleRembourser}
            disabled={remboursing || !remMontant || Number(remMontant) <= 0 || !isModePaiementValid(remModePaiement, remDetailsPaiement)}
            className={`btn-primary ${(remboursing || !remMontant || Number(remMontant) <= 0 || !isModePaiementValid(remModePaiement, remDetailsPaiement)) ? 'opacity-40 cursor-not-allowed' : ''}`}
          ><CreditCard size={14}/>{remboursing ? 'Validation…' : 'Valider'}</button>
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
        footer={<><button onClick={() => setAdd(false)} disabled={addingPret} className="btn-secondary">Annuler</button><button onClick={guardedHandleAdd} disabled={addingPret} className="btn-primary"><HandCoins size={14}/>{addingPret ? 'Enregistrement…' : 'Accorder le prêt'}</button></>}>
        <PretFormFields
          form={form} setForm={setForm}
          membres={membres} caissesPret={caissesPret}
          pretSimule={pretSimule} montantInteret={montantInteret}
          repartitionSimulee={repartitionSimulee} caisseSelectionnee={caisseSelectionnee}
        />
      </Modal>
    </div>
  );
}
