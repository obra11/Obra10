import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Package, ChevronDown, ChevronRight, Layers, Zap, CheckCircle, AlertCircle, Loader2, ArrowLeft
} from 'lucide-react';

interface SubModulo { slug: string; nome: string; descricao?: string; ativo: boolean; }
interface Integracao { moduloOrigem: string; moduloDestino: string; evento: string; descricao?: string; }
interface Modulo {
  slug: string; nome: string; sigla?: string; grupo: string;
  descricao?: string; preco: number; versao: string;
  dependencias: string[]; ordemExibicao: number;
  submodulos: SubModulo[];
}

const GRUPO_COLORS: Record<string, { bg: string; badge: string; dot: string }> = {
  'Operacional': { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  'Qualidade':   { bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  'Gestão':      { bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  'Pessoas':     { bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  'GERAL':       { bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
};

// Modules currently implemented
const IMPLEMENTADOS = new Set(['RDO']);

export const ModulosCatalogo: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [integracoes, setIntegracoes] = useState<Record<string, { emite: Integracao[]; consome: Integracao[] }>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedIntegracoes, setExpandedIntegracoes] = useState<Record<string, boolean>>({});

  // Only SUPER_ADMIN can access this page
  useEffect(() => {
    if (user && user.perfilGlobal !== 'SUPER_ADMIN') navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    api.get('/modulos').then(async r => {
      const mods: Modulo[] = r.data;
      setModulos(mods);

      // Fetch integrations for each module
      const integMap: Record<string, any> = {};
      await Promise.all(mods.map(async m => {
        try {
          const res = await api.get(`/modulos/${m.slug}/integracoes`);
          integMap[m.slug] = res.data;
        } catch { integMap[m.slug] = { emite: [], consome: [] }; }
      }));
      setIntegracoes(integMap);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const grupos = ['Operacional', 'Qualidade', 'Gestão', 'Pessoas', 'GERAL'].reduce<Record<string, Modulo[]>>((acc, g) => {
    const ms = modulos.filter(m => m.grupo === g);
    if (ms.length) acc[g] = ms;
    return acc;
  }, {});

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <Package className="text-red-600 border-l border-gray-200 pl-3 ml-1" size={24} />
            <div className="pl-1">
              <h1 className="font-bold text-gray-900 leading-tight">Catálogo de Módulos</h1>
              <p className="text-xs text-gray-500">{modulos.length} módulos · {modulos.reduce((s, m) => s + m.submodulos.length, 0)} submódulos</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full">SUPER ADMIN</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {Object.entries(grupos).map(([grupo, mods]) => {
          const colors = GRUPO_COLORS[grupo] || GRUPO_COLORS['GERAL'];
          return (
            <section key={grupo}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                <h2 className="text-lg font-bold text-gray-800">{grupo}</h2>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colors.badge}`}>{mods.length} módulos</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mods.map(m => {
                  const isImpl = IMPLEMENTADOS.has(m.slug);
                  const hasSubmodulos = m.submodulos.length > 0;
                  const modInteg = integracoes[m.slug] || { emite: [], consome: [] };
                  const hasInteg = modInteg.emite.length + modInteg.consome.length > 0;
                  const isExpandedSubs = expanded[m.slug];
                  const isExpandedInteg = expandedIntegracoes[m.slug];

                  return (
                    <div key={m.slug} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                      {/* Module Header */}
                      <div className={`px-5 py-4 ${colors.bg}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-gray-900">{m.nome}</h3>
                              {m.sigla && (
                                <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">{m.sigla}</span>
                              )}
                              {isImpl ? (
                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle size={10} /> Implementado
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertCircle size={10} /> Backlog
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{m.descricao}</p>
                          </div>
                          <div className="ml-4 text-right shrink-0">
                            <p className="font-bold text-gray-800 text-lg">R$ {Number(m.preco).toFixed(2)}</p>
                            <p className="text-xs text-gray-400">/mês · v{m.versao}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-mono">{m.slug}</code>
                          {m.dependencias?.length > 0 && (
                            <span className="text-xs text-gray-400">Requer: {m.dependencias.join(', ')}</span>
                          )}
                        </div>
                      </div>

                      {/* Submodules */}
                      {hasSubmodulos && (
                        <div className="border-t border-gray-100">
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [m.slug]: !p[m.slug] }))}
                            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Layers size={15} />
                              {m.submodulos.length} Submódulos inclusos
                            </div>
                            <ChevronDown size={15} className={`transition-transform ${isExpandedSubs ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpandedSubs && (
                            <div className="px-5 pb-4 grid grid-cols-1 gap-1.5">
                              {m.submodulos.map(s => (
                                <div key={s.slug} className="flex items-start gap-2 text-sm">
                                  <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                                  <div>
                                    <span className="font-medium text-gray-800">{s.nome}</span>
                                    <code className="ml-2 text-[10px] text-gray-400 font-mono">{s.slug}</code>
                                    {s.descricao && <p className="text-xs text-gray-400 mt-0.5">{s.descricao}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Integrations */}
                      {hasInteg && (
                        <div className="border-t border-gray-100">
                          <button
                            onClick={() => setExpandedIntegracoes(p => ({ ...p, [m.slug]: !p[m.slug] }))}
                            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Zap size={15} />
                              {modInteg.emite.length} emite · {modInteg.consome.length} consome
                            </div>
                            <ChevronDown size={15} className={`transition-transform ${isExpandedInteg ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpandedInteg && (
                            <div className="px-5 pb-4 space-y-2">
                              {modInteg.emite.map((i, idx) => (
                                <div key={`e-${idx}`} className="text-xs flex items-center gap-2">
                                  <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded shrink-0">EMITE</span>
                                  <code className="font-mono text-gray-600">{i.evento}</code>
                                  <ChevronRight size={12} className="text-gray-400 shrink-0" />
                                  <span className="font-semibold text-gray-700">{i.moduloDestino}</span>
                                </div>
                              ))}
                              {modInteg.consome.map((i, idx) => (
                                <div key={`c-${idx}`} className="text-xs flex items-center gap-2">
                                  <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded shrink-0">CONSOME</span>
                                  <code className="font-mono text-gray-600">{i.evento}</code>
                                  <span className="text-gray-400">de</span>
                                  <span className="font-semibold text-gray-700">{i.moduloOrigem}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
};
