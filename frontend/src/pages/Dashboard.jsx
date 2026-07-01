import { Users, Wallet, Building2, HandCoins, Heart, RefreshCw, ShieldAlert, CalendarDays, ArrowRight, CheckCircle, Clock, Gift, Award, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate, periodeLabel } from '../data/mockData';
import { StatCard, Badge, SectionCard, EmptyState } from '../components/ui/index';
import clsx from 'clsx';

const TYPE_COLORS = {
  rotation: 'var(--brand)',
  tirage: 'var(--brand-soft)',
  enchere: 'var(--brand-pale)',
};

const TYPE_ICONS = {
  rotation: RefreshCw,
  tirage: Gift,
  enchere: Award,
};

const BANK_COLORS = ['#2147a6', '#d9a629', '#10224d', '#55617c', '#c7921f'];

const MODULES = [
  { title: 'Organisation', desc: 'Associations, postes, règlement intérieur, paramètres.' },
  { title: 'Membres', desc: 'Fiches, statuts, rôles, assurance et historique.' },
  { title: 'Réunions', desc: 'Ordre du jour, présences, signatures et PV.' },
  { title: 'Tontines', desc: 'Parts, cycles, cotisations, gagnants et enchères.' },
  { title: 'Finance', desc: 'Caisses, transactions, transferts et rapprochements.' },
  { title: 'Prêts', desc: 'Demandes, validation, décaissement et remboursements.' },
  { title: 'Sanctions', desc: 'Absences, retards, sanctions automatiques et manuelles.' },
  { title: 'Social', desc: 'Aides sociales, événements et décisions AG.' },
  { title: 'Rapports', desc: 'Vues KPI, exports, journaux et lecture rapide.' },
  { title: 'Sécurité', desc: 'Rôles, audit, scopes par association et verrouillage.' },
];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-200 rounded-2xl p-3 shadow-card text-xs">
      <p className="font-semibold text-ink-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

