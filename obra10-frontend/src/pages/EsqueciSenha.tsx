import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { Obra10Logo } from '../components/Obra10Logo';

export const EsqueciSenha: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await api.post('/auth/esqueci-senha', { email });
      setIsSent(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Ocorreu um erro ao processar sua solicitação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-lunardeli-gray flex">
      {/* Left side - Brand/Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-lunardeli-red items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 text-white max-w-lg">
          <div className="flex space-x-4 items-center mb-8">
            <Obra10Logo size={40} withWordmark wordmarkClassName="text-white" />
          </div>
          <h1 className="text-5xl font-extrabold mb-6 leading-tight">
            Gestão inteligente no canteiro de obras.
          </h1>
          <p className="text-lg text-white/90">
            Recupere seu acesso de forma rápida e segura para continuar gerenciando seus canteiros de obra.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl shadow-black/5">
          {/* Mobile Logo */}
          <div className="flex lg:hidden justify-center items-center mb-8">
            <Obra10Logo
              size={36}
              withWordmark
              wordmarkClassName="text-lunardeli-dark"
            />
          </div>

          <div className="mb-8">
            <button 
              onClick={() => navigate('/login')} 
              className="flex items-center text-sm font-semibold text-gray-500 hover:text-lunardeli-red transition-colors mb-4"
            >
              <ArrowLeft size={16} className="mr-1" /> Voltar para o login
            </button>
            <h2 className="text-3xl font-bold text-lunardeli-dark mb-2">Recuperar Senha</h2>
            <p className="text-gray-500">
              Digite seu e-mail cadastrado e enviaremos um link personalizado para você cadastrar uma nova senha.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-lunardeli-red text-red-700 text-sm font-medium rounded-r-md">
              {error}
            </div>
          )}

          {isSent ? (
            <div className="text-center py-6">
              <CheckCircle size={56} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">E-mail Enviado!</h3>
              <p className="text-gray-600 mb-6">
                Se o e-mail informado estiver cadastrado no sistema, você receberá em instantes um link de recuperação. Por favor, verifique também a sua pasta de spam.
              </p>
              <Link
                to="/login"
                className="inline-block px-6 py-3 bg-lunardeli-red hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
              >
                Voltar para o Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail de Cadastro</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-colors bg-gray-50 focus:bg-white outline-none"
                    placeholder="exemplo@empresa.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-lunardeli-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lunardeli-red transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                    Enviando e-mail...
                  </>
                ) : (
                  'Enviar Link de Recuperação'
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-sm text-gray-500">
            &copy; 2026 Lunardeli Engenharia. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
};
