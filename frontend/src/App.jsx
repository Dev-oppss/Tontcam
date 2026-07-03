import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout        from './components/layout/Layout';
import Login         from './pages/Login';
import Setup         from './pages/Setup';
import Dashboard     from './pages/Dashboard';
import Membres       from './pages/Membres';
import { Reunions }  from './pages/Reunions';
import Tontines      from './pages/Tontines';
import Rotations     from './pages/Rotations';
import Encheres      from './pages/Encheres';
import Banques       from './pages/Banques';
import Prets         from './pages/Prets';
import CaisseSociale from './pages/CaisseSociale';
import FondAssurance from './pages/FondAssurance';
import Caisse        from './pages/Caisse';
import Sanctions     from './pages/Sanctions';
import Rapports      from './pages/Rapports';
import Utilisateurs  from './pages/Utilisateurs';

function WorkspaceGate({ children }) {
  const { currentAssociation, setupComplete, user, loading } = useApp();

  if (loading) {
    return null;
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
            <Route path="caisse-sociale"  element={<CaisseSociale />} />
            <Route path="fond-assurance"  element={<FondAssurance />} />
            <Route path="caisse"          element={<Caisse />}        />
            <Route path="sanctions"       element={<Sanctions />}     />
            <Route path="rapports"        element={<Rapports />}      />
            <Route path="utilisateurs"    element={<Utilisateurs />}  />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