function ModuleTile({ title, desc, index }) {
  return (
    <div className="module-tile p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-display font-semibold text-ink-900">{title}</p>
          <p className="text-xs text-ink-600/65 mt-1 leading-relaxed">{desc}</p>
        </div>
        <span className="w-8 h-8 rounded-2xl flex items-center justify-center text-xs font-bold text-ink-900 bg-[linear-gradient(135deg,#f9efdd_0%,#f2dfb4_100%)] border border-[#ead39c]">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const {
    currentAssociation,
    dashboardStats,
    evolutionCaisse,
    repartitionBanques: repartitionBanquesRaw,
    prets,
    rotations,
    tontines,
    membresParTontine,
    planningTours,
  } = useApp();

  const alertPrets = prets.filter((p) => p.statut === 'en_retard');
  const lastRotations = rotations.filter((r) => r.dateAttribution).slice(-3).reverse();
  const repartitionBanques = repartitionBanquesRaw.map((b, i) => ({
    ...b,
    color: BANK_COLORS[i % BANK_COLORS.length],
  }));

  const getNbEncaisses = (id) => (planningTours || []).filter((p) => p.idTontine === id && p.statut === 'encaisse').length;
  const getProchainBenef = (id) => (planningTours || []).filter((p) => p.idTontine === id && p.statut === 'planifie').sort((a, b) => a.numeroTour - b.numeroTour)[0];

  return (
    <div className="space-y-6">
      <section className="hero-panel rounded-[30px] p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 surface-pattern pointer-events-none" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_.9fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hero-chip">TONTIX</span>
              <span className="hero-chip">Association au centre</span>
            </div>
            <h2 className="mt-4 text-3xl md:text-5xl font-display font-semibold max-w-3xl leading-[1.05]">
              Une plateforme de tontine qui respire la rigueur, la solidarité et la culture.
            </h2>
            <div className="africa-band mt-5 max-w-[220px]" />
            <p className="mt-4 text-white/[0.74] max-w-2xl leading-relaxed">
              Chaque association a son espace, puis ses membres, réunions, tontines, finances, prêts, sanctions,
              social et rapports. Le front est déjà pensé dans cet ordre métier.
            </p>

            {currentAssociation && (
              <div className="mt-5 rounded-[24px] border border-white/12 bg-white/[0.08] p-4 max-w-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-bold">Association active</p>
                    <p className="text-lg md:text-xl font-display font-semibold mt-1">{currentAssociation.nom}</p>
                    <p className="text-sm text-white/[0.70] mt-1">
                      {currentAssociation.siege} · {currentAssociation.ville}, {currentAssociation.pays}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-bold">Code</p>
                    <p className="text-lg font-display font-semibold mt-1">{currentAssociation.abrege}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Association', 'Membres', 'Réunions', 'Tontines', 'Finance', 'Rapports'].map((step, index) => (
                    <span key={step} className="hero-chip">
                      {String(index + 1).padStart(2, '0')} · {step}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-5">
              {MODULES.slice(0, 6).map((module) => (
                <span key={module.title} className="hero-chip">
                  {module.title}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {currentAssociation && (
              <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <img src="/tontix-logo.jpeg" alt="TONTIX" className="h-14 w-14 rounded-[18px] bg-white p-1 shrink-0 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white/60 text-xs uppercase tracking-[0.14em] font-bold">Association racine</p>
                    <p className="text-lg font-display font-semibold mt-1 truncate">{currentAssociation.nom}</p>
                    <p className="text-sm text-white/[0.72] mt-1">
                      {currentAssociation.ville}, {currentAssociation.pays}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="hero-chip">ID · {currentAssociation.id}</span>
                  <span className="hero-chip">Devise · {currentAssociation.devise}</span>
                  <span className="hero-chip">Siège · {currentAssociation.siege}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase tracking-[0.14em] font-bold">Membres actifs</p>
                <p className="text-2xl font-display font-semibold mt-2">{dashboardStats.membresActifs}</p>
              </div>
              <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase tracking-[0.14em] font-bold">Tontines</p>
                <p className="text-2xl font-display font-semibold mt-2">{dashboardStats.tontinesActives}</p>
              </div>
              <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase tracking-[0.14em] font-bold">Prêts</p>
                <p className="text-2xl font-display font-semibold mt-2">{dashboardStats.pretsEnCours}</p>
              </div>
              <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
                <p className="text-white/60 text-xs uppercase tracking-[0.14em] font-bold">Caisse</p>
                <p className="text-2xl font-display font-semibold mt-2">{fmt(dashboardStats.soldeCaisse)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {alertPrets.length > 0 && (
        <div className="bg-[#fff3d1] border border-[#edd399] rounded-2xl px-4 py-3 flex items-center gap-3 text-sm text-[#84590e]">
          <ShieldAlert size={18} className="text-[#d9a629] shrink-0" />
          <span>
            <strong>{alertPrets.length} prêt(s) en retard</strong> - relancer les membres concernés.
          </span>
          <NavLink to="/prets" className="ml-auto text-[#84590e] font-semibold hover:underline flex items-center gap-1 shrink-0">
            Voir <ArrowRight size={13} />
          </NavLink>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Membres actifs" value={dashboardStats.membresActifs} sub={`sur ${dashboardStats.totalMembres} membres`} iconBg="bg-[#e7efff]" iconColor="text-[#2147a6]" accent="var(--brand)" />
        <StatCard icon={Wallet} label="Solde caisse" value={fmt(dashboardStats.soldeCaisse)} sub="Caisse centrale" iconBg="bg-[#fff3d1]" iconColor="text-[#b57f13]" accent="var(--brand-dark)" />
        <StatCard icon={Building2} label="Total caisses" value={fmt(dashboardStats.totalBanques)} sub="Épargnes internes" iconBg="bg-[#eef4ff]" iconColor="text-[#2147a6]" accent="var(--brand-soft)" />
        <StatCard icon={HandCoins} label="Prêts en cours" value={dashboardStats.pretsEnCours} sub={`Restant : ${fmt(dashboardStats.totalPretsRestants)}`} iconBg="bg-[#f2f0eb]" iconColor="text-[#55617c]" accent="var(--brand-pale)" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={RefreshCw} label="Tontines actives" value={dashboardStats.tontinesActives} iconBg="bg-[#e7efff]" iconColor="text-[#2147a6]" accent="var(--brand)" />
        <StatCard icon={Heart} label="Fond assurance" value={fmt(dashboardStats.fondAssurance || dashboardStats.caisseSociale)} iconBg="bg-[#fff3d1]" iconColor="text-[#d9a629]" accent="var(--brand-dark)" />
        <StatCard icon={ShieldAlert} label="Sanctions impayées" value={dashboardStats.sanctionsImpayees} iconBg="bg-[#fff3d1]" iconColor="text-[#b57f13]" accent="var(--brand-dark)" />
        <StatCard icon={CalendarDays} label="Prochaine réunion" value={dashboardStats.prochaineReunion ? fmtDate(dashboardStats.prochaineReunion) : '—'} sub="Agenda à venir" iconBg="bg-[#eef4ff]" iconColor="text-[#2147a6]" accent="var(--brand-soft)" />
      </div>

      <SectionCard
        title="Couverture fonctionnelle"
        subtitle="Tous les modules métier de l’association, organisés en un seul espace."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {MODULES.map((module, index) => (
            <ModuleTile key={module.title} title={module.title} desc={module.desc} index={index} />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Tontines actives"
        subtitle="Vue des groupes en circulation et de leur progression."
        action={<NavLink to="/tontines" className="text-xs text-[#2147a6] hover:underline flex items-center gap-1">Gérer <ArrowRight size={12} /></NavLink>}
      >
        {tontines.filter((t) => t.statut === 'active').length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="Aucune tontine active"
            description="Créez votre première tontine pour lancer un cycle de cotisation."
            action={<NavLink to="/tontines" className="btn-secondary">Créer une tontine</NavLink>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {tontines.filter((t) => t.statut === 'active').map((t) => {
              const nbActifs = membresParTontine.filter((mt) => mt.idTontine === t.id && mt.statut === 'actif').length;
              const encaisses = getNbEncaisses(t.id);
              const progress = Math.round((encaisses / Math.max(t.nbTours, 1)) * 100);
              const potTour = t.cotisation * t.totalParts;
              const prochainB = getProchainBenef(t.id);
              const TypeIcon = TYPE_ICONS[t.typeAttribution] || Building2;

              return (
                <NavLink key={t.id} to="/tontines" className="module-tile block">
                  <div className="flex items-center gap-2 mb-3">
                    <TypeIcon size={18} className="text-[#2147a6]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-ink-900 truncate">{t.nom}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {periodeLabel[t.periode]} · {nbActifs} membre(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-ink-500 mb-1">
                    <span>Pot / tour</span>
                    <span className="font-semibold text-[#2147a6]">{fmt(potTour)}</span>
                  </div>

                  <div className="h-1.5 bg-[#f2eadf] rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: TYPE_COLORS[t.typeAttribution] || 'var(--brand)' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-ink-400 mb-2">
                    <span>{encaisses}/{t.nbTours} tours</span>
                    <span>{progress}%</span>
                  </div>

                  {prochainB ? (
                    <div className="p-2.5 bg-white/70 border border-surface-200 rounded-2xl">
                      <p className="text-xs text-ink-500">Prochain bénéficiaire</p>
                      <p className="text-xs font-semibold text-ink-800 truncate mt-0.5">{prochainB.nomMembre}</p>
                      {prochainB.datePrevue && <p className="text-xs text-ink-400 mt-0.5">{fmtDate(prochainB.datePrevue)}</p>}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-white/70 border border-surface-200 rounded-2xl text-center">
                      <p className="text-xs text-ink-400">Bénéficiaire non planifié</p>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-ink-900">Évolution de la caisse</h3>
              <p className="text-xs text-ink-500">Entrées vs sorties - historique.</p>
            </div>
            <span className="badge-green">En FCFA</span>
          </div>
          {evolutionCaisse.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Aucune donnée de caisse"
              description="Les mouvements de caisse apparaîtront ici dès la première opération."
            />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={evolutionCaisse}>
                <defs>
                  <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-dark)" stopOpacity={0.10} />
                    <stop offset="95%" stopColor="var(--brand-dark)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="entrees" name="Entrées" stroke="var(--brand)" strokeWidth={2} fill="url(#gBlue)" />
                <Area type="monotone" dataKey="sorties" name="Sorties" stroke="var(--muted)" strokeWidth={2} fill="url(#gAmber)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="font-display font-semibold text-ink-900 mb-1">Répartition des caisses</h3>
          <p className="text-xs text-ink-500 mb-3">Soldes actuels</p>
          {repartitionBanques.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Aucune caisse"
              description="Créez une caisse pour commencer à suivre les soldes."
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={repartitionBanques} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {repartitionBanques.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {repartitionBanques.map((bank) => (
                  <div key={bank.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: bank.color }} />
                    <span className="text-ink-600 flex-1 truncate">{bank.name}</span>
                    <span className="font-semibold text-ink-700">{fmt(bank.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard
          title="Dernières attributions"
          subtitle="Historique rapide des tours de tontine."
          action={<NavLink to="/rotations" className="text-xs text-[#2147a6] hover:underline flex items-center gap-1">Voir tout <ArrowRight size={12} /></NavLink>}
        >
          {lastRotations.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="Aucune attribution effectuée"
              description="Les bénéficiaires apparaîtront ici après le premier tour attribué."
            />
          ) : (
            <div className="space-y-2">
              {lastRotations.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-white/70 border border-surface-200 rounded-2xl">
                  <div className="w-10 h-10 rounded-2xl bg-[linear-gradient(135deg,#10224d_0%,#2147a6_100%)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    T{r.numeroTour}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-800 truncate">{r.beneficiaire}</p>
                    <p className="text-xs text-ink-400">{fmtDate(r.dateAttribution)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink-800">{fmt(r.montantRecu)}</p>
                    {r.enchere > 0 && <p className="text-xs text-[#d9a629]">Enchère : {fmt(r.enchere)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Prêts en cours"
          subtitle="Suivi des remboursements et des retards."
          action={<NavLink to="/prets" className="text-xs text-[#2147a6] hover:underline flex items-center gap-1">Voir tout <ArrowRight size={12} /></NavLink>}
        >
          {prets.filter((p) => p.statut !== 'rembourse').length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Aucun prêt actif"
              description="Les prêts accordés aux membres apparaîtront ici."
            />
          ) : (
            <div className="space-y-3">
              {prets.filter((p) => p.statut !== 'rembourse').map((p) => {
                const pct = Math.round((p.montantRembourse / p.montantTotal) * 100);
                return (
                  <div key={p.id} className="p-3 bg-white/70 border border-surface-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-ink-800">{p.nomMembre}</p>
                      <Badge variant={p.statut === 'en_retard' ? 'red' : 'blue'}>
                        {p.statut === 'en_retard' ? 'En retard' : 'En cours'}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs text-ink-500 mb-1.5">
                      <span>{fmt(p.montantRembourse)} remboursés</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-[#f2eadf] rounded-full h-1.5">
                      <div
                        className={clsx('h-1.5 rounded-full', p.statut === 'en_retard' ? 'bg-[#c7563a]' : 'bg-[#2147a6]')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
