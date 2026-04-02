import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ModuloToggle } from '../../components/ModuloToggle';
import {
  Building2, Shield, CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

interface Modulo { slug: string; nome: string; }
interface TenantModulo { modulo: Modulo; ativo: boolean; }
interface Tenant {
  id: string; cnpj: string; razaoSocial: string; plano: string;
  ativo: boolean; limiteUsuarios: number;
  tenantModulos: TenantModulo[];
  _count: { usuarios: number };
}

const ALL_MODULES = ['RDO', 'FVS', 'PROJETOS', 'CONCRETO', 'IA'];
const PLAN_COLOR: Record<string, string> = {
  BASICO: 'bg-gray-100 text-gray-600',
  PRO: 'bg-blue-100 text-blue-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
};

export const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if ((user as any)?.perfilGlobal !== 'SUPER_ADMIN') {
      navigate('/dashboard');
      return;
    }
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data } = await api.get('/admin/tenants');
      setTenants(data);
    } finally {
      setLoading(false);
    }
  };

  const toggleModulo = async (tenantId: string, slug: string, currentAtivo: boolean) => {
    setSaving(tenantId + slug);
    try {
      await api.patch(`/admin/tenants/${tenantId}/modulos`, {
        modulos: [{ slug, ativo: !currentAtivo }],
      });
      await fetchTenants();
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-red-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="text-red-600" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel Super Admin</h1>
            <p className="text-gray-500 text-sm">{tenants.length} tenants cadastrados</p>
          </div>
        </div>

        <div className="space-y-3">
          {tenants.map(t => {
            const isExpanded = expanded === t.id;
            const activeModules = t.tenantModulos.filter(m => m.ativo).map(m => m.modulo.slug);

            return (
              <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : t.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                      <Building2 className="text-red-600" size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{t.razaoSocial}</p>
                      <p className="text-xs text-gray-400">{t.cnpj} · {t._count.usuarios}/{t.limiteUsuarios} usuários</p>
                    </div>
                    <span className={`hidden sm:inline-flex text-xs font-bold px-2 py-1 rounded-full ${PLAN_COLOR[t.plano]}`}>
                      {t.plano}
                    </span>
                    {t.ativo
                      ? <span className="hidden sm:flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={14} /> Ativo</span>
                      : <span className="hidden sm:flex items-center gap-1 text-red-600 text-xs"><XCircle size={14} /> Inativo</span>
                    }
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="mt-4 pt-4 border-t border-gray-100 px-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Módulos Contratados</p>
                      <div className="flex flex-wrap gap-2">
                        {ALL_MODULES.map(slug => {
                          const isActive = activeModules.includes(slug);
                          return (
                            <ModuloToggle
                              key={slug}
                              slug={slug}
                              label={slug}
                              isActive={isActive}
                              isLoading={saving === t.id + slug}
                              onToggle={() => toggleModulo(t.id, slug, isActive)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
