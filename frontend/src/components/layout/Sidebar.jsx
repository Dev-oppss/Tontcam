import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const nav = [
  { label:'Tableau de bord', path:'/' },
  { label:'Membres',         path:'/membres' },
  { label:'Réunions',        path:'/reunions' },
  { label:'Tontines', children:[
    { label:'Tontines actives', path:'/tontines' },
    { label:'Rotations',        path:'/rotations' },
    { label:'Enchères',         path:'/encheres'  },
  ]},
  { label:'Banques',         path:'/banques'       },
  { label:'Prêts & Crédits', path:'/prets'         },
  { label:'Caisse Centrale', path:'/caisse'        },
  { label:'Sanctions',       path:'/sanctions'     },
  { label:'Rapports',        path:'/rapports'      },
  { label:'Utilisateurs',    path:'/utilisateurs'  },
];

function Item({ item, collapsed }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (item.children) {
    const active = item.children.some(c => location.pathname === c.path);
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={clsx(
            'sidebar-link w-full',
            active ? 'text-white bg-white/10' : 'sidebar-link-inactive'
          )}
        >
          <span className="nav-dot" />
          {!collapsed && <>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronRight size={13} className={clsx('transition-transform duration-200 opacity-50', open && 'rotate-90')} />
          </>}
        </button>
        {open && !collapsed && (
          <div className="ml-4 mt-1 pl-3 border-l border-white/10 space-y-0.5 pb-1">
            {item.children.map(c => (
              <NavLink key={c.path} to={c.path}
                className={({ isActive }) => clsx(
                  'block px-3 py-2 text-xs font-medium transition-all duration-150 rounded-2xl',
                  isActive
                    ? 'text-white bg-white/15'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                )}
              >{c.label}</NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink to={item.path} end={item.path === '/'}
      className={({ isActive }) => clsx(
        'sidebar-link',
        isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
      )}
    >
      <span className="nav-dot" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

export default function Sidebar({ collapsed, setCollapsed }) {
  return (
    <aside
      className={clsx(
        'h-screen flex flex-col transition-all duration-300 shrink-0 relative',
        collapsed ? 'w-[64px]' : 'w-[190px]'
      , 'gradient-sidebar')}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
      />

      {/* Logo */}
      <div className={clsx('flex items-center gap-3 border-b border-white/12 relative z-10', collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-4')}>
        <div className="app-logo">
          <img src="/favicon.svg" alt="TontineApp" className="w-full h-full" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-none">TontineApp</p>
            <p className="text-white/55 text-[11px] mt-1">Gestion professionnelle</p>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-white/30 hover:text-white/70 p-1 rounded-lg transition-colors"
            title="Réduire"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-6 w-6 h-6 bg-ink-800 border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white shadow-lg transition-colors z-20"
        >
          <PanelLeft size={11} />
        </button>
      )}

      {/* Nav */}
      <nav className={clsx('flex-1 overflow-y-auto py-3 space-y-0.5 sidebar-scroll relative z-10', collapsed ? 'px-2' : 'px-3')}>
        {nav.map(item => <Item key={item.label} item={item} collapsed={collapsed} />)}
      </nav>

      {/* User */}
      <div className={clsx('border-t border-white/12 relative z-10', collapsed ? 'px-2 py-3 flex justify-center' : 'px-3 py-3')}>
        {collapsed ? (
          <div className="avatar-soft">A</div>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/6 transition-colors cursor-pointer">
            <div className="avatar-soft">A</div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate leading-tight">Administrateur</p>
              <p className="text-white/40 text-[11px] mt-0.5">Administrateur</p>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" title="En ligne" />
          </div>
        )}
      </div>
    </aside>
  );
}
