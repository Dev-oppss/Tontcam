import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Sparkles, ArrowRight, Layers3, ShieldCheck, BadgeCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

const flow = [
  { title: '1. Association', desc: 'Fiche complète, contacts, siège et devise.' },
  { title: '2. Membres', desc: 'Adhésions, statuts, rôles et historiques.' },
  { title: '3. Réunions', desc: 'Présences, PV, décisions et signatures.' },
  { title: '4. Tontines', desc: 'Parts, cycles, tours et enchères.' },
  { title: '5. Finance', desc: 'Caisse, banques, prêts, sanctions et social.' },
  { title: '6. Rapports', desc: 'Suivi d’activité, soldes et synthèse.' },
];

const EMPTY_FORM = {
  nom: 'Union des Femmes de Bonanjo',
  abrege: 'UFB',
  ville: 'Douala',
  pays: 'Cameroun',
  siege: 'Bonanjo, Douala',
  telephone: '+237 699 100 200',
  email: 'contact@ufb-cm.org',
  devise: 'XAF',
};

export default function Setup() {
  const { createAssociation, loadDemoWorkspace, resetWorkspace, currentAssociation } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (currentAssociation) {
      setForm((prev) => ({
        ...prev,
        nom: currentAssociation.nom || prev.nom,
        abrege: currentAssociation.abrege || prev.abrege,
        ville: currentAssociation.ville || prev.ville,
        pays: currentAssociation.pays || prev.pays,
        siege: currentAssociation.siege || prev.siege,
        telephone: currentAssociation.telephone || prev.telephone,
        email: currentAssociation.email || prev.email,
      }));
    }
  }, [currentAssociation]);

  const submit = async (mode) => {
    if (busy) return;
    setBusy(mode);
    try {
      if (mode === 'demo') {
        await loadDemoWorkspace();
        navigate('/');
        return;
      }
      const next = await createAssociation(form);
      navigate('/login');
      return next;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen app-shell p-4 md:p-6 bg-[linear-gradient(135deg,#09142a_0%,#2147a6_42%,#fbfaf7_100%)]">
      <div className="absolute inset-0 opacity-[.12] surface-pattern pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_.95fr] gap-6">
        <section className="hero-panel rounded-[34px] p-6 md:p-8 overflow-hidden">
          <div className="flex items-center gap-3">
            <img src="/tontix-logo.jpeg" alt="TONTIX" className="h-16 w-auto rounded-[18px] bg-white p-1 shadow-[0_12px_30px_rgba(0,0,0,.18)]" />
            <div>
              <p className="text-white font-display text-xl font-semibold">TONTIX</p>
              <p className="text-white/70 text-xs">Gestion des associations, tontines et caisses</p>
            </div>
          </div>

          <h1 className="mt-8 font-display text-3xl md:text-5xl font-semibold leading-[1.02] max-w-2xl">
            Tout démarre par la fiche association.
          </h1>
          <div className="africa-band mt-5 max-w-[240px]" />
          <p className="mt-4 text-white/[0.75] max-w-2xl leading-relaxed">
            Membres, réunions, tontines, caisse, prêts, sanctions, social et rapports sont rattachés à une seule structure.
            Cette interface sert à vérifier le parcours complet avant le branchement backend.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <Building2 size={18} className="text-[#d9a629]" />
              <p className="mt-3 text-sm font-semibold text-white">Association</p>
              <p className="text-xs text-white/65 mt-1">Base unique des données</p>
            </div>
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <Layers3 size={18} className="text-[#2147a6]" />
              <p className="mt-3 text-sm font-semibold text-white">Modules</p>
              <p className="text-xs text-white/65 mt-1">Navigation par activité</p>
            </div>
            <div className="rounded-[24px] bg-white/10 border border-white/10 p-4">
              <ShieldCheck size={18} className="text-[#f0d48e]" />
              <p className="mt-3 text-sm font-semibold text-white">Traçabilité</p>
              <p className="text-xs text-white/65 mt-1">Historique local pour test</p>
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-3">
            {flow.map((step) => (
              <div key={step.title} className="rounded-[24px] border border-white/10 bg-white/[0.08] p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-bold">{step.title}</p>
                <p className="mt-2 text-sm font-semibold text-white">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card rounded-[34px] p-6 md:p-8 shadow-[0_30px_80px_rgba(16,32,27,.18)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="hero-chip bg-[#e7efff] text-[#1f4aa6] border-[#cfdcff]">Initialiser l’association</span>
              <h2 className="mt-4 text-2xl font-display font-semibold text-ink-900">Démarrer le workspace</h2>
              <p className="text-sm text-ink-600/70 mt-1">
                Renseigne la structure de base, puis ouvre le parcours complet avec des données de prévisualisation.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3 rounded-[24px] bg-[#eef4ff] border border-[#cfdcff] px-4 py-3">
              <BadgeCheck size={18} className="text-[#1f4aa6]" />
              <div>
                <p className="text-xs uppercase tracking-[0.14em] font-bold text-[#1f4aa6]">Statut</p>
                <p className="text-sm font-semibold text-[#173374]">Prévisualisation locale</p>
              </div>
            </div>
          </div>

          {currentAssociation && (
            <div className="mt-5 rounded-2xl border border-[#cfdcff] bg-[#eef4ff] p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#1f4aa6]">Association active</p>
              <p className="text-sm font-semibold text-ink-900 mt-1">{currentAssociation.nom}</p>
            </div>
          )}

          <div className="mt-6 grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nom association</label>
                <input className="input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="TONTIX Solidarité Cameroun" />
              </div>
              <div>
                <label className="label">Abréviation</label>
                <input className="input" value={form.abrege} onChange={(e) => setForm({ ...form, abrege: e.target.value })} placeholder="TSC" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Ville</label>
                <input className="input" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
              </div>
              <div>
                <label className="label">Pays</label>
                <input className="input" value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="label">Siège</label>
              <input className="input" value={form.siege} onChange={(e) => setForm({ ...form, siege: e.target.value })} placeholder="Akwa, Douala" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+237..." />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@..." />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <button type="button" disabled={busy} onClick={() => submit('blank')} className="btn-primary justify-center">
                <ArrowRight size={14} />
                Enregistrer et ouvrir la connexion
              </button>
              <button type="button" disabled={busy} onClick={() => submit('demo')} className="btn-secondary justify-center">
                <Sparkles size={14} />
                Ouvrir l’exemple préchargé
              </button>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={resetWorkspace}
              className="text-xs text-ink-500 hover:text-ink-800 hover:underline self-start"
            >
              Vider la prévisualisation locale
            </button>
          </div>

          <p className="mt-6 text-xs text-ink-500 leading-relaxed">
            Les données saisies restent dans ce navigateur pour permettre les tests du front sans base de données.
          </p>
        </section>
      </div>
    </div>
  );
}
