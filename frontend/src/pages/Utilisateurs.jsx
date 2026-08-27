import { useState, useRef } from 'react';
import { UserCog, Plus, ShieldCheck, Pencil, Power, Copy, Check, KeyRound } from 'lucide-react';
import { roleLabel } from '../data/mockData';

const fmtDerniereConnexion = (d) => {
  if (!d) return 'Jamais connecté';
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';

const roleV = { super_admin:'red', president:'purple', vice_president:'purple', tresorier:'blue', secretaire:'green', controleur:'gray' };

const EMPTY = { email:'', role:'tresorier', idMembre:'' };

export default function Utilisateurs() {
  const { membres, utilisateurs, addUtilisateur, updateUtilisateur, desactiverUtilisateur, activerUtilisateur, showToast } = useApp();
  const [add,  setAdd]  = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null); // { u, action: 'activer'|'desactiver' }
  const [edit, setEdit] = useState(null);
  const [editRole, setEditRole] = useState('tresorier');
  const [tempPassword, setTempPassword] = useState(null); // { email, mdp }
  const [copied, setCopied] = useState(false);

  const handleAdd = async () => {
    const missing = getMissingFields(form, [
      { key: 'idMembre', label: 'Membre lié' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Rôle' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const m = membres.find(x=>x.id===form.idMembre);
    if (!m) { showToast?.('Membre introuvable.', 'error'); return; }
    const res = await addUtilisateur({ ...form, idMembre: form.idMembre, nomMembre:`${m.nom} ${m.prenom}` });
    setAdd(false);
    setForm(EMPTY);
    if (res?.motDePasseProvisoire) {
      setCopied(false);
      setTempPassword({ email: form.email, mdp: res.motDePasseProvisoire });
    }
  };
  const [guardedHandleAdd, addingUser] = useAsyncGuard(handleAdd);

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard?.writeText(tempPassword.mdp);
    setCopied(true);
  };

  const openEdit = (u) => { setEditRole(u.role); setEdit(u); };
  const handleEditSave = async () => {
    if (!edit) return;
    await updateUtilisateur(edit.id, { role: editRole });
    setEdit(null);
  };
  const [guardedHandleEditSave, savingEdit] = useAsyncGuard(handleEditSave);

  const handleToggle = async () => {
    if (!confirm) return;
    if (confirm.action === 'desactiver') await desactiverUtilisateur(confirm.u.id);
    else await activerUtilisateur(confirm.u.id);
    setConfirm(null);
  };
  const [guardedHandleToggle, toggling] = useAsyncGuard(handleToggle);

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
              <td className="td text-gray-400 text-xs">{fmtDerniereConnexion(u.derniereConnexion)}</td>
              <td className="td"><Badge variant={u.statut==='actif'?'green':'gray'}>{u.statut==='actif'?'Actif':'Inactif'}</Badge></td>
              <td className="td">
                <div className="flex gap-1">
                  <button
                    onClick={()=>openEdit(u)}
                    className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                    <Pencil size={12}/>Modifier
                  </button>
                  {u.statut==='actif' && u.role!=='super_admin' && (
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
        footer={<><button onClick={()=>setAdd(false)} disabled={addingUser} className="btn-secondary">Annuler</button><button onClick={guardedHandleAdd} disabled={addingUser} className="btn-primary"><UserCog size={14}/>{addingUser ? 'Création…' : 'Créer'}</button></>}>
        <div className="space-y-4">
          <FormField label="Membre lié" required>
            <S k="idMembre">
              <option value="">Sélectionner un membre…</option>
              {membres.map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
            </S>
          </FormField>
          <FormField label="Email" required>
            <F k="email" type="email" placeholder="ex: tresorier2@exemple.com"/>
          </FormField>
          <FormField label="Rôle" required>
            <S k="role">
              <option value="president">Président</option>
              <option value="vice_president">Vice-Président</option>
              <option value="tresorier">Trésorier</option>
              <option value="secretaire">Secrétaire</option>
              <option value="controleur">Contrôleur</option>
              <option value="super_admin">Super Administrateur</option>
            </S>
          </FormField>
          <p className="text-xs text-ink-500">Un mot de passe provisoire sera généré et affiché après la création.</p>
        </div>
      </Modal>

      {/* Modal édition rôle */}
      <Modal open={!!edit} onClose={()=>setEdit(null)} title="Modifier l'utilisateur"
        footer={<><button onClick={()=>setEdit(null)} disabled={savingEdit} className="btn-secondary">Annuler</button><button onClick={guardedHandleEditSave} disabled={savingEdit} className="btn-primary"><Pencil size={14}/>{savingEdit ? 'Enregistrement…' : 'Enregistrer'}</button></>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {edit?.nomUtilisateur} — {edit?.nomMembre}
          </p>
          <FormField label="Rôle" required>
            <select className="select" value={editRole} onChange={e=>setEditRole(e.target.value)}>
              <option value="president">Président</option>
              <option value="vice_president">Vice-Président</option>
              <option value="tresorier">Trésorier</option>
              <option value="secretaire">Secrétaire</option>
              <option value="controleur">Contrôleur</option>
              <option value="super_admin">Super Administrateur</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Modal mot de passe provisoire : reste ouverte, copiable, pas de disparition automatique */}
      <Modal open={!!tempPassword} onClose={()=>setTempPassword(null)} title="Compte créé"
        footer={<button onClick={()=>setTempPassword(null)} className="btn-primary">J'ai noté le mot de passe</button>}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Communiquez ces identifiants à <strong>{tempPassword?.email}</strong> — ce mot de passe provisoire
            ne sera plus jamais affiché après fermeture de cette fenêtre.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <KeyRound size={16} className="text-gray-400 shrink-0"/>
            <span className="font-mono text-sm font-semibold text-gray-800 flex-1 select-all">{tempPassword?.mdp}</span>
            <button onClick={handleCopyPassword} className="btn-secondary py-1 px-2 text-xs flex items-center gap-1 shrink-0">
              {copied ? <Check size={12}/> : <Copy size={12}/>}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmation */}
      <Modal open={!!confirm} onClose={()=>setConfirm(null)}
        title={confirm?.action==='desactiver'?'Désactiver l\'utilisateur':'Activer l\'utilisateur'}
        footer={<>
          <button onClick={()=>setConfirm(null)} disabled={toggling} className="btn-secondary">Annuler</button>
          <button onClick={guardedHandleToggle} disabled={toggling} className={confirm?.action==='desactiver'?'btn-danger':'btn-primary'}>
            <Power size={14}/>{toggling ? 'Veuillez patienter…' : (confirm?.action==='desactiver'?'Oui, désactiver':'Oui, activer')}
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
