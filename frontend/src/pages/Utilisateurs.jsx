import { useState, useRef } from 'react';
import { UserCog, Plus, ShieldCheck, Pencil, Power } from 'lucide-react';
import { roleLabel } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';

const roleV = { admin:'red', president:'purple', tresorier:'blue', secretaire:'green' };

const EMPTY = { nomUtilisateur:'', role:'tresorier', idMembre:'', motDePasse:'' };

export default function Utilisateurs() {
  const { membres, utilisateurs, addUtilisateur, desactiverUtilisateur, activerUtilisateur } = useApp();
  const [add,  setAdd]  = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null); // { u, action: 'activer'|'desactiver' }

  const handleAdd = () => {
    if (!form.nomUtilisateur.trim() || !form.idMembre) return;
    const m = membres.find(x=>x.id===Number(form.idMembre));
    addUtilisateur({ ...form, idMembre: Number(form.idMembre), nomMembre:`${m.nom} ${m.prenom}` });
    setAdd(false);
    setForm(EMPTY);
  };

  const handleToggle = () => {
    if (!confirm) return;
    if (confirm.action === 'desactiver') desactiverUtilisateur(confirm.u.id);
    else activerUtilisateur(confirm.u.id);
    setConfirm(null);
  };

  const formRef = useRef(form); formRef.current = form;
  const F = useRef(({ k, ...p }) => (
    <input className="input" value={formRef.current[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} {...p}/>
  )).current;
  const S = useRef(({ k, children }) => (
    <select className="select" value={formRef.current[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}>{children}</select>
  )).current;

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" subtitle="Gestion des accès au système"
        action={<button onClick={()=>setAdd(true)} className="btn-primary"><Plus size={15}/> Nouvel utilisateur</button>}/>

      {/* Rôles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { role:'Administrateur', desc:'Accès complet',         icon:'', v:'red'    },
          { role:'Président',      desc:'Consultation générale', icon:'', v:'purple' },
          { role:'Trésorier',      desc:'Finances & Caisse',     icon:'', v:'blue'   },
          { role:'Secrétaire',     desc:'Réunions & Membres',    icon:'', v:'green'  },
        ].map(r=>(
          <div key={r.role} className="card text-center py-4">
            <p className="text-3xl mb-2">{r.icon}</p>
            <p className="font-semibold text-gray-800 text-sm">{r.role}</p>
            <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-500"/>
            Comptes utilisateurs
          </h3>
          <Badge variant="gray">{utilisateurs.length} compte(s)</Badge>
        </div>
        <Table headers={['Utilisateur','Membre lié','Rôle','Dernière connexion','Statut','Actions']}>
          {utilisateurs.map(u=>(
            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
              <td className="td">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {u.nomUtilisateur[0].toUpperCase()}
                  </div>
                  <span className="font-mono text-sm font-medium text-gray-800">{u.nomUtilisateur}</span>
                </div>
              </td>
              <td className="td text-gray-600">{u.nomMembre}</td>
              <td className="td"><Badge variant={roleV[u.role]}>{roleLabel[u.role]}</Badge></td>
              <td className="td text-gray-400 text-xs">{u.derniereConnexion}</td>
              <td className="td"><Badge variant={u.statut==='actif'?'green':'gray'}>{u.statut==='actif'?'Actif':'Inactif'}</Badge></td>
              <td className="td">
                <div className="flex gap-1">
                  {u.statut==='actif' && u.role!=='admin' && (
                    <button
                      onClick={()=>setConfirm({u,action:'desactiver'})}
                      className="btn-danger py-1 px-2.5 text-xs flex items-center gap-1">
                      <Power size={12}/>Désactiver
                    </button>
                  )}
                  {u.statut!=='actif' && (
                    <button
                      onClick={()=>setConfirm({u,action:'activer'})}
                      className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1">
                      <Power size={12}/>Activer
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Modal ajout */}
      <Modal open={add} onClose={()=>setAdd(false)} title="Nouvel utilisateur"
        footer={<><button onClick={()=>setAdd(false)} className="btn-secondary">Annuler</button><button onClick={handleAdd} className="btn-primary"><UserCog size={14}/>Créer</button></>}>
        <div className="space-y-4">
          <FormField label="Membre lié" required>
            <S k="idMembre">
              <option value="">Sélectionner un membre…</option>
              {membres.map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
            </S>
          </FormField>
          <FormField label="Nom d'utilisateur" required>
            <F k="nomUtilisateur" placeholder="ex: tresorier2"/>
          </FormField>
          <FormField label="Rôle" required>
            <S k="role">
              <option value="president">Président</option>
              <option value="tresorier">Trésorier</option>
              <option value="secretaire">Secrétaire</option>
              <option value="admin">Administrateur</option>
            </S>
          </FormField>
          <FormField label="Mot de passe" required>
            <F k="motDePasse" type="password" placeholder="--------"/>
          </FormField>
        </div>
      </Modal>

      {/* Modal confirmation */}
      <Modal open={!!confirm} onClose={()=>setConfirm(null)}
        title={confirm?.action==='desactiver'?'Désactiver l\'utilisateur':'Activer l\'utilisateur'}
        footer={<>
          <button onClick={()=>setConfirm(null)} className="btn-secondary">Annuler</button>
          <button onClick={handleToggle} className={confirm?.action==='desactiver'?'btn-danger':'btn-primary'}>
            <Power size={14}/>{confirm?.action==='desactiver'?'Oui, désactiver':'Oui, activer'}
          </button>
        </>}>
        <p className="text-sm text-gray-600">
          {confirm?.action==='desactiver'
            ? `L'utilisateur "${confirm?.u?.nomUtilisateur}" sera désactivé et ne pourra plus se connecter.`
            : `L'utilisateur "${confirm?.u?.nomUtilisateur}" sera réactivé.`}
        </p>
      </Modal>
    </div>
  );
}
