import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';

// "Initialisation" (RG-INIT) : pose un résumé — un point de départ — pour un
// membre, sans reconstituer le détail des opérations qui y ont mené
// (contrairement à l'import historique). Réservé au super_admin.
export default function InitialisationMembreTab({ membre }) {
  const { user, typesAideSociale, banques, chargerInitialisationMembre, enregistrerInitialisationMembre } = useApp();
  const [donnees, setDonnees] = useState(null);
  const [absences, setAbsences] = useState('0');
  const [sanctionDu, setSanctionDu] = useState('0');
  const [aides, setAides] = useState({}); // { type_aide_id: nombre }
  const [cotisations, setCotisations] = useState({}); // { tontine_part_id: montant }
  const [epargne, setEpargne] = useState({}); // { caisse_id: solde }
  const [pretActif, setPretActif] = useState(false);
  const [pret, setPret] = useState({ caisse_id: '', montant_restant_du: '', taux_interet_mensuel: '', date_prochaine_echeance: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await chargerInitialisationMembre(membre.id);
      setDonnees(res);
      setAbsences(String(res?.absences_cumulees_initiales ?? 0));
      setSanctionDu(String(res?.sanction_montant_du ?? 0));
      setAides(Object.fromEntries((res?.aides || []).map((a) => [a.type_aide_id, String(a.nombre_deja_recu)])));
      setCotisations(Object.fromEntries((res?.parts || []).map((p) => [p.tontine_part_id, String(p.montant_accumule_initial || '')])));
      setEpargne(Object.fromEntries((res?.caisses_epargne || []).map((c) => [c.caisse_id, String(c.solde_initial || '')])));
      if (res?.pret_en_cours) {
        setPretActif(true);
        setPret({
          caisse_id: res.pret_en_cours.caisse_id,
          montant_restant_du: String(res.pret_en_cours.montant_restant_du),
          taux_interet_mensuel: String(res.pret_en_cours.taux_interet_mensuel || ''),
          date_prochaine_echeance: res.pret_en_cours.date_prochaine_echeance?.slice(0, 10) || '',
        });
      } else {
        setPretActif(false);
        setPret({ caisse_id: '', montant_restant_du: '', taux_interet_mensuel: '', date_prochaine_echeance: '' });
      }
      setLoading(false);
    })();
  }, [membre.id]);

  if (user?.role !== 'super_admin') {
    return <p className="text-sm text-gray-500 p-4">Réservé au super administrateur.</p>;
  }
  if (loading) return <p className="text-sm text-gray-500 p-4">Chargement…</p>;

  const enregistrer = async () => {
    setSaving(true);
    const pretPayload = pretActif && pret.caisse_id && pret.montant_restant_du && pret.date_prochaine_echeance
      ? { caisse_id: pret.caisse_id, montant_restant_du: Number(pret.montant_restant_du), taux_interet_mensuel: Number(pret.taux_interet_mensuel || 0), date_prochaine_echeance: pret.date_prochaine_echeance }
      : (donnees?.pret_en_cours ? { caisse_id: donnees.pret_en_cours.caisse_id, montant_restant_du: 0, date_prochaine_echeance: donnees.pret_en_cours.date_prochaine_echeance } : null);
    const payload = {
      absences_cumulees: Number(absences || 0),
      sanction_montant_du: Number(sanctionDu || 0),
      aides: Object.entries(aides).filter(([, v]) => v !== '').map(([type_aide_id, v]) => ({ type_aide_id, nombre_deja_recu: Number(v) })),
      cotisations: Object.entries(cotisations).filter(([, v]) => v !== '').map(([tontine_part_id, v]) => ({ tontine_part_id, montant_initial: Number(v) })),
      epargne: Object.entries(epargne).filter(([, v]) => v !== '').map(([caisse_id, v]) => ({ caisse_id, solde_initial: Number(v) })),
      ...(pretPayload ? { pret_en_cours: pretPayload } : {}),
    };
    const res = await enregistrerInitialisationMembre(membre.id, payload);
    if (res) setDonnees(res);
    setSaving(false);
  };

  const caissesEpargne = donnees?.caisses_epargne || [];

  return <div className="space-y-5">
    <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
      <Info size={15} className="shrink-0 mt-0.5" />
      Sert à poser un point de départ résumé pour ce membre (ex: "6000 FCFA de sanctions dues"), sans recréer le détail des opérations passées. Pour reconstituer l'historique complet opération par opération, utilisez plutôt la Reprise d'historique.
    </div>

    <div className="p-3 bg-gray-50 rounded-xl space-y-2">
      <p className="text-sm font-semibold text-gray-800">Sanctions</p>
      <label className="text-xs text-gray-500 block">Nombre d'absences non excusées déjà cumulées</label>
      <input type="number" min="0" className="input" value={absences} onChange={(e) => setAbsences(e.target.value)} />
      <label className="text-xs text-gray-500 block mt-2">Montant total déjà dû en sanctions (FCFA)</label>
      <input type="number" min="0" className="input" value={sanctionDu} onChange={(e) => setSanctionDu(e.target.value)} />
    </div>

    {typesAideSociale?.length > 0 && <div className="p-3 bg-gray-50 rounded-xl space-y-2">
      <p className="text-sm font-semibold text-gray-800">Aide sociale — nombre déjà reçu par type</p>
      {typesAideSociale.map((t) => <div key={t.id} className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-600">{t.libelle}{t.nbMaxVie ? <span className="text-gray-400"> (plafond à vie : {t.nbMaxVie})</span> : null}</span>
        <input type="number" min="0" className="input w-24 text-sm" value={aides[t.id] ?? ''} onChange={(e) => setAides((a) => ({ ...a, [t.id]: e.target.value }))} />
      </div>)}
    </div>}

    {donnees?.parts?.length > 0 && <div className="p-3 bg-gray-50 rounded-xl space-y-2">
      <p className="text-sm font-semibold text-gray-800">Cotisations — montant déjà accumulé par part</p>
      {donnees.parts.map((p) => <div key={p.tontine_part_id} className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-600">{p.tontine_nom} — part n°{p.numero_part}</span>
        <input type="number" min="0" className="input w-28 text-sm" value={cotisations[p.tontine_part_id] ?? ''} onChange={(e) => setCotisations((c) => ({ ...c, [p.tontine_part_id]: e.target.value }))} placeholder="0" />
      </div>)}
      <p className="text-[11px] text-gray-400">Ne s'applique qu'aux tontines en mode cagnotte.</p>
    </div>}

    {caissesEpargne.length > 0 && <div className="p-3 bg-gray-50 rounded-xl space-y-2">
      <p className="text-sm font-semibold text-gray-800">Épargne — solde de départ par caisse</p>
      {caissesEpargne.map((c) => <div key={c.caisse_id} className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-600">{c.caisse_nom}</span>
        <input type="number" min="0" className="input w-28 text-sm" value={epargne[c.caisse_id] ?? ''} onChange={(e) => setEpargne((s) => ({ ...s, [c.caisse_id]: e.target.value }))} placeholder="0" />
      </div>)}
      <p className="text-[11px] text-gray-400">Ne s'applique qu'aux caisses ayant le suivi épargne activé.</p>
    </div>}

    <div className="p-3 bg-gray-50 rounded-xl space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <input type="checkbox" checked={pretActif} onChange={(e) => setPretActif(e.target.checked)} />
        Ce membre a déjà un prêt en cours
      </label>
      {pretActif && <div className="space-y-2 mt-2">
        <label className="text-xs text-gray-500 block">Caisse source</label>
        <select className="select" value={pret.caisse_id} onChange={(e) => setPret((p) => ({ ...p, caisse_id: e.target.value }))}>
          <option value="">Sélectionner…</option>
          {banques.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
        </select>
        <label className="text-xs text-gray-500 block mt-2">Montant restant dû (FCFA)</label>
        <input type="number" min="0" className="input" value={pret.montant_restant_du} onChange={(e) => setPret((p) => ({ ...p, montant_restant_du: e.target.value }))} />
        <label className="text-xs text-gray-500 block mt-2">Taux d'intérêt mensuel (ex: 0.02 pour 2%, optionnel)</label>
        <input type="number" min="0" step="0.001" className="input" value={pret.taux_interet_mensuel} onChange={(e) => setPret((p) => ({ ...p, taux_interet_mensuel: e.target.value }))} />
        <label className="text-xs text-gray-500 block mt-2">Date de la prochaine échéance</label>
        <input type="date" className="input" value={pret.date_prochaine_echeance} onChange={(e) => setPret((p) => ({ ...p, date_prochaine_echeance: e.target.value }))} />
        <p className="text-[11px] text-gray-400">Une seule échéance restante est créée — pas tout le tableau d'amortissement passé.</p>
      </div>}
    </div>

    <button onClick={enregistrer} disabled={saving} className="btn-primary w-full justify-center"><Save size={14}/> {saving ? 'Enregistrement…' : 'Enregistrer le point de départ'}</button>
  </div>;
}
