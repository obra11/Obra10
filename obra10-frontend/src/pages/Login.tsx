import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { HardHat, Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // empresaId é auto-detectado pelo backend via e-mail
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // MVP: Chama o backend real para login
      const data = await authService.login(email, senha);
      login(data);
      if (data.usuario?.perfilGlobal === 'SUPER_ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'E-mail ou senha incorretos.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cores inspiradas no Brand Book anexado: Branco, Vermelho (#E5192C) e Cinza Escuro
  return (
    <div className="min-h-screen bg-lunardeli-gray flex">
      {/* Left side - Brand/Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-lunardeli-red items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 text-white max-w-lg">
          <div className="flex space-x-4 items-center mb-8">
            <HardHat size={48} />
            <span className="text-4xl font-bold tracking-tight">OBRA 10</span>
          </div>
          <h1 className="text-5xl font-extrabold mb-6 leading-tight">
            Gestão inteligente no canteiro de obras.
          </h1>
          <p className="text-lg text-white/90">
            Acompanhe a execução, aprove RDOs e gerencie recursos com a credibilidade Lunardeli.
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl shadow-black/5">
          {/* Mobile Logo */}
          <div className="flex lg:hidden justify-center items-center space-x-3 mb-8 text-lunardeli-red">
            <HardHat size={40} />
            <span className="text-3xl font-bold text-lunardeli-dark">OBRA 10</span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-lunardeli-dark mb-2">Bem-vindo</h2>
            <p className="text-gray-500">Acesse sua conta para continuar</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-lunardeli-red text-red-700 text-sm font-medium rounded-r-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-colors bg-gray-50 focus:bg-white outline-none"
                  placeholder="engenheiro@acme.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-colors bg-gray-50 focus:bg-white outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-lunardeli-red focus:ring-lunardeli-red border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600">
                  Lembrar-me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="font-semibold text-lunardeli-red hover:text-red-800 transition-colors">
                  Esqueceu a senha?
                </a>
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
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            Ainda não tem conta? <Link to="/register" className="font-semibold text-lunardeli-red hover:underline">Criar conta</Link>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            &copy; 2026 Lunardeli Engenharia. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
};
