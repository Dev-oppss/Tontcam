import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const pillars = [
  'Organisation claire',
  'Réunions et PV',
  'Tontines et cycles',
  'Finance et prêts',
  'Sanctions et social',
];

export default function Login() {
  const { user, login, changePassword, utilisateurs } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [mustChange, setMustChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', password: '', password_confirmation: '' });
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
        setPasswordForm((f) => ({ ...f, current_password: form.password }));
        return;
      }
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Connexion impossible. Vérifiez vos identifiants.');
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
              Une interface nette pour les tontines, les caisses et les membres.
            </h1>
            <div className="africa-band mt-5 max-w-[220px]" />
            <p className="mt-4 text-white/[0.74] max-w-xl leading-relaxed">
              Chaque association est la racine. Ensuite viennent les membres, réunions, tontines, finances, prêts,
              sanctions et rapports, tous liés au même <span className="font-semibold">association_id</span>.
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              {pillars.map((item) => (
                <span key={item} className="hero-chip">
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-white/12 bg-white/[0.08] p-4 max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-bold">Parcours métier</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Association', 'Membres', 'Réunions', 'Tontines', 'Finance', 'Rapports'].map((step, index) => (
                  <span key={step} className="hero-chip">
                    {String(index + 1).padStart(2, '0')} · {step}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mt-8">
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55 font-bold">Statut</p>
              <p className="text-sm text-white font-semibold mt-2">Accès sécurisé</p>
            </div>
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55 font-bold">Cible</p>
              <p className="text-sm text-white font-semibold mt-2">Accès du bureau exécutif</p>
            </div>
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/55 font-bold">Style</p>
              <p className="text-sm text-white font-semibold mt-2">Image institutionnelle</p>
            </div>
          </div>
        </div>

        <div className="card rounded-[32px] p-6 md:p-8 self-center shadow-[0_30px_80px_rgba(16,32,27,.18)]">
          <div className="mb-6">
            <span className="hero-chip bg-[#e7efff] text-[#1f4aa6] border-[#cfdcff]">Accès sécurisé</span>
            <h2 className="text-2xl font-display font-semibold text-ink-900 mt-4">
              Se connecter
            </h2>
            <p className="text-sm text-ink-600/70 mt-1">
              Entrez vos identifiants pour accéder à l’espace de gestion.
            </p>
          </div>

          {!mustChange ? (
            <form onSubmit={submit} className="space-y-4">
              {(!utilisateurs || utilisateurs.length === 0) && (
                <>
                  <div className="rounded-2xl bg-[#eef4ff] border border-[#cfdcff] p-3 text-xs text-[#1f4aa6]">
                    Premier accès à cette association — ce compte devient automatiquement <strong>Administrateur</strong>.
                  </div>
                  <div>
                    <label className="label">Nom complet</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input"
                      placeholder="Ex : Jean Mballa"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input"
                />
              </div>
              <p className="text-xs text-ink-600/45 -mt-1">
                Votre rôle est déterminé par le compte créé pour vous dans <strong>Utilisateurs</strong> (onglet Sécurité).
                Le tout premier compte créé sur une association devient automatiquement Administrateur.
              </p>
              {error && <div className="text-sm text-[#a64734]">{error}</div>}
              <button type="submit" className="btn-primary w-full justify-center">Se connecter</button>
            </form>
          ) : (
            <form onSubmit={submitPassword} className="space-y-4">
              <div className="rounded-2xl bg-[#fcf1d7] border border-[#edd399] p-3 text-sm text-[#8a6421]">
                Changement de mot de passe requis.
              </div>
              <div>
                <label className="label">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Confirmation</label>
                <input
                  type="password"
                  value={passwordForm.password_confirmation}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password_confirmation: e.target.value })}
                  className="input"
                />
              </div>
              {error && <div className="text-sm text-[#a64734]">{error}</div>}
              <button type="submit" className="btn-primary w-full justify-center">
                Changer
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
