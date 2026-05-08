import axios from 'axios';

// Criação da instância base do Axios apontando para a variável
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 10000,
  withCredentials: true, // Obrigatório para enviar HttpOnly Cookies
  xsrfCookieName: 'XSRF-TOKEN', 
  xsrfHeaderName: 'x-xsrf-token',
});

// Função auxiliar para ler cookies (necessária pois axios dropa auto-XSRF em cross-origin local)
function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

// Interceptor para adicionar o header de obra e XSRF
api.interceptors.request.use((config) => {
  // Força o envio do token XSRF mesmo em cross-origin
  const xsrfToken = getCookie('XSRF-TOKEN');
  if (xsrfToken) {
    config.headers['x-xsrf-token'] = xsrfToken;
  }
  
  // Evita tela de alerta do Localtunnel/Ngrok em túneis gratuitos
  config.headers['Bypass-Tunnel-Reminder'] = 'true';

  const obraAtivaString = localStorage.getItem('obra10_obraAtiva');
  if (obraAtivaString && obraAtivaString !== 'undefined') {
    try {
       const obraAtiva = JSON.parse(obraAtivaString);
       if (obraAtiva?.id) {
         config.headers['x-obra-id'] = obraAtiva.id;
       }
    } catch(e) {}
  }
  return config;
}, (error) => Promise.reject(error));

// Interceptor de Resposta Global para CSRF/Expirados
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (window.location.pathname !== '/login') {
         window.dispatchEvent(new Event('auth:unauthorized'));
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
