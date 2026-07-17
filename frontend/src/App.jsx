import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Toast }      from './components/ui/Toast';
import Layout        from './components/layout/Layout';
import Login         from './pages/Login';
import Register      from './pages/Register';
import Setup         from './pages/Setup';
import Dashboard     from './pages/Dashboard';
import Membres       from './pages/Membres';
import { Reunions }  from './pages/Reunions';
import Tontines      from './pages/Tontines';
import Rotations     from './pages/Rotations';
import Encheres      from './pages/Encheres';
import Banques       from './pages/Banques';
import Prets         from './pages/Prets';
import Caisse        from './pages/Caisse';
import Sanctions     from './pages/Sanctions';
import Rapports      from './pages/Rapports';
import Utilisateurs  from './pages/Utilisateurs';
import Parametres    from './pages/Parametres';
import Postes        from './pages/Postes';
import PortailMembre from './pages/PortailMembre';
import DecisionsAG   from './pages/DecisionsAG';
import Social        from './pages/Social';
import RapprochementBancaire from './pages/RapprochementBancaire';
import AuditLog from './pages/AuditLog';
import ReglementInterieur from './pages/ReglementInterieur';
import MonProfil from './pages/MonProfil';

function WorkspaceGate({ children }) {
  const { currentAssociation, setupComplete, user, booting } = useApp();

  if (booting) {
    return <div className="min-h-screen flex items-center justify-center text-ink-500 text-sm">Chargement…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!setupComplete || !currentAssociation) {
    return <Navigate to="/setup" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<WorkspaceGate><Layout /></WorkspaceGate>}>
            <Route index                 element={<Dashboard />}     />
            <Route path="membres"         element={<Membres />}       />
            <Route path="reunions"        element={<Reunions />}      />
            <Route path="tontines"        element={<Tontines />}      />
            <Route path="rotations"       element={<Rotations />}     />
            <Route path="encheres"        element={<Encheres />}      />
            <Route path="caisses"         element={<Banques />}       />
            <Route path="banques"         element={<Navigate to="/caisses" replace />} />
            <Route path="prets"           element={<Prets />}         />
            <Route path="caisse-sociale"  element={<Navigate to="/social" replace />} />
            <Route path="fond-assurance"  element={<Navigate to="/social" replace />} />
            <Route path="caisse"          element={<Caisse />}        />
            <Route path="sanctions"       element={<Sanctions />}     />
            <Route path="rapports"        element={<Rapports />}      />
            <Route path="utilisateurs"    element={<Utilisateurs />}  />
            <Route path="parametres"      element={<Parametres />}    />
            <Route path="postes"          element={<Postes />}        />
            <Route path="mon-espace"      element={<PortailMembre />} />
            <Route path="decisions-ag"    element={<DecisionsAG />}   />
            <Route path="social"          element={<Social />}        />
            <Route path="rapprochement"   element={<RapprochementBancaire />} />
            <Route path="audit"           element={<AuditLog />}       />
            <Route path="reglement"       element={<ReglementInterieur />} />
            <Route path="mon-profil"      element={<MonProfil />}     />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toast />
    </AppProvider>
  );
}
