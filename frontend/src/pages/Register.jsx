import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const EMPTY_FORM = {
  nom: '', prenom: '', telephone: '', email: '',
  password: '', passwordConfirmation: '',
};

export default function Register() {
  const { user, register } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (user) return <Navigate to="/" replace />;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.nom || !form.prenom || !form.telephone || !form.email || !form.password) {
      return setError('Veuillez remplir tous les champs');
    }
    if (form.password !== form.passwordConfirmation) {
      return setError('Les mots de passe ne correspondent pas');
    }
    if (form.password.length < 8) {
      return setError('Le mot de passe doit contenir au moins 8 caractères');
    }
    setBusy(true);
    try {
      const res = await register(form);
      if (res?.user) navigate('/');
      else setError('Inscription impossible. Vérifiez vos informations.');
    } catch {
      setError('Inscription impossible. Vérifiez vos informations.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen app-shell flex items-stretch bg-[linear-gradient(135deg,#09142a_0%,#2147a6_42%,#fbfaf7_100%)] p-4 md:p-6">
      <div className="absolute inset-0 opacity-[.12] surface-pattern pointer-events-none" />

      <div className="relative z-10 grid w-full max-w-6xl mx-auto lg:grid-cols-[1.1fr_.9fr] gap-5">
        <div className="hero-panel rounded-[32px] p-6 md:p-8 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center gap-3">
              <img src="/tontix-logo.jpeg" alt="TONTIX" className="h-14 w-auto rounded-[18px] bg-white p-1 shadow-[0_12px_30px_rgba(0,0,0,.18)]" />
              <div>
                <p className="font-display text-xl font-semibold text-white">TONTIX</p>
                <p className="text-xs text-white/70">Gestion solidaire, pensée pour l’Afrique</p>
              </div>
            </div>

            <h1 className="font-display text-3xl md:text-5xl font-semibold leading-[1.02] mt-8 max-w-xl">
              Créez votre espace en quelques instants.
            </h1>
            <div className="africa-band mt-5 max-w-[220px]" />
            <p className="mt-4 text-white/[0.74] max-w-xl leading-relaxed">
              Votre compte est créé avec votre propre association, isolée de toute autre donnée. Vous pourrez
              compléter la fiche de l’association juste après.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-8">
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55 font-bold">Étape 1</p>
              <p className="text-sm text-white font-semibold mt-2">Créer le compte</p>
            </div>
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55 font-bold">Étape 2</p>
              <p className="text-sm text-white font-semibold mt-2">Compléter l’association</p>
            </div>
          </div>
        </div>

        <div className="card rounded-[32px] p-6 md:p-8 self-center shadow-[0_30px_80px_rgba(16,32,27,.18)]">
          <div className="mb-6">
            <span className="hero-chip bg-[#e7efff] text-[#1f4aa6] border-[#cfdcff]">Nouveau compte</span>
            <h2 className="text-2xl font-display font-semibold text-ink-900 mt-4">Créer un compte</h2>
            <p className="text-sm text-ink-600/70 mt-1">
              Renseignez vos informations pour ouvrir votre espace de gestion.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Prénom</label>
                <input className="input" value={form.prenom} onChange={set('prenom')} placeholder="Roger" />
              </div>
              <div>
                <label className="label">Nom</label>
                <input className="input" value={form.nom} onChange={set('nom')} placeholder="Tagne" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.telephone} onChange={set('telephone')} placeholder="+237600000000" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={set('email')} placeholder="vous@exemple.com" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Mot de passe</label>
                <input type="password" className="input" value={form.password} onChange={set('password')} />
              </div>
              <div>
                <label className="label">Confirmation</label>
                <input type="password" className="input" value={form.passwordConfirmation} onChange={set('passwordConfirmation')} />
              </div>
            </div>

            {error && <div className="text-sm text-[#a64734]">{error}</div>}

            <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
              Créer mon compte
            </button>

            <p className="text-sm text-ink-600/70 text-center">
              Déjà un compte ? <Link to="/login" className="font-semibold text-[#1f4aa6]">Se connecter</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
