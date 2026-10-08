import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resetDemo } from '../services/journey';

/** /reset — wipe the demo in this browser and start again at registration. */
export default function Reset() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    resetDemo();
    logout();
    navigate('/register', { replace: true });
  }, [logout, navigate]);

  return null;
}
