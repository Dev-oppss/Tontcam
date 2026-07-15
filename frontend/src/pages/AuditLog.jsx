import { useState, useMemo } from 'react';
import { ShieldCheck, Lock, Filter } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../data/mockData';
import { PageHeader, Table, Badge, EmptyState } from '../components/ui/index';

const ACTIONS = { create: 'green', update: 'blue', delete: 'red' };

export default function AuditLog() {
  const { user, auditLog = [], logAuditConsultation } = useApp();
  const [filtreModule, setFiltreModule] = useState('');
  const [filtreAction, setFiltreAction] = useState('');

  const autorise = user?.role === 'super_admin' || user?.role === 'controleur';

  // La consultation de l'audit log est elle-même tracée (RG-SEC-012)
  useMemo(() => {
    if (autorise) logAuditConsultation?.({ idUtilisateur: user?.id, filtres: { filtreModule, filtreAction }, consulteLe: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorise]);

  if (!autorise) {
    return (
      <EmptyState
        icon={Lock}
        title="Accès restreint"
        description="Le journal d'audit est accessible uniquement au Super Admin et au Contrôleur (RG-SEC-011)."
      />
    );
  }

  const modules = [...new Set(auditLog.map((l) => l.module))];

  const filtres = auditLog.filter((l) =>
    (!filtreModule || l.module === filtreModule) &&
    (!filtreAction || l.action === filtreAction)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        subtitle="Traçabilité immuable de toute opération financière (RG-SEC-009/010)"
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-ink-600/40" />
        <select className="select w-auto text-xs py-2" value={filtreModule} onChange={(e) => setFiltreModule(e.target.value)}>
          <option value="">Tous les modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="select w-auto text-xs py-2" value={filtreAction} onChange={(e) => setFiltreAction(e.target.value)}>
          <option value="">Toutes les actions</option>
          <option value="create">Création</option>
          <option value="update">Modification</option>
          <option value="delete">Suppression</option>
        </select>
        <Badge variant="gray">{filtres.length} entrée(s)</Badge>
      </div>

      <Table headers={['Date', 'Utilisateur', 'Module', 'Action', 'Valeur avant', 'Valeur après']}>
        {filtres.slice().reverse().map((l) => (
          <tr key={l.id} className="hover:bg-white/40 transition-colors">
            <td className="td text-ink-600/60 text-xs font-mono">{fmtDate(l.date)}</td>
            <td className="td font-medium">{l.utilisateur}</td>
            <td className="td">{l.module}</td>
            <td className="td"><Badge variant={ACTIONS[l.action] || 'gray'}>{l.action}</Badge></td>
            <td className="td text-xs text-ink-600/50 max-w-[180px] truncate font-mono">{l.avant || '—'}</td>
            <td className="td text-xs text-ink-600/70 max-w-[180px] truncate font-mono">{l.apres || '—'}</td>
          </tr>
        ))}
        {filtres.length === 0 && (
          <tr><td colSpan={6} className="td text-center text-ink-600/40 py-8">Aucune entrée</td></tr>
        )}
      </Table>

      <p className="text-xs text-ink-600/40 flex items-center gap-1.5">
        <ShieldCheck size={12} /> Ces entrées sont immuables et conservées indéfiniment.
      </p>
    </div>
  );
}
