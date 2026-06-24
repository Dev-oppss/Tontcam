import { useLocation } from 'react-router-dom';

const names = {
  '/':              { title: 'Tableau de bord',  sub: 'Vue d\'ensemble de votre tontine' },
  '/membres':       { title: 'Membres',           sub: 'Gestion des membres actifs' },
  '/reunions':      { title: 'Réunions',          sub: 'Planification & procès-verbaux' },
  '/tontines':      { title: 'Tontines actives',  sub: 'Gestion des tontines' },
  '/rotations':     { title: 'Rotations',         sub: 'Attribution des tours' },
  '/encheres':      { title: 'Enchères',          sub: 'Système d\'enchères' },
  '/banques':       { title: 'Banques internes',  sub: 'Comptes & opérations' },
  '/prets':         { title: 'Prêts & Crédits',   sub: 'Gestion des prêts membres' },
  '/caisse':        { title: 'Caisse Centrale',   sub: 'Journal & mouvements' },
  '/sanctions':     { title: 'Sanctions',         sub: 'Pénalités & infractions' },
  '/rapports':      { title: 'Rapports',          sub: 'Analyses & statistiques' },
  '/utilisateurs':  { title: 'Utilisateurs',      sub: 'Accès & permissions' },
};

export default function Header() {
  const { pathname } = useLocation();
  const meta = names[pathname] || { title: 'Page', sub: '' };
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className="h-16 bg-white/90 border-b border-surface-200/80 flex items-center px-5 gap-4 shrink-0 sticky top-0 z-30 backdrop-blur-sm">

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-ink-900 leading-tight">{meta.title}</h1>
        <p className="text-sm text-ink-600/70 capitalize mt-0.5 leading-tight">{meta.sub || today}</p>
      </div>

      <div className="hidden md:flex items-center gap-2 bg-surface-100 border border-surface-200 rounded-full px-4 py-2 w-72 transition-all focus-within:border-primary-300">
        <input
          placeholder="Rechercher"
          className="bg-transparent text-sm outline-none text-ink-700 placeholder-ink-500/50 w-full"
        />
      </div>

      <div className="flex items-center gap-3 pl-4 border-l border-surface-200">
        <div className="avatar-soft">A</div>
        <div className="hidden sm:block min-w-0">
          <p className="text-sm font-semibold text-ink-900 truncate">Administration</p>
          <p className="text-xs text-ink-600/70 truncate">Accès local</p>
        </div>
      </div>
    </header>
  );
}
