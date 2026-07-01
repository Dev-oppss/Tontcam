import { useLocation } from 'react-router-dom';
import { CalendarDays, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { roleLabel } from '../../data/mockData';

const names = {
  '/':                { title: 'Tableau de bord',   sub: 'Vue globale du système' },
  '/membres':         { title: 'Organisation',      sub: 'Membres et structure' },
  '/reunions':        { title: 'Réunions',          sub: 'Planification et procès-verbaux' },
  '/tontines':        { title: 'Tontines actives',  sub: 'Gestion des cycles et parts' },
  '/rotations':       { title: 'Rotations',         sub: 'Attribution des tours' },
  '/encheres':        { title: 'Enchères',          sub: 'Système d\'enchères' },
  '/caisses':         { title: 'Finance',           sub: 'Caisses et opérations' },
  '/prets':           { title: 'Prêts & Crédits',   sub: 'Gestion des prêts membres' },
  '/caisse':          { title: 'Caisse Centrale',   sub: 'Journal et mouvements' },
  '/caisse-sociale':  { title: 'Caisse sociale',    sub: 'Aides et soutien social' },
  '/fond-assurance':  { title: 'Fonds assurance',   sub: 'Garanties et assistance' },
  '/sanctions':       { title: 'Sanctions',         sub: 'Pénalités et infractions' },
  '/rapports':        { title: 'Rapports',          sub: 'Analyses et statistiques' },
  '/utilisateurs':    { title: 'Sécurité',          sub: 'Accès et permissions' },
};

export default function Header() {
  const { pathname } = useLocation();
  const { user, currentAssociation } = useApp();
  const meta = names[pathname] || { title: 'Page', sub: '' };
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className="min-h-[78px] bg-white/[0.82] border-b border-white/70 flex items-center px-5 py-3 gap-4 shrink-0 sticky top-0 z-30 backdrop-blur-xl shadow-[0_12px_30px_-24px_rgba(16,24,39,.22)]">

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="hero-chip text-[10px] uppercase tracking-[0.16em]">TONTIX</span>
          {currentAssociation && (
            <span className="hero-chip text-[10px] uppercase tracking-[0.16em]">
              {currentAssociation.abrege}
            </span>
          )}
          <span className="hidden sm:inline-flex hero-chip text-[10px] uppercase tracking-[0.16em]">
            <CalendarDays size={12} />
            {today}
          </span>
        </div>
        <h1 className="text-[1.1rem] md:text-[1.35rem] font-display font-semibold text-ink-900 leading-tight">
          {meta.title}
        </h1>
        <p className="text-sm text-ink-600/75 mt-0.5 leading-tight">{meta.sub || 'Vue claire des modules métier'}</p>
        {currentAssociation && (
          <p className="text-[11px] text-ink-500 mt-1">
            Association active: {currentAssociation.nom} · {currentAssociation.ville}, {currentAssociation.pays}
          </p>
        )}
      </div>

      <div className="hidden lg:flex items-center gap-2 bg-white/85 border border-surface-200 rounded-full px-4 py-2.5 w-[320px] transition-all focus-within:border-primary-300 focus-within:shadow-[0_0_0_4px_rgba(33,71,166,.08)]">
        <Search size={16} className="text-ink-500/70 shrink-0" />
        <input
          placeholder="Rechercher un membre, une tontine, un prêt..."
          className="bg-transparent text-sm outline-none text-ink-700 placeholder-ink-500/50 w-full"
        />
      </div>

      <div className="flex items-center gap-3 pl-4 border-l border-surface-200/80">
        <div className="avatar-soft">{(user?.name || 'A')[0].toUpperCase()}</div>
        <div className="hidden sm:block min-w-0">
          <p className="text-sm font-semibold text-ink-900 truncate">
            {user?.name || 'Administration'}
          </p>
          <p className="text-xs text-ink-600/70 truncate">{roleLabel[user?.role] || 'Accès administrateur'}</p>
        </div>
      </div>
    </header>
  );
}
