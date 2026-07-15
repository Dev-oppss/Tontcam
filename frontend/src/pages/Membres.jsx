import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus, Search, Eye, Pencil, Trash2, Users, Plus, Minus,
  Phone, MapPin, Briefcase, Calendar, CreditCard,
  Building2, HandCoins, ShieldAlert, Shield, Trophy,
  TrendingUp, CheckCircle, AlertCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { fmtDate, fmt, periodeLabel, typeAttrLabel } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { PageHeader, Table, Badge, Modal, FormField } from '../components/ui/index';
import clsx from 'clsx';

const sMap = { actif:'green', suspendu:'amber', demissionnaire:'gray', decede:'red' };
const sLbl = { actif:'Actif', suspendu:'Suspendu', demissionnaire:'Démissionnaire', décédé:'Décédé' };
const EMPTY = { nom:'', prenom:'', sexe:'M', telephone:'', adresse:'', profession:'', statut:'actif', dateAdhesion: new Date().toISOString().split('T')[0] };

// ── Fiche membre complète ─────────────────────────────────────
function FicheMembre({ membre, onClose, onEdit }) {
  const {
    tontines, membresParTontine, banques, comptesBanque, operationsBanque,
    prets, sanctions, planningTours, aidesAssurance, seanceTransactions,
    reunions,
  } = useApp();

  const [activeTab, setActiveTab] = useState('identite');

  const id = membre.id;

  // ── Tontines ──
  const inscriptions = membresParTontine
    .filter(mt => mt.idMembre === id)
    .map(mt => ({ ...mt, tontine: tontines.find(t => t.id === mt.idTontine) }))
    .filter(mt => mt.tontine);

  const totalParts = inscriptions.reduce((s, mt) => s + mt.nombreParts, 0);
  const totalCotisations = inscriptions.reduce((s, mt) => s + (mt.tontine.cotisation * mt.nombreParts), 0);

  // ── Tours planifiés / encaissés ──
  const tours = planningTours.filter(p => p.idMembre === id);
  const toursEncaisses = tours.filter(p => p.statut === 'encaisse');

  // ── Comptes bancaires ──
  const comptes = comptesBanque.filter(c => c.idMembre === id).map(c => ({
    ...c, banque: banques.find(b => b.id === c.idBanque),
  }));
  const totalEpargne = comptes.reduce((s, c) => s + c.solde, 0);

  // Opérations bancaires du membre
  const opsMembre = operationsBanque.filter(o => o.idMembre === id);

  // ── Prêts ──
  const pretsMembre = prets.filter(p => p.idMembre === id);
  const pretEnCours = pretsMembre.filter(p => ['en_cours','en_retard'].includes(p.statut));
  const totalPretsRestants = pretEnCours.reduce((s, p) => s + p.resteAPayer, 0);

  // ── Sanctions ──
  const sanctionsMembre = sanctions.filter(s => s.idMembre === id);
  const sanctionsImpa   = sanctionsMembre.filter(s => s.statut === 'impayee');
  const totalAmendes    = sanctionsMembre.filter(s => s.statut === 'payee').reduce((s, x) => s + x.montant, 0);

  // ── Fond Assurance ──
  const aidesMembre = (aidesAssurance || []).filter(a => a.idMembre === id);
  const totalAidesRecues = aidesMembre.reduce((s, a) => s + a.montantAide, 0);
  const compteAssurance = comptes.find(c => c.banque?.type === 'banque_assurance');
  const cotisAssuranceVersee = compteAssurance?.solde || 0;

  const tabs = [
    { id:'identite',  label:'Identité',    icon: UserPlus },
    { id:'tontines',  label:'Tontines',    icon: RefreshCw,  badge: inscriptions.length },
    { id:'banques',   label:'Épargne',     icon: Building2,  badge: comptes.filter(c=>c.banque?.type!=='banque_assurance').length },
    { id:'prets',     label:'Prêts',       icon: HandCoins,  badge: pretsMembre.length },
    { id:'sanctions', label:'Sanctions',   icon: ShieldAlert,badge: sanctionsImpa.length > 0 ? sanctionsImpa.length : null },
    { id:'assurance', label:'Fond Assur.', icon: Shield,     badge: aidesMembre.length > 0 ? aidesMembre.length : null },
  ];

  return createPortal((
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box max-w-[100rem] w-full" onClick={e => e.stopPropagation()}>

        {/* En-tête membre */}
        <div className="px-6 py-5 bg-gradient-to-r from-primary-700 to-primary-500 text-white rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black backdrop-blur-sm shrink-0">
                {membre.nom[0]}
              </div>
              <div>
                <p className="text-xl font-black">{membre.nom} {membre.prenom}</p>
                <p className="text-sm opacity-80 mt-0.5">{membre.numero} · {membre.profession}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', membre.statut === 'actif' ? 'bg-primary-400/30 text-white' : 'bg-red-400/30 text-white')}>
                    {sLbl[membre.statut] || membre.statut}
                  </span>
                  <span className="text-xs opacity-70">Depuis {fmtDate(membre.dateAdhesion)}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">X</button>
          </div>

          {/* KPIs rapides */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { l:'Tontines', v: inscriptions.length, icon:'' },
              { l:'Épargne',  v: fmt(totalEpargne).replace('XAF','').trim(), icon:'' },
              { l:'Prêts',    v: pretEnCours.length > 0 ? fmt(totalPretsRestants) : 'OK', icon:'' },
              { l:'Bénéficiaire', v: toursEncaisses.length + 'x', icon:'' },
            ].map(k => (
              <div key={k.l} className="bg-white/15 rounded-xl px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-base">{k.icon}</p>
                <p className="text-xs font-bold mt-0.5 truncate">{k.v}</p>
                <p className="text-xs opacity-70">{k.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={clsx('flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap',
                activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              <tab.icon size={12}/>
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className={clsx('px-1.5 py-0.5 rounded-full text-xs font-bold leading-none', tab.id === 'sanctions' ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600')}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">

          {/* ── IDENTITÉ ── */}
          {activeTab === 'identite' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['N° membre',      membre.numero,               CreditCard   ],
                  ['Sexe',           membre.sexe==='M'?'Masculin':'Féminin', UserPlus],
                  ['Téléphone',      membre.telephone,            Phone        ],
                  ['Adresse',        membre.adresse,              MapPin       ],
                  ['Profession',     membre.profession,           Briefcase    ],
                  ['Date adhésion',  fmtDate(membre.dateAdhesion),Calendar    ],
                ].map(([l, v, Icon]) => (
                  <div key={l} className="p-3 bg-gray-50 rounded-xl flex items-start gap-2">
                    <Icon size={13} className="text-gray-400 mt-0.5 shrink-0"/>
                    <div>
                      <p className="text-xs text-gray-400">{l}</p>
                      <p className="text-sm font-semibold text-gray-800">{v || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => { onClose(); onEdit(membre); }}
                className="btn-secondary w-full justify-center text-sm">
                <Pencil size={13}/> Modifier les informations
              </button>
            </div>
          )}

          {/* ── TONTINES ── */}
          {activeTab === 'tontines' && (
            <div className="space-y-3">
              {inscriptions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <RefreshCw size={28} className="mx-auto mb-2 text-gray-200"/>
                  <p className="text-sm">Non inscrit dans une tontine</p>
                </div>
              ) : inscriptions.map(mt => {
                const t = mt.tontine;
                const nbEncaisses = planningTours.filter(p => p.idTontine === t.id && p.statut === 'encaisse').length;
                const progressPct = t.nbTours > 0 ? Math.round(nbEncaisses / t.nbTours * 100) : 0;
                const tourMembre = tours.find(p => p.idTontine === t.id);
                const typeIcon = { rotation:'', tirage:'', enchere:'' }[t.typeAttribution] || '';
                const cotisParTour = t.cotisation * mt.nombreParts;
                const montantPot = t.cotisation * t.totalParts;
                return (
                  <div key={mt.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-800 flex items-center gap-1.5">
                          {typeIcon} {t.nom}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{periodeLabel[t.periode] || t.periode} · {typeAttrLabel[t.typeAttribution]}</p>
                      </div>
                      <Badge variant={mt.statut === 'actif' ? 'green' : 'amber'}>{mt.statut}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div className="p-2 bg-white rounded-xl text-center">
                        <p className="font-black text-primary-600">{mt.nombreParts}</p>
                        <p className="text-gray-400">Parts</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl text-center">
                        <p className="font-black text-gray-800">{fmt(cotisParTour)}</p>
                        <p className="text-gray-400">/ tour</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl text-center">
                        <p className="font-black text-amber-600">{fmt(montantPot)}</p>
                        <p className="text-gray-400">pot max</p>
                      </div>
                    </div>
                    {/* Progression tontine */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-1.5 bg-primary-500 rounded-full" style={{ width: `${progressPct}%` }}/>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{nbEncaisses}/{t.nbTours} tours</span>
                    </div>
                    {/* Tour du membre */}
                    {tourMembre ? (
                      <div className={clsx('flex items-center gap-2 p-2 rounded-xl text-xs', tourMembre.statut === 'encaisse' ? 'bg-primary-50 text-primary-700' : 'bg-blue-50 text-blue-700')}>
                        {tourMembre.statut === 'encaisse' ? <CheckCircle size={11}/> : <Clock size={11}/>}
                        Tour N°{tourMembre.numeroTour} — {tourMembre.statut === 'encaisse' ? `Encaissé le ${fmtDate(tourMembre.dateReelle)}` : `Prévu le ${fmtDate(tourMembre.datePrevue)}`}
                        {tourMembre.montantPot > 0 && <span className="ml-auto font-bold">{fmt(tourMembre.montantPot)}</span>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-1">Tour non encore planifié</p>
                    )}
                  </div>
                );
              })}
              <div className="p-3 bg-primary-50 rounded-xl border border-primary-100 flex justify-between text-sm">
                <span className="text-gray-600">Total cotisation par tour</span>
                <span className="font-black text-primary-700">{fmt(totalCotisations)}</span>
              </div>
            </div>
          )}

          {/* ── ÉPARGNE / BANQUES ── */}
          {activeTab === 'banques' && (
            <div className="space-y-3">
              {comptes.filter(c => c.banque?.type !== 'banque_assurance').length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Building2 size={28} className="mx-auto mb-2 text-gray-200"/>
                  <p className="text-sm">Aucun compte bancaire</p>
                </div>
              ) : comptes.filter(c => c.banque?.type !== 'banque_assurance').map(c => {
                const opsCompte = opsMembre.filter(o => o.idBanque === c.idBanque);
                const totalDep  = opsCompte.filter(o => o.typeOperation === 'depot').reduce((s, o) => s + o.montant, 0);
                const totalRet  = opsCompte.filter(o => o.typeOperation === 'retrait').reduce((s, o) => s + o.montant, 0);
                return (
                  <div key={c.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm text-gray-800"> {c.nomBanque}</p>
                        <p className="text-xs text-gray-400">{c.banque?.description}</p>
                      </div>
                      <p className="text-xl font-black text-primary-600">{fmt(c.solde)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-green-50 rounded-xl flex justify-between">
                        <span className="text-gray-500">Dépôts</span><span className="font-bold text-green-600">{fmt(totalDep)}</span>
                      </div>
                      <div className="p-2 bg-red-50 rounded-xl flex justify-between">
                        <span className="text-gray-500">Retraits</span><span className="font-bold text-red-500">{fmt(totalRet)}</span>
                      </div>
                    </div>
                    {opsCompte.length > 0 && (
                      <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                        {[...opsCompte].reverse().slice(0, 5).map(op => (
                          <div key={op.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                            <span className="text-gray-500">{fmtDate(op.dateOperation)}</span>
                            <span className="text-gray-600 flex-1 mx-2 truncate">{op.observation || op.typeOperation}</span>
                            <span className={op.typeOperation === 'depot' ? 'font-bold text-green-600' : 'font-bold text-red-500'}>
                              {op.typeOperation === 'depot' ? '+' : '−'}{fmt(op.montant)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {comptes.filter(c => c.banque?.type !== 'banque_assurance').length > 0 && (
                <div className="p-3 bg-primary-50 rounded-xl flex justify-between text-sm">
                  <span className="text-gray-600">Total épargne</span>
                  <span className="font-black text-primary-700">{fmt(comptes.filter(c=>c.banque?.type!=='banque_assurance').reduce((s,c)=>s+c.solde,0))}</span>
                </div>
              )}
            </div>
          )}

          {/* ── PRÊTS ── */}
          {activeTab === 'prets' && (
            <div className="space-y-3">
              {pretsMembre.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <HandCoins size={28} className="mx-auto mb-2 text-gray-200"/>
                  <p className="text-sm">Aucun prêt enregistré</p>
                </div>
              ) : pretsMembre.map(p => {
                const pct = Math.round(p.montantRembourse / p.montantTotal * 100);
                const sColor = { en_cours:'blue', en_retard:'red', rembourse:'green' };
                const sLabel = { en_cours:'En cours', en_retard:' En retard', rembourse:'OK Remboursé' };
                return (
                  <div key={p.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-gray-800">Prêt du {fmtDate(p.datePret)}</p>
                      <Badge variant={sColor[p.statut]}>{sLabel[p.statut]}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div className="p-2 bg-white rounded-xl text-center">
                        <p className="font-black text-gray-800">{fmt(p.montantPret)}</p><p className="text-gray-400">Capital</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl text-center">
                        <p className="font-black text-purple-600">{fmt(p.montantInteret)}</p><p className="text-gray-400">Intérêts {p.tauxInteret}%</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl text-center">
                        <p className={clsx('font-black', p.resteAPayer > 0 ? 'text-red-600' : 'text-green-600')}>{p.resteAPayer > 0 ? fmt(p.resteAPayer) : 'OK Soldé'}</p>
                        <p className="text-gray-400">Reste dû</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={clsx('h-2 rounded-full', p.statut === 'en_retard' ? 'bg-red-500' : 'bg-primary-500')} style={{ width: `${pct}%` }}/>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{pct}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Échéance : {fmtDate(p.dateEcheance)} · Garantie : {p.garantie}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SANCTIONS ── */}
          {activeTab === 'sanctions' && (
            <div className="space-y-3">
              {sanctionsMembre.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle size={28} className="mx-auto mb-2 text-green-200"/>
                  <p className="text-sm text-green-600 font-medium">Aucune sanction — dossier irréprochable OK</p>
                </div>
              ) : (
                <>
                  {sanctionsImpa.length > 0 && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 flex items-center gap-2">
                      <AlertCircle size={15} className="text-red-500 shrink-0"/>
                      <p className="text-xs text-red-700 font-medium">{sanctionsImpa.length} sanction(s) impayée(s) — {fmt(sanctionsImpa.reduce((s,x)=>s+x.montant,0))} à régler</p>
                    </div>
                  )}
                  {sanctionsMembre.map(s => (
                    <div key={s.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
                      <span className="text-base"></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">{s.typeSanction} — Réunion N°{s.numReunion}</p>
                        <p className="text-xs text-gray-400">{fmtDate(s.dateSanction)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-amber-600">{fmt(s.montant)}</p>
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-medium', s.statut === 'payee' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                          {s.statut === 'payee' ? 'OK Payée' : ' Impayée'}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-gray-50 rounded-xl flex justify-between text-xs">
                    <span className="text-gray-500">Total amendes payées</span>
                    <span className="font-bold text-amber-600">{fmt(totalAmendes)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── FOND ASSURANCE ── */}
          {activeTab === 'assurance' && (
            <div className="space-y-3">
              {/* Statut éligibilité */}
              <div className={clsx('p-4 rounded-2xl border-2 flex items-center gap-3',
                cotisAssuranceVersee > 0 ? 'border-green-300 bg-green-50' : 'border-red-200 bg-red-50')}>
                {cotisAssuranceVersee > 0
                  ? <CheckCircle size={22} className="text-green-500 shrink-0"/>
                  : <AlertCircle size={22} className="text-red-500 shrink-0"/>
                }
                <div>
                  <p className={clsx('font-bold text-sm', cotisAssuranceVersee > 0 ? 'text-green-800' : 'text-red-700')}>
                    {cotisAssuranceVersee > 0 ? 'OK Éligible aux aides' : 'Non Non éligible — cotisation en attente'}
                  </p>
                  <p className="text-xs mt-0.5 opacity-75">
                    {cotisAssuranceVersee > 0
                      ? `Cotisation versée : ${fmt(cotisAssuranceVersee)}`
                      : 'Doit cotiser au Fond Assurance pour bénéficier des aides'}
                  </p>
                </div>
              </div>

              {/* Aides reçues */}
              {aidesMembre.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Shield size={28} className="mx-auto mb-2 text-gray-200"/>
                  <p className="text-sm">Aucune aide reçue à ce jour</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-gray-600">Aides reçues du Fond Assurance</p>
                  {aidesMembre.map(a => {
                    const typeIcon = { deces_parent:'', deces_membre:'', maladie:'', mariage:'', naissance:'', accident:'', autre:'' };
                    return (
                      <div key={a.id} className="p-3 bg-pink-50 rounded-xl border border-pink-200 flex items-center gap-3">
                        <span className="text-lg">{typeIcon[a.typeEvenement] || ''}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800">{a.typeEvenement.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-400">{fmtDate(a.dateEvenement)} — {a.description}</p>
                        </div>
                        <p className="font-black text-pink-600">{fmt(a.montantAide)}</p>
                      </div>
                    );
                  })}
                  <div className="p-3 bg-pink-50 rounded-xl flex justify-between text-sm border border-pink-100">
                    <span className="text-gray-600">Total aides reçues</span>
                    <span className="font-black text-pink-600">{fmt(totalAidesRecues)}</span>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  ), document.body);
}

// ── Page principale Membres ───────────────────────────────────
export default function Membres() {
  const { membres, tontines, membresParTontine, addMembre, updateMembre, deleteMembre, addMembreTontine, removeMembreTontine, updateMembreTontine } = useApp();

  const [search,     setSearch]     = useState('');
  const [filtre,     setFiltre]     = useState('tous');
  const [view,       setView]       = useState(null);
  const [edit,       setEdit]       = useState(null);
  const [add,        setAdd]        = useState(false);
  const [confirm,    setConfirm]    = useState(null);
  const [form,       setForm]       = useState(EMPTY);

  const [showInscrit, setShowInscrit] = useState(null);
  const [formInscrit, setFormInscrit] = useState({ idTontine:'', nombreParts:1, dateAdhesion:'' });

  const list = membres.filter(m => {
    const q = search.toLowerCase();
    return `${m.nom} ${m.prenom} ${m.numero} ${m.telephone}`.toLowerCase().includes(q)
      && (filtre === 'tous' || m.statut === filtre);
  });

  const openEdit = (m) => { setForm({ ...m }); setEdit(m); };

  const handleAdd  = () => { if (!form.nom.trim()||!form.prenom.trim()||!form.telephone.trim()) return; addMembre({...form}); setAdd(false); };
  const handleEdit = () => { if (!form.nom.trim()||!form.prenom.trim()||!form.telephone.trim()) return; updateMembre(edit.id, {...edit,...form}); setEdit(null); };

  const formRef = useRef(form); formRef.current = form;
  const F = useRef(({k,...p}) => <input className="input" value={formRef.current[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} {...p}/>).current;
  const S = useRef(({k,children}) => <select className="select" value={formRef.current[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}>{children}</select>).current;

  const getTontinesDuMembre  = id => membresParTontine.filter(mt=>mt.idMembre===id).map(mt=>({...mt,tontine:tontines.find(t=>t.id===mt.idTontine)}));
  const getTontinesDisponibles = id => tontines.filter(t=>!membresParTontine.some(mt=>mt.idMembre===id&&mt.idTontine===t.id));
  const getTotalParts = id => membresParTontine.filter(mt=>mt.idMembre===id).reduce((s,mt)=>s+mt.nombreParts,0);

  const handleInscrit = () => {
    if (!formInscrit.idTontine) return;
    addMembreTontine({ idMembre:showInscrit.id, idTontine:Number(formInscrit.idTontine), nombreParts:Number(formInscrit.nombreParts)||1, dateAdhesion:formInscrit.dateAdhesion||new Date().toISOString().split('T')[0] });
    setFormInscrit({idTontine:'',nombreParts:1,dateAdhesion:''});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membres"
        subtitle={`${membres.length} membres — ${membresParTontine.reduce((s,mt)=>s+mt.nombreParts,0)} parts totales`}
        action={<button onClick={()=>{setForm(EMPTY);setAdd(true);}} className="btn-primary"><UserPlus size={15}/> Nouveau membre</button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {l:'Total',      v:membres.length,                                c:'text-gray-800'},
          {l:'Actifs',     v:membres.filter(m=>m.statut==='actif').length,  c:'text-primary-600'},
          {l:'Suspendus',  v:membres.filter(m=>m.statut==='suspendu').length,c:'text-amber-600'},
          {l:'Inscriptions',v:membresParTontine.length,                     c:'text-blue-600'},
        ].map(s=>(
          <div key={s.l} className="card py-3 text-center">
            <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="card py-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-48">
          <Search size={13} className="text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom, numéro…" className="bg-transparent text-sm outline-none flex-1"/>
        </div>
        <select value={filtre} onChange={e=>setFiltre(e.target.value)} className="select w-44">
          <option value="tous">Tous les statuts</option>
          <option value="actif">Actifs</option>
          <option value="suspendu">Suspendus</option>
          <option value="demissionnaire">Démissionnaires</option>
        </select>
      </div>

      <Table headers={['N°','Membre','Tontines','Parts','Téléphone','Statut','Actions']}>
        {list.map(m => {
          const tontinesMembre = getTontinesDuMembre(m.id);
          const totalParts     = getTotalParts(m.id);
          return (
            <tr key={m.id} className="hover:bg-gray-50 cursor-pointer" onClick={()=>setView(m)}>
              <td className="px-4 py-3 text-xs text-gray-400 font-mono">{m.numero}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{m.nom[0]}</div>
                  <div>
                    <p className="font-semibold text-gray-800">{m.nom} {m.prenom}</p>
                    <p className="text-xs text-gray-400">{m.profession}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                {tontinesMembre.length===0
                  ? <span className="text-xs text-gray-300">Aucune</span>
                  : <div className="flex flex-wrap gap-1">
                      {tontinesMembre.map(mt=>(
                        <span key={mt.id} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                          {mt.tontine?.nom} ({mt.nombreParts}p)
                        </span>
                      ))}
                    </div>
                }
              </td>
              <td className="px-4 py-3 text-center font-bold text-primary-600">{totalParts}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{m.telephone}</td>
              <td className="px-4 py-3"><Badge variant={sMap[m.statut]||'gray'}>{sLbl[m.statut]||m.statut}</Badge></td>
              <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                <div className="flex gap-1">
                  <button onClick={()=>setView(m)} title="Fiche complète" className="p-1.5 hover:bg-primary-50 rounded-lg"><Eye size={14} className="text-primary-400"/></button>
                  <button onClick={()=>{setShowInscrit(m);setFormInscrit({idTontine:'',nombreParts:1,dateAdhesion:''}); }} title="Tontines" className="p-1.5 hover:bg-gray-100 rounded-lg"><Users size={14} className="text-gray-400"/></button>
                  <button onClick={()=>openEdit(m)} title="Modifier" className="p-1.5 hover:bg-blue-50 rounded-lg"><Pencil size={14} className="text-blue-400"/></button>
                  <button onClick={()=>setConfirm(m.id)} title="Supprimer" className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} className="text-red-400"/></button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      {/* ── Fiche complète (modal custom) ── */}
      {view && <FicheMembre membre={view} onClose={()=>setView(null)} onEdit={(m)=>{openEdit(m);}}/>}

      {/* ── Modal Gestion Tontines ── */}
      <Modal open={!!showInscrit} onClose={()=>setShowInscrit(null)} title={`Tontines — ${showInscrit?.nom} ${showInscrit?.prenom}`}
        footer={<button onClick={()=>setShowInscrit(null)} className="btn-secondary ml-auto">Fermer</button>}>
        {showInscrit && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Inscriptions actuelles</p>
              <div className="space-y-2">
                {getTontinesDuMembre(showInscrit.id).length===0
                  ? <p className="text-xs text-gray-400 text-center py-3">Aucune inscription</p>
                  : getTontinesDuMembre(showInscrit.id).map(mt=>(
                      <div key={mt.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{mt.tontine?.nom}</p>
                          <p className="text-xs text-gray-400">{periodeLabel[mt.tontine?.periode]} · {fmt(mt.tontine?.cotisation)}/part</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <button onClick={()=>updateMembreTontine({...mt,nombreParts:Math.max(1,mt.nombreParts-1)})} className="p-1 hover:bg-gray-200 rounded"><Minus size={12}/></button>
                            <span className="text-sm font-bold text-primary-600 w-8 text-center">{mt.nombreParts}</span>
                            <button onClick={()=>updateMembreTontine({...mt,nombreParts:mt.nombreParts+1})} className="p-1 hover:bg-gray-200 rounded"><Plus size={12}/></button>
                          </div>
                          <Badge variant={mt.statut==='actif'?'green':'amber'}>{mt.statut}</Badge>
                          <button onClick={()=>removeMembreTontine(mt.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={13} className="text-red-400"/></button>
                        </div>
                      </div>
                    ))
                }
              </div>
            </div>
            {getTontinesDisponibles(showInscrit.id).length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Inscrire dans une tontine</p>
                <div className="flex gap-2 flex-wrap">
                  <select className="select flex-1" value={formInscrit.idTontine} onChange={e=>setFormInscrit(f=>({...f,idTontine:e.target.value}))}>
                    <option value="">-- Choisir --</option>
                    {getTontinesDisponibles(showInscrit.id).map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Parts :</label>
                    <input type="number" min="1" className="input w-16 text-center" value={formInscrit.nombreParts} onChange={e=>setFormInscrit(f=>({...f,nombreParts:e.target.value}))}/>
                  </div>
                  <button onClick={handleInscrit} className="btn-primary"><Plus size={14}/> Inscrire</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Add / Edit ── */}
      {[{open:add,onClose:()=>setAdd(false),title:'Nouveau membre',onSave:handleAdd,label:'Ajouter'},
        {open:!!edit,onClose:()=>setEdit(null),title:'Modifier le membre',onSave:handleEdit,label:'Enregistrer'}
      ].map(({open,onClose,title,onSave,label})=>(
        <Modal key={title} open={open} onClose={onClose} title={title}
          footer={<><button onClick={onClose} className="btn-secondary">Annuler</button><button onClick={onSave} className="btn-primary">{label}</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nom" required><F k="nom" placeholder="NGONO"/></FormField>
              <FormField label="Prénom" required><F k="prenom" placeholder="Élise"/></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Sexe"><S k="sexe"><option value="M">Masculin</option><option value="F">Féminin</option></S></FormField>
              <FormField label="Téléphone" required><F k="telephone" placeholder="699 000 000"/></FormField>
            </div>
            <FormField label="Adresse"><F k="adresse" placeholder="Douala, Akwa"/></FormField>
            <FormField label="Profession"><F k="profession" placeholder="Commerçant(e)"/></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Statut"><S k="statut"><option value="actif">Actif</option><option value="suspendu">Suspendu</option><option value="demissionnaire">Démissionnaire</option></S></FormField>
              <FormField label="Date adhésion"><F k="dateAdhesion" type="date"/></FormField>
            </div>
          </div>
        </Modal>
      ))}

      <Modal open={!!confirm} onClose={()=>setConfirm(null)} title="Confirmer la suppression"
        footer={<><button onClick={()=>setConfirm(null)} className="btn-secondary">Annuler</button><button onClick={()=>{deleteMembre(confirm);setConfirm(null);}} className="btn-danger">Supprimer</button></>}>
        <p className="text-sm text-gray-600">Cette action est irréversible. Le membre sera retiré de toutes les tontines.</p>
      </Modal>
    </div>
  );
}
