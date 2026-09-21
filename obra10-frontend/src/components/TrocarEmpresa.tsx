import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  authService,
  destinoPosLogin,
  type EmpresaLoginOpcao,
} from '../services/auth.service';
import { getImageUrl } from '../utils/image';

const PERFIL_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  GESTOR: 'Gestor',
  USER: 'Colaborador',
  COLABORADOR: 'Colaborador',
  EXTERNO: 'Visitante',
  PERSONALIZADO: 'Personalizado',
};

function EmpresaCard({
  empresa,
  atual,
  disabled,
  onClick,
}: {
  empresa: EmpresaLoginOpcao;
  atual?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || atual}
      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        atual
          ? 'border-lunardeli-red/40 bg-red-50 cursor-default'
          : 'border-gray-200 bg-white hover:border-lunardeli-red hover:bg-red-50/40'
      } disabled:opacity-70`}
    >
      {empresa.logoUrl ? (
        <img
          src={getImageUrl(empresa.logoUrl)}
          alt=""
          className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-100 shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
          <Building2 size={18} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-lunardeli-dark truncate">{empresa.nome}</p>
        <p className="text-xs text-gray-500">
          {PERFIL_LABELS[empresa.perfilGlobal] || empresa.perfilGlobal}
          {empresa.planoAtivo ? ' · Plano ativo' : ' · Aguardando pagamento'}
        </p>
      </div>
      {atual ? (
        <Check size={18} className="text-lunardeli-red shrink-0" />
      ) : (
        <ChevronRight size={18} className="text-gray-400 shrink-0" />
      )}
    </button>
  );
}

export const ListaEmpresasLogin: React.FC<{
  empresas: EmpresaLoginOpcao[];
  onEscolher: (empresaId: string) => void;
  loadingId?: string | null;
}> = ({ empresas, onEscolher, loadingId }) => (
  <div className="space-y-2">
    {empresas.map((emp) => (
      <EmpresaCard
        key={emp.id}
        empresa={emp}
        disabled={Boolean(loadingId)}
        onClick={() => onEscolher(emp.id)}
      />
    ))}
    {loadingId && (
      <p className="flex items-center justify-center gap-2 text-sm text-gray-500 pt-2">
        <Loader2 className="animate-spin" size={16} /> Entrando...
      </p>
    )}
  </div>
);

export const TrocarEmpresa: React.FC<{
  variant?: 'panel' | 'inline';
}> = ({ variant = 'panel' }) => {
  const navigate = useNavigate();
  const { empresa, trocarEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState<EmpresaLoginOpcao[]>([]);
  const [empresaAtualId, setEmpresaAtualId] = useState(empresa?.id || '');
  const [aberto, setAberto] = useState(variant === 'panel');
  const [loading, setLoading] = useState(true);
  const [trocandoId, setTrocandoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    authService
      .minhasEmpresas()
      .then((data) => {
        if (!vivo) return;
        setEmpresas(data.empresas || []);
        setEmpresaAtualId(data.empresaAtualId);
      })
      .catch(() => {
        if (vivo) setEmpresas([]);
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (loading || empresas.length < 2) return null;

  const handleEscolher = async (empresaId: string) => {
    if (empresaId === empresaAtualId) return;
    setErro('');
    setTrocandoId(empresaId);
    try {
      const data = await trocarEmpresa(empresaId);
      navigate(destinoPosLogin(data), { replace: true });
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Não foi possível trocar de empresa.');
      setTrocandoId(null);
    }
  };

  if (variant === 'inline') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-lunardeli-red"
        >
          <Building2 size={16} /> Trocar de empresa
        </button>
        {aberto && (
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[100] space-y-2">
            <p className="text-xs font-semibold text-gray-500 px-1">
              Este e-mail está em {empresas.length} empresas
            </p>
            {empresas.map((emp) => (
              <EmpresaCard
                key={emp.id}
                empresa={emp}
                atual={emp.id === empresaAtualId}
                disabled={Boolean(trocandoId)}
                onClick={() => handleEscolher(emp.id)}
              />
            ))}
            {erro && <p className="text-xs text-red-600 px-1">{erro}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-lunardeli-red/10 text-lunardeli-red flex items-center justify-center shrink-0">
          <Building2 size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-800">Suas empresas</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Este e-mail está em {empresas.length} empresas. Escolha em qual deseja entrar.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {empresas.map((emp) => (
          <EmpresaCard
            key={emp.id}
            empresa={emp}
            atual={emp.id === empresaAtualId}
            disabled={Boolean(trocandoId)}
            onClick={() => handleEscolher(emp.id)}
          />
        ))}
      </div>
      {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
    </div>
  );
};
