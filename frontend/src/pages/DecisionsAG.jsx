import { useState } from 'react';
import { Gavel, Plus, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../data/mockData';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';

const TYPES = [
  { value: 'financier', label: 'Financier' },
  { value: 'statutaire', label: 'Statutaire' },
  { value: 'disciplinaire', label: 'Disciplinaire' },
  { value: 'organisationnel', label: 'Organisationnel' },
  { value: 'autre', label: 'Autre' },
];

const EMPTY = {
  objet: '', description: '', type: 'organisationnel', idReunion: '',
  dateAG: new Date().toISOString().split('T')[0], dateAGModifiee: false,
  pour: '', contre: '', abstentions: '', quorumPresent: '',
};

// Le backend renvoie un vrai statut ('adopte','rejete','reporte','annule',
// 'en_cours') — l'UI le reflète tel quel au lieu de le recalculer localement
// depuis pour/contre. Deux cas concrets où le recalcul mentait :
// une décision importée depuis l'historique porte le statut réellement
// constaté sur pièce (papier d'archive), pas forcément pour > contre ; et les
// statuts reporte/annule (qui existent en base) n'étaient jamais affichables,
// toujours réduits à Adoptée/Rejetée par le recalcul.
const STATUT_CFG = {
  adopte:   { label: 'Adoptée',  variant: 'green' },
  rejete:   { label: 'Rejetée',  variant: 'red' },
  reporte:  { label: 'Reportée', variant: 'amber' },
  annule:   { label: 'Annulée',  variant: 'gray' },
  en_cours: { label: 'En cours', variant: 'blue' },
};

export default function DecisionsAG() {
  const { decisionsAG = [], addDecisionAG, membres = [], reunions = [], showToast } = useApp();
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);

  // Même règle que Sanctions.jsx (RG-SEA-001) : une décision ne peut être
  // rattachée qu'à une séance ouverte — le backend le refuse sinon
  // (AssertSeanceOuverte, 422). Sans ce filtre, choisir une réunion déjà
  // clôturée/planifiée/annulée n'échouait qu'après clic sur Enregistrer.
  const reunionsOuvertes = reunions.filter((r) => r.statutReunion === 'en_cours');

  const handleAdd = async () => {
    const missing = getMissingFields(form, [
      { key: 'objet', label: 'Objet de la décision' },
      { key: 'idReunion', label: 'Réunion associée' },
      { key: 'type', label: 'Type' },
      { key: 'dateAG', label: "Date d'effet" },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    await addDecisionAG?.(form);
    setAdd(false);
    setForm(EMPTY);
  };
  const [guardedHandleAdd, addingDecision] = useAsyncGuard(handleAdd);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Décisions d'Assemblée Générale"
        subtitle="Registre des votes — archivage définitif, non supprimable (RG-SOC-011/014)"
        action={<button onClick={() => setAdd(true)} className="btn-primary"><Plus size={15} />Nouvelle décision</button>}
      />

      <Table headers={['N°', 'Objet', 'Type', 'Date AG', 'Vote', 'Quorum', 'Résultat']}>
        {decisionsAG.map((d) => (
          <tr key={d.id} className="hover:bg-white/40 transition-colors">
            <td className="td font-mono text-xs">{d.numero}</td>
            <td className="td font-medium max-w-[220px] truncate">{d.objet}</td>
            <td className="td"><Badge variant="gray">{TYPES.find(t => t.value === d.type)?.label || d.type}</Badge></td>
            <td className="td text-ink-600/60">{fmtDate(d.dateAG)}</td>
            <td className="td">
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} />{d.pour}</span>
                <span className="flex items-center gap-1 text-red-600"><XCircle size={12} />{d.contre}</span>
                <span className="flex items-center gap-1 text-ink-500"><MinusCircle size={12} />{d.abstentions}</span>
              </div>
            </td>
            <td className="td num text-ink-600/60">{d.quorumPresent}</td>
            <td className="td"><Badge variant={(STATUT_CFG[d.statut] || STATUT_CFG.rejete).variant}>{(STATUT_CFG[d.statut] || STATUT_CFG.rejete).label}</Badge></td>
          </tr>
        ))}
        {decisionsAG.length === 0 && (
          <tr><td colSpan={7} className="td text-center text-ink-600/40 py-8">Aucune décision enregistrée</td></tr>
        )}
      </Table>

      <Modal open={add} onClose={() => setAdd(false)} title="Nouvelle décision d'AG"
        footer={<>
          <button onClick={() => setAdd(false)} className="btn-secondary">Annuler</button>
          <button onClick={guardedHandleAdd} disabled={addingDecision} className="btn-primary"><Gavel size={14} />{addingDecision ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Objet de la décision" required>
            <input className="input" value={form.objet} onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))} placeholder="Ex : Révision du règlement intérieur" />
          </FormField>
          <FormField label="Description">
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Réunion associée" required hint={reunionsOuvertes.length === 0 ? 'Aucune séance ouverte actuellement.' : undefined}>
            <select className="select" value={form.idReunion} onChange={(e) => {
              const r = reunionsOuvertes.find((x) => x.id === e.target.value);
              setForm((f) => ({
                ...f,
                idReunion: e.target.value,
                // Pré-remplit la date d'effet avec la date de la réunion (le cas le
                // plus courant), sans écraser une valeur déjà modifiée à la main.
                dateAG: (r?.date && !f.dateAGModifiee) ? r.date : f.dateAG,
              }));
            }}>
              <option value="">Sélectionner…</option>
              {reunionsOuvertes.map((r) => (
                <option key={r.id} value={r.id}>N°{r.numReunion} — {r.date}</option>
              ))}
            </select>
          </FormField>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Type" required>
              <select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Date d'effet" hint="Pré-remplie avec la date de la réunion — modifiable si la décision prend effet à une autre date.">
              <input type="date" className="input" value={form.dateAG} onChange={(e) => setForm((f) => ({ ...f, dateAG: e.target.value, dateAGModifiee: true }))} />
            </FormField>
          </div>
          <p className="label !mb-2">Résultat du vote (RG-SOC-012)</p>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Pour"><input type="number" className="input" value={form.pour} onChange={(e) => setForm((f) => ({ ...f, pour: e.target.value }))} /></FormField>
            <FormField label="Contre"><input type="number" className="input" value={form.contre} onChange={(e) => setForm((f) => ({ ...f, contre: e.target.value }))} /></FormField>
            <FormField label="Abstentions"><input type="number" className="input" value={form.abstentions} onChange={(e) => setForm((f) => ({ ...f, abstentions: e.target.value }))} /></FormField>
          </div>
          <FormField label="Quorum présent" hint={`Total membres actifs : ${membres.filter(m => m.statut === 'actif').length}`}>
            <input type="number" className="input" value={form.quorumPresent} onChange={(e) => setForm((f) => ({ ...f, quorumPresent: e.target.value }))} />
          </FormField>
          {form.type === 'financier' && (
            <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 text-xs text-amber-800">
              Une décision financière prend effet au prochain cycle suivant son adoption (RG-SOC-013) — ajustez la date d'effet ci-dessus en conséquence si besoin, elle n'est pas calculée automatiquement.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
