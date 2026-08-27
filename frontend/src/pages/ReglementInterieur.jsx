import { useState } from 'react';
import { FileText, Upload, CheckCircle2, History } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../data/mockData';
import { resolveApiUrl } from '../lib/api';
import { PageHeader, SectionCard, Table, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';

const EMPTY = { version: '', dateAdoption: new Date().toISOString().split('T')[0], decisionAG: '', fichier: '', notes: '' };

export default function ReglementInterieur() {
  const { reglements = [], addReglement, decisionsAG = [], showToast } = useApp();
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const actif = reglements.find((r) => r.estActif) ||
    reglements.slice().sort((a, b) => new Date(b.dateAdoption) - new Date(a.dateAdoption))[0];

  const handleAdd = async () => {
    const missing = getMissingFields(form, [
      { key: 'version', label: 'Numéro de version' },
      { key: 'fichier', label: 'Document PDF' },
      { key: 'decisionAG', label: "Décision d'AG associée" },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    // Toute modification nécessite une décision AG enregistrée avant publication (RG-ORG-006)
    try {
      await addReglement?.({ ...form });
      setAdd(false);
      setForm(EMPTY);
    } catch { /* L'erreur est affichée par le contexte et le formulaire reste ouvert. */ }
  };
  const [guardedHandleAdd, publishing] = useAsyncGuard(handleAdd);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Règlement intérieur"
        subtitle="Versionné — la version active est celle adoptée la plus récente (RG-ORG-005/006)"
        action={<button onClick={() => setAdd(true)} className="btn-primary"><Upload size={15} />Nouvelle version</button>}
      />

      {actif && (
        <SectionCard title="Version en vigueur" subtitle={`Adoptée le ${fmtDate(actif.dateAdoption)}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink-900">Version {actif.version}</p>
              <a href={resolveApiUrl(actif.fichier)} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 mt-0.5 hover:underline">Consulter le PDF</a>
            </div>
            <Badge variant="green"><CheckCircle2 size={11} className="inline mr-1" />Adopté</Badge>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Historique des versions" className="p-0 overflow-hidden">
        <Table headers={['Version', 'Date adoption', 'Décision AG', 'Fichier', 'Statut']}>
          {reglements.slice().sort((a, b) => new Date(b.dateAdoption) - new Date(a.dateAdoption)).map((r) => (
            <tr key={r.id} className="hover:bg-white/40 transition-colors">
              <td className="td font-semibold">{r.version}</td>
              <td className="td text-ink-600/60">{fmtDate(r.dateAdoption)}</td>
              <td className="td font-mono text-xs">{r.decisionAG || '—'}</td>
              <td className="td text-indigo-600 text-xs truncate max-w-[160px]"><a href={resolveApiUrl(r.fichier)} target="_blank" rel="noreferrer" className="hover:underline">Consulter le PDF</a></td>
              <td className="td"><Badge variant={r === actif ? 'green' : 'gray'}>{r === actif ? 'Actif' : 'Archivé'}</Badge></td>
            </tr>
          ))}
          {reglements.length === 0 && (
            <tr><td colSpan={5} className="td text-center text-ink-600/40 py-8">Aucune version enregistrée</td></tr>
          )}
        </Table>
      </SectionCard>

      <Modal open={add} onClose={() => setAdd(false)} title="Publier une nouvelle version"
        footer={<>
          <button onClick={() => setAdd(false)} className="btn-secondary">Annuler</button>
          <button onClick={guardedHandleAdd} disabled={publishing} className="btn-primary"><Upload size={14} />{publishing ? 'Publication…' : 'Publier'}</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Numéro de version" required>
            <input className="input" placeholder="Ex : 2.1" value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
          </FormField>
          <FormField label="Décision d'AG associée" required hint="Requis avant publication (RG-ORG-006)">
            <select className="select" value={form.decisionAG} onChange={(e) => setForm((f) => ({ ...f, decisionAG: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {decisionsAG.filter((d) => d.type === 'statutaire' && d.statut === 'adopte').map((d) => (
                <option key={d.id} value={d.numero}>{d.numero} — {d.objet}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Date d'adoption">
            <input type="date" className="input" value={form.dateAdoption} onChange={(e) => setForm((f) => ({ ...f, dateAdoption: e.target.value }))} />
          </FormField>
          <FormField label="Document PDF" required>
            <input type="file" accept="application/pdf" className="input" onChange={(e) => { const file = e.target.files?.[0]; setForm((f) => ({ ...f, fichier: file?.name || '', fichierFile: file || null })); }} />
          </FormField>
          <FormField label="Notes de version">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </FormField>
          {!form.decisionAG && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5"><History size={12} />Sans décision d'AG liée, cette version ne peut pas être publiée.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
