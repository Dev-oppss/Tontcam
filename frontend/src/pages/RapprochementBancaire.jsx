import { useState } from 'react';
import { Landmark, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate } from '../data/mockData';
import { PageHeader, SectionCard, Table, Badge, Modal, FormField } from '../components/ui/index';

const EMPTY = { idCaisse: '', soldeReleve: '', dateReleve: new Date().toISOString().split('T')[0], commentaire: '' };

const joursDepuis = (date) => Math.floor((Date.now() - new Date(date).getTime()) / 86400000);

export default function RapprochementBancaire() {
  const { banques = [], caisses = [], rapprochements = [], addRapprochement, justifierEcart } = useApp();
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [justifModal, setJustifModal] = useState(null);
  const [motif, setMotif] = useState('');

  // Dans ce modèle frontend, toute caisse peut faire l'objet d'un rapprochement
  // bancaire (pas d'entité "compte bancaire" séparée pour l'instant — à affiner
  // côté backend avec la table comptes_bancaires du schéma SQL).
  const caissesBancaires = caisses.length ? caisses : banques;

  const handleAdd = () => {
    if (!form.idCaisse || form.soldeReleve === '') return;
    const c = caissesBancaires.find((x) => x.id === form.idCaisse);
    const soldeLogiciel = Number(c?.totalSolde || 0);
    const ecart = Number(form.soldeReleve) - soldeLogiciel;
    addRapprochement?.({
      idCaisse: form.idCaisse,
      nomCaisse: c?.nom || c?.libelle,
      soldeLogiciel,
      soldeReleve: Number(form.soldeReleve),
      ecart,
      dateReleve: form.dateReleve,
      statut: ecart === 0 ? 'ok' : 'ecart',
    });
    setAdd(false);
    setForm(EMPTY);
  };

  const handleJustifier = () => {
    if (!justifModal || !motif.trim()) return;
    justifierEcart?.(justifModal.id, motif);
    setJustifModal(null);
    setMotif('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapprochement bancaire"
        subtitle="Compare le solde logiciel au relevé bancaire importé (RG-CAI-017 à 019)"
        action={<button onClick={() => setAdd(true)} className="btn-primary"><Plus size={15} />Nouveau relevé</button>}
      />

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-lg font-mono font-semibold text-ink-900">{rapprochements.filter(r => r.statut === 'ok').length}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Rapprochements OK</p>
        </div>
        <div className="card text-center border-t-4 border-t-amber-400">
          <p className="text-lg font-mono font-semibold text-amber-600">{rapprochements.filter(r => r.statut === 'ecart' && !r.justifie).length}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Écarts à justifier</p>
        </div>
        <div className="card text-center border-t-4 border-t-red-400">
          <p className="text-lg font-mono font-semibold text-red-600">
            {rapprochements.filter(r => r.statut === 'ecart' && !r.justifie && joursDepuis(r.dateReleve) > 30).length}
          </p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Écarts &gt; 30 jours (alerte Président)</p>
        </div>
      </div>

      <SectionCard title="Historique des relevés" className="p-0 overflow-hidden">
        <Table headers={['Caisse', 'Date relevé', 'Solde logiciel', 'Solde relevé', 'Écart', 'Statut']}>
          {rapprochements.map((r) => {
            const enRetard = r.statut === 'ecart' && !r.justifie && joursDepuis(r.dateReleve) > 30;
            return (
              <tr key={r.id} className="hover:bg-white/40 transition-colors">
                <td className="td font-medium">{r.nomCaisse}</td>
                <td className="td text-ink-600/60">{fmtDate(r.dateReleve)}</td>
                <td className="td num">{fmt(r.soldeLogiciel)}</td>
                <td className="td num">{fmt(r.soldeReleve)}</td>
                <td className={`td num font-semibold ${r.ecart === 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.ecart > 0 ? '+' : ''}{fmt(r.ecart)}</td>
                <td className="td">
                  {r.statut === 'ok' ? (
                    <Badge variant="green"><CheckCircle2 size={11} className="inline mr-1" />Conforme</Badge>
                  ) : r.justifie ? (
                    <Badge variant="blue">Justifié</Badge>
                  ) : (
                    <button onClick={() => setJustifModal(r)} className={enRetard ? 'btn-danger py-1 px-2.5 text-xs' : 'btn-secondary py-1 px-2.5 text-xs'}>
                      <AlertTriangle size={12} />{enRetard ? 'En retard — justifier' : 'Justifier'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {rapprochements.length === 0 && (
            <tr><td colSpan={6} className="td text-center text-ink-600/40 py-8">Aucun relevé importé</td></tr>
          )}
        </Table>
      </SectionCard>

      <Modal open={add} onClose={() => setAdd(false)} title="Importer un relevé bancaire"
        footer={<>
          <button onClick={() => setAdd(false)} className="btn-secondary">Annuler</button>
          <button onClick={handleAdd} className="btn-primary"><Landmark size={14} />Comparer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Caisse liée à un compte bancaire" required>
            <select className="select" value={form.idCaisse} onChange={(e) => setForm((f) => ({ ...f, idCaisse: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {caissesBancaires.map((c) => <option key={c.id} value={c.id}>{c.nom || c.libelle}</option>)}
            </select>
          </FormField>
          <FormField label="Solde du relevé bancaire (FCFA)" required>
            <input type="number" className="input" value={form.soldeReleve} onChange={(e) => setForm((f) => ({ ...f, soldeReleve: e.target.value }))} />
          </FormField>
          <FormField label="Date du relevé">
            <input type="date" className="input" value={form.dateReleve} onChange={(e) => setForm((f) => ({ ...f, dateReleve: e.target.value }))} />
          </FormField>
        </div>
      </Modal>

      <Modal open={!!justifModal} onClose={() => setJustifModal(null)} title="Justifier l'écart"
        footer={<>
          <button onClick={() => setJustifModal(null)} className="btn-secondary">Annuler</button>
          <button onClick={handleJustifier} className="btn-primary"><CheckCircle2 size={14} />Valider la justification</button>
        </>}>
        <div className="space-y-4">
          <div className="rounded-xl bg-white/40 border border-white/50 p-3 text-sm">
            Écart de <strong className={justifModal?.ecart > 0 ? 'text-emerald-600' : 'text-red-600'}>{fmt(justifModal?.ecart || 0)}</strong> sur {justifModal?.nomCaisse}
          </div>
          <FormField label="Motif de l'écart" required hint="Validation Trésorier requise (RG-CAI-018)">
            <textarea className="input" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : Frais bancaires non enregistrés, chèque en circulation…" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
