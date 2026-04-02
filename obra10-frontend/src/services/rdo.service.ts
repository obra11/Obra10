import api from './api';

export const rdoService = {
  listarRdos: async (obraId: string) => {
    const response = await api.get('/rdos', { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  buscarRdo: async (obraId: string, id: string) => {
    const response = await api.get(`/rdos/${id}`, { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  criarRdo: async (obraId: string, data: any) => {
    const response = await api.post('/rdos', data, { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  addAtividade: async (obraId: string, rdoId: string, data: any) => {
    const response = await api.post(`/rdos/${rdoId}/atividades`, data, { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  addEfetivo: async (obraId: string, rdoId: string, data: any) => {
    const response = await api.post(`/rdos/${rdoId}/efetivos`, data, { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  addOcorrencia: async (obraId: string, rdoId: string, data: any) => {
    const response = await api.post(`/rdos/${rdoId}/ocorrencias`, data, { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  enviarRdo: async (obraId: string, rdoId: string) => {
    const response = await api.put(`/rdos/${rdoId}/submeter`, {}, { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  aprovarRdo: async (obraId: string, rdoId: string) => {
    const response = await api.put(`/rdos/${rdoId}/aprovar`, {}, { headers: { 'x-obra-id': obraId } });
    return response.data;
  },

  uploadFotos: async (obraId: string, rdoId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/upload/obra/${obraId}/rdo/${rdoId}/fotos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'x-obra-id': obraId,
      },
    });
    return response.data;
  }
};
