import api from './api';

export const authService = {
  async login(email: string, senha: string, empresaId?: string) {
    const response = await api.post('/auth/login', { email, senha, empresaId });
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
