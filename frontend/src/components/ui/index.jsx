import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

/* ── Badge ──────────────────────────────────────────────────── */
const badgeMap = {
  green:'badge-green', red:'badge-red', amber:'badge-amber',
  blue:'badge-blue',   gray:'badge-gray', purple:'badge-purple',
};
export function Badge({ children, variant = 'gray' }) {
  return <span className={badgeMap[variant] || 'badge-gray'}>{children}</span>;
}

/* ── StatCard ───────────────────────────────────────────────── */
export function StatCard({ icon: Icon, label, value, sub, iconBg = 'bg-primary-50', iconColor = 'text-primary-600', trend, accent }) {
  return (
    <div className="card-hover fade-up flex items-start gap-4 relative pl-3">
      {accent && <div className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-md" style={{ background: accent }} />}
      {Icon && <div className={clsx('stat-icon-wrap shrink-0', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>}
      <div className="min-w-0 flex-1">
        <p className="label text-[11px]">{label}</p>
        <p className="text-xl font-bold text-ink-900 mt-0.5 leading-tight tracking-tight">{value}</p>
        {sub && <p className="text-xs text-ink-600/50 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0', trend >= 0 ? 'text-primary-700 bg-primary-50' : 'text-red-700 bg-red-50')}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
  );
}

/* ── Table ──────────────────────────────────────────────────── */
export function Table({ headers, children, empty }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-200 bg-white/90">
      <table className="w-full">
        <thead>
          <tr className="bg-surface-50 border-b border-surface-200">
            {headers.map(h => <th key={h} className="th">{h}</th>)}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-surface-100">
          {children}
        </tbody>
      </table>
      {empty}
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-overlay scale-in" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h3 className="font-semibold text-ink-900 text-base">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-ink-600/50 hover:text-ink-800 hover:bg-surface-100 rounded-lg transition-all">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-surface-100 flex justify-end gap-3 bg-surface-50 rounded-b-[18px]">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* ── PageHeader ─────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-ink-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-ink-600/60 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ── FormField ──────────────────────────────────────────────── */
export function FormField({ label, required, children, hint }) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-red-500 ml-0.5 normal-case font-normal">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-600/45 mt-1">{hint}</p>}
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {Icon && (
        <div className="w-14 h-14 rounded-[22px] bg-surface-100 border border-surface-200 flex items-center justify-center mb-4">
          <Icon size={26} className="text-ink-600/30" />
        </div>
      )}
      <p className="text-sm font-display font-semibold text-ink-700">{title}</p>
      {description && <p className="text-xs text-ink-600/50 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── SectionCard ────────────────────────────────────────────── */
export function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={clsx('card', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <h3 className="font-display font-semibold text-ink-800 text-sm">{title}</h3>}
            {subtitle && <p className="text-xs text-ink-600/50 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Divider ────────────────────────────────────────────────── */
export function Divider({ label }) {
  if (!label) return <hr className="border-surface-200 my-4" />;
  return (
    <div className="section-divider my-4">
      <span className="text-[11px] font-semibold text-ink-600/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}
