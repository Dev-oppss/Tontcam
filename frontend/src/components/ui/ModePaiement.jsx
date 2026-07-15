import { MODES_PAIEMENT, modePaiementConfig } from '../../data/mockData';
import { FormField } from './index';

/**
 * Champs "Mode de paiement" + "Détails" réutilisables sur toute opération
 * de caisse (entrée ou sortie). Le champ détails s'affiche/se masque et
 * change de libellé dynamiquement selon le mode choisi (RG-CAI-011/012).
 *
 * Props :
 *  - modePaiement / detailsPaiement : valeurs contrôlées
 *  - onModeChange / onDetailsChange : callbacks
 *  - required : si true, bloque la validation tant que le mode (et le
 *    détail si nécessaire) n'est pas renseigné — à combiner avec isValid()
 */
export function ModePaiementFields({
  modePaiement,
  detailsPaiement,
  onModeChange,
  onDetailsChange,
  required = true,
}) {
  const cfg = modePaiementConfig[modePaiement] || modePaiementConfig.especes;

  return (
    <div className="space-y-3">
      <FormField label="Mode de paiement" required={required}>
        <select
          className="select"
          value={modePaiement || 'especes'}
          onChange={(e) => onModeChange(e.target.value)}
        >
          {MODES_PAIEMENT.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </FormField>

      {cfg.detail && (
        <FormField label={cfg.detailLabel} required={required} hint="Champ contextuel selon le mode choisi">
          <input
            className="input"
            placeholder={cfg.detailPlaceholder}
            value={detailsPaiement || ''}
            onChange={(e) => onDetailsChange(e.target.value)}
          />
        </FormField>
      )}
    </div>
  );
}

/** Validation partagée : mode requis, détail requis sauf espèces */
export function isModePaiementValid(modePaiement, detailsPaiement) {
  if (!modePaiement) return false;
  const cfg = modePaiementConfig[modePaiement];
  if (!cfg) return false;
  if (cfg.detail && !String(detailsPaiement || '').trim()) return false;
  return true;
}

/** Badge compact pour affichage dans les listes/journaux */
export function ModePaiementBadge({ modePaiement, detailsPaiement }) {
  const cfg = modePaiementConfig[modePaiement];
  if (!cfg) return <span className="text-ink-600/40 text-xs">—</span>;
  return (
    <span className="inline-flex flex-col">
      <span className="text-xs font-semibold text-ink-800">{cfg.label}</span>
      {cfg.detail && detailsPaiement && (
        <span className="text-[11px] text-ink-600/50">{detailsPaiement}</span>
      )}
    </span>
  );
}
