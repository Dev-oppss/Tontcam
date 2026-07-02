import { useState } from 'react';
import { SlidersHorizontal, Save, Wallet, Users2, CalendarClock, ShieldAlert, HeartHandshake } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, SectionCard, FormField, Badge } from '../components/ui/index';

const TABS = [
  { id: 'general',   label: 'Général',   icon: SlidersHorizontal },
  { id: 'financier', label: 'Financier', icon: Wallet },
  { id: 'reunions',  label: 'Réunions',  icon: CalendarClock },
  { id: 'sanctions', label: 'Sanctions', icon: ShieldAlert },
  { id: 'social',    label: 'Social',    icon: HeartHandshake },
];

const DEFAULTS = {
  devise: 'XAF',
  seuilApprobationPret: 200000,
  tauxPenaliteRetard: 2,
  dureeMaxPretMois: 12,
  nbSignatairesPV: 3,
  delaiRappelJ7: true,
  delaiRappelJ3: true,
  delaiRappelJ1: true,
  toleranceRetardMinutes: 15,
  seuilSuspensionSanctions: 25000,
  cyclesImpayesAvantSuspension: 3,
  plafondCumulPostes: 2,
  aideNaissance: 25000,
  aideMariage: 50000,
  aideDecesMembre: 150000,
  aideDecesFamille: 75000,
  maxAidesParCategorieAn: 3,
};

export default function Parametres() {
  const app = useApp();
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({ ...DEFAULTS, ...(app?.parametres || {}) });
  const [saved, setSaved] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBool = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  const handleSave = async () => {
    if (app?.updateParametres) await app.updateParametres(form);
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
            <FormField label="Nb signataires requis pour un PV" hint="Entre 2 et 5 (RG-ORG-013 / RG-REU-022)">
              <input type="number" min={2} max={5} className="input" value={form.nbSignatairesPV} onChange={set('nbSignatairesPV')} />
            </FormField>
          </div>
        </SectionCard>
      )}

      {tab === 'financier' && (
        <SectionCard title="Seuils et taux financiers">
          <div className="grid sm:grid-cols-3 gap-4">
            <FormField label="Seuil d'approbation Président (FCFA)" hint="Au-delà, validation du Président requise (RG-ORG-012)">
              <input type="number" className="input" value={form.seuilApprobationPret} onChange={set('seuilApprobationPret')} />
            </FormField>
            <FormField label="Taux de pénalité de retard (%/mois)" hint="RG-PRT-020">
              <input type="number" step="0.1" className="input" value={form.tauxPenaliteRetard} onChange={set('tauxPenaliteRetard')} />
            </FormField>
            <FormField label="Durée maximale d'un prêt (mois)" hint="RG-PRT-006">
              <input type="number" className="input" value={form.dureeMaxPretMois} onChange={set('dureeMaxPretMois')} />
            </FormField>
          </div>
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
            <FormField label="Tolérance de retard (minutes)" hint="Au-delà, le membre est marqué en retard (RG-REU-017)">
              <input type="number" className="input" value={form.toleranceRetardMinutes} onChange={set('toleranceRetardMinutes')} />
            </FormField>
          </div>
        </SectionCard>
      )}

      {tab === 'sanctions' && (
        <SectionCard title="Seuils de suspension">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Seuil de sanctions cumulées avant alerte (FCFA)" hint="RG-SAN-017">
              <input type="number" className="input" value={form.seuilSuspensionSanctions} onChange={set('seuilSuspensionSanctions')} />
            </FormField>
            <FormField label="Cycles impayés avant suspension possible" hint="RG-SAN-015">
              <input type="number" className="input" value={form.cyclesImpayesAvantSuspension} onChange={set('cyclesImpayesAvantSuspension')} />
            </FormField>
          </div>
        </SectionCard>
      )}

      {tab === 'social' && (
        <SectionCard title="Barème des aides sociales" subtitle="Défini en AG, versionné (RG-SOC-001 à 003)">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Aide naissance (FCFA)"><input type="number" className="input" value={form.aideNaissance} onChange={set('aideNaissance')} /></FormField>
            <FormField label="Aide mariage (FCFA)"><input type="number" className="input" value={form.aideMariage} onChange={set('aideMariage')} /></FormField>
            <FormField label="Aide décès (membre) (FCFA)"><input type="number" className="input" value={form.aideDecesMembre} onChange={set('aideDecesMembre')} /></FormField>
            <FormField label="Aide décès (famille proche) (FCFA)"><input type="number" className="input" value={form.aideDecesFamille} onChange={set('aideDecesFamille')} /></FormField>
            <FormField label="Max aides par catégorie / an" hint="RG-SOC-010"><input type="number" className="input" value={form.maxAidesParCategorieAn} onChange={set('maxAidesParCategorieAn')} /></FormField>
          </div>
        </SectionCard>
      )}

      <div className="flex items-center gap-2 text-xs text-ink-600/50">
        <Badge variant="gray">Association active</Badge>
        <span>Ces paramètres s'appliquent uniquement à {app?.currentAssociation?.nom || 'votre association'} — aucun partage entre associations (RG-ORG-015).</span>
      </div>
    </div>
  );
}
