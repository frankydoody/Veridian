import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, getToken, setToken, clearToken } from '../api/client.js';
import { setSessionMessage, SESSION_EXPIRED_MESSAGE } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Au démarrage : s'il y a un jeton, on demande au backend qui est connecté
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }

    apiFetch('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => {
        // Jeton présent mais refusé (expiré, secret JWT changé...) : on l'explique à l'utilisateur
        clearToken();
        setSessionMessage(SESSION_EXPIRED_MESSAGE);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(data.token);
    setUser(data.user);
  };

const register = async (name, email, password) => {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
  setToken(data.token);
  setUser(data.user);
};

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);