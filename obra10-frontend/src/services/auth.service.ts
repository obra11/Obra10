import api from './api';

export type EmpresaLoginOpcao = {
  id: string;
  nome: string;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  logoUrl?: string | null;
  perfilGlobal: string;
  planoAtivo: boolean;
};

export function destinoPosLogin(data: {
  usuario?: { perfilGlobal?: string };
  empresa?: { planoAtivo?: boolean };
}) {
  if (data.usuario?.perfilGlobal === 'SUPER_ADMIN') return '/admin/dashboard';
  if (data.empresa?.planoAtivo !== true) return '/contratacao';
  return '/dashboard';
}

export const authService = {
  async login(email: string, senha: string, empresaId?: string) {
    const response = await api.post('/auth/login', { email, senha, empresaId });
    return response.data;
  },

  async minhasEmpresas() {
    const response = await api.get('/auth/minhas-empresas');
    return response.data as {
      empresaAtualId: string;
      empresas: EmpresaLoginOpcao[];
    };
  },

  async trocarEmpresa(empresaId: string) {
    const response = await api.post('/auth/trocar-empresa', { empresaId });
    return response.data;
  },

  async logout() {
    try {
       await api.post('/auth/logout');
    } catch(e) { console.warn('Logout API failed', e); }
  },

  async getSession(queryString: string = '') {
    const response = await api.get(`/auth/me${queryString}`);
    return response.data;
  }
};
