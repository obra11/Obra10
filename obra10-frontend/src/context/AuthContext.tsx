import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  empresaId: string;
  perfilGlobal: string;
  fotoUrl?: string;
}

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  logoUrl?: string;
  modulos?: { slug: string; nome: string; sigla: string; grupo: string; }[];
}

export interface Obra {
  id: string;
  nome: string;
  endereco?: string;
  status: string;
  imageUrl?: string;
  minhasPermissoes?: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: Usuario | null;
  empresa: Empresa | null;
  obras: Obra[];
  obraAtiva: Obra | null;
  setObraAtiva: (obra: Obra | null) => void;
  login: (data: any) => void;
  logout: () => void;
  updateEmpresaLogo: (url: string) => void;
  updateObraImage: (obraId: string, url: string) => void;
  updateUserPhoto: (url: string) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const loadObraAtiva = () => {
    try {
      const data = localStorage.getItem('obra10_obraAtiva');
      if (!data || data === 'undefined' || data === 'null') return null;
      return JSON.parse(data);
    } catch { return null; }
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<Usuario | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [obras, setObras] = useState<Obra[]>([]);
  const [obraAtiva, setObraAtivaState] = useState<Obra | null>(loadObraAtiva());

  const fetchSession = async () => {
    try {
      setIsLoading(true);
      // Cache buster adicionado para evitar que o navegador mantenha a lista presa na memória (Disk Cache)
      const data = await authService.getSession(`?_t=${Date.now()}`);
      setUser(data.usuario);
      setEmpresa(data.empresa);
      setObras(data.obrasPermitidas);
      setIsAuthenticated(true);
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
      setEmpresa(null);
      setObras([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();

    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = (data: any) => {
    // Session is established by HttpOnly cookie on backend before this reaches here
    setUser(data.usuario);
    setEmpresa(data.empresa);
    setObras(data.obrasPermitidas);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setEmpresa(null);
    setObras([]);
    setObraAtivaState(null);
    localStorage.removeItem('obra10_obraAtiva');
    setIsAuthenticated(false);
  };

  const setObraAtiva = (obra: Obra | null) => {
    setObraAtivaState(obra);
    if(obra) localStorage.setItem('obra10_obraAtiva', JSON.stringify(obra));
    else localStorage.removeItem('obra10_obraAtiva');
  };

  const updateEmpresaLogo = (url: string) => {
    if (empresa) setEmpresa({ ...empresa, logoUrl: url });
  };

  const updateObraImage = (obraId: string, url: string) => {
    const updatedObras = obras.map(o => o.id === obraId ? { ...o, imageUrl: url } : o);
    setObras(updatedObras);
    if (obraAtiva && obraAtiva.id === obraId) {
      const updatedObraAtiva = { ...obraAtiva, imageUrl: url };
      setObraAtivaState(updatedObraAtiva);
      localStorage.setItem('obra10_obraAtiva', JSON.stringify(updatedObraAtiva));
    }
  };

  const updateUserPhoto = (url: string) => {
    if (user) setUser({ ...user, fotoUrl: url });
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, isLoading, user, empresa, obras, obraAtiva, 
      setObraAtiva, login, logout, updateEmpresaLogo, updateObraImage, updateUserPhoto
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
