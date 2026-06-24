import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';

// La Caisse Sociale est maintenant le Fond Assurance
export default function CaisseSociale() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/fond-assurance', { replace: true }); }, [navigate]);
  return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <Shield size={32} className="mx-auto mb-3 text-primary-400"/>
        <p className="font-medium">Redirection vers Fond Assurance…</p>
      </div>
    </div>
  );
}
