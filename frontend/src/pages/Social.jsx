import { useState, useMemo } from 'react';
import { HeartHandshake, Plus, Paperclip, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate } from '../data/mockData';
import { PageHeader, SectionCard, Table, Badge, Modal, FormField } from '../components/ui/index';

const CATEGORIES = [
  { code: 'naissance',      label: 'Naissance',            delaiJours: 30, param: 'aideNaissance' },
  { code: 'mariage',        label: 'Mariage',               delaiJours: 30, param: 'aideMariage' },
  { code: 'maladie',        label: 'Maladie',                delaiJours: 15, param: null },
  { code: 'deces_membre',   label: 'Décès (membre)',        delaiJours: 7,  param: 'aideDecesMembre' },
  { code: 'deces_famille',  label: 'Décès (famille proche)', delaiJours: 7,  param: 'aideDecesFamille' },
  { code: 'autre',          label: 'Autre',                  delaiJours: 30, param: null },
];

const EMPTY = { idMembre: '', categorie: 'naissance', montant: '', description: '', justificatif: '', dateDeclaration: new Date().toISOString().split('T')[0] };

export default function Social() {
  const { membres = [], aidesSociales = [], addAideSociale, validerAideSociale, parametres = {} } = useApp();
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const maxParCategorieAn = Number(parametres.maxAidesParCategorieAn || 3);
  const anneeEnCours = new Date().getFullYear();

  const nbDejaAccorde = (idMembre, categorie) =>
    aidesSociales.filter((a) => a.idMembre === Number(idMembre) && a.categorie === categorie && new Date(a.dateDeclaration).getFullYear() === anneeEnCours).length;

  const montantSuggere = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.code === form.categorie);
    return cat?.param ? Number(parametres[cat.param] || 0) : '';
  }, [form.categorie, parametres]);

  const enAttente = aidesSociales.filter((a) => a.statut === 'en_attente');
  const versees = aidesSociales.filter((a) => a.statut === 'versee');
  const totalVerse = versees.reduce((s, a) => s + Number(a.montant), 0);

  const handleAdd = () => {
    if (!form.idMembre || !form.categorie) return;
    if (nbDejaAccorde(form.idMembre, form.categorie) >= maxParCategorieAn) return; // garde-fou RG-SOC-010
    const m = membres.find((x) => x.id === Number(form.idMembre));
    addAideSociale?.({
      ...form,
      idMembre: Number(form.idMembre),
      nomMembre: `${m?.nom || ''} ${m?.prenom || ''}`.trim(),
      montant: Number(form.montant || montantSuggere || 0),
      statut: 'en_attente',
    });
    setAdd(false);
    setForm(EMPTY);
  };

  const limiteAtteinte = form.idMembre && nbDejaAccorde(form.idMembre, form.categorie) >= maxParCategorieAn;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volet Social"
        subtitle="Barème des aides, déclaration et suivi (RG-SOC-001 à 010)"
        action={<button onClick={() => setAdd(true)} className="btn-primary"><Plus size={15} />Déclarer un événement</button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-lg font-mono font-semibold text-ink-900">{enAttente.length}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">En attente de validation</p>
        </div>
        <div className="card text-center">
          <p className="text-lg font-mono font-semibold text-ink-900">{versees.length}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Aides versées ({anneeEnCours})</p>
        </div>
        <div className="card text-center col-span-2">
          <p className="text-lg font-mono font-semibold text-indigo-700">{fmt(totalVerse)}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Total versé cette année</p>
        </div>
      </div>

      <SectionCard title="Barème par catégorie" subtitle="Défini en AG, modifiable dans Paramètres → Social">
        <div className="grid sm:grid-cols-3 gap-3">
          {CATEGORIES.map((c) => (
            <div key={c.code} className="rounded-xl bg-white/40 border border-white/50 p-3">
              <p className="text-sm font-semibold text-ink-900">{c.label}</p>
              <p className="text-xs text-ink-600/50 mt-1">Délai max : {c.delaiJours}j · Max {maxParCategorieAn}/an</p>
              {c.param && <p className="font-mono text-sm font-semibold text-indigo-700 mt-1">{fmt(parametres[c.param] || 0)}</p>}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Demandes" className="p-0 overflow-hidden">
        <Table headers={['Membre', 'Catégorie', 'Montant', 'Justificatif', 'Date', 'Statut', 'Action']}>
          {aidesSociales.map((a) => (
            <tr key={a.id} className="hover:bg-white/40 transition-colors">
              <td className="td font-medium">{a.nomMembre}</td>
              <td className="td">{CATEGORIES.find((c) => c.code === a.categorie)?.label || a.categorie}</td>
              <td className="td num font-semibold">{fmt(a.montant)}</td>
              <td className="td">
                {a.justificatif ? <span className="flex items-center gap-1 text-xs text-indigo-600"><Paperclip size={12} />Joint</span> : <span className="text-xs text-red-500">Manquant</span>}
              </td>
              <td className="td text-ink-600/60">{fmtDate(a.dateDeclaration)}</td>
              <td className="td"><Badge variant={a.statut === 'versee' ? 'green' : 'amber'}>{a.statut === 'versee' ? 'Versée' : 'En attente'}</Badge></td>
              <td className="td">
                {a.statut === 'en_attente' && (
                  <button onClick={() => validerAideSociale?.(a.id)} className="btn-primary py-1 px-2.5 text-xs"><CheckCircle2 size={12} />Valider</button>
                )}
              </td>
            </tr>
          ))}
          {aidesSociales.length === 0 && (
            <tr><td colSpan={7} className="td text-center text-ink-600/40 py-8">Aucune demande enregistrée</td></tr>
          )}
        </Table>
      </SectionCard>

      <Modal open={add} onClose={() => setAdd(false)} title="Déclarer un événement social"
        footer={<>
          <button onClick={() => setAdd(false)} className="btn-secondary">Annuler</button>
          <button onClick={handleAdd} disabled={limiteAtteinte} className="btn-primary"><HeartHandshake size={14} />Déclarer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Membre" required>
            <select className="select" value={form.idMembre} onChange={(e) => setForm((f) => ({ ...f, idMembre: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {membres.map((m) => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
            </select>
          </FormField>
          <FormField label="Catégorie" required>
            <select className="select" value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </FormField>
          {limiteAtteinte && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700 flex items-center gap-1.5">
              <Clock size={12} /> Limite de {maxParCategorieAn} aides/an atteinte pour cette catégorie (RG-SOC-010).
            </div>
          )}
          <FormField label="Montant (FCFA)" hint={montantSuggere ? `Barème suggéré : ${fmt(montantSuggere)}` : 'Montant variable, à saisir'}>
            <input type="number" className="input" placeholder={montantSuggere || ''} value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Justificatif" required hint="Certificat, acte — obligatoire (RG-SOC-006)">
            <input type="file" className="input" onChange={(e) => setForm((f) => ({ ...f, justificatif: e.target.files?.[0]?.name || '' }))} />
          </FormField>
          <FormField label="Date de déclaration">
            <input type="date" className="input" value={form.dateDeclaration} onChange={(e) => setForm((f) => ({ ...f, dateDeclaration: e.target.value }))} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
