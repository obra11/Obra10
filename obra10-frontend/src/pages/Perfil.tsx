import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, User, Phone, Lock, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Headphones } from 'lucide-react';
import api from '../services/api';

export const Perfil: React.FC = () => {
  const navigate = useNavigate();
  const { user, fetchSession } = useAuth();

  // Profile fields
  const [nome, setNome] = useState(user?.nome || '');
  const [telefone, setTelefone] = useState('');
  
  // Password change fields
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load current details
  useEffect(() => {
    if (user) {
      setNome(user.nome);
      // Fetch details from getMeusDados to get phone number
      api.get('/auth/meus-dados')
        .then(res => {
          if (res.data?.dadosPessoais?.telefone) {
            setTelefone(res.data.dadosPessoais.telefone);
          }
        })
        .catch(err => console.error('Erro ao buscar dados do usuário:', err));
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    // Validations for password change
    if (novaSenha || confirmarSenha || senhaAtual) {
      if (!senhaAtual) {
        setErrorMsg('Você precisa informar sua senha atual para alterar a senha.');
        return;
      }
      if (novaSenha.length < 6) {
        setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (novaSenha !== confirmarSenha) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }
    }

    setLoading(true);

    try {
      const payload: any = {
        nome,
        telefone: telefone || null,
      };

      if (novaSenha) {
        payload.senhaAtual = senhaAtual;
        payload.novaSenha = novaSenha;
      }

      await api.patch('/usuarios/perfil', payload);
      
      // Update global context
      await fetchSession();

      // Reset password fields
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');

      setSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-lunardeli-gray p-6">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="flex items-center text-gray-500 hover:text-red-600 mb-6 font-semibold transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" /> Voltar ao Painel
        </button>

        <h1 className="text-3xl font-bold text-lunardeli-dark flex items-center mb-8">
          <User className="mr-3 text-red-600" size={32}/> Meu Perfil
        </h1>

        <button
          type="button"
          onClick={() => navigate('/suporte')}
          className="w-full mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-lunardeli-red/40 hover:shadow-md transition-all text-left flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-lunardeli-red/10 text-lunardeli-red flex items-center justify-center group-hover:bg-lunardeli-red group-hover:text-white transition-colors">
            <Headphones size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lunardeli-dark">Central de Suporte</p>
            <p className="text-sm text-gray-500">FAQ, abrir chamado e falar no WhatsApp</p>
          </div>
        </button>

        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm font-medium rounded-r-md flex items-center gap-2">
            <CheckCircle size={18} />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-lunardeli-red text-red-700 text-sm font-medium rounded-r-md flex items-center gap-2">
            <AlertCircle size={18} />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Card: Dados Básicos */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Informações Pessoais</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail (Não alterável)</label>
                <input 
                  type="email" 
                  value={user?.email || ''} 
                  disabled 
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    value={nome} 
                    onChange={e => setNome(e.target.value)} 
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none" 
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Phone size={18} />
                  </div>
                  <input 
                    type="text" 
                    value={telefone} 
                    onChange={e => setTelefone(e.target.value)} 
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none" 
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card: Alterar Senha */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Alterar Senha</h2>
            <p className="text-gray-500 text-xs mb-4">Preencha estes campos apenas se desejar cadastrar uma nova senha.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Senha Atual</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={senhaAtual} 
                    onChange={e => setSenhaAtual(e.target.value)} 
                    className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none" 
                    placeholder="Senha antiga"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={novaSenha} 
                    onChange={e => setNovaSenha(e.target.value)} 
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none" 
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={confirmarSenha} 
                    onChange={e => setConfirmarSenha(e.target.value)} 
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none" 
                    placeholder="Confirme a nova senha"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Salvando Alterações...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
