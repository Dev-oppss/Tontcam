import { useState } from 'react';
import { Gavel, Plus, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../data/mockData';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';

const TYPES = ['Financier', 'Règlement', 'Calendrier tontine', 'Sortie de défaut', 'Autre'];

const EMPTY = {
  objet: '', description: '', type: 'Autre',
  dateAG: new Date().toISOString().split('T')[0],
  pour: '', contre: '', abstentions: '', quorumPresent: '',
};

export default function DecisionsAG() {
  const { decisionsAG = [], addDecisionAG, membres = [] } = useApp();
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const adopte = (d) => Number(d.pour) > Number(d.contre);

  const handleAdd = () => {
    if (!form.objet.trim()) return;
    addDecisionAG?.({
      ...form,
      pour: Number(form.pour) || 0,
      contre: Number(form.contre) || 0,
      abstentions: Number(form.abstentions) || 0,
      quorumPresent: Number(form.quorumPresent) || 0,
      numero: `AG-${new Date(form.dateAG).getFullYear()}-${String(decisionsAG.length + 1).padStart(3, '0')}`,
    });
    setAdd(false);
    setForm(EMPTY);
  };

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
            <td className="td"><Badge variant="gray">{d.type}</Badge></td>
            <td className="td text-ink-600/60">{fmtDate(d.dateAG)}</td>
            <td className="td">
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} />{d.pour}</span>
                <span className="flex items-center gap-1 text-red-600"><XCircle size={12} />{d.contre}</span>
                <span className="flex items-center gap-1 text-ink-500"><MinusCircle size={12} />{d.abstentions}</span>
              </div>
            </td>
            <td className="td num text-ink-600/60">{d.quorumPresent}</td>
            <td className="td"><Badge variant={adopte(d) ? 'green' : 'red'}>{adopte(d) ? 'Adoptée' : 'Rejetée'}</Badge></td>
          </tr>
        ))}
        {decisionsAG.length === 0 && (
          <tr><td colSpan={7} className="td text-center text-ink-600/40 py-8">Aucune décision enregistrée</td></tr>
        )}
      </Table>

      <Modal open={add} onClose={() => setAdd(false)} title="Nouvelle décision d'AG"
        footer={<>
          <button onClick={() => setAdd(false)} className="btn-secondary">Annuler</button>
          <button onClick={handleAdd} className="btn-primary"><Gavel size={14} />Enregistrer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Objet de la décision" required>
            <input className="input" value={form.objet} onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))} placeholder="Ex : Révision du règlement intérieur" />
          </FormField>
          <FormField label="Description">
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Type" required>
              <select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Date de l'AG" required>
              <input type="date" className="input" value={form.dateAG} onChange={(e) => setForm((f) => ({ ...f, dateAG: e.target.value }))} />
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
          {form.type === 'Financier' && (
            <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 text-xs text-amber-800">
              Une décision financière prend effet au prochain cycle suivant son adoption (RG-SOC-013).
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
