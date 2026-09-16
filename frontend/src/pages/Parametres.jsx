import { useEffect, useState } from 'react';
import { SlidersHorizontal, Save, Wallet, CalendarClock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, SectionCard, FormField, Badge } from '../components/ui/index';

// Les onglets "Sanctions" (seuil de suspension, cycles impayés) et "Social"
// (barème des aides) ont été retirés : aucun de ces champs n'était jamais lu
// côté backend. Le barème d'aides sociales est désormais géré, avec de
// vrais montants configurables par type d'événement, sur la page Social
// (types_aide_sociale) — voir src/pages/Social.jsx.
const TABS = [
  { id: 'general',   label: 'Général',   icon: SlidersHorizontal },
  { id: 'financier', label: 'Financier', icon: Wallet },
  { id: 'reunions',  label: 'Réunions',  icon: CalendarClock },
];

const DEFAULTS = {
  devise: 'XAF',
  seuilApprobationPret: 200000,
  dureeMaxPretMois: 12,
  nbSignatairesPV: 3,
  delaiRappelJ7: true,
  delaiRappelJ3: true,
  delaiRappelJ1: true,
  plafondCumulPostes: 2,
};

export default function Parametres() {
  const app = useApp();
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({ ...DEFAULTS, ...(app?.parametres || {}) });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm((previous) => ({ ...previous, ...DEFAULTS, ...(app?.parametres || {}) }));
  }, [app?.parametres]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBool = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  const handleSave = async () => {
    if (!app?.updateParametres) return;
    await app.updateParametres(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        subtitle="Règles de gestion propres à votre association"
        action={
          <button onClick={handleSave} className="btn-primary">
            <Save size={15} /> {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'btn-primary py-2 px-3 text-xs'
                : 'btn-secondary py-2 px-3 text-xs'
            }
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <SectionCard title="Identité & isolation" subtitle="Chaque association dispose de son propre espace de données isolé (RG-ORG-015)">
          <div className="grid sm:grid-cols-3 gap-4">
            <FormField label="Devise" hint="Verrouillée après la première transaction (RG-ORG-003)">
              <select className="select" value={form.devise} onChange={set('devise')} disabled={app?.hasTransactions}>
                <option value="XAF">Franc CFA (XAF)</option>
                <option value="XOF">Franc CFA UEMOA (XOF)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </FormField>
            <FormField label="Plafond de cumul de postes" hint="Max de postes simultanés par membre (RG-ORG-010)">
              <input type="number" className="input" value={form.plafondCumulPostes} onChange={set('plafondCumulPostes')} />
            </FormField>
            <FormField label="Nb signataires requis pour un PV" hint="Entre 2 et 7 (RG-ORG-013 / RG-REU-022)">
              <input type="number" min={2} max={7} className="input" value={form.nbSignatairesPV} onChange={set('nbSignatairesPV')} />
            </FormField>
          </div>
        </SectionCard>
      )}

      {tab === 'financier' && (
        <SectionCard title="Seuils et taux financiers">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Seuil d'approbation Président (FCFA)" hint="Au-delà, validation du Président requise (RG-ORG-012)">
              <input type="number" className="input" value={form.seuilApprobationPret} onChange={set('seuilApprobationPret')} />
            </FormField>
            <FormField label="Durée maximale d'un prêt (mois)" hint="RG-PRT-006">
              <input type="number" className="input" value={form.dureeMaxPretMois} onChange={set('dureeMaxPretMois')} />
            </FormField>
          </div>
          <p className="text-xs text-ink-600/50 mt-3">
            Le taux de pénalité de retard sur prêt (RG-PRT-020) est propre à chaque caisse, pas global à l'association — il n'est donc pas réglable ici.
          </p>
        </SectionCard>
      )}

      {tab === 'reunions' && (
        <SectionCard title="Rappels et présence">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Canaux de rappel automatiques" hint="RG-REU-007">
              <div className="flex gap-4 pt-2">
                {[['delaiRappelJ7', 'J-7'], ['delaiRappelJ3', 'J-3'], ['delaiRappelJ1', 'J-1']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-ink-700">
                    <input type="checkbox" checked={form[k]} onChange={setBool(k)} /> {l}
                  </label>
                ))}
              </div>
            </FormField>
          </div>
          <p className="text-xs text-ink-600/50 mt-3">
            Les seuils de retard aux réunions (RG-REU-017) se règlent par palier dans la configuration des types de sanction, pas ici.
          </p>
        </SectionCard>
      )}

      <div className="flex items-center gap-2 text-xs text-ink-600/50">
        <Badge variant="gray">Association active</Badge>
        <span>Ces paramètres s'appliquent uniquement à {app?.currentAssociation?.nom || 'votre association'} — aucun partage entre associations (RG-ORG-015).</span>
      </div>
    </div>
  );
}
