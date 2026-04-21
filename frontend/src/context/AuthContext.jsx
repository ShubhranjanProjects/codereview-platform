import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cr_token");
    if (!token) { setLoading(false); return; }
    api.me()
      .then(setUser)
      .catch(() => localStorage.removeItem("cr_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem("cr_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("cr_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
