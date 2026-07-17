import { useEffect } from 'react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge } from '../components/ui/index';
import { Trophy } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function Rotations() {
  const { rotations, tontines, chargerRotations } = useApp();

  useEffect(() => {
    tontines.forEach(t => chargerRotations(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tontines.map(t => t.id).join(',')]);

  const done = rotations.filter(r=>r.dateAttribution);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rotations"
        subtitle="Historique des attributions de tontine"
        action={<NavLink to="/encheres" className="btn-primary"><Trophy size={15}/> Gérer les enchères</NavLink>}
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">{done.length}</p>
          <p className="text-xs text-gray-400 mt-1">Tours effectués</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-800">{fmt(done.reduce((s,r)=>s+r.montantRecu,0))}</p>
          <p className="text-xs text-gray-400 mt-1">Total distribué</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">{fmt(rotations.reduce((s,r)=>s+r.enchere,0))}</p>
          <p className="text-xs text-gray-400 mt-1">Enchères récoltées</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <Table headers={['Tour','Bénéficiaire','Pot total','Enchère','Montant reçu','Date','Statut']}>
          {rotations.map(r=>(
            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
              <td className="td">
                <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold">{r.numeroTour}</div>
              </td>
              <td className="td">
                <div className="flex items-center gap-2">
                  {r.dateAttribution?<Trophy size={14} className="text-amber-500"/>:<div className="w-4"/>}
                  <span className={r.dateAttribution?'font-semibold text-gray-800':'text-gray-400 italic'}>{r.beneficiaire}</span>
                </div>
              </td>
              <td className="td font-medium">{fmt(r.montantTotal)}</td>
              <td className="td">{r.enchere>0?<span className="text-amber-600">{fmt(r.enchere)}</span>:'—'}</td>
              <td className="td">{r.montantRecu>0?<span className="font-bold text-primary-600">{fmt(r.montantRecu)}</span>:'—'}</td>
              <td className="td text-gray-500">{fmtDate(r.dateAttribution)}</td>
              <td className="td">
                <Badge variant={r.dateAttribution?'green':'gray'}>
                  {r.dateAttribution?'Effectué':'En attente'}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
