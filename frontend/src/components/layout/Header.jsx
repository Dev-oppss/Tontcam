import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Search, User, Coins, Landmark } from 'lucide-react';
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
  '/import-historique': { title: 'Reprise d’historique', sub: 'Import initial et traçable' },
  '/utilisateurs':    { title: 'Sécurité',          sub: 'Accès et permissions' },
  '/parametres':      { title: 'Paramètres',        sub: 'Configuration de l\'association' },
  '/postes':          { title: 'Organisation & Postes', sub: 'Organigramme, mandats et règles de cumul' },
  '/mon-espace':      { title: 'Mon espace',        sub: 'Portail membre' },
  '/decisions-ag':    { title: 'Décisions AG',      sub: 'Assemblées générales et résolutions' },
  '/social':          { title: 'Caisse sociale',    sub: 'Aides et soutien social' },
  '/rapprochement':   { title: 'Rapprochement bancaire', sub: 'Vérification des relevés' },
  '/audit':           { title: 'Journal d\'audit',  sub: 'Historique des actions' },
  '/reglement':       { title: 'Règlement intérieur', sub: 'Textes et clauses statutaires' },
  '/mon-profil':      { title: 'Mon profil',        sub: 'Informations personnelles' },
};

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, currentAssociation, membres, tontines, prets } = useApp();
  const meta = names[pathname] || { title: 'Page', sub: '' };
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { membres: [], tontines: [], prets: [] };
    const matchMembre = (m) => `${m.nom || ''} ${m.prenom || ''}`.toLowerCase().includes(q)
      || (m.matricule || '').toLowerCase().includes(q) || (m.telephone || '').includes(q);
    return {
      membres: (membres || []).filter(matchMembre).slice(0, 5),
      tontines: (tontines || []).filter((t) => (t.nom || '').toLowerCase().includes(q)).slice(0, 5),
      prets: (prets || []).filter((p) => (p.nomMembre || '').toLowerCase().includes(q)).slice(0, 5),
    };
  }, [query, membres, tontines, prets]);

  const hasResults = results.membres.length || results.tontines.length || results.prets.length;

  const goTo = (path) => { setOpen(false); setQuery(''); navigate(path); };

  return (
    <header className="no-print min-h-[74px] bg-white/55 border-b border-white/60 flex items-center px-5 py-3 gap-4 shrink-0 sticky top-0 z-30 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_24px_-20px_rgba(11,13,18,.3)]">

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

      <div ref={boxRef} className="hidden lg:block relative w-[320px]">
        <div className="flex items-center gap-2 bg-white/70 backdrop-blur border border-white/60 rounded-full px-4 py-2.5 transition-all focus-within:border-indigo-300 focus-within:shadow-glow-indigo">
          <Search size={16} className="text-ink-500/70 shrink-0" />
          <input
            placeholder="Rechercher un membre, une tontine, un prêt..."
            className="bg-transparent text-sm outline-none text-ink-700 placeholder-ink-500/50 w-full"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => query && setOpen(true)}
          />
        </div>

        {open && query.trim() && (
          <div className="absolute top-full mt-2 w-full bg-white rounded-2xl border border-surface-200 shadow-xl overflow-hidden z-40 max-h-[360px] overflow-y-auto">
            {!hasResults && (
              <p className="px-4 py-3 text-sm text-ink-500">Aucun résultat pour « {query} »</p>
            )}
            {results.membres.length > 0 && (
              <div className="py-1">
                <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Membres</p>
                {results.membres.map((m) => (
                  <button key={m.id} onClick={() => goTo('/membres')}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-surface-100">
                    <User size={14} className="text-ink-500 shrink-0" />
                    <span className="truncate">{m.nom} {m.prenom}</span>
                  </button>
                ))}
              </div>
            )}
            {results.tontines.length > 0 && (
              <div className="py-1 border-t border-surface-100">
                <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Tontines</p>
                {results.tontines.map((t) => (
                  <button key={t.id} onClick={() => goTo('/tontines')}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-surface-100">
                    <Coins size={14} className="text-ink-500 shrink-0" />
                    <span className="truncate">{t.nom}</span>
                  </button>
                ))}
              </div>
            )}
            {results.prets.length > 0 && (
              <div className="py-1 border-t border-surface-100">
                <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Prêts</p>
                {results.prets.map((p) => (
                  <button key={p.id} onClick={() => goTo('/prets')}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-surface-100">
                    <Landmark size={14} className="text-ink-500 shrink-0" />
                    <span className="truncate">{p.nomMembre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
