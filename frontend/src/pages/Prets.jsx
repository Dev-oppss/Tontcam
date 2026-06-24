import { useState } from 'react';
import { Plus, HandCoins, CreditCard, ChevronDown, ChevronUp, Coins, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';

export default function Prets() {
  const { membres, prets, comptesBanque, addPret, rembourserPret, distribuerInteretsPret } = useApp();

  const [add,        setAdd]        = useState(false);
  const [remModal,   setRemModal]   = useState(null);
  const [detailPret, setDetailPret] = useState(null);
  const [form,       setForm]       = useState({
    idMembre: '', montantPret: '', tauxInteret: 10, dureeMois: 3,
    datePret: new Date().toISOString().split('T')[0],
    dateEcheance: '', garantie: "Caution d'un membre", observation: '',
  });
  const [remMontant, setRemMontant] = useState('');

  const enCours   = prets.filter(p => p.statut === 'en_cours');
  const enRetard  = prets.filter(p => p.statut === 'en_retard');
  const rembourse = prets.filter(p => p.statut === 'rembourse');

  const sMap = { en_cours: 'blue', en_retard: 'red', rembourse: 'green' };
  const sLbl = { en_cours: 'En cours', en_retard: 'En retard', rembourse: 'Remboursé' };

  const calcEcheance = (datePret, dureeMois) => {
    if (!datePret || !dureeMois) return '';
    const d = new Date(datePret);
    d.setMonth(d.getMonth() + Number(dureeMois));
    return d.toISOString().split('T')[0];
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

  const montantInteret = form.montantPret
    ? Math.round(Number(form.montantPret) * Number(form.tauxInteret) / 100)
    : 0;
  const repartitionSimulee = montantInteret > 0 ? simulerRepartition(montantInteret) : [];

  const handleAdd = () => {
    if (!form.idMembre || !form.montantPret) return;
    const m = membres.find(x => x.id === Number(form.idMembre));
    addPret({ ...form, nomMembre: `${m.nom} ${m.prenom}`, idMembre: Number(form.idMembre) });
    setAdd(false);
    setForm({ idMembre: '', montantPret: '', tauxInteret: 10, dureeMois: 3, datePret: new Date().toISOString().split('T')[0], dateEcheance: '', garantie: "Caution d'un membre", observation: '' });
  };

  const handleRembourser = () => {
    if (!remMontant || Number(remMontant) <= 0) return;
    const reste = remModal.resteAPayer - Number(remMontant);
    rembourserPret(remModal.id, Number(remMontant));
    if (reste <= 0 && !remModal.interetsDistribues) {
      setTimeout(() => distribuerInteretsPret(remModal.id), 200);
    }
    setRemModal(null);
    setRemMontant('');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Prêts & Crédits"
        subtitle="Intérêts distribués aux membres selon leurs parts en banque — système bancaire intelligent"
        action={<button onClick={() => setAdd(true)} className="btn-primary"><Plus size={15}/> Nouveau prêt</button>}/>

      <div className="grid grid-cols-3 gap-4">
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

      {enRetard.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2"> Prêts en retard — Action requise</p>
          {enRetard.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-red-100 last:border-0">
              <span className="font-medium text-red-800">{p.nomMembre}</span>
              <div className="flex items-center gap-3">
                <span className="text-red-600 font-bold">{fmt(p.resteAPayer)} restant</span>
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
              {prets.map(p => {
                const pct = Math.round((p.montantRembourse / p.montantTotal) * 100);
                const isOpen = detailPret === p.id;
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
                            <div className={`h-1.5 rounded-full ${p.statut==='en_retard'?'bg-red-500':'bg-primary-500'}`} style={{width:`${pct}%`}}/>
                          </div>
                        </div>
                      </td>
                      <td className="td font-bold text-gray-800">
                        {p.resteAPayer > 0 ? fmt(p.resteAPayer) : <span className="text-primary-600">OK Soldé</span>}
                      </td>
                      <td className="td"><Badge variant={sMap[p.statut]}>{sLbl[p.statut]}</Badge></td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          {p.statut !== 'rembourse' && (
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
                            <p className="text-xs text-gray-400 italic">Aucune répartition — aucun membre avec solde en banque au moment du prêt.</p>
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
        footer={<><button onClick={() => setRemModal(null)} className="btn-secondary">Annuler</button><button onClick={handleRembourser} className="btn-primary"><CreditCard size={14}/>Valider</button></>}>
        {remModal && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl space-y-1.5">
              <p className="text-sm font-semibold text-gray-800">{remModal.nomMembre}</p>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Capital :</span><span>{fmt(remModal.montantPret)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Intérêts ({remModal.tauxInteret}%) :</span><span className="text-purple-600 font-medium">{fmt(remModal.montantInteret)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Déjà remboursé :</span><span className="text-primary-600 font-medium">{fmt(remModal.montantRembourse)}</span></div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200"><span className="font-semibold text-gray-700">Reste à payer :</span><span className="font-bold text-red-600">{fmt(remModal.resteAPayer)}</span></div>
            </div>
            <FormField label="Montant (FCFA)" required>
              <input type="number" className="input" value={remMontant}
                onChange={e => setRemMontant(e.target.value)} min="1" max={remModal.resteAPayer}/>
            </FormField>
            <button onClick={() => setRemMontant(String(remModal.resteAPayer))} className="text-xs text-primary-600 hover:underline">
              - Solder en totalité ({fmt(remModal.resteAPayer)})
            </button>
            {(remModal.repartitionInterets || []).length > 0 && Number(remMontant) >= remModal.resteAPayer && !remModal.interetsDistribues && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-xs">
                <p className="font-semibold text-purple-700 flex items-center gap-1"><Coins size={12}/> Distribution automatique des intérêts</p>
                <p className="text-purple-600 mt-1">{fmt(remModal.montantInteret)} répartis entre {remModal.repartitionInterets.length} membre(s) selon leurs parts.</p>
              </div>
            )}
          </div>
        )}
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
            </div>
          )}
          {repartitionSimulee.length > 0 && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1"><Coins size={12}/> Répartition des intérêts selon parts en banque</p>
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
               Aucun membre avec solde en banque. Les intérêts ne seront pas distribués automatiquement.
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
