import { Coins, AlertTriangle } from 'lucide-react';
import { fmt, fmtDate } from '../../data/mockData';
import { FormField } from '../ui/index';
import { calcEcheance } from '../../lib/amortissement';

// Contenu du formulaire « Nouveau prêt » de Prets.jsx (sans le Modal qui
// l'entoure là-bas), pour que l'onglet Prêt de Reunions.jsx affiche EXACTEMENT
// les mêmes champs, la même simulation et la même fiche d'amortissement —
// un seul et même composant, deux points d'entrée.
export function PretFormFields({ form, setForm, membres, caissesPret, pretSimule, montantInteret, repartitionSimulee, caisseSelectionnee }) {
  const onDureeChange = (val) => setForm((f) => ({ ...f, dureeMois: val, dateEcheance: calcEcheance(f.datePret, val) }));
  const onDateChange = (val) => setForm((f) => ({ ...f, datePret: val, dateEcheance: calcEcheance(val, f.dureeMois) }));
  const avalistesPossibles = membres.filter((m) => m.statut === 'actif' && m.id !== form.idMembre);

  return (
    <div className="space-y-4">
      <FormField label="Membre bénéficiaire" required>
        <select className="select" value={form.idMembre} onChange={(e) => setForm((f) => ({ ...f, idMembre: e.target.value }))}>
          <option value="">Sélectionner un membre…</option>
          {membres.filter((m) => m.statut === 'actif').map((m) => (
            <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Caisse source" required>
        <select className="select" value={form.caisseId} onChange={(e) => {
          const caisse = caissesPret.find((c) => c.id === e.target.value);
          setForm((f) => ({
            ...f,
            caisseId: e.target.value,
            // Bug corrigé : ce select lisait c.tauxInteretPret, un champ qui
            // n'existe pas — l'adaptateur produit c.tauxInteret. Le taux
            // configuré sur la caisse (image « Modifier la caisse ») restait
            // donc toujours ignoré ici (0% affiché quel que soit le vrai taux).
            tauxInteret: caisse?.tauxInteret ?? f.tauxInteret,
          }));
        }}>
          <option value="">Sélectionner une caisse…</option>
          {caissesPret.map((c) => (
            <option key={c.id} value={c.id}>{c.nom} · {c.tauxInteret || 0}%</option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Montant (FCFA)" required>
          <input type="number" className="input" placeholder="500000" value={form.montantPret}
            onChange={(e) => setForm((f) => ({ ...f, montantPret: e.target.value }))} />
        </FormField>
        <FormField label="Taux d'intérêt (%)">
          <input type="number" className="input" value={form.tauxInteret}
            onChange={(e) => setForm((f) => ({ ...f, tauxInteret: e.target.value }))} min="0" max="100" />
        </FormField>
      </div>
      {form.montantPret && (
        <div className="p-3 bg-primary-50 rounded-xl space-y-1">
          <div className="flex justify-between text-sm"><span className="text-gray-600">Capital :</span><span className="font-medium">{fmt(Number(form.montantPret))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-600">Intérêts ({form.tauxInteret}%) :</span><span className="font-medium text-purple-600">{fmt(montantInteret)}</span></div>
          <div className="flex justify-between text-sm pt-1 border-t border-primary-200"><span className="font-bold text-gray-700">Total :</span><span className="font-bold text-primary-700">{fmt(Number(form.montantPret) + montantInteret)}</span></div>
          {caisseSelectionnee && (
            <p className="text-xs text-primary-700 mt-1">Caisse source: {caisseSelectionnee.nom}</p>
          )}
          {caisseSelectionnee?.penaliteRetardActive && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertTriangle size={11} /> Pénalité de {caisseSelectionnee.tauxPenalite}% par échéance manquée sur cette caisse
            </p>
          )}
        </div>
      )}
      {repartitionSimulee.length > 0 && (
        <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
          <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1"><Coins size={12} /> Répartition des intérêts selon parts en caisse</p>
          <div className="space-y-1">
            {repartitionSimulee.map((r, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-700">{r.nomMembre} <span className="text-gray-400">({r.pourcentage}%)</span></span>
                <span className="font-semibold text-purple-600">{fmt(r.montantInterets)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {repartitionSimulee.length === 0 && form.montantPret && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
          Aucun membre avec solde en caisse. Les intérêts ne seront pas distribués automatiquement.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Durée (mois)">
          <input type="number" className="input" value={form.dureeMois} onChange={(e) => onDureeChange(e.target.value)} />
        </FormField>
        <FormField label="Date du prêt">
          <input type="date" className="input" value={form.datePret} onChange={(e) => onDateChange(e.target.value)} />
        </FormField>
      </div>
      <FormField label="Date d'échéance">
        <input type="date" className="input" value={form.dateEcheance}
          onChange={(e) => setForm((f) => ({ ...f, dateEcheance: e.target.value }))} />
        {form.datePret && form.dureeMois && <p className="text-xs text-primary-600 mt-1"> Auto: {fmtDate(calcEcheance(form.datePret, form.dureeMois))}</p>}
      </FormField>
      {pretSimule && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
              <p className="text-[11px] uppercase tracking-wide text-primary-700 font-semibold">Montant du prêt</p>
              <p className="text-sm font-bold text-primary-800 mt-1">{fmt(pretSimule.capital)}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Total intérêts</p>
              <p className="text-sm font-bold text-amber-800 mt-1">{fmt(pretSimule.totalInteret)}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl border border-green-100">
              <p className="text-[11px] uppercase tracking-wide text-green-700 font-semibold">Total à rembourser</p>
              <p className="text-sm font-bold text-green-800 mt-1">{fmt(pretSimule.montantTotal)}</p>
            </div>
            <div className="p-3 bg-surface-50 rounded-xl border border-surface-200">
              <p className="text-[11px] uppercase tracking-wide text-ink-600 font-semibold">Montant par mois</p>
              <p className="text-sm font-bold text-ink-900 mt-1">{fmt(pretSimule.mensualiteMoyenne)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-surface-200 overflow-hidden bg-white">
            <div className="flex items-center justify-between px-3 py-2.5 bg-surface-50 border-b border-surface-200">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-700">Fiche d'amortissement</p>
              <p className="text-[11px] text-ink-600/50">{pretSimule.duree} mois</p>
            </div>
            <div className="overflow-x-auto max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="border-b border-surface-100">
                    <th className="th">Mois</th>
                    <th className="th">Échéance</th>
                    <th className="th">Capital</th>
                    <th className="th">Intérêt</th>
                    <th className="th">Mensualité</th>
                    <th className="th">Reste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {pretSimule.ficheAmortissement.map((ligne) => (
                    <tr key={ligne.mois} className="tr">
                      <td className="td font-semibold">{ligne.mois}</td>
                      <td className="td text-ink-600/70">{fmtDate(ligne.dateEcheance)}</td>
                      <td className="td font-medium">{fmt(ligne.capital)}</td>
                      <td className="td font-medium text-amber-600">{fmt(ligne.interet)}</td>
                      <td className="td font-semibold text-primary-700">{fmt(ligne.total)}</td>
                      <td className="td font-semibold text-ink-800">{fmt(ligne.reste)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {caisseSelectionnee && (
            <p className="text-xs text-primary-700">Caisse source: {caisseSelectionnee.nom}</p>
          )}
        </div>
      )}
      <FormField label="Garantie">
        <select className="select" value={form.garantie} onChange={(e) => setForm((f) => ({ ...f, garantie: e.target.value }))}>
          <option value="caution_membre">Caution d'un membre</option>
          <option value="blocage_epargne">Blocage épargne</option>
          <option value="retenue_tontine">Retenue sur tontine</option>
          <option value="aucune">Aucune</option>
        </select>
      </FormField>
      {form.garantie === 'caution_membre' && (
        <FormField label="Avaliste (caution)" required hint="Membre qui se porte garant — requis pour cette garantie, vérifié par le serveur.">
          <select className="select" value={form.idAvaliste || ''} onChange={(e) => setForm((f) => ({ ...f, idAvaliste: e.target.value }))}>
            <option value="">Sélectionner un avaliste…</option>
            {avalistesPossibles.map((m) => <option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
          </select>
        </FormField>
      )}
      {form.garantie === 'retenue_tontine' && (
        <p className="text-xs text-amber-600 -mt-2">Le membre doit détenir au moins une part de tontine active — vérifié à la validation.</p>
      )}
      {form.garantie === 'blocage_epargne' && (
        <p className="text-xs text-amber-600 -mt-2">Module épargne pas encore disponible — cette garantie est acceptée mais non encore appliquée automatiquement.</p>
      )}
      <FormField label="Observation">
        <textarea className="input h-14 resize-none" value={form.observation}
          onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))} />
      </FormField>
    </div>
  );
}
