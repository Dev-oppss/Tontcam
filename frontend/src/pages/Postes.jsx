import { useState, useMemo } from 'react';
import { Landmark, UserCheck, History, Plus, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PageHeader, SectionCard, Table, Badge, Modal, FormField } from '../components/ui/index';

const POSTES_OBLIGATOIRES = ['Président', 'Secrétaire Général', 'Trésorier Général'];

export default function Postes() {
  const { membres = [], postes = [], mandats = [], addMandat, cloturerMandat, parametres } = useApp();
  const [assignModal, setAssignModal] = useState(null); // { poste }
  const [form, setForm] = useState({ idMembre: '', dateDebut: new Date().toISOString().split('T')[0] });

  const plafond = Number(parametres?.plafondCumulPostes || 2);

  const listePostes = useMemo(() => {
    const custom = postes.filter((p) => !POSTES_OBLIGATOIRES.includes(p.nom)).map((p) => p.nom);
    return [...POSTES_OBLIGATOIRES, ...custom];
  }, [postes]);

  const titulaireActuel = (poste) =>
    mandats.find((m) => m.poste === poste && !m.dateFin);

  const historique = (poste) =>
    mandats.filter((m) => m.poste === poste).sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));

  const nbPostesMembre = (idMembre) =>
    mandats.filter((m) => m.idMembre === idMembre && !m.dateFin).length;

  const handleAssign = () => {
    if (!form.idMembre || !assignModal) return;
    if (nbPostesMembre(form.idMembre) >= plafond) return; // garde-fou RG-ORG-010
    const m = membres.find((x) => x.id === form.idMembre);
    addMandat?.({
      poste: assignModal.poste,
      idMembre: form.idMembre,
      nomMembre: `${m?.nom || ''} ${m?.prenom || ''}`.trim(),
      dateDebut: form.dateDebut,
      dateFin: null,
    });
    setAssignModal(null);
    setForm({ idMembre: '', dateDebut: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation & Postes"
        subtitle="Organigramme, mandats et règles de cumul — distinct de la fiche membre"
      />

      <div className="grid sm:grid-cols-3 gap-4">
        {listePostes.map((poste) => {
          const titulaire = titulaireActuel(poste);
          const obligatoire = POSTES_OBLIGATOIRES.includes(poste);
          return (
            <div key={poste} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-indigo-500" />
                  <p className="font-display font-semibold text-ink-900 text-sm">{poste}</p>
                </div>
                {obligatoire && <Badge variant="amber">Obligatoire</Badge>}
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
      </div>

      <SectionCard title="Historique des mandats" subtitle="Conservé indéfiniment (RG-ORG-009)" className="p-0 overflow-hidden">
        <Table headers={['Poste', 'Titulaire', 'Début', 'Fin', 'Statut']}>
          {mandats.slice().sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut)).map((m) => (
            <tr key={m.id} className="hover:bg-white/40 transition-colors">
              <td className="td font-medium">{m.poste}</td>
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
        title={`Attribuer : ${assignModal?.poste || ''}`}
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
    </div>
  );
}
