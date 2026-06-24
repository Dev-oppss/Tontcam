import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Le Fond Assurance est maintenant intégré dans les Banques
export default function FondAssurance() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/banques', { replace: true }); }, [navigate]);
  return null;
}
