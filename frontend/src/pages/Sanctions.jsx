import { useState } from 'react';
import clsx from 'clsx';
import { ShieldAlert, Plus, Settings2, CreditCard, Pencil, Trash2 } from 'lucide-react';
import { fmt, fmtDate, typeSancLabel } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import { ModePaiementFields, isModePaiementValid, ModePaiementBadge } from '../components/ui/ModePaiement';
import { getMissingFields } from '../lib/validation';
import { useAsyncGuard } from '../hooks/useAsyncGuard';

const PRESET_TYPES = [
  { code: 'retard_cotisation', libelle: 'Retard de cotisation', montantFixe: 2500 },
  { code: 'absence_non_excusee', libelle: 'Absence non excusée', montantFixe: 5000 },
  { code: 'insubordination', libelle: 'Insubordination', montantFixe: 10000 },
  { code: 'insulte', libelle: 'Insulte', montantFixe: 15000 },
];

const emptyCustomType = () => ({
  libelle: '',
  montant: '',
});

const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export default function Sanctions() {
  const { membres, sanctions, addSanction, payerSanction, typesSanction, addTypeSanction, updateTypeSanction, deleteTypeSanction, reunions = [], showToast } = useApp();
  const [add, setAdd] = useState(false);
  const [addType, setAddType] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [form, setForm] = useState({
    idMembre: '',
    nomMembre: '',
    typeSanction: 'retard_cotisation',
    montant: 2500,
    idReunion: '',
    dateSanction: new Date().toISOString().split('T')[0],
  });
  const [customTypeForm, setCustomTypeForm] = useState(emptyCustomType());
  const [payModal, setPayModal] = useState(null);
  const [payModePaiement, setPayModePaiement] = useState('especes');
  const [payDetailsPaiement, setPayDetailsPaiement] = useState('');

  // ── Sanction automatique de retard à l'arrivée (declencheur 'retard_presence') ──
  // Un seul type par association pour ce déclencheur (voir SanctionService::retardPresence,
  // qui prend le premier trouvé) : on l'édite s'il existe déjà, sinon on en crée un.
  const typeRetard = typesSanction.find((t) => t.declencheur === 'retard_presence');
  const [retardModalOpen, setRetardModalOpen] = useState(false);
  const [retardForm, setRetardForm] = useState({ actif: false, libelle: 'Retard à l\'arrivée', paliers: [{ minutes: '15', montant: '' }] });

  const openRetardModal = () => {
    setRetardForm(typeRetard
      ? { actif: !!typeRetard.estAutomatique, libelle: typeRetard.libelle, paliers: (typeRetard.paliersRetard?.length ? typeRetard.paliersRetard : [{ minutes: '15', montant: '' }]).map(p => ({ minutes: String(p.minutes), montant: String(p.montant) })) }
      : { actif: true, libelle: 'Retard à l\'arrivée', paliers: [{ minutes: '15', montant: '' }] });
    setRetardModalOpen(true);
  };
  const setPalier = (i, patch) => setRetardForm(f => ({ ...f, paliers: f.paliers.map((p, idx) => idx === i ? { ...p, ...patch } : p) }));
  const addPalier = () => setRetardForm(f => ({ ...f, paliers: [...f.paliers, { minutes: '', montant: '' }] }));
  const removePalier = (i) => setRetardForm(f => ({ ...f, paliers: f.paliers.filter((_, idx) => idx !== i) }));

  const handleSaveRetard = async () => {
    const paliersValides = retardForm.paliers.filter(p => p.minutes && p.montant);
    if (retardForm.actif && paliersValides.length === 0) {
      showToast?.('Ajoutez au moins un palier (ex. « à partir de 15 min → 100 FCFA »).', 'error');
      return;
    }
    const payload = {
      libelle: retardForm.libelle.trim() || 'Retard à l\'arrivée',
      montantFixe: 0, modeCalcul: 'fixe', declencheur: 'retard_presence',
      estAutomatique: retardForm.actif, paliersRetard: paliersValides,
    };
    if (typeRetard) await updateTypeSanction(typeRetard.id, payload);
    else await addTypeSanction({ ...payload, code: 'retard_presence' });
    setRetardModalOpen(false);
  };
  const [guardedSaveRetard, savingRetard] = useAsyncGuard(handleSaveRetard);

  const handlePayer = async () => {
    if (!isModePaiementValid(payModePaiement, payDetailsPaiement)) { showToast?.('Référence de paiement requise pour ce mode de versement.', 'error'); return; }
    await payerSanction(payModal.id, { modePaiement: payModePaiement, detailsPaiement: payDetailsPaiement });
    setPayModal(null);
    setPayModePaiement('especes');
    setPayDetailsPaiement('');
  };
  const [guardedHandlePayer, payingAmende] = useAsyncGuard(handlePayer);

  const impayees = sanctions.filter(s=>s.statut==='impayee');
  const payees   = sanctions.filter(s=>s.statut==='payee');
  const reunionsOuvertes = reunions.filter(r => r.statutReunion === 'en_cours');
  const typeV    = { retard_cotisation:'amber', absence_non_excusee:'red', insubordination:'red', insulte:'red', autre:'gray' };
  // Les types réellement paramétrés (association) priment toujours ; PRESET_TYPES
  // ne sert plus que de suggestions de démarrage si rien n'a encore été paramétré.
  const typesDisponibles = typesSanction.length
    ? typesSanction.map((t) => ({ code: t.code, libelle: t.libelle, montantFixe: Number(t.montantFixe || 0) }))
    : PRESET_TYPES;
  const montantsParType = Object.fromEntries(typesDisponibles.map((t) => [t.code, t.montantFixe]));

  const resetForm = () => {
    setForm({
      idMembre: '',
      nomMembre: '',
      typeSanction: 'retard_cotisation',
      montant: 2500,
      idReunion: '',
      dateSanction: new Date().toISOString().split('T')[0],
    });
    setCustomTypeForm(emptyCustomType());
  };

  const handleSelectType = (value) => {
    if (value === 'autre') {
      setForm((f) => ({ ...f, typeSanction: value, montant: Number(customTypeForm.montant || f.montant || 0) }));
      return;
    }
    setForm((f) => ({
      ...f,
      typeSanction: value,
      montant: montantsParType[value] || f.montant,
    }));
  };

  const ensureCustomType = async () => {
    const libelle = customTypeForm.libelle.trim();
    if (!libelle) return null;
    const code = slugify(libelle);
    const already = typesSanction.find((item) => item.code === code || String(item.libelle || '').toLowerCase() === libelle.toLowerCase());
    if (already) return already;
    return addTypeSanction({
      libelle,
      code,
      montantFixe: Number(customTypeForm.montant || 0),
      delaiReglementJours: 7,
      estAutomatique: false,
      modeCalcul: 'fixe',
    });
  };

  const handleAdd = async () => {
    const missing = getMissingFields(form, [{ key: 'idMembre', label: 'Membre' }, { key: 'idReunion', label: 'Réunion' }]);
    if (form.typeSanction === 'autre' && !customTypeForm.libelle.trim()) missing.push('Libellé de la sanction');
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const m = membres.find(x=>x.id===form.idMembre);
    let typeCode = form.typeSanction;
    let motif = typesDisponibles.find((t) => t.code === typeCode)?.libelle || typeSancLabel[typeCode] || typeCode;
    let montant = Number(form.montant || 0);

    if (typeCode === 'autre') {
      const created = await ensureCustomType();
      if (!created) { showToast?.('Libellé de la sanction requis.', 'error'); return; }
      typeCode = created.code;
      motif = created.libelle || customTypeForm.libelle.trim();
      montant = Number(created.montantFixe ?? customTypeForm.montant ?? form.montant ?? 0);
    }

    addSanction({
      idMembre: form.idMembre,
      nomMembre: `${m.nom} ${m.prenom}`,
      typeSanction: typeCode,
      motif,
      montant,
      numReunion: form.idReunion,
      dateSanction: form.dateSanction,
    });
    setAdd(false);
    resetForm();
  };
  const [guardedHandleAdd, addingSanction] = useAsyncGuard(handleAdd);

  const handleAddType = async () => {
    if (!customTypeForm.libelle.trim()) { showToast?.('Libellé requis.', 'error'); return; }
    if (editingTypeId) {
      await updateTypeSanction(editingTypeId, {
        libelle: customTypeForm.libelle.trim(),
        montantFixe: Number(customTypeForm.montant || 0),
      });
    } else {
      await addTypeSanction({
        libelle: customTypeForm.libelle.trim(),
        code: slugify(customTypeForm.libelle),
        montantFixe: Number(customTypeForm.montant || 0),
        delaiReglementJours: 7,
        estAutomatique: false,
        modeCalcul: 'fixe',
      });
    }
    setAddType(false);
    setEditingTypeId(null);
    setCustomTypeForm(emptyCustomType());
  };
  const [guardedHandleAddType, savingType] = useAsyncGuard(handleAddType);

  const openEditType = (t) => {
    setEditingTypeId(t.id);
    setCustomTypeForm({ libelle: t.libelle || '', montant: t.montantFixe ?? '' });
    setAddType(true);
  };

  const handleDeleteType = (t) => {
    if (!t.id) return; // types PRESET (jamais paramétrés) n'ont pas d'id, rien à supprimer
    if (window.confirm(`Supprimer le type de sanction « ${t.libelle} » ?`)) deleteTypeSanction(t.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sanctions" subtitle="Types de sanction paramétrables et pénalités des membres"
        action={
          <div className="flex gap-2">
            <button onClick={openRetardModal} className="btn-secondary"><ShieldAlert size={15}/> Retards automatiques</button>
            <button onClick={()=>{setEditingTypeId(null); setCustomTypeForm(emptyCustomType()); setAddType(true);}} className="btn-secondary"><Settings2 size={15}/> Paramètres</button>
            <button onClick={()=>setAdd(true)} className="btn-primary"><Plus size={15}/> Nouvelle sanction</button>
          </div>
        }/>

      <div className={clsx('card border-l-4', typeRetard?.estAutomatique ? 'border-l-green-400' : 'border-l-gray-300')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              Sanction automatique de retard
              <Badge variant={typeRetard?.estAutomatique ? 'green' : 'gray'}>{typeRetard?.estAutomatique ? 'Activée' : 'Désactivée'}</Badge>
            </p>
            {typeRetard?.estAutomatique && typeRetard.paliersRetard?.length > 0 ? (
              <p className="text-xs text-gray-400 mt-1">
                {typeRetard.paliersRetard.map((p, i) => (
                  <span key={i}>{i > 0 && ' · '}À partir de {p.minutes} min → {fmt(p.montant)}</span>
                ))}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Un membre marqué « En retard » lors du pointage des présences peut être sanctionné automatiquement selon la durée de son retard.</p>
            )}
          </div>
          <button onClick={openRetardModal} className="btn-secondary text-xs py-1.5 shrink-0"><Pencil size={12}/> Configurer</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center border-t-4 border-t-red-400">
          <p className="text-2xl font-bold text-red-600">{impayees.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sanctions impayées</p>
          <p className="text-sm font-semibold text-red-500 mt-0.5">{fmt(impayees.reduce((s,x)=>s+x.montant,0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-green-400">
          <p className="text-2xl font-bold text-primary-600">{payees.length}</p>
          <p className="text-xs text-gray-400 mt-1">Sanctions réglées</p>
          <p className="text-sm font-semibold text-primary-500 mt-0.5">{fmt(payees.reduce((s,x)=>s+x.montant,0))}</p>
        </div>
        <div className="card text-center border-t-4 border-t-amber-400">
          <p className="text-2xl font-bold text-gray-800">{sanctions.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total sanctions</p>
        </div>
      </div>

        <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Catalogue des sanctions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(typesSanction.length ? typesSanction : PRESET_TYPES).map((t) => (
            <div key={t.id || t.code || t.libelle} className="p-3 rounded-xl border border-surface-200 bg-surface-50 group relative">
              <p className="text-sm font-semibold text-ink-800 pr-10">{t.libelle}</p>
              <p className="text-xs text-ink-600/50 mt-1">{fmt(t.montantFixe || 0)}</p>
              {t.id && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditType(t)} title="Modifier" className="p-1 hover:bg-white rounded-lg text-ink-600/50 hover:text-primary-600">
                    <Pencil size={12}/>
                  </button>
                  <button onClick={() => handleDeleteType(t)} title="Supprimer" className="p-1 hover:bg-white rounded-lg text-ink-600/50 hover:text-red-600">
                    <Trash2 size={12}/>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {impayees.length>0&&(
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5"><ShieldAlert size={14}/>Amendes impayées</p>
          {impayees.map(s=>(
            <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-red-100 last:border-0">
              <span className="font-medium text-red-800">{s.nomMembre}</span>
              <span className="text-gray-500 text-xs">{s.motif || typeSancLabel[s.typeSanction] || s.typeSanction}</span>
              <span className="font-bold text-red-600">{fmt(s.montant)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <Table headers={['Membre','Réunion','Type','Montant','Date','Statut','Paiement','Action']}>
          {sanctions.map(s=>(
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="td font-medium text-gray-800">{s.nomMembre}</td>
              <td className="td text-gray-500">{reunions.find(r => r.id === s.numReunion)?.numero ? `N°${reunions.find(r => r.id === s.numReunion).numero}` : '—'}</td>
              <td className="td"><Badge variant={typeV[s.typeSanction]}>{typeSancLabel[s.typeSanction]||s.typeSanction}</Badge></td>
              <td className="td font-bold text-red-600">{fmt(s.montant)}</td>
              <td className="td text-gray-500">{fmtDate(s.dateSanction)}</td>
              <td className="td"><Badge variant={s.statut==='payee'?'green':'red'}>{s.statut==='payee'?'Payée':'Impayée'}</Badge></td>
              <td className="td">
                {s.statut === 'payee'
                  ? <ModePaiementBadge modePaiement={s.modePaiement} detailsPaiement={s.detailsPaiement} />
                  : <span className="text-ink-600/30 text-xs">—</span>}
              </td>
              <td className="td">
                {s.statut==='impayee'&&(
                  <button onClick={()=>setPayModal(s)} className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1">
                    <CreditCard size={12}/>Marquer payée
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Modal open={retardModalOpen} onClose={() => setRetardModalOpen(false)} title="Sanction automatique de retard"
        footer={<><button onClick={() => setRetardModalOpen(false)} disabled={savingRetard} className="btn-secondary">Annuler</button><button onClick={guardedSaveRetard} disabled={savingRetard} className="btn-primary"><ShieldAlert size={14}/>{savingRetard ? 'Enregistrement…' : 'Enregistrer'}</button></>}>
        <div className="space-y-4">
          <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer">
            <input type="checkbox" checked={retardForm.actif} onChange={e => setRetardForm(f => ({ ...f, actif: e.target.checked }))} className="w-4 h-4"/>
            <span className="text-sm font-medium text-gray-700">Appliquer automatiquement une sanction aux membres marqués « En retard »</span>
          </label>
          <FormField label="Libellé" required>
            <input className="input" value={retardForm.libelle} onChange={e => setRetardForm(f => ({ ...f, libelle: e.target.value }))} />
          </FormField>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Paliers de retard</p>
            <p className="text-xs text-gray-400 mb-3">
              Le montant appliqué est celui du plus grand palier atteint — ce ne sont pas des tranches
              cumulées. Ex : « à partir de 15 min → 100 FCFA » et « à partir de 3h → 250 FCFA » veut dire
              qu'un retard de 3h ou plus coûte 250 FCFA (pas 100 + 250).
            </p>
            <div className="space-y-2">
              {retardForm.paliers.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 shrink-0">À partir de</span>
                  <input type="number" min="1" className="input" placeholder="15" value={p.minutes} onChange={e => setPalier(i, { minutes: e.target.value })}/>
                  <span className="text-xs text-gray-400 shrink-0">min →</span>
                  <input type="number" min="0" className="input" placeholder="100" value={p.montant} onChange={e => setPalier(i, { montant: e.target.value })}/>
                  <span className="text-xs text-gray-400 shrink-0">FCFA</span>
                  <button type="button" onClick={() => removePalier(i)} className="p-1.5 text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addPalier} className="btn-secondary text-xs py-1.5 mt-2"><Plus size={12}/> Ajouter un palier</button>
          </div>
        </div>
      </Modal>

      <Modal open={add} onClose={()=>setAdd(false)} title="Nouvelle sanction"
        footer={<><button onClick={()=>setAdd(false)} disabled={addingSanction} className="btn-secondary">Annuler</button><button onClick={guardedHandleAdd} disabled={addingSanction} className="btn-danger"><ShieldAlert size={14}/>{addingSanction ? 'Enregistrement…' : 'Enregistrer'}</button></>}>
        <div className="space-y-4">
          <FormField label="Membre" required>
            <select className="select" value={form.idMembre} onChange={e=>setForm(f=>({...f,idMembre:e.target.value}))}>
              <option value="">Sélectionner…</option>
              {membres.map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
            </select>
          </FormField>
          <FormField label="Type de sanction" required>
            <select className="select" value={form.typeSanction} onChange={e=>handleSelectType(e.target.value)}>
              {typesDisponibles.map((type) => <option key={type.code} value={type.code}>{type.libelle} — {fmt(type.montantFixe)}</option>)}
              <option value="autre">Autre (créer un nouveau type)</option>
            </select>
          </FormField>
          {form.typeSanction === 'autre' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Type personnalisé</p>
                  <p className="text-xs text-amber-700 mt-1">Ce type sera sauvegardé et réutilisable pour les prochains membres.</p>
                </div>
              </div>
              <FormField label="Libellé de la sanction" required>
                <input className="input" value={customTypeForm.libelle} onChange={e=>setCustomTypeForm(f=>({...f,libelle:e.target.value}))} placeholder="Ex : Retard de réunion, refus de participation…" />
              </FormField>
              <FormField label="Montant (FCFA)" required>
                <input type="number" className="input" value={customTypeForm.montant} onChange={e=>setCustomTypeForm(f=>({...f,montant:e.target.value}))} />
              </FormField>
            </div>
          )}
          {form.typeSanction !== 'autre' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Montant (FCFA)">
                <input type="number" className="input" value={form.montant} onChange={e=>setForm(f=>({...f,montant:e.target.value}))}/>
              </FormField>
              <FormField label="Réunion concernée" required hint={reunionsOuvertes.length === 0 ? 'Aucune séance ouverte actuellement.' : undefined}>
                <select className="select" value={form.idReunion} onChange={e=>setForm(f=>({...f,idReunion:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {reunionsOuvertes.map(r => <option key={r.id} value={r.id}>N°{r.numero} — {fmtDate(r.date)}</option>)}
                </select>
              </FormField>
            </div>
          )}
          {form.typeSanction === 'autre' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Réunion concernée" required hint={reunionsOuvertes.length === 0 ? 'Aucune séance ouverte actuellement.' : undefined}>
                <select className="select" value={form.idReunion} onChange={e=>setForm(f=>({...f,idReunion:e.target.value}))}>
                  <option value="">— Sélectionner —</option>
                  {reunionsOuvertes.map(r => <option key={r.id} value={r.id}>N°{r.numero} — {fmtDate(r.date)}</option>)}
                </select>
              </FormField>
              <div className="hidden md:block" />
            </div>
          )}
          <FormField label="Date">
            <input type="date" className="input" value={form.dateSanction} onChange={e=>setForm(f=>({...f,dateSanction:e.target.value}))}/>
          </FormField>
        </div>
      </Modal>

      <Modal open={addType} onClose={()=>{setAddType(false); setEditingTypeId(null); setCustomTypeForm(emptyCustomType());}} title={editingTypeId ? 'Modifier le type de sanction' : 'Paramétrer un type de sanction'}
        footer={<><button onClick={()=>{setAddType(false); setEditingTypeId(null); setCustomTypeForm(emptyCustomType());}} disabled={savingType} className="btn-secondary">Annuler</button><button onClick={guardedHandleAddType} disabled={savingType} className="btn-primary"><Settings2 size={14}/>{savingType ? 'Enregistrement…' : 'Enregistrer'}</button></>}>
        <div className="space-y-4">
          <FormField label="Libellé" required>
            <input className="input" value={customTypeForm.libelle} onChange={e=>setCustomTypeForm(f=>({...f,libelle:e.target.value}))} placeholder="Ex : Retard de cotisation" />
          </FormField>
          <FormField label="Montant (FCFA)" required>
            <input type="number" className="input" value={customTypeForm.montant} onChange={e=>setCustomTypeForm(f=>({...f,montant:e.target.value}))} />
          </FormField>
        </div>
      </Modal>

      <Modal open={!!payModal} onClose={()=>setPayModal(null)} title="Régler la sanction"
        footer={<>
          <button onClick={()=>setPayModal(null)} disabled={payingAmende} className="btn-secondary">Annuler</button>
          <button onClick={guardedHandlePayer} disabled={payingAmende || !isModePaiementValid(payModePaiement, payDetailsPaiement)}
            className={`btn-primary ${(payingAmende || !isModePaiementValid(payModePaiement, payDetailsPaiement)) ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <CreditCard size={14}/>{payingAmende ? 'Paiement…' : 'Confirmer le paiement'}
          </button>
        </>}>
        {payModal && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-sm font-semibold text-red-800">{payModal.nomMembre}</p>
              <p className="text-xs text-red-600 mt-0.5">{payModal.motif || typeSancLabel[payModal.typeSanction] || payModal.typeSanction} — <strong>{fmt(payModal.montant)}</strong></p>
            </div>
            <ModePaiementFields
              modePaiement={payModePaiement}
              detailsPaiement={payDetailsPaiement}
              onModeChange={(v)=>{ setPayModePaiement(v); setPayDetailsPaiement(''); }}
              onDetailsChange={setPayDetailsPaiement}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
