import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { ArrowRight, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

type TipoPessoa = 'FISICA' | 'JURIDICA';
type Step = 1 | 2 | 3 | 4;

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [tipo, setTipo] = useState<TipoPessoa>('JURIDICA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    cpfCnpj: '', razaoSocial: '', nomeFantasia: '', nomeCompleto: '',
    email: '', telefone: '', cep: '', logradouro: '', numero: '',
    complemento: '', bairro: '', cidade: '', estado: '',
    nome: '', senha: '', confirmarSenha: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (tipo === 'JURIDICA') {
      if (value.length > 14) value = value.slice(0, 14);
      value = value.replace(/^(\d{2})(\d)/, '$1.$2')
                   .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                   .replace(/\.(\d{3})(\d)/, '.$1/$2')
                   .replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      if (value.length > 11) value = value.slice(0, 11);
      value = value.replace(/(\d{3})(\d)/, '$1.$2')
                   .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
                   .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    }
    setForm(p => ({ ...p, cpfCnpj: value }));
  };

  const buscarCEP = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(p => ({
          ...p, logradouro: data.logradouro, bairro: data.bairro,
          cidade: data.localidade, estado: data.uf,
        }));
      }
    } catch { }
  };

  const handleSubmit = async () => {
    setError('');
    if (form.senha !== form.confirmarSenha) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      await api.post('/tenants/register', {
        tipoPessoa: tipo, cpfCnpj: form.cpfCnpj, razaoSocial: form.razaoSocial || undefined,
        nomeFantasia: form.nomeFantasia || undefined, nomeCompleto: form.nomeCompleto || undefined,
        email: form.email, telefone: form.telefone || undefined, cep: form.cep || undefined,
        numero: form.numero || undefined, complemento: form.complemento || undefined,
        nome: form.nome, senha: form.senha,
      });
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1';

  if (step === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md w-full">
          <CheckCircle size={56} className="mx-auto mb-4 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro concluído!</h2>
          <p className="text-gray-500 text-sm mb-6">
            A sua conta foi ativada. Você já pode acessar o sistema com o e-mail <strong>{form.email}</strong>.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2"
          >
            Acessar o sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Criar conta no OBRA 10</h1>
          <p className="text-red-200 text-sm mt-1">Passo {step} de 3</p>
          <div className="flex gap-1 mt-3">
            {[1,2,3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${step >= s ? 'bg-white' : 'bg-red-500'}`} />
            ))}
          </div>
        </div>

        <div className="p-8">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border-l-4 border-red-500">{error}</div>}

          {/* STEP 1: Tipo + Documento */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className={labelCls}>Tipo de cadastro</p>
                <div className="flex gap-3">
                  {(['JURIDICA', 'FISICA'] as TipoPessoa[]).map(t => (
                    <button key={t} onClick={() => setTipo(t)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${tipo === t ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {t === 'JURIDICA' ? '🏢 Pessoa Jurídica' : '👤 Pessoa Física'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>{tipo === 'JURIDICA' ? 'CNPJ' : 'CPF'}</label>
                <input value={form.cpfCnpj} onChange={handleCpfCnpjChange} className={inputCls} placeholder={tipo === 'JURIDICA' ? '00.000.000/0001-00' : '000.000.000-00'} />
              </div>
              {tipo === 'JURIDICA' ? (
                <>
                  <div><label className={labelCls}>Razão Social *</label><input value={form.razaoSocial} onChange={set('razaoSocial')} className={inputCls} placeholder="Empresa Ltda." /></div>
                  <div><label className={labelCls}>Nome Fantasia</label><input value={form.nomeFantasia} onChange={set('nomeFantasia')} className={inputCls} placeholder="Marca da empresa" /></div>
                </>
              ) : (
                <div><label className={labelCls}>Nome Completo *</label><input value={form.nomeCompleto} onChange={set('nomeCompleto')} className={inputCls} placeholder="João da Silva" /></div>
              )}
              <button onClick={() => setStep(2)} className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                Próximo <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: Contato + Endereço */}
          {step === 2 && (
            <div className="space-y-4">
              <div><label className={labelCls}>E-mail *</label><input type="email" value={form.email} onChange={set('email')} className={inputCls} placeholder="empresa@email.com" /></div>
              <div><label className={labelCls}>Telefone / WhatsApp</label><input value={form.telefone} onChange={set('telefone')} className={inputCls} placeholder="(11) 99999-9999" /></div>
              <div>
                <label className={labelCls}>CEP</label>
                <input value={form.cep} onChange={set('cep')} onBlur={e => buscarCEP(e.target.value)} className={inputCls} placeholder="00000-000" />
              </div>
              {form.logradouro && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                  📍 {form.logradouro}, {form.bairro} — {form.cidade}/{form.estado}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Número</label><input value={form.numero} onChange={set('numero')} className={inputCls} placeholder="123" /></div>
                <div><label className={labelCls}>Complemento</label><input value={form.complemento} onChange={set('complemento')} className={inputCls} placeholder="Apto 4" /></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"><ArrowLeft size={16} />Voltar</button>
                <button onClick={() => setStep(3)} className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2">Próximo<ArrowRight size={16} /></button>
              </div>
            </div>
          )}

          {/* STEP 3: Acesso */}
          {step === 3 && (
            <div className="space-y-4">
              <div><label className={labelCls}>Seu Nome (administrador) *</label><input value={form.nome} onChange={set('nome')} className={inputCls} placeholder="Nome do responsável" /></div>
              <div><label className={labelCls}>Senha *</label><input type="password" value={form.senha} onChange={set('senha')} className={inputCls} placeholder="Mínimo 8 caracteres" /></div>
              <div><label className={labelCls}>Confirmar Senha *</label><input type="password" value={form.confirmarSenha} onChange={set('confirmarSenha')} className={inputCls} /></div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"><ArrowLeft size={16} />Voltar</button>
                <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={16} className="animate-spin" />Criando...</> : 'Criar Conta'}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Já tem uma conta? <Link to="/login" className="text-red-600 font-semibold hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
