import { useState } from 'react';
import { HeartHandshake, Plus, Paperclip, CheckCircle2, XCircle, Clock, Wallet, Settings2, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate } from '../data/mockData';
import { PageHeader, SectionCard, Table, Badge, Modal, FormField } from '../components/ui/index';
import { ModePaiementFields, isModePaiementValid, ModePaiementBadge } from '../components/ui/ModePaiement';
import { useAsyncGuard } from '../hooks/useAsyncGuard';

const CATEGORIES = [
  { code: 'naissance',      label: 'Naissance',            delaiJours: 30, param: 'aideNaissance' },
  { code: 'mariage',        label: 'Mariage',               delaiJours: 30, param: 'aideMariage' },
  { code: 'maladie',        label: 'Maladie',                delaiJours: 15, param: null },
  { code: 'deces_membre',   label: 'Décès (membre)',        delaiJours: 7,  param: 'aideDecesMembre' },
  { code: 'deces_famille',  label: 'Décès (famille proche)', delaiJours: 7,  param: 'aideDecesFamille' },
  { code: 'scolarite',      label: 'Scolarité',              delaiJours: 30, param: null },
  { code: 'autre',          label: 'Autre',                  delaiJours: 30, param: null },
];

const EMPTY_TYPE = { libelle: '', typeEvenement: 'naissance', montantFixe: '', nbMaxVie: '' };

const EMPTY = { idMembre: '', categorie: '', montant: '', description: '', justificatif: '', dateDeclaration: new Date().toISOString().split('T')[0] };

