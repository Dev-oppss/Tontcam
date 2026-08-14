import { useState } from 'react';
import { Landmark, UserCheck, History, LogOut, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, SectionCard, Table, Badge, Modal, FormField } from '../components/ui/index';
import { getMissingFields } from '../lib/validation';

export default function Postes() {
  const { membres = [], postes = [], mandats = [], addPoste, addMandat, cloturerMandat, parametres, showToast } = useApp();
  const [assignModal, setAssignModal] = useState(null); // { poste }
  const [form, setForm] = useState({ idMembre: '', dateDebut: new Date().toISOString().split('T')[0] });
  const [posteModal, setPosteModal] = useState(false);
  const [posteForm, setPosteForm] = useState({ libelle: '', code: '', role_utilisateur: '', niveau_hierarchie: 3, est_bureau: false });

  const plafond = Number(parametres?.plafondCumulPostes || 2);

  const titulaireActuel = (poste) => poste.mandats?.[0];

  const nbPostesMembre = (idMembre) =>
    mandats.filter((m) => m.idMembre === idMembre && !m.dateFin).length;

  const handleAssign = () => {
    if (!assignModal) return;
    if (!form.idMembre) { showToast?.('Membre requis.', 'error'); return; }
    if (nbPostesMembre(form.idMembre) >= plafond) { showToast?.(`Plafond de ${plafond} poste(s) simultané(s) atteint pour ce membre (RG-ORG-010).`, 'error'); return; }
    addMandat?.({ idPoste: assignModal.poste.id, idMembre: form.idMembre, dateDebut: form.dateDebut });
    setAssignModal(null);
    setForm({ idMembre: '', dateDebut: new Date().toISOString().split('T')[0] });
  };
  const handleCreatePoste = async () => {
    const missing = getMissingFields(posteForm, [
      { key: 'libelle', label: 'Intitulé' },
      { key: 'code', label: 'Code' },
    ]);
    if (missing.length) { showToast?.(`Champ(s) requis manquant(s) : ${missing.join(', ')}`, 'error'); return; }
    const poste = await addPoste?.(posteForm);
    if (poste) {
      setPosteModal(false);
      setPosteForm({ libelle: '', code: '', role_utilisateur: '', niveau_hierarchie: 3, est_bureau: false });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation & Postes"
        subtitle="Organigramme, mandats et règles de cumul — distinct de la fiche membre"
      />
      <div className="flex justify-end -mt-3">
        <button onClick={() => setPosteModal(true)} className="btn-primary"><Plus size={15}/> Créer un poste</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {postes.map((poste) => {
          const titulaire = titulaireActuel(poste);
          return (
            <div key={poste.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-indigo-500" />
                  <p className="font-display font-semibold text-ink-900 text-sm">{poste.libelle}</p>
                </div>
                {poste.estObligatoire && <Badge variant="amber">Obligatoire</Badge>}
              </div>
              {titulaire ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="avatar-soft w-8 h-8 text-xs">{titulaire.nomMembre?.[0]?.toUpperCase() || '?'}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{titulaire.nomMembre}</p>
                    <p className="text-[11px] text-ink-600/50">Depuis {titulaire.dateDebut}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-600/50 italic">Poste vacant</p>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => setAssignModal({ poste })} className="btn-secondary py-1.5 px-2.5 text-xs flex-1">
                  <UserCheck size={12} /> {titulaire ? 'Remplacer' : 'Attribuer'}
                </button>
                {titulaire && (
                  <button
                    onClick={() => cloturerMandat?.(titulaire.id, new Date().toISOString().split('T')[0])}
                    className="btn-danger py-1.5 px-2.5 text-xs"
                    title="Clôturer le mandat"
                  >
                    <LogOut size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {postes.length === 0 && (
          <p className="text-sm text-ink-600/50 italic col-span-3">Chargement des postes…</p>
        )}
      </div>

      <SectionCard title="Historique des mandats" subtitle="Conservé indéfiniment (RG-ORG-009)" className="p-0 overflow-hidden">
        <Table headers={['Poste', 'Titulaire', 'Début', 'Fin', 'Statut']}>
          {mandats.slice().sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut)).map((m) => (
            <tr key={m.id} className="hover:bg-white/40 transition-colors">
              <td className="td font-medium">{m.poste || postes.find((p) => p.id === m.idPoste)?.libelle}</td>
              <td className="td">{m.nomMembre}</td>
              <td className="td text-ink-600/60 num">{m.dateDebut}</td>
              <td className="td text-ink-600/60 num">{m.dateFin || '—'}</td>
              <td className="td"><Badge variant={m.dateFin ? 'gray' : 'green'}>{m.dateFin ? 'Terminé' : 'Actif'}</Badge></td>
            </tr>
          ))}
          {mandats.length === 0 && (
            <tr><td colSpan={5} className="td text-center text-ink-600/40 py-8">Aucun mandat enregistré</td></tr>
          )}
        </Table>
      </SectionCard>

      <Modal
        open={!!assignModal}
        onClose={() => setAssignModal(null)}
        title={`Attribuer : ${assignModal?.poste?.libelle || ''}`}
        footer={<>
          <button onClick={() => setAssignModal(null)} className="btn-secondary">Annuler</button>
          <button onClick={handleAssign} className="btn-primary"><UserCheck size={14} />Attribuer</button>
        </>}
      >
        <div className="space-y-4">
          <FormField label="Membre" required hint={`Plafond : ${plafond} poste(s) simultané(s) par membre (RG-ORG-010)`}>
            <select className="select" value={form.idMembre} onChange={(e) => setForm((f) => ({ ...f, idMembre: e.target.value }))}>
              <option value="">Sélectionner un membre actif…</option>
              {membres.filter((m) => m.statut === 'actif').map((m) => {
                const nb = nbPostesMembre(m.id);
                return (
                  <option key={m.id} value={m.id} disabled={nb >= plafond}>
                    {m.nom} {m.prenom} {nb >= plafond ? `(plafond atteint : ${nb})` : ''}
                  </option>
                );
              })}
            </select>
          </FormField>
          <FormField label="Date de début du mandat">
            <input type="date" className="input" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} />
          </FormField>
          <p className="text-xs text-ink-600/50 flex items-center gap-1.5"><History size={12} /> L'attribution clôture automatiquement le mandat précédent, s'il existe.</p>
        </div>
      </Modal>

      <Modal open={posteModal} onClose={() => setPosteModal(false)} title="Créer un poste"
        footer={<><button onClick={() => setPosteModal(false)} className="btn-secondary">Annuler</button><button onClick={handleCreatePoste} className="btn-primary">Créer</button></>}>
        <div className="space-y-4">
          <FormField label="Intitulé" required><input className="input" value={posteForm.libelle} onChange={e => setPosteForm(f => ({ ...f, libelle: e.target.value }))}/></FormField>
          <FormField label="Code" required hint="Ex. COMMISSAIRE_AUX_COMPTES"><input className="input uppercase" value={posteForm.code} onChange={e => setPosteForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))}/></FormField>
          <FormField label="Rôle applicatif / droits"><select className="select" value={posteForm.role_utilisateur} onChange={e => setPosteForm(f => ({ ...f, role_utilisateur: e.target.value }))}><option value="">Aucun droit applicatif</option><option value="president">Président</option><option value="vice_president">Vice-président</option><option value="tresorier">Trésorier</option><option value="secretaire">Secrétaire</option><option value="controleur">Contrôleur</option><option value="membre">Membre</option></select></FormField>
          <FormField label="Niveau hiérarchique"><input type="number" min="1" className="input" value={posteForm.niveau_hierarchie} onChange={e => setPosteForm(f => ({ ...f, niveau_hierarchie: Number(e.target.value) }))}/></FormField>
          <p className="text-xs text-ink-600/60">Le rôle choisi est appliqué au compte du titulaire pendant son mandat actif.</p>
        </div>
      </Modal>
    </div>
  );
}
