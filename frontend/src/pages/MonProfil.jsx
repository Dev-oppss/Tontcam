import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { roleLabel } from '../data/mockData';
import { PageHeader, SectionCard, FormField } from '../components/ui/index';

export default function MonProfil() {
  const { user, updateMonProfil, changePassword } = useApp();
  const membre = user?.membre || {};

  const [form, setForm] = useState({
    nom: membre.nom || '',
    prenom: membre.prenom || '',
    email: user?.email || '',
    telephone: membre.telephone || '',
    telephone2: membre.telephone2 || '',
    ville: membre.ville || '',
    profession: membre.profession || '',
  });
  const [saving, setSaving] = useState(false);

  const [pwd, setPwd] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitProfil = async (e) => {
    e.preventDefault();
    setSaving(true);
    await updateMonProfil(form);
    setSaving(false);
  };

  const submitPwd = async (e) => {
    e.preventDefault();
    if (pwd.password !== pwd.password_confirmation) return;
    setPwdSaving(true);
    await changePassword(pwd);
    setPwd({ current_password: '', password: '', password_confirmation: '' });
    setPwdSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        subtitle={`${roleLabel[user?.role] || user?.role || ''} — modifiez vos informations personnelles et votre mot de passe`}
      />

      <SectionCard title="Mes informations">
        <form onSubmit={submitProfil} className="grid sm:grid-cols-2 gap-4">
          <FormField label="Nom">
            <input className="input" value={form.nom} onChange={set('nom')} />
          </FormField>
          <FormField label="Prénom">
            <input className="input" value={form.prenom} onChange={set('prenom')} />
          </FormField>
          <FormField label="Email (identifiant de connexion)" required>
            <input type="email" className="input" value={form.email} onChange={set('email')} />
          </FormField>
          <FormField label="Téléphone">
            <input className="input" value={form.telephone} onChange={set('telephone')} />
          </FormField>
          <FormField label="Téléphone secondaire">
            <input className="input" value={form.telephone2} onChange={set('telephone2')} />
          </FormField>
          <FormField label="Ville">
            <input className="input" value={form.ville} onChange={set('ville')} />
          </FormField>
          <FormField label="Profession">
            <input className="input" value={form.profession} onChange={set('profession')} />
          </FormField>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary gap-2">
              <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer mes informations'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Changer mon mot de passe">
        <form onSubmit={submitPwd} className="grid sm:grid-cols-3 gap-4">
          <FormField label="Mot de passe actuel" required>
            <input
              type="password"
              className="input"
              value={pwd.current_password}
              onChange={(e) => setPwd((f) => ({ ...f, current_password: e.target.value }))}
            />
          </FormField>
          <FormField label="Nouveau mot de passe" required>
            <input
              type="password"
              className="input"
              value={pwd.password}
              onChange={(e) => setPwd((f) => ({ ...f, password: e.target.value }))}
            />
          </FormField>
          <FormField label="Confirmation" required>
            <input
              type="password"
              className="input"
              value={pwd.password_confirmation}
              onChange={(e) => setPwd((f) => ({ ...f, password_confirmation: e.target.value }))}
            />
          </FormField>
          {pwd.password && pwd.password_confirmation && pwd.password !== pwd.password_confirmation && (
            <p className="sm:col-span-3 text-sm text-[#a64734]">Les mots de passe ne correspondent pas.</p>
          )}
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pwdSaving} className="btn-primary gap-2">
              <KeyRound size={16} /> {pwdSaving ? 'Enregistrement…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