export default function Social() {
  const {
    membres = [], aidesSociales = [], addAideSociale, validerAideSociale, verserAideSociale,
    typesAideSociale = [], addTypeAideSociale, updateTypeAideSociale, deleteTypeAideSociale,
    banques = [], parametres = {}, showToast,
  } = useApp();
  const [add, setAdd] = useState(false);
  const [addType, setAddType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);
  const [verserModal, setVerserModal] = useState(null);
  const [verserMode, setVerserMode] = useState('especes');
  const [verserDetails, setVerserDetails] = useState('');
  const [verserCaisse, setVerserCaisse] = useState('');
  const [form, setForm] = useState(EMPTY);

  const maxParCategorieAn = Number(parametres.maxAidesParCategorieAn || 3);
  const anneeEnCours = new Date().getFullYear();

  const nbDejaAccorde = (idMembre, categorie) =>
    aidesSociales.filter((a) => a.idMembre === idMembre && a.categorie === categorie && new Date(a.dateDeclaration).getFullYear() === anneeEnCours).length;

  // Le type sélectionné dans le formulaire EST désormais un vrai type paramétré
  // (typesAideSociale), pas juste un code de catégorie brut — cohérent avec le
  // barème réellement configuré (RG-SOC), et évite l'erreur "aucun barème configuré".
  const typeSelectionne = typesAideSociale.find((t) => t.id === form.categorie);
  const montantSuggere = Number(typeSelectionne?.montantFixe || 0) || '';

  const enAttente = aidesSociales.filter((a) => a.statut === 'demandee');
  const versees = aidesSociales.filter((a) => a.statut === 'versee');
  const totalVerse = versees.reduce((s, a) => s + Number(a.montant), 0);

  const handleAdd = async () => {
    if (!form.idMembre || !form.categorie) return;
    if (nbDejaAccorde(form.idMembre, typeSelectionne?.typeEvenement) >= maxParCategorieAn) return; // garde-fou RG-SOC-010
    const m = membres.find((x) => x.id === form.idMembre);
    await addAideSociale?.({
      ...form,
      idMembre: form.idMembre,
      nomMembre: `${m?.nom || ''} ${m?.prenom || ''}`.trim(),
      montant: Number(form.montant || montantSuggere || 0),
      statut: 'demandee',
    });
    setAdd(false);
    setForm(EMPTY);
  };
  const [guardedHandleAdd, declaringAide] = useAsyncGuard(handleAdd);

  const limiteAtteinte = form.idMembre && form.categorie && nbDejaAccorde(form.idMembre, typeSelectionne?.typeEvenement) >= maxParCategorieAn;

  const openEditType = (t) => {
    setEditingTypeId(t.id);
    setTypeForm({ libelle: t.libelle || '', typeEvenement: t.typeEvenement || 'naissance', montantFixe: t.montantFixe ?? '', nbMaxVie: t.nbMaxVie ?? '' });
    setAddType(true);
  };
  const closeTypeModal = () => { setAddType(false); setEditingTypeId(null); setTypeForm(EMPTY_TYPE); };
  const [guardedSaveType, savingTypeAide] = useAsyncGuard(async () => {
    if (!typeForm.libelle.trim()) return;
    const payload = { libelle: typeForm.libelle.trim(), typeEvenement: typeForm.typeEvenement, montantFixe: Number(typeForm.montantFixe || 0), nbMaxVie: typeForm.nbMaxVie ? Number(typeForm.nbMaxVie) : null };
    const result = editingTypeId ? await updateTypeAideSociale?.(editingTypeId, payload) : await addTypeAideSociale(payload);
    if (result) closeTypeModal();
  });
  const handleDeleteType = (t) => {
    if (window.confirm(`Supprimer le type d'aide « ${t.libelle} » ?`)) deleteTypeAideSociale?.(t.id);
  };
  const [guardedHandleDeleteType, deletingType] = useAsyncGuard(async (t) => {
    if (window.confirm(`Supprimer le type d'aide « ${t.libelle} » ?`)) await deleteTypeAideSociale?.(t.id);
  });

  // Caisse de versement : celle configurée sur le type si présente, sinon à
  // choisir ici (paramétrer un type n'exige plus de caisse, cf addTypeAideSociale).
  const verserCaisseRequise = verserModal && !typesAideSociale.find((t) => t.id === verserModal.categorie)?.caisseSourceId;
  const handleVerser = async () => {
    if (verserCaisseRequise && !verserCaisse) { showToast?.('Choisissez la caisse à débiter pour ce versement.', 'error'); return; }
    await verserAideSociale?.(verserModal.id, { modePaiement: verserMode, detailsPaiement: verserDetails, idCaisse: verserCaisse || undefined });
    setVerserModal(null);
  };
  const [guardedHandleVerser, verserEnCours] = useAsyncGuard(handleVerser);

  const [validationEnCours, setValidationEnCours] = useState(null); // id de l'aide en cours de validation/rejet — anti double-clic ciblé
  const guardedValiderAideSociale = async (id, ...args) => {
    if (validationEnCours) return;
    setValidationEnCours(id);
    try { await validerAideSociale?.(id, ...args); } finally { setValidationEnCours(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Volet Social"
        subtitle="Barème des aides, déclaration et suivi (RG-SOC-001 à 010)"
        action={
          <div className="flex gap-2">
            <button onClick={() => { setEditingTypeId(null); setTypeForm(EMPTY_TYPE); setAddType(true); }} className="btn-secondary"><Settings2 size={15} />Paramètres</button>
            <button onClick={() => setAdd(true)} className="btn-primary"><Plus size={15} />Déclarer un événement</button>
          </div>
        }
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

      <SectionCard title="Barème par type d'aide" subtitle="Paramétré une fois, réutilisé ensuite lors de chaque déclaration">
        {typesAideSociale.length === 0 ? (
          <div className="text-center py-6 text-ink-600/40 text-sm">
            Aucun type d'aide paramétré. Clique sur « Paramètres » pour en créer un (ex : « Mariage — 5 000 »).
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            {typesAideSociale.map((t) => (
              <div key={t.id} className="rounded-xl bg-white/40 border border-white/50 p-3 group relative">
                <p className="text-sm font-semibold text-ink-900 pr-10">{t.libelle}</p>
                <p className="text-xs text-ink-600/50 mt-1">{CATEGORIES.find((c) => c.code === t.typeEvenement)?.label || t.typeEvenement} · Max {maxParCategorieAn}/an{t.nbMaxVie ? ` · Max ${t.nbMaxVie} à vie` : ''}</p>
                <p className="font-mono text-sm font-semibold text-indigo-700 mt-1">{fmt(t.montantFixe)}</p>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditType(t)} title="Modifier" className="p-1 hover:bg-white rounded-lg text-ink-600/50 hover:text-indigo-600">
                    <Pencil size={12}/>
                  </button>
                  <button onClick={() => guardedHandleDeleteType(t)} disabled={deletingType} title="Supprimer" className="p-1 hover:bg-white rounded-lg text-ink-600/50 hover:text-red-600">
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Demandes" className="p-0 overflow-hidden">
        <Table headers={['Membre', 'Catégorie', 'Montant', 'Justificatif', 'Date', 'Statut', 'Paiement', 'Action']}>
          {aidesSociales.map((a) => (
            <tr key={a.id} className="hover:bg-white/40 transition-colors">
              <td className="td font-medium">{a.nomMembre}</td>
              <td className="td">{CATEGORIES.find((c) => c.code === a.categorie)?.label || a.categorie}</td>
              <td className="td num font-semibold">{fmt(a.statut === 'approuvee' || a.statut === 'versee' ? (a.montantAccorde ?? a.montant) : a.montant)}</td>
              <td className="td">
                {a.justificatif ? <span className="flex items-center gap-1 text-xs text-indigo-600"><Paperclip size={12} />Joint</span> : <span className="text-xs text-red-500">Manquant</span>}
              </td>
              <td className="td text-ink-600/60">{fmtDate(a.dateDeclaration)}</td>
              <td className="td">
                <Badge variant={a.statut === 'versee' ? 'green' : a.statut === 'approuvee' ? 'blue' : a.statut === 'refusee' ? 'red' : 'amber'}>
                  {a.statut === 'versee' ? 'Versée' : a.statut === 'approuvee' ? 'Approuvée' : a.statut === 'refusee' ? 'Refusée' : 'En attente'}
                </Badge>
              </td>
              <td className="td">
                {a.statut === 'versee'
                  ? <ModePaiementBadge modePaiement={a.modePaiement} detailsPaiement={a.detailsPaiement} />
                  : <span className="text-ink-600/30 text-xs">—</span>}
              </td>
              <td className="td">
                <div className="flex items-center gap-1">
                  {a.statut === 'demandee' && (
                    <>
                      <button onClick={() => guardedValiderAideSociale(a.id, 'approuvee')} disabled={validationEnCours===a.id} title="Approuver" className="btn-primary py-1 px-2.5 text-xs"><CheckCircle2 size={12} />{validationEnCours===a.id ? '…' : 'Valider'}</button>
                      <button onClick={() => guardedValiderAideSociale(a.id, 'refusee')} disabled={validationEnCours===a.id} title="Refuser" className="p-1.5 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"><XCircle size={14} className="text-red-400"/></button>
                    </>
                  )}
                  {a.statut === 'approuvee' && (
                    <button onClick={() => { setVerserModal(a); setVerserMode('especes'); setVerserDetails(''); setVerserCaisse(''); }} className="btn-primary py-1 px-2.5 text-xs"><Wallet size={12} />Verser</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {aidesSociales.length === 0 && (
            <tr><td colSpan={8} className="td text-center text-ink-600/40 py-8">Aucune demande enregistrée</td></tr>
          )}
        </Table>
      </SectionCard>

      <Modal open={!!verserModal} onClose={() => setVerserModal(null)} title="Verser l'aide sociale"
        footer={<>
          <button onClick={() => setVerserModal(null)} disabled={verserEnCours} className="btn-secondary">Annuler</button>
          <button
            onClick={guardedHandleVerser}
            disabled={verserEnCours || !isModePaiementValid(verserMode, verserDetails) || (verserCaisseRequise && !verserCaisse)}
            className={`btn-primary ${(verserEnCours || !isModePaiementValid(verserMode, verserDetails) || (verserCaisseRequise && !verserCaisse)) ? 'opacity-40 cursor-not-allowed' : ''}`}
          ><Wallet size={14}/>{verserEnCours ? 'Versement…' : 'Confirmer le versement'}</button>
        </>}>
        {verserModal && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-sm font-semibold text-indigo-800">{verserModal.nomMembre}</p>
              <p className="text-xs text-indigo-600 mt-0.5">{CATEGORIES.find((c) => c.code === verserModal.categorie)?.label} — <strong>{fmt(verserModal.montantAccorde ?? verserModal.montant)}</strong></p>
            </div>
            {verserCaisseRequise && (
              <FormField label="Caisse à débiter" required hint="Aucune caisse par défaut sur ce type d'aide — à choisir ici.">
                <select className="select" value={verserCaisse} onChange={(e) => setVerserCaisse(e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {banques.map((b) => <option key={b.id} value={b.id}>{b.nom || b.libelle}</option>)}
                </select>
              </FormField>
            )}
            <ModePaiementFields
              modePaiement={verserMode}
              detailsPaiement={verserDetails}
              onModeChange={(v) => { setVerserMode(v); setVerserDetails(''); }}
              onDetailsChange={setVerserDetails}
            />
          </div>
        )}
      </Modal>

      <Modal open={add} onClose={() => setAdd(false)} title="Déclarer un événement social"
        footer={<>
          <button onClick={() => setAdd(false)} disabled={declaringAide} className="btn-secondary">Annuler</button>
          <button onClick={guardedHandleAdd} disabled={limiteAtteinte || declaringAide} className="btn-primary"><HeartHandshake size={14} />{declaringAide ? 'Déclaration…' : 'Déclarer'}</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Membre" required>
            <select className="select" value={form.idMembre} onChange={(e) => setForm((f) => ({ ...f, idMembre: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {membres.map((m) => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
            </select>
          </FormField>
          <FormField label="Type d'aide" required hint={typesAideSociale.length === 0 ? "Aucun type paramétré — clique sur « Paramètres » d'abord." : undefined}>
            <select className="select" value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {typesAideSociale.map((t) => <option key={t.id} value={t.id}>{t.libelle} — {fmt(t.montantFixe)}</option>)}
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
            <input type="file" className="input" onChange={(e) => { const file = e.target.files?.[0]; setForm((f) => ({ ...f, justificatif: file?.name || '', justificatifFile: file || null })); }} />
          </FormField>
          <FormField label="Date de déclaration">
            <input type="date" className="input" value={form.dateDeclaration} onChange={(e) => setForm((f) => ({ ...f, dateDeclaration: e.target.value }))} />
          </FormField>
        </div>
      </Modal>
      <Modal open={addType} onClose={closeTypeModal} title={editingTypeId ? "Modifier le type d'aide sociale" : "Paramétrer un type d'aide sociale"}
        footer={<>
          <button onClick={closeTypeModal} disabled={savingTypeAide} className="btn-secondary">Annuler</button>
          <button onClick={guardedSaveType} disabled={savingTypeAide} className="btn-primary"><Settings2 size={14}/>{savingTypeAide ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>}>
        <div className="space-y-4">
          <FormField label="Libellé" required hint="Ex : « Mariage », « Naissance jumeaux », « Rentrée scolaire »">
            <input className="input" value={typeForm.libelle} onChange={(e) => setTypeForm((f) => ({ ...f, libelle: e.target.value }))} />
          </FormField>
          <FormField label="Catégorie d'événement" required>
            <select className="select" value={typeForm.typeEvenement} onChange={(e) => setTypeForm((f) => ({ ...f, typeEvenement: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Montant (FCFA)" required>
            <input type="number" className="input" value={typeForm.montantFixe} onChange={(e) => setTypeForm((f) => ({ ...f, montantFixe: e.target.value }))} />
          </FormField>
          <FormField label="Plafond à vie (optionnel)" hint="Nombre maximum de fois qu'un même membre peut recevoir cette aide, sur toute la durée de son adhésion. Laisser vide = pas de plafond à vie.">
            <input type="number" min="1" className="input" value={typeForm.nbMaxVie} onChange={(e) => setTypeForm((f) => ({ ...f, nbMaxVie: e.target.value }))} placeholder="Illimité" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
