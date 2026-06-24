import { Users, Wallet, Building2, HandCoins, Heart, RefreshCw, ShieldAlert, CalendarDays, ArrowRight, TrendingUp, CheckCircle, Clock, Gift, Award } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate, periodeLabel } from '../data/mockData';
import { StatCard, Badge } from '../components/ui/index';
import clsx from 'clsx';

const TYPE_COLORS = { rotation:'var(--brand)', tirage:'var(--brand-soft)', enchere:'var(--brand-pale)' };
const TYPE_ICONS  = { rotation: RefreshCw, tirage: Gift, enchere: Award };

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p,i)=><p key={i} style={{color:p.color}}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

export default function Dashboard() {
  const {
    dashboardStats, evolutionCaisse, repartitionBanques,
    prets, rotations, tontines, membresParTontine, planningTours,
  } = useApp();

  const alertPrets    = prets.filter(p=>p.statut==='en_retard');
  const lastRotations = rotations.filter(r=>r.dateAttribution).slice(-3).reverse();

  const getNbEncaisses = (id) => (planningTours||[]).filter(p=>p.idTontine===id&&p.statut==='encaisse').length;
  const getProchainBenef = (id) => (planningTours||[]).filter(p=>p.idTontine===id&&p.statut==='planifie').sort((a,b)=>a.numeroTour-b.numeroTour)[0];

  return (
    <div className="space-y-6">

      {/* Alerte prêts */}
      {alertPrets.length>0&&(
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-red-700">
          <ShieldAlert size={18} className="text-red-500 shrink-0"/>
          <span><strong>{alertPrets.length} prêt(s) en retard</strong> — Relancer les membres concernés.</span>
          <NavLink to="/prets" className="ml-auto text-red-600 font-medium hover:underline flex items-center gap-1 shrink-0">Voir <ArrowRight size={13}/></NavLink>
        </div>
      )}

      {/* Stats ligne 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}     label="Membres actifs"  value={dashboardStats.membresActifs}     sub={`sur ${dashboardStats.totalMembres} membres`}              iconBg="bg-primary-100" iconColor="text-primary-600" accent="var(--brand)" />
        <StatCard icon={Wallet}    label="Solde caisse"    value={fmt(dashboardStats.soldeCaisse)}  sub="Caisse centrale"                                           iconBg="bg-amber-100"   iconColor="text-amber-600" accent="var(--brand-dark)" />
        <StatCard icon={Building2} label="Total banques"   value={fmt(dashboardStats.totalBanques)} sub="Épargnes internes"                                         iconBg="bg-blue-100"    iconColor="text-blue-600" accent="var(--brand-soft)" />
        <StatCard icon={HandCoins} label="Prêts en cours"  value={dashboardStats.pretsEnCours}      sub={`Restant : ${fmt(dashboardStats.totalPretsRestants)}`}     iconBg="bg-surface-100"  iconColor="text-ink-600" accent="var(--brand-pale)" />
      </div>

      {/* Stats ligne 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={RefreshCw}   label="Tontines actives"   value={dashboardStats.tontinesActives}         iconBg="bg-primary-100" iconColor="text-primary-600" accent="var(--brand)" />
        <StatCard icon={Heart}       label="Fond Assurance"     value={fmt(dashboardStats.fondAssurance || dashboardStats.caisseSociale)}      iconBg="bg-red-100"    iconColor="text-red-600" accent="var(--brand-dark)" />
        <StatCard icon={ShieldAlert} label="Sanctions impayées" value={dashboardStats.sanctionsImpayees}       iconBg="bg-amber-100"  iconColor="text-amber-600" accent="var(--brand-dark)" />
        <StatCard icon={CalendarDays}label="Prochaine réunion"  value={dashboardStats.prochaineReunion ? fmtDate(dashboardStats.prochaineReunion) : '—'} sub="Prochaine réunion" iconBg="bg-blue-100" iconColor="text-blue-600" accent="var(--brand-soft)" />
      </div>

      {/* Tontines actives — cartes dynamiques */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <RefreshCw size={16} className="text-primary-600"/> Tontines actives
          </h3>
          <NavLink to="/tontines" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
            Gérer <ArrowRight size={12}/>
          </NavLink>
        </div>
        {tontines.filter(t=>t.statut==='active').length === 0 ? (
          <div className="card text-center py-8 text-gray-400">
            <RefreshCw size={28} className="mx-auto mb-2 text-gray-200"/>
            <p className="text-sm">Aucune tontine active</p>
            <NavLink to="/tontines" className="text-xs text-primary-600 hover:underline mt-1 inline-block">Créer une tontine -</NavLink>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tontines.filter(t=>t.statut==='active').map(t => {
              const nbActifs   = membresParTontine.filter(mt=>mt.idTontine===t.id&&mt.statut==='actif').length;
              const encaisses  = getNbEncaisses(t.id);
              const progress   = Math.round((encaisses / Math.max(t.nbTours,1)) * 100);
              const potTour    = t.cotisation * t.totalParts;
              const prochainB  = getProchainBenef(t.id);
              const TypeIcon = TYPE_ICONS[t.typeAttribution] || Building2;

              return (
                <NavLink key={t.id} to="/tontines"
                  className="card border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all no-underline">
                  <div className="flex items-center gap-2 mb-3">
                    <TypeIcon size={18} className="text-primary-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{t.nom}</p>
                      <p className="text-xs text-gray-400">{periodeLabel[t.periode]} · {nbActifs} membre(s)</p>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Pot / tour</span>
                    <span className="font-bold text-primary-600">{fmt(potTour)}</span>
                  </div>

                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all" style={{ width:`${progress}%`, background: TYPE_COLORS[t.typeAttribution]||'var(--brand)' }}/>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>{encaisses}/{t.nbTours} tours</span>
                    <span>{progress}%</span>
                  </div>

                  {prochainB ? (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Prochain bénéficiaire</p>
                      <p className="text-xs font-bold text-gray-800 truncate">{prochainB.nomMembre}</p>
                      {prochainB.datePrevue && <p className="text-xs text-gray-400">{fmtDate(prochainB.datePrevue)}</p>}
                    </div>
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-400">Bénéficiaire non planifié</p>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-800">Évolution de la caisse</h3>
              <p className="text-xs text-gray-400">Entrées vs Sorties — historique</p>
            </div>
            <span className="badge-green">En FCFA</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={evolutionCaisse}>
              <defs>
                <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--brand)" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="var(--brand)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--brand-dark)" stopOpacity={0.08}/>
                  <stop offset="95%" stopColor="var(--brand-dark)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/>
              <XAxis dataKey="mois" tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'var(--muted)'}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000000).toFixed(1)}M`}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="entrees" name="Entrées" stroke="var(--brand)" strokeWidth={2} fill="url(#gBlue)"/>
              <Area type="monotone" dataKey="sorties" name="Sorties" stroke="var(--muted)" strokeWidth={2} fill="url(#gAmber)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-1">Répartition banques</h3>
          <p className="text-xs text-gray-400 mb-3">Soldes actuels</p>
          {dashboardStats.totalBanques === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Building2 size={32} className="text-gray-200 mb-2"/>
              <p className="text-sm">Soldes à 0 FCFA</p>
              <NavLink to="/banques" className="text-xs text-primary-600 hover:underline mt-1">Faire un dépôt</NavLink>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={repartitionBanques} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {repartitionBanques.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {repartitionBanques.map(b=>(
                  <div key={b.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:b.color}}/>
                    <span className="text-gray-600 flex-1 truncate">{b.name}</span>
                    <span className="font-semibold text-gray-700">{fmt(b.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Dernières attributions</h3>
            <NavLink to="/rotations" className="text-xs text-primary-600 hover:underline flex items-center gap-1">Voir tout <ArrowRight size={12}/></NavLink>
          </div>
          {lastRotations.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Aucune attribution effectuée</p>
          ) : (
            <div className="space-y-2">
              {lastRotations.map(r=>(
                <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center text-white text-xs font-bold shrink-0">T{r.numeroTour}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.beneficiaire}</p>
                    <p className="text-xs text-gray-400">{fmtDate(r.dateAttribution)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{fmt(r.montantRecu)}</p>
                    {r.enchere>0&&<p className="text-xs text-amber-600">Enchère : {fmt(r.enchere)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Prêts en cours</h3>
            <NavLink to="/prets" className="text-xs text-primary-600 hover:underline flex items-center gap-1">Voir tout <ArrowRight size={12}/></NavLink>
          </div>
          {prets.filter(p=>p.statut!=='rembourse').length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Aucun prêt actif</p>
          ) : (
            <div className="space-y-3">
              {prets.filter(p=>p.statut!=='rembourse').map(p=>{
                const pct = Math.round((p.montantRembourse/p.montantTotal)*100);
                return (
                  <div key={p.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800">{p.nomMembre}</p>
                      <Badge variant={p.statut==='en_retard'?'red':'blue'}>{p.statut==='en_retard'?'En retard':'En cours'}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>{fmt(p.montantRembourse)} remboursés</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${p.statut==='en_retard'?'bg-red-500':'bg-primary-500'}`} style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
