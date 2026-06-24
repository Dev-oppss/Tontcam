import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Login() {
  const { user, login, changePassword } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [mustChange, setMustChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password:'', password:'', password_confirmation:'' });
  const [error, setError] = useState(null);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password) return setError('Veuillez remplir tous les champs');
    try {
      const response = await login(form);
      if (response.must_change_password) {
        setMustChange(true);
        setPasswordForm(f => ({ ...f, current_password: form.password }));
        return;
      }
      navigate('/');
    } catch {
      setError('Connexion locale impossible');
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await changePassword(passwordForm);
      navigate('/');
    } catch {
      setError('Impossible de changer le mot de passe');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#f8fafc, #eef4fb)] p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-2 text-ink-900">Se connecter</h2>
        <p className="text-xs text-ink-600 mb-4">Entrez vos identifiants pour accéder au tableau de bord</p>

        {!mustChange ? <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="input" />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="input" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center justify-between">
            <button type="submit" className="btn-primary">Se connecter</button>
            <button type="button" className="btn-secondary" onClick={()=>{ setForm({email:'admin@test.local',password:'password'}); }}>Remplir</button>
          </div>
          <p className="text-xs text-ink-500">Mot de passe oublié et réinitialisation seront gérés par l’API Laravel.</p>
        </form> : <form onSubmit={submitPassword} className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">Changement de mot de passe requis.</div>
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input type="password" value={passwordForm.password} onChange={e=>setPasswordForm({...passwordForm,password:e.target.value})} className="input" />
          </div>
          <div>
            <label className="label">Confirmation</label>
            <input type="password" value={passwordForm.password_confirmation} onChange={e=>setPasswordForm({...passwordForm,password_confirmation:e.target.value})} className="input" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button type="submit" className="btn-primary">Changer</button>
        </form>}
      </div>
    </div>
  );
}
