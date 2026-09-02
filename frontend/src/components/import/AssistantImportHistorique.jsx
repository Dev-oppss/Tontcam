import { useMemo, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';

// Un champ par ligne du formulaire pas-à-pas. `col` = nom de colonne CSV
// exact attendu par le backend (voir COLONNES_FICHIER dans ImportHistorique.jsx).
// Le backend résout désormais les noms (membre, caisse, réunion...) tout
// seul : l'assistant n'a donc jamais besoin de manipuler d'UUID.
function champsPour(type, { membres, caisses, tontines, typesSanction, membresTontine }) {
  const nomsMembres = (membresTontine || membres).map((m) => `${m.nom} ${m.prenom}`);
  const nomsCaisses = caisses.map((c) => c.nom);
  switch (type) {
    case 'transactions':
      return [
        { col: 'caisse_id', label: 'Caisse', type: 'select', options: nomsCaisses },
        { col: 'sens', label: 'Entrée ou sortie', type: 'select', options: ['entree', 'sortie'] },
        { col: 'montant', label: 'Montant', type: 'number' },
        { col: 'libelle', label: 'Motif / Libellé', type: 'text' },
        { col: 'date_transaction', label: 'Date', type: 'date' },
        { col: 'mode_paiement', label: 'Mode de paiement', type: 'select', options: ['especes', 'mobile_money', 'virement', 'cheque', 'carte_bancaire'] },
      ];
    case 'decisions':
      return [
        { col: 'reunion_id', label: 'Date de la réunion', type: 'date' },
        { col: 'numero_decision', label: 'Numéro de la décision', type: 'text' },
        { col: 'type', label: 'Type', type: 'select', options: ['financier', 'statutaire', 'disciplinaire', 'organisationnel', 'autre'] },
        { col: 'objet', label: 'Objet de la décision', type: 'text' },
        { col: 'quorum_present', label: 'Membres présents (quorum)', type: 'number' },
        { col: 'votes_pour', label: 'Votes pour', type: 'number' },
        { col: 'votes_contre', label: 'Votes contre', type: 'number' },
        { col: 'votes_abstention', label: 'Abstentions', type: 'number', optionnel: true },
        { col: 'statut', label: 'Résultat', type: 'select', options: ['adopte', 'rejete'] },
        { col: 'date_effet', label: "Date d'effet", type: 'date', optionnel: true },
      ];
    case 'prets':
      return [
        { col: 'caisse_id', label: 'Caisse prêteuse', type: 'select', options: nomsCaisses },
        { col: 'emprunteur_id', label: 'Emprunteur', type: 'select', options: nomsMembres },
        { col: 'montant_principal', label: 'Montant du prêt', type: 'number' },
        { col: 'taux_interet_mensuel', label: "Taux d'intérêt mensuel (ex: 0.02 pour 2%)", type: 'number' },
        { col: 'statut', label: 'Statut', type: 'select', options: ['en_cours', 'en_retard', 'defaut', 'solde'] },
        { col: 'date_demande', label: 'Date de la demande', type: 'date' },
        { col: 'date_echeance', label: "Date d'échéance", type: 'date' },
        { col: 'montant_capital', label: 'Capital dû à cette échéance', type: 'number' },
        { col: 'montant_interet', label: 'Intérêt dû à cette échéance', type: 'number' },
        { col: 'statut_echeance', label: "Statut de l'échéance", type: 'select', options: ['a_venir', 'payee', 'partielle', 'en_retard', 'penalisee'] },
      ];
    case 'sanctions':
      return [
        { col: 'membre_id', label: 'Membre sanctionné', type: 'select', options: nomsMembres },
        { col: 'type_sanction_id', label: 'Type de sanction', type: 'select', options: typesSanction.map((t) => t.libelle || t.nom) },
        { col: 'motif', label: 'Motif', type: 'text' },
        { col: 'date_application', label: 'Date', type: 'date' },
        { col: 'reunion_id', label: 'Réunion concernée (date)', type: 'date', optionnel: true },
      ];
    case 'cycles':
      return [
        { col: 'reunion_id', label: 'Date de la réunion', type: 'date' },
        { col: 'gagnant_part_id', label: 'Membre gagnant', type: 'select', options: nomsMembres },
        { col: 'date_ouverture', label: "Date d'ouverture du cycle", type: 'date' },
        { col: 'date_cloture', label: 'Date de clôture du cycle', type: 'date' },
        { col: 'cotisation_tontine_part_id', label: 'Membre qui a cotisé (une ligne par membre)', type: 'select', options: nomsMembres, optionnel: true },
        { col: 'cotisation_montant_verse', label: 'Montant cotisé par ce membre', type: 'number', optionnel: true },
        { col: 'cotisation_date_versement', label: 'Date de cotisation', type: 'date', optionnel: true },
      ];
    default:
      return [];
  }
}

function valeursVides(champs) {
  return Object.fromEntries(champs.map((c) => [c.col, '']));
}

// Construit un CSV depuis les lignes saisies — le backend accepte déjà noms
// et dates jj/mm/aaaa en entrée, donc aucune conversion n'est nécessaire ici.
function versCsv(champs, lignes, refKey) {
  const entetes = [...new Set([refKey, ...champs.map((c) => c.col)].filter(Boolean))];
  const echapper = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const corps = lignes.map((l) => entetes.map((c) => echapper(l[c] ?? '')).join(','));
  return [entetes.join(','), ...corps].join('\n');
}

export default function AssistantImportHistorique({ type, tontineId, contexte, onImporter, busy }) {
  const champs = useMemo(() => champsPour(type, contexte), [type, contexte]);
  const [brouillon, setBrouillon] = useState(() => valeursVides(champs));
  const [lignes, setLignes] = useState([]);
  const [erreur, setErreur] = useState('');

  const refKey = type === 'prets' ? 'pret_ref' : type === 'cycles' ? 'cycle_ref' : null;
  // Un même prêt/cycle est saisi en plusieurs lignes (une par échéance/cotisation) ;
  // on les regroupe automatiquement tant que "Nouveau prêt/cycle" n'est pas cliqué.
  const [groupeActuel, setGroupeActuel] = useState(1);

  const changerChamp = (col, valeur) => setBrouillon((b) => ({ ...b, [col]: valeur }));

  const ajouterLigne = () => {
    const manquant = champs.find((c) => !c.optionnel && !String(brouillon[c.col] ?? '').trim());
    if (manquant) { setErreur(`Renseignez « ${manquant.label} ».`); return; }
    setErreur('');
    const ligne = { ...brouillon };
    if (refKey) ligne[refKey] = `groupe-${groupeActuel}`;
    setLignes((prev) => [...prev, ligne]);
    // On garde les champs communs (caisse, dates du prêt/cycle) pré-remplis
    // pour la ligne suivante du même groupe — seuls les champs d'échéance/
    // cotisation sont vidés, pour aller vite sur une saisie répétitive.
    const champsAGarder = refKey === 'pret_ref'
      ? ['caisse_id', 'emprunteur_id', 'montant_principal', 'taux_interet_mensuel', 'statut', 'date_demande']
      : refKey === 'cycle_ref'
        ? ['reunion_id', 'gagnant_part_id', 'date_ouverture', 'date_cloture']
        : [];
    setBrouillon((b) => {
      const suivant = valeursVides(champs);
      champsAGarder.forEach((c) => { suivant[c] = b[c]; });
      return suivant;
    });
  };

  const nouveauGroupe = () => { setGroupeActuel((n) => n + 1); setBrouillon(valeursVides(champs)); };
  const supprimerLigne = (i) => setLignes((prev) => prev.filter((_, idx) => idx !== i));

  const importer = async () => {
    if (lignes.length === 0) { setErreur('Ajoutez au moins une ligne avant d’importer.'); return; }
    const csv = versCsv(champs, lignes, refKey);
    const fichier = new File([csv], `import-${type}.csv`, { type: 'text/csv' });
    const res = await onImporter(fichier);
    if (res && !res.erreurs?.length) { setLignes([]); setGroupeActuel(1); }
  };

  return <div className="space-y-4">
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-semibold text-ink-700 mb-3">
        {refKey ? `Groupe en cours : #${groupeActuel} — ` : ''}Remplissez les champs puis « Ajouter cette ligne ».
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {champs.map((c) => <div key={c.col}>
          <label className="text-xs text-ink-600 mb-1 block">{c.label}{c.optionnel ? ' (optionnel)' : ''}</label>
          {c.type === 'select'
            ? <select className="select" value={brouillon[c.col]} onChange={(e) => changerChamp(c.col, e.target.value)}>
                <option value="">Sélectionner…</option>
                {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            : <input className="input" type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'}
                value={brouillon[c.col]} onChange={(e) => changerChamp(c.col, e.target.value)} />}
        </div>)}
      </div>
      {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={ajouterLigne} className="btn-secondary text-xs"><Plus size={14} />Ajouter cette ligne</button>
        {refKey && <button onClick={nouveauGroupe} className="btn-secondary text-xs">Nouveau {refKey === 'pret_ref' ? 'prêt' : 'cycle'}</button>}
      </div>
    </div>

    {lignes.length > 0 && <div className="rounded-xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-semibold text-ink-700 mb-2">{lignes.length} ligne(s) prête(s) à importer</p>
      <ul className="space-y-1 max-h-56 overflow-auto text-xs">
        {lignes.map((l, i) => <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-2 py-1">
          <span className="truncate">{champs.slice(0, 3).map((c) => l[c.col]).filter(Boolean).join(' · ')}</span>
          <button onClick={() => supprimerLigne(i)} className="text-red-500 shrink-0"><Trash2 size={13} /></button>
        </li>)}
      </ul>
      <div className="mt-3 flex justify-end">
        <button onClick={importer} disabled={busy} className="btn-primary text-xs"><Upload size={14} />{busy ? 'Import en cours…' : `Importer ${lignes.length} ligne(s)`}</button>
      </div>
    </div>}
  </div>;
}
