import { useEffect, useMemo, useState } from 'react';
import { Wallet, Landmark, ShieldAlert, HeartHandshake, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fmt, fmtDate } from '../data/mockData';
import { PageHeader, SectionCard, Table, Badge, EmptyState } from '../components/ui/index';

export default function PortailMembre() {
  const { portailMoi, chargerPortailMoi } = useApp();
  const [loading, setLoading] = useState(true);

  // Isolation stricte côté serveur (RG-SEC-006/007) : /portail/moi ne renvoie
  // que les données du membre lié à l'utilisateur connecté — le rôle "membre"
  // n'a de toute façon pas la permission de lire /membres, /prets, /sanctions
  // globalement (vérifié fail-closed côté backend), donc plus aucun filtrage
  // client sur des listes globales n'est nécessaire ni même possible ici.
  useEffect(() => {
    chargerPortailMoi?.().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moi = portailMoi?.membre;
  const mesParts = moi?.parts || [];
  const mesPrets = portailMoi?.prets || [];
  const mesSanctions = portailMoi?.sanctions || [];
  const mesPresences = moi?.presences || [];

  const tauxParticipation = useMemo(() => mesPresences.length
    ? Math.round((mesPresences.filter((p) => p.statut === 'present').length / mesPresences.length) * 100)
    : null, [mesPresences]);

  const sanctionsDues = mesSanctions.filter((s) => s.statut === 'due').reduce((s, x) => s + Number(x.montant || 0), 0);
  const pretsEnCours = mesPrets.filter((p) => ['en_cours', 'en_retard', 'retard'].includes(p.statut)).reduce((s, x) => s + Number(x.capital_restant ?? x.montant_principal ?? 0), 0);

  if (loading) {
    return <div className="py-16 text-center text-ink-600/40">Chargement de votre espace…</div>;
  }

  if (!moi) {
    return (
      <EmptyState
        icon={Wallet}
        title="Aucune fiche membre liée"
        description="Votre compte utilisateur n'est pas encore rattaché à une fiche membre. Contactez le Trésorier."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mon espace" subtitle={`Bienvenue, ${moi.nom} ${moi.prenom} — vue strictement personnelle`} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <Wallet size={18} className="mx-auto text-indigo-500 mb-2" />
          <p className="text-lg font-mono font-semibold text-ink-900">{mesParts.length}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Parts actives</p>
        </div>
        <div className="card text-center">
          <Landmark size={18} className="mx-auto text-bronze-500 mb-2" />
          <p className="text-lg font-mono font-semibold text-ink-900">{fmt(pretsEnCours)}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Prêts en cours</p>
        </div>
        <div className="card text-center">
          <ShieldAlert size={18} className="mx-auto text-red-500 mb-2" />
          <p className="text-lg font-mono font-semibold text-ink-900">{fmt(sanctionsDues)}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Sanctions dues</p>
        </div>
        <div className="card text-center">
          <TrendingUp size={18} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-lg font-mono font-semibold text-ink-900">{tauxParticipation !== null ? `${tauxParticipation}%` : '—'}</p>
          <p className="text-[11px] text-ink-600/50 mt-0.5">Taux de présence</p>
        </div>
      </div>

      <SectionCard title="Mes tontines" subtitle="Statut de chaque part que vous détenez">
        {mesParts.length === 0 ? (
          <p className="text-sm text-ink-600/50 italic py-4 text-center">Vous ne détenez aucune part pour le moment.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {mesParts.map((mt) => (
              <div key={mt.id} className="rounded-xl bg-white/40 border border-white/50 p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">{mt.tontine?.libelle || 'Tontine'}</p>
                  <p className="text-xs text-ink-600/50">Part #{mt.numero_part || mt.id}</p>
                </div>
                <Badge variant={mt.statut === 'gagnee' ? 'amber' : 'green'}>{mt.statut === 'gagnee' ? 'Gagnée' : 'Disponible'}</Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Mes prêts" className="p-0 overflow-hidden">
        <Table headers={['Montant', 'Taux', 'Statut', 'Restant dû']}>
          {mesPrets.map((p) => (
            <tr key={p.id} className="hover:bg-white/40 transition-colors">
              <td className="td num">{fmt(p.montant_principal)}</td>
              <td className="td">{p.taux_interet_mensuel}%</td>
              <td className="td"><Badge variant={p.statut === 'en_retard' || p.statut === 'retard' ? 'red' : p.statut === 'solde' ? 'green' : 'blue'}>{p.statut}</Badge></td>
              <td className="td num font-semibold">{fmt(p.capital_restant ?? p.montant_principal)}</td>
            </tr>
          ))}
          {mesPrets.length === 0 && <tr><td colSpan={4} className="td text-center text-ink-600/40 py-6">Aucun prêt</td></tr>}
        </Table>
      </SectionCard>

      <SectionCard title="Mes sanctions" className="p-0 overflow-hidden">
        <Table headers={['Motif', 'Montant', 'Date', 'Statut']}>
          {mesSanctions.map((s) => (
            <tr key={s.id} className="hover:bg-white/40 transition-colors">
              <td className="td text-ink-600/60">{s.motif}</td>
              <td className="td num text-red-600 font-semibold">{fmt(s.montant)}</td>
              <td className="td text-ink-600/60">{fmtDate(s.date_sanction)}</td>
              <td className="td"><Badge variant={s.statut === 'payee' ? 'green' : s.statut === 'annulee' ? 'gray' : 'red'}>{s.statut === 'payee' ? 'Payée' : s.statut === 'annulee' ? 'Annulée' : 'Due'}</Badge></td>
            </tr>
          ))}
          {mesSanctions.length === 0 && <tr><td colSpan={4} className="td text-center text-ink-600/40 py-6">Aucune sanction</td></tr>}
        </Table>
      </SectionCard>

      <p className="text-xs text-ink-600/40 text-center flex items-center justify-center gap-1.5">
        <HeartHandshake size={12} /> Vous ne voyez que vos propres données. Pour toute question, contactez le Trésorier.
      </p>
    </div>
  );
}
