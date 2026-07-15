import { useState, useMemo } from 'react';
import { HeartHandshake, Plus, Paperclip, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate } from '../data/mockData';
import { PageHeader, SectionCard, Table, Badge, Modal, FormField } from '../components/ui/index';

const LABELS_EVENEMENT = {
  naissance: 'Naissance', mariage: 'Mariage', maladie: 'Maladie',
  deces_membre: 'Décès (membre)', deces_famille: 'Décès (famille proche)', autre: 'Autre',
};

const EMPTY = { idMembre: '', categorie: '', montant: '', description: '', justificatif: '', dateDeclaration: new Date().toISOString().split('T')[0] };
const EMPTY_TYPE = { libelle: '', typeEvenement: 'naissance', montantFixe: '', caisseSourceId: '', nbMaxParAn: 3 };

export default function Social() {
  const { membres = [], aidesSociales = [], addAideSociale, addAide, validerAideSociale, typesAideSociale = [], addTypeAideSociale, caisses = [], parametres = {} } = useApp();
  const [add, setAdd] = useState(false);
  const [addType, setAddType] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);

  const creerAide = addAideSociale || addAide;
  const maxParCategorieAn = Number(parametres.maxAidesParCategorieAn || 3);
  const anneeEnCours = new Date().getFullYear();

  const nbDejaAccorde = (idMembre, typeId) =>
    aidesSociales.filter((a) => a.idMembre === Number(idMembre) && a.typeEvenement === typeId && new Date(a.dateDeclaration).getFullYear() === anneeEnCours).length;

  const typeSelectionne = useMemo(() => typesAideSociale.find((t) => t.id === form.categorie), [form.categorie, typesAideSociale]);
  const montantSuggere = typeSelectionne?.montantFixe || '';

  const enAttente = aidesSociales.filter((a) => a.statut === 'en_attente');
  const versees = aidesSociales.filter((a) => a.statut === 'verse' || a.statut === 'versee');
  const totalVerse = versees.reduce((s, a) => s + Number(a.montantAide || a.montant || 0), 0);

  const handleAdd = () => {
    if (!form.idMembre || !form.categorie) return;
    if (nbDejaAccorde(form.idMembre, form.categorie) >= (typeSelectionne?.nbMaxParAn || maxParCategorieAn)) return;
    creerAide({ ...form, typeEvenement: form.categorie, montantAide: Number(form.montant || montantSuggere || 0) });
    setAdd(false);
    setForm(EMPTY);
  };

  const handleAddType = () => {
    if (!typeForm.libelle.trim() || !typeForm.caisseSourceId) return;
    addTypeAideSociale(typeForm);
    setAddType(false);
    setTypeForm(EMPTY_TYPE);
  };

  const limiteAtteinte = form.idMembre && form.categorie && nbDejaAccorde(form.idMembre, form.categorie) >= (typeSelectionne?.nbMaxParAn || maxParCategorieAn);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volet Social"
        subtitle="Barème des aides, déclaration et suivi (RG-SOC-001 à 010)"
        action={
          <div className="flex gap-2">
            <button onClick={() => setAddType(true)} className="btn-secondary"><Plus size={15} />Nouveau barème</button>
            <button onClick={() => setAdd(true)} className="btn-primary" disabled={typesAideSociale.length === 0}><Plus size={15} />Déclarer un événement</button>
          </div>
        }
      />

      {typesAideSociale.length === 0 && (
        <div className="card border-l-4 border-l-amber-400 text-sm text-ink-700">
          Aucun barème configuré. Crée d'abord un type d'aide (ex: Naissance — 25 000 FCFA) avant de pouvoir déclarer un événement.
        </div>
      )}

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

      <SectionCard title="Barème par catégorie" subtitle="Défini en AG — chaque type est rattaché à une caisse source réelle">
        {typesAideSociale.length === 0 ? (
          <p className="text-sm text-ink-600/50 italic py-4 text-center">Aucun type d'aide créé pour le moment.</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {typesAideSociale.map((t) => (
              <div key={t.id} className="rounded-xl bg-white/40 border border-white/50 p-3">
                <p className="text-sm font-semibold text-ink-900">{t.libelle}</p>
                <p className="text-xs text-ink-600/50 mt-1">{LABELS_EVENEMENT[t.typeEvenement] || t.typeEvenement} · Max {t.nbMaxParAn || 3}/an</p>
                <p className="font-mono text-sm font-semibold text-indigo-700 mt-1">{fmt(t.montantFixe || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Demandes" className="p-0 overflow-hidden">
        <Table headers={['Membre', 'Catégorie', 'Montant', 'Justificatif', 'Date', 'Statut', 'Action']}>
          {aidesSociales.map((a) => (
            <tr key={a.id} className="hover:bg-white/40 transition-colors">
              <td className="td font-medium">{a.nomMembre}</td>
              <td className="td">{typesAideSociale.find((t) => t.id === a.typeEvenement)?.libelle || LABELS_EVENEMENT[a.typeEvenement] || a.typeEvenement}</td>
              <td className="td num font-semibold">{fmt(a.montantAide)}</td>
              <td className="td">
                {a.justificatif ? <span className="flex items-center gap-1 text-xs text-indigo-600"><Paperclip size={12} />Joint</span> : <span className="text-xs text-red-500">Manquant</span>}
              </td>
              <td className="td text-ink-600/60">{fmtDate(a.dateEvenement)}</td>
              <td className="td"><Badge variant={a.statut === 'verse' ? 'green' : 'amber'}>{a.statut === 'verse' ? 'Versée' : 'En attente'}</Badge></td>
              <td className="td">
                {a.statut === 'en_attente' && validerAideSociale && (
                  <button onClick={() => validerAideSociale(a.id)} className="btn-primary py-1 px-2.5 text-xs"><CheckCircle2 size={12} />Valider</button>
                )}
              </td>
            </tr>
          ))}
          {aidesSociales.length === 0 && (
            <tr><td colSpan={7} className="td text-center text-ink-600/40 py-8">Aucune demande enregistrée</td></tr>
          )}
        </Table>
      </SectionCard>

      <Modal open={addType} onClose={() => setAddType(false)} title="Nouveau barème d'aide sociale"
        footer={<>
          <button onClick={() => setAddType(false)} className="btn-secondary">Annuler</button>
          <button onClick={handleAddType} className="btn-primary"><HeartHandshake size={14} />Créer</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Libellé" required>
            <input className="input" value={typeForm.libelle} onChange={(e) => setTypeForm((f) => ({ ...f, libelle: e.target.value }))} placeholder="Ex : Aide naissance" />
          </FormField>
          <FormField label="Type d'événement" required>
            <select className="select" value={typeForm.typeEvenement} onChange={(e) => setTypeForm((f) => ({ ...f, typeEvenement: e.target.value }))}>
              {Object.entries(LABELS_EVENEMENT).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </FormField>
          <FormField label="Caisse source" required>
            <select className="select" value={typeForm.caisseSourceId} onChange={(e) => setTypeForm((f) => ({ ...f, caisseSourceId: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </FormField>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Montant fixe (FCFA)">
              <input type="number" className="input" value={typeForm.montantFixe} onChange={(e) => setTypeForm((f) => ({ ...f, montantFixe: e.target.value }))} />
            </FormField>
            <FormField label="Max par an">
              <input type="number" className="input" value={typeForm.nbMaxParAn} onChange={(e) => setTypeForm((f) => ({ ...f, nbMaxParAn: e.target.value }))} />
            </FormField>
          </div>
        </div>
      </Modal>

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
              <option value="">Sélectionner…</option>
              {typesAideSociale.map((t) => <option key={t.id} value={t.id}>{t.libelle}</option>)}
            </select>
          </FormField>
          {limiteAtteinte && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700 flex items-center gap-1.5">
              <Clock size={12} /> Limite d'aides/an atteinte pour cette catégorie (RG-SOC-010).
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
