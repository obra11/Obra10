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
  // Força o envio do token XSRF mesmo em cross-origin.
  // Fallback: se o cookie não estiver legível (comum em ambientes cross-site/subdomínios diferentes),
  // tentamos obter o token que foi exposto pelo backend e salvo no localStorage.
  // DÍVIDA TÉCNICA/SEGURANÇA: O uso do localStorage para o CSRF token introduz vulnerabilidade a XSS,
  // mas é aceitável temporariamente para o ambiente beta. Deve ser removido após migração para domínios same-site.
  const xsrfToken = getCookie('XSRF-TOKEN') || localStorage.getItem('obra10_csrf_token');
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
  (response) => {
    // Se o backend retornou o token CSRF exposto na resposta, salva no localStorage como fallback.
    const csrfHeader = response.headers['x-xsrf-token'];
    if (csrfHeader) {
      localStorage.setItem('obra10_csrf_token', csrfHeader);
    }
    return response;
  },
  (error) => {
    if (error.response?.headers && error.response.headers['x-xsrf-token']) {
      localStorage.setItem('obra10_csrf_token', error.response.headers['x-xsrf-token']);
    }

    if (error.response && error.response.status === 401) {
      // Rotas públicas (site comercial + auth). Sem isso, 401 em /auth/session
      // na home redirecionava visitante para /login e “sumia” o site.
      const publicPaths = [
        '/',
        '/produto',
        '/precos',
        '/sobre',
        '/contato',
        '/login',
        '/register',
        '/verificar-email',
        '/esqueci-senha',
        '/redefinir-senha',
        '/diario-de-obra',
      ];
      const path = window.location.pathname;
      if (!publicPaths.includes(path)) {
         window.dispatchEvent(new Event('auth:unauthorized'));
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

