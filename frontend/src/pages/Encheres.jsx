import { useState, useEffect } from 'react';
import { Gavel, Trophy, Info } from 'lucide-react';
import { fmt, fmtDate } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge } from '../components/ui/index';

// RÈGLE D'OR : toute enchère et toute attribution de tour se font depuis la
// Réunion en cours (onglet Bénéficiaire), jamais depuis cette page. Avant ce
// correctif, cette page permettait d'enregistrer une enchère et de désigner
// un gagnant en dehors de tout contexte de séance, en appelant directement
// le même endpoint que le flux réunion (POST /cycles/{id}/encheres) — donc
// sans passage par le PV, sans traçabilité de séance. Cette page reste utile
// en lecture seule pour visualiser l'état des enchères en cours et l'historique.
export default function Encheres() {
  const { rotations, encheres, tontines, chargerRotations } = useApp();

  useEffect(() => {
    tontines.filter(t => t.typeAttribution === 'enchere').forEach(t => chargerRotations(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tontines.map(t => t.id).join(',')]);

  // Tour en attente d'attribution
  const tourEnCours = rotations.find(r => !r.dateAttribution);
  const encTour = tourEnCours ? encheres.filter(e => e.idRotation === tourEnCours.id) : [];
  const potTotal = tourEnCours?.montantTotal || 0;

  const maxEnchere = encTour.length > 0
    ? encTour.reduce((max, e) => e.montantEnchere > max.montantEnchere ? e : max, encTour[0])
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Enchères" subtitle="Suivi des enchères — les actions se font depuis la Réunion en cours" />

      <div className="card border-l-4 border-l-primary-400 bg-primary-50/40 flex items-start gap-3">
        <Info size={18} className="text-primary-600 mt-0.5 shrink-0" />
        <p className="text-sm text-primary-800">
          Enregistrer une enchère ou désigner le gagnant se fait exclusivement depuis la <strong>Réunion en cours</strong> (onglet Bénéficiaire),
          afin que chaque enchère reste rattachée à une séance et à son PV. Cette page n'affiche que le suivi.
        </p>
      </div>

      {!tourEnCours && (
        <div className="card text-center py-12 text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 text-gray-200"/>
          <p className="font-medium">Tous les tours ont été attribués</p>
          <p className="text-sm mt-1">Aucun tour en attente d'enchère</p>
        </div>
      )}

      {tourEnCours && (
        <>
          {/* Simulation */}
          <div className="card border-l-4 border-l-amber-500 bg-amber-50/40">
            <div className="flex items-start gap-3">
              <Gavel size={20} className="text-amber-600 mt-0.5 shrink-0"/>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 mb-3">Tour N°{tourEnCours.numeroTour} — En cours d'enchères</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-white rounded-xl text-center border border-amber-100">
                    <p className="text-xs text-gray-400 mb-1">Pot total</p>
                    <p className="text-lg font-bold text-gray-800">{fmt(potTotal)}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl text-center border border-amber-100">
                    <p className="text-xs text-gray-400 mb-1">Meilleure enchère</p>
                    {maxEnchere ? (
                      <>
                        <p className="text-lg font-bold text-amber-600">{fmt(maxEnchere.montantEnchere)}</p>
                        <p className="text-xs text-gray-500">{maxEnchere.nomMembre}</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Aucune enchère</p>
                    )}
                  </div>
                  <div className="p-3 bg-primary-50 rounded-xl text-center border border-primary-100">
                    <p className="text-xs text-gray-400 mb-1">Gagnant recevra</p>
                    <p className="text-lg font-bold text-primary-600">
                      {maxEnchere ? fmt(potTotal - maxEnchere.montantEnchere) : fmt(potTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau enchères */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Enchères reçues — Tour N°{tourEnCours.numeroTour}</h3>
              <Badge variant="amber">{encTour.length} enchère(s)</Badge>
            </div>
            {encTour.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Aucune enchère reçue pour ce tour</p>
            ) : (
              <Table headers={['Rang','Membre','Montant enchère','Date','Statut']}>
                {[...encTour].sort((a,b)=>b.montantEnchere-a.montantEnchere).map((e,i)=>(
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="td">
                      {i===0
                        ? <div className="flex items-center gap-1.5 text-amber-600 font-bold"><Trophy size={14}/>1er</div>
                        : <span className="text-gray-400 font-medium">{i+1}e</span>}
                    </td>
                    <td className="td font-semibold text-gray-800">{e.nomMembre}</td>
                    <td className="td"><span className={`font-bold text-lg ${i===0?'text-amber-600':'text-gray-700'}`}>{fmt(e.montantEnchere)}</span></td>
                    <td className="td text-gray-500">{fmtDate(e.dateEnchere)}</td>
                    <td className="td"><Badge variant={i===0?'amber':'gray'}>{i===0?'Meilleure offre':'En attente'}</Badge></td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </>
      )}

      {/* Historique des tours attribués */}
      {rotations.filter(r=>r.dateAttribution).length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Historique des attributions</h3>
          </div>
          <Table headers={['Tour','Bénéficiaire','Enchère gagnante','Montant reçu','Date']}>
            {rotations.filter(r=>r.dateAttribution).reverse().map(r=>(
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="td"><div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold">{r.numeroTour}</div></td>
                <td className="td font-semibold text-gray-800">{r.beneficiaire}</td>
                <td className="td text-amber-600 font-bold">{r.enchere>0?fmt(r.enchere):'—'}</td>
                <td className="td font-bold text-primary-600">{fmt(r.montantRecu)}</td>
                <td className="td text-gray-500">{fmtDate(r.dateAttribution)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
