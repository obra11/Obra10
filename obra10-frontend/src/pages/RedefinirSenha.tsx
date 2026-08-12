import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { Obra10Logo } from '../components/Obra10Logo';

export const RedefinirSenha: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Token de redefinição ausente ou inválido.');
      return;
    }

    if (novaSenha.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/redefinir-senha', { token, novaSenha });
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Token inválido ou expirado. Solicite outro link.');
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
          <div className="flex items-center mb-8">
            <Obra10Logo size={44} withWordmark wordmarkClassName="text-white" />
          </div>
          <h1 className="text-5xl font-extrabold mb-6 leading-tight">
            Gestão inteligente no canteiro de obras.
          </h1>
          <p className="text-lg text-white/90">
            Defina uma nova senha forte para proteger sua conta e todos os dados de suas obras.
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
            <h2 className="text-3xl font-bold text-lunardeli-dark mb-2">Nova Senha</h2>
            <p className="text-gray-500">
              Escolha uma senha segura de pelo menos 6 caracteres.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-lunardeli-red text-red-700 text-sm font-medium rounded-r-md">
              {error}
            </div>
          )}

          {!token && (
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 text-sm font-medium rounded-r-md">
              Nenhum token de recuperação foi encontrado. Por favor, acesse o link enviado no seu e-mail ou <Link to="/esqueci-senha" className="underline font-bold text-yellow-950">solicite um novo link aqui</Link>.
            </div>
          )}

          {isSuccess ? (
            <div className="text-center py-6">
              <CheckCircle size={56} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Senha Alterada!</h3>
              <p className="text-gray-600 mb-6">
                Sua senha foi redefinida com sucesso. Suas sessões anteriores foram desconectadas por segurança.
              </p>
              <Link
                to="/login"
                className="inline-block px-6 py-3 bg-lunardeli-red hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
              >
                Ir para o Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-colors bg-gray-50 focus:bg-white outline-none"
                    placeholder="No mínimo 6 caracteres"
                    required
                    disabled={!token}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    disabled={!token}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-colors bg-gray-50 focus:bg-white outline-none"
                    placeholder="Digite novamente"
                    required
                    disabled={!token}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !token}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-lunardeli-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lunardeli-red transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                    Alterando senha...
                  </>
                ) : (
                  'Salvar Nova Senha'
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
