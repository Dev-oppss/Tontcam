import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, PanelLeftClose, PanelLeft, LogOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useApp } from '../../context/AppContext';
import { roleLabel } from '../../data/mockData';

const nav = [
  { label: 'Tableau de bord', path: '/' },
  {
    label: 'Organisation',
    children: [
      { label: 'Association', path: '/setup' },
      { label: 'Membres', path: '/membres' },
      { label: 'Postes & mandats', path: '/postes' },
      { label: 'Règlement intérieur', path: '/reglement' },
      { label: 'Réunions', path: '/reunions' },
    ],
  },
  {
    label: 'Tontines',
    children: [
      { label: 'Tontines actives', path: '/tontines' },
      { label: 'Rotations', path: '/tontines?type=rotation' },
      { label: 'Tirage au sort', path: '/tontines?type=tirage' },
      { label: 'Enchères', path: '/tontines?type=enchere' },
    ],
  },
  {
    label: 'Finance',
    children: [
      { label: 'Caisses', path: '/caisses' },
      { label: 'Caisse centrale', path: '/caisse' },
      { label: 'Prêts & crédits', path: '/prets' },
      { label: 'Rapprochement bancaire', path: '/rapprochement' },
    ],
  },
  {
    label: 'Social',
    children: [
      { label: 'Volet social', path: '/social' },
      { label: 'Décisions AG', path: '/decisions-ag' },
    ],
  },
  { label: 'Sanctions', path: '/sanctions' },
  { label: 'Rapports', path: '/rapports' },
  { label: 'Sécurité', path: '/utilisateurs' },
  { label: "Journal d'audit", path: '/audit' },
  { label: 'Paramètres', path: '/parametres' },
  { label: 'Mon espace', path: '/mon-espace' },
];

function Section({ item, collapsed }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const active = useMemo(() => {
    if (!item.children) return location.pathname === item.path;
    return item.children.some((c) => {
      const [childPath, childQuery] = c.path.split('?');
      return location.pathname === childPath
        && (childQuery === undefined || (location.search || '').replace(/^\?/, '') === childQuery);
    });
  }, [item, location.pathname, location.search]);

  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) => clsx('sidebar-link', isActive ? 'sidebar-link-active' : 'sidebar-link-inactive')}
      >
        <span className="nav-dot" />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx('sidebar-link w-full', active ? 'text-white bg-white/12' : 'sidebar-link-inactive')}
      >
        <span className="nav-dot" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronRight size={13} className={clsx('transition-transform duration-200 opacity-60', open && 'rotate-90')} />
          </>
        )}
      </button>

      {open && !collapsed && (
        <div className="ml-4 mt-1 pl-3 border-l border-white/10 space-y-0.5 pb-1">
          {item.children.map((child) => {
            // NavLink ne compare que location.pathname par défaut, jamais location.search.
            // Ici plusieurs liens partagent le même pathname (/tontines) avec un ?type=
            // différent : sans cette comparaison manuelle, ils s'affichent TOUS actifs
            // simultanément dès qu'on est sur /tontines, quel que soit le lien cliqué.
            const [childPath, childQuery] = child.path.split('?');
            const isChildActive = location.pathname === childPath
              && (childQuery ?? '') === (location.search || '').replace(/^\?/, '');

            return (
              <NavLink
                key={child.path}
                to={child.path}
                className={clsx(
                  'block px-3 py-2 text-xs font-medium transition-all duration-150 rounded-2xl',
                  isChildActive ? 'text-white bg-white/15' : 'text-white/65 hover:text-white hover:bg-white/10'
                )}
              >
                {child.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, setCollapsed }) {
  const { currentAssociation, user, logout } = useApp();
  const navigate = useNavigate();
  return (
    <aside
      className={clsx(
        'sticky top-0 h-screen flex flex-col transition-all duration-300 shrink-0 relative overflow-hidden no-print',
        collapsed ? 'w-[72px]' : 'w-[276px]',
        'gradient-sidebar'
      )}
    >
      <div className="absolute inset-0 pointer-events-none opacity-[.06] surface-pattern" />
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#d9a629]/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-16 w-52 h-52 rounded-full bg-[#2147a6]/18 blur-3xl pointer-events-none" />

      <div className={clsx('relative z-10 border-b border-white/10', collapsed ? 'px-2 py-3' : 'px-4 py-5')}>
        <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
          {collapsed ? (
            <div className="w-11 h-11 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center overflow-hidden">
              <img src="/tontix-mark.png" alt="TONTIX" className="w-8 h-8 object-contain" />
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                <img src="/tontix-mark.png" alt="TONTIX" className="w-6 h-6 object-contain" />
              </div>
              <p className="font-display text-base font-semibold text-white tracking-tight">TONTIX</p>
              <button
                onClick={() => setCollapsed(true)}
                className="text-white/35 hover:text-white/90 p-1 rounded-lg transition-colors ml-auto"
                title="Réduire"
              >
                <PanelLeftClose size={15} />
              </button>
            </>
          )}
        </div>

        {!collapsed && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.08] backdrop-blur px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-bold">Identité</p>
            <p className="text-sm text-white font-semibold mt-1">
              {currentAssociation?.nom || 'Association active'}
            </p>
            <p className="text-xs text-white/[0.65] mt-1.5">
              {currentAssociation?.ville ? `${currentAssociation.ville}, ${currentAssociation.pays}` : 'Base visuelle alignée sur le logo et les usages métier.'}
            </p>
          </div>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-6 w-7 h-7 bg-ink-900 border border-white/10 rounded-full flex items-center justify-center text-white/60 hover:text-white shadow-lg transition-colors z-20"
        >
          <PanelLeft size={11} />
        </button>
      )}

      <nav className={clsx('flex-1 overflow-y-auto py-3 sidebar-scroll relative z-10', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Modules métier</p>}
        <div className="space-y-1">
          {nav.map((item) => (
            <Section key={item.label} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <div className={clsx('border-t border-white/10 relative z-10', collapsed ? 'px-2 py-3 flex justify-center' : 'px-3 py-3')}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => navigate('/mon-profil')}
            className="avatar-soft"
            title="Mon profil"
          >
            {(user?.membre?.prenom || user?.email || 'A')[0].toUpperCase()}
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-2xl hover:bg-white/[0.08] transition-colors">
            <button
              type="button"
              onClick={() => navigate('/mon-profil')}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
              title="Mon profil"
            >
              <div className="avatar-soft">{(user?.membre?.prenom || user?.email || 'A')[0].toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate leading-tight">
                  {user?.membre ? `${user.membre.prenom} ${user.membre.nom}` : (user?.email || 'Administration')}
                </p>
                <p className="text-white/[0.48] text-[11px] mt-0.5">{roleLabel[user?.role] || 'Accès administrateur'}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { logout(); navigate('/login'); }}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              title="Se déconnecter"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
