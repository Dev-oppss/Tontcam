import { useState } from 'react';
import { ShieldAlert, Plus } from 'lucide-react';
import { fmt, fmtDate, typeSancLabel } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';

export default function Sanctions() {
  const { membres, sanctions, addSanction, payerSanction } = useApp();
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState({ idMembre:'', nomMembre:'', typeSanction:'absence', montant:5000, numReunion:'', dateSanction: new Date().toISOString().split('T')[0] });

  const impayees = sanctions.filter(s=>s.statut==='impayee');
  const payees   = sanctions.filter(s=>s.statut==='payee');
  const typeV    = { absence:'red', retard:'amber', non_paiement:'red', autre:'gray' };

  const montantsParType = { absence:5000, retard:2000, non_paiement:10000, autre:0 };

  const handleAdd = () => {
    if (!form.idMembre) return;
    const m = membres.find(x=>x.id===Number(form.idMembre));
    addSanction({ ...form, idMembre: Number(form.idMembre), nomMembre:`${m.nom} ${m.prenom}`, montant: Number(form.montant) });
    setAdd(false);
    setForm({ idMembre:'', nomMembre:'', typeSanction:'absence', montant:5000, numReunion:'', dateSanction: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sanctions & Amendes" subtitle="Infractions et pénalités des membres"
        action={<button onClick={()=>setAdd(true)} className="btn-primary"><Plus size={15}/> Nouvelle sanction</button>}/>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center border-t-4 border-t-red-400">
          <p className="text-2xl font-bold text-red-600">{impayees.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sanctions impayées</p>
          <p className="text-sm font-semibold text-red-500 mt-0.5">{fmt(impayees.reduce((s,x)=>s+x.montant,0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-green-400">
          <p className="text-2xl font-bold text-primary-600">{payees.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sanctions réglées</p>
          <p className="text-sm font-semibold text-primary-500 mt-0.5">{fmt(payees.reduce((s,x)=>s+x.montant,0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-amber-400">
          <p className="text-2xl font-bold text-gray-800">{sanctions.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total sanctions</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Barème des amendes</h3>
        <div className="grid grid-cols-3 gap-3">
          {[['Absence réunion',5000,'red'],['Retard',2000,'amber'],['Non-paiement tontine',10000,'red']].map(([l,v,c])=>(
            <div key={l} className={`p-3 rounded-xl text-center bg-${c}-50 border border-${c}-100`}>
              <p className={`text-lg font-bold text-${c}-600`}>{fmt(v)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {impayees.length>0&&(
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5"><ShieldAlert size={14}/>Amendes impayées</p>
          {impayees.map(s=>(
            <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-red-100 last:border-0">
              <span className="font-medium text-red-800">{s.nomMembre}</span>
              <span className="text-gray-500 text-xs">{typeSancLabel[s.typeSanction]}</span>
              <span className="font-bold text-red-600">{fmt(s.montant)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <Table headers={['Membre','Réunion','Type','Montant','Date','Statut','Action']}>
          {sanctions.map(s=>(
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="td font-medium text-gray-800">{s.nomMembre}</td>
              <td className="td text-gray-500">N°{s.numReunion}</td>
              <td className="td"><Badge variant={typeV[s.typeSanction]}>{typeSancLabel[s.typeSanction]||s.typeSanction}</Badge></td>
              <td className="td font-bold text-red-600">{fmt(s.montant)}</td>
              <td className="td text-gray-500">{fmtDate(s.dateSanction)}</td>
              <td className="td"><Badge variant={s.statut==='payee'?'green':'red'}>{s.statut==='payee'?'Payée':'Impayée'}</Badge></td>
              <td className="td">
                {s.statut==='impayee'&&(
                  <button onClick={()=>payerSanction(s.id)} className="btn-primary py-1 px-2.5 text-xs">Marquer payée</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Modal open={add} onClose={()=>setAdd(false)} title="Nouvelle sanction"
        footer={<><button onClick={()=>setAdd(false)} className="btn-secondary">Annuler</button><button onClick={handleAdd} className="btn-danger"><ShieldAlert size={14}/>Enregistrer</button></>}>
        <div className="space-y-4">
          <FormField label="Membre" required>
            <select className="select" value={form.idMembre} onChange={e=>setForm(f=>({...f,idMembre:e.target.value}))}>
              <option value="">Sélectionner…</option>
              {membres.map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
            </select>
          </FormField>
          <FormField label="Type de sanction" required>
            <select className="select" value={form.typeSanction} onChange={e=>setForm(f=>({...f,typeSanction:e.target.value,montant:montantsParType[e.target.value]||f.montant}))}>
              <option value="absence">Absence réunion — 5 000 FCFA</option>
              <option value="retard">Retard — 2 000 FCFA</option>
              <option value="non_paiement">Non-paiement tontine — 10 000 FCFA</option>
              <option value="autre">Autre</option>
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant (FCFA)">
              <input type="number" className="input" value={form.montant} onChange={e=>setForm(f=>({...f,montant:e.target.value}))}/>
            </FormField>
            <FormField label="N° Réunion concernée">
              <input type="number" className="input" placeholder="7" value={form.numReunion} onChange={e=>setForm(f=>({...f,numReunion:e.target.value}))}/>
            </FormField>
          </div>
          <FormField label="Date">
            <input type="date" className="input" value={form.dateSanction} onChange={e=>setForm(f=>({...f,dateSanction:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
