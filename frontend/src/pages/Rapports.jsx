import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate } from '../data/mockData';
import { PageHeader } from '../components/ui/index';
import { TX_TYPES } from '../context/AppContext';
import { Download, TrendingUp, TrendingDown, FileText, Receipt, Printer } from 'lucide-react';
import clsx from 'clsx';

const tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{color:p.color}}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

export default function Rapports() {
  const {
    membres, membresParTontine, tontines, reunions, prets, sanctions,
    evolutionCaisse, dashboardStats, banques, comptesBanque,
    seanceTransactions, caisseJournal,
  } = useApp();

  const tauxRecouvrement = prets.length > 0
    ? Math.round((prets.filter(p=>p.statut==='rembourse').length / prets.length) * 100)
    : 0;

  const participationData = membres.map(m => ({
    name: `${m.nom.substring(0,6)}.`,
    parts: membresParTontine.filter(mt => mt.idMembre === m.id).reduce((s,mt) => s + mt.nombreParts, 0),
  })).filter(d => d.parts > 0);

  const reunionsCloturees = reunions.filter(r => r.statutReunion === 'cloturee');
  const tauxPresence = reunionsCloturees.length > 0
    ? Math.round(reunionsCloturees.reduce((s,r) => {
        const total = (r.cloture?.presents||0) + (r.cloture?.absents||0);
        return s + (total > 0 ? (r.cloture.presents / total) : 0);
      }, 0) / reunionsCloturees.length * 100)
    : 0;

  const soldeCaisse  = dashboardStats.soldeCaisse;
  const totalCaisses = dashboardStats.totalBanques;
  const COLORS = ['var(--brand)','var(--brand-soft)','var(--brand-pale)','var(--muted)'];

  const bancairesData = banques.map((b,i) => ({
    name: b.nom, value: b.totalSolde, color: COLORS[i%4]
  }));

  // ── Statistiques des transactions de séance par type ────
  const txParType = TX_TYPES.map(tt => {
    const txs = seanceTransactions.filter(t => t.type === tt.value);
    return {
      name: tt.label,
      icon: tt.icon,
      dir:  tt.dir,
      count: txs.length,
      total: txs.reduce((s,t) => s + t.montant, 0),
    };
  }).filter(t => t.count > 0);

  // ── Historique des séances (rapport condensé) ──────────
  const reunionsAvecTx = reunions.map(r => {
    const txs = seanceTransactions.filter(t => t.reunionId === r.id);
    const entrees = txs.filter(t => TX_TYPES.find(tt=>tt.value===t.type)?.dir==='entree').reduce((s,t)=>s+t.montant,0);
    const sorties = txs.filter(t => TX_TYPES.find(tt=>tt.value===t.type)?.dir==='sortie').reduce((s,t)=>s+t.montant,0);
    const banque  = txs.filter(t => t.type==='depot_banque').reduce((s,t)=>s+t.montant,0);
    return { ...r, entrees, sorties, banque, nbTx: txs.length };
  });

  // Données pour le graphique caisse par mois (depuis caisseJournal)
  const caisseParMois = Object.values(
    caisseJournal.reduce((acc, op) => {
      const mois = op.date?.substring(0,7) || 'Inconnu';
      if (!acc[mois]) acc[mois] = { mois: mois.substring(5,7)+'/'+mois.substring(2,4), entrees: 0, sorties: 0 };
      acc[mois].entrees += op.entree || 0;
      acc[mois].sorties += op.sortie || 0;
      return acc;
    }, {})
  ).slice(-6);

  const graphData = caisseParMois.length > 0 ? caisseParMois : evolutionCaisse.map(e => ({
    mois: e.mois, entrees: e.entrees, sorties: e.sorties
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Rapports & Statistiques" subtitle="Synthèse financière et opérationnelle"
        action={
          <button onClick={()=>window.print()} className="btn-secondary no-print">
            <Printer size={15}/> Imprimer
          </button>
        }/>

      {/* ── KPIs ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Solde caisse',        value: fmt(soldeCaisse),       color: soldeCaisse>=0?'text-primary-600':'text-red-500' },
          { label:'Total caisses',       value: fmt(totalCaisses),      color: 'text-blue-600'   },
          { label:'Taux présence',       value: `${tauxPresence}%`,     color: 'text-amber-600'  },
          { label:'Taux recouvrement',   value: `${tauxRecouvrement}%`, color: 'text-purple-600' },
        ].map(k=>(
          <div key={k.label} className="card text-center py-4">
            <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Graphique évolution caisse ──────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary-600"/> Évolution de la caisse (6 derniers mois)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={graphData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/>
            <XAxis dataKey="mois" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>v>=1000?`${Math.round(v/1000)}k`:v} tick={{fontSize:11}} axisLine={false} tickLine={false}/>
            <Tooltip content={tip}/>
            <Bar dataKey="entrees" fill="var(--brand)" name="Entrées" radius={[4,4,0,0]}/>
            <Bar dataKey="sorties" fill="var(--muted)" name="Sorties" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Caisses ──────────────────────────────────────── */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Répartition des caisses internes</h3>
          {bancairesData.every(b=>b.value===0) ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">Aucun solde de caisse enregistré</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={bancairesData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name,percent})=>`${name.substring(0,8)}… ${Math.round(percent*100)}%`} labelLine={false}>
                  {bancairesData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                </Pie>
                <Tooltip formatter={v=>fmt(v)}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Participation tontines ───────────────────────── */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Parts par membre (toutes tontines)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={participationData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} axisLine={false} tickLine={false} width={55}/>
              <Tooltip/>
              <Bar dataKey="parts" fill="var(--brand)" name="Parts" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Transactions de séance par type ─────────────────── */}
      {txParType.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Receipt size={16} className="text-primary-600"/> Transactions enregistrées par séance — synthèse
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {txParType.map(t => (
              <div key={t.name} className={clsx(
                'p-3 rounded-xl border',
                t.dir==='entree' ? 'bg-green-50 border-green-100' :
                t.dir==='sortie' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{t.icon}</span>
                  <span className="text-xs text-gray-600 font-medium truncate">{t.name}</span>
                </div>
                <p className={clsx('text-base font-bold',
                  t.dir==='entree' ? 'text-green-700' : t.dir==='sortie' ? 'text-red-600' : 'text-blue-700'
                )}>{fmt(t.total)}</p>
                <p className="text-xs text-gray-400">{t.count} opération(s)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Historique rapports de séance ───────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText size={16} className="text-primary-600"/> Rapport condensé par séance
          </h3>
          <p className="text-xs text-gray-400">Cliquez sur une réunion pour voir son PV complet</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">N° Séance</th>
                <th className="th">Date</th>
                <th className="th">Lieu</th>
                <th className="th">Présence</th>
                <th className="th text-right text-green-600">Entrées</th>
                <th className="th text-right text-red-500">Sorties</th>
                <th className="th text-right text-blue-600">Caisses</th>
                <th className="th text-right">Solde séance</th>
                <th className="th">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...reunionsAvecTx].sort((a,b)=>b.numero-a.numero).map(r => {
                const solde = r.entrees - r.sorties;
                const tauxP = r.cloture && (r.cloture.presents+r.cloture.absents)>0
                  ? Math.round(r.cloture.presents/(r.cloture.presents+r.cloture.absents)*100) : null;
                const couleur = { planifiee:'text-blue-600', en_cours:'text-amber-600', cloturee:'text-green-600' };
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="td font-bold text-gray-800">N°{r.numero}</td>
                    <td className="td text-xs text-gray-500">{fmtDate(r.date)}</td>
                    <td className="td text-xs text-gray-500 truncate max-w-[140px]">{r.lieu}</td>
                    <td className="td text-center">
                      {tauxP !== null
                        ? <span className={clsx('text-xs font-bold', tauxP>=80?'text-green-600':tauxP>=60?'text-amber-600':'text-red-500')}>{tauxP}%</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="td text-right font-semibold text-green-600">{r.entrees > 0 ? fmt(r.entrees) : '—'}</td>
                    <td className="td text-right font-semibold text-red-500">{r.sorties > 0 ? fmt(r.sorties) : '—'}</td>
                    <td className="td text-right font-semibold text-blue-600">{r.banque > 0 ? fmt(r.banque) : '—'}</td>
                    <td className={clsx('td text-right font-bold', solde>0?'text-primary-600':solde<0?'text-red-600':'text-gray-400')}>
                      {r.nbTx > 0 ? (solde >= 0 ? '+' : '') + fmt(solde) : '—'}
                    </td>
                    <td className="td">
                      <span className={clsx('text-xs font-semibold', couleur[r.statutReunion])}>
                        {r.statutReunion === 'planifiee' ? 'Planifiée' : r.statutReunion === 'en_cours' ? 'En cours' : 'Clôturée'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {reunions.length === 0 && (
                <tr><td colSpan={9} className="td text-center text-gray-400 py-8">Aucune réunion enregistrée</td></tr>
              )}
            </tbody>
            {reunionsAvecTx.some(r=>r.nbTx>0) && (
              <tfoot className="bg-primary-50 border-t-2 border-primary-200 font-bold text-sm">
                <tr>
                  <td colSpan={4} className="td text-primary-700">TOTAUX CUMULÉS</td>
                  <td className="td text-right text-green-600">{fmt(reunionsAvecTx.reduce((s,r)=>s+r.entrees,0))}</td>
                  <td className="td text-right text-red-500">{fmt(reunionsAvecTx.reduce((s,r)=>s+r.sorties,0))}</td>
                  <td className="td text-right text-blue-600">{fmt(reunionsAvecTx.reduce((s,r)=>s+r.banque,0))}</td>
                  <td className="td text-right text-primary-700">
                    {fmt(reunionsAvecTx.reduce((s,r)=>s+(r.entrees-r.sorties),0))}
                  </td>
                  <td className="td"/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Synthèse prêts ───────────────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingDown size={16} className="text-amber-600"/> Synthèse des prêts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l:'Total prêts accordés',  v: fmt(prets.reduce((s,p)=>s+p.montantPret,0)),       c:'text-gray-800'    },
            { l:'Intérêts générés',      v: fmt(prets.reduce((s,p)=>s+p.montantInteret,0)),     c:'text-amber-600'   },
            { l:'Déjà remboursé',        v: fmt(prets.reduce((s,p)=>s+p.montantRembourse,0)),   c:'text-primary-600' },
            { l:'Reste à recouvrer',     v: fmt(prets.reduce((s,p)=>s+p.resteAPayer,0)),        c:'text-red-500'     },
          ].map(k=>(
            <div key={k.l} className="text-center p-3 bg-gray-50 rounded-xl">
              <p className={`text-lg font-bold ${k.c}`}>{k.v}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
