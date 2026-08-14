import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Package, Loader2, Edit2, Save, X, Power } from 'lucide-react';
import { PLANOS, PLANO_KEYS, pacoteDoPlano, precoModuloPorPacote } from '../../utils/pacotesObras';
import type { PlanoNome } from '../../utils/pacotesObras';

type EditState = {
  descricao: string;
  precoBasico: string;
  precoAnualBasico: string;
  preco: string;
  precoAnual: string;
  precoEnterprise: string;
  precoAnualEnterprise: string;
};

const emptyEdit = (): EditState => ({
  descricao: '',
  precoBasico: '',
  precoAnualBasico: '',
  preco: '',
  precoAnual: '',
  precoEnterprise: '',
  precoAnualEnterprise: '',
});

const money = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const AdminModulos: React.FC = () => {
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<EditState>(emptyEdit());
  const [salvando, setSalvando] = useState(false);

  const fetchModulos = async () => {
    try {
      const res = await api.get('/admin/modulos');
      setModulos(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModulos();
  }, []);

  const iniciarEdicao = (mod: any) => {
    const pro = Number(mod.preco || 0);
    const proAnual = Number(mod.precoAnual || 0);
    setEditando(mod.id);
    setForm({
      descricao: mod.descricao || '',
      preco: String(pro),
      precoAnual: String(proAnual),
      precoBasico: String(
        Number(mod.precoBasico) > 0
          ? mod.precoBasico
          : Math.round(pro * 0.8 * 100) / 100,
      ),
      precoAnualBasico: String(
        Number(mod.precoAnualBasico) > 0
          ? mod.precoAnualBasico
          : Math.round(proAnual * 0.8 * 100) / 100,
      ),
      precoEnterprise: String(
        Number(mod.precoEnterprise) > 0
          ? mod.precoEnterprise
          : Math.round(pro * 1.5 * 100) / 100,
      ),
      precoAnualEnterprise: String(
        Number(mod.precoAnualEnterprise) > 0
          ? mod.precoAnualEnterprise
          : Math.round(proAnual * 1.5 * 100) / 100,
      ),
    });
  };

  const setCampo = (key: keyof EditState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const salvarEdicao = async (id: string) => {
    setSalvando(true);
    try {
      await api.patch(`/admin/modulos/${id}`, {
        descricao: form.descricao,
        preco: Number(form.preco),
        precoAnual: Number(form.precoAnual),
        precoBasico: Number(form.precoBasico),
        precoAnualBasico: Number(form.precoAnualBasico),
        precoEnterprise: Number(form.precoEnterprise),
        precoAnualEnterprise: Number(form.precoAnualEnterprise),
      });
      setEditando(null);
      await fetchModulos();
    } catch (err) {
      alert('Erro ao salvar módulo');
    } finally {
      setSalvando(false);
    }
  };

  const toggleStatusModulo = async (mod: any) => {
    if (
      !window.confirm(
        `Deseja realmente ${mod.ativo ? 'desativar' : 'ativar'} o módulo "${mod.nome}"? ${
          mod.ativo
            ? '\n\nAo desativar, novas empresas não poderão contratá-lo e as atuais poderão perder acesso temporariamente.'
            : ''
        }`,
      )
    )
      return;
    try {
      await api.patch(`/admin/modulos/${mod.id}`, {
        ativo: !mod.ativo,
      });
      fetchModulos();
    } catch (err) {
      alert('Erro ao alterar status do módulo');
    }
  };

  const precoPlano = (mod: any, plano: PlanoNome, period: 'MENSAL' | 'ANUAL') =>
    precoModuloPorPacote(mod, pacoteDoPlano(plano), period);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-red-600" size={40} />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de Módulos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Defina o preço de cada plano (Básico, Pro e Enterprise) para mensal e anual.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {modulos.map((mod) => (
          <div
            key={mod.id}
            className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 transition-all ${
              !mod.ativo ? 'opacity-60 grayscale-[0.5]' : ''
            }`}
          >
            <div className="flex flex-col md:flex-row gap-4 md:items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0 border border-red-100">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                      {mod.nome}
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {mod.slug}
                      </span>
                    </h3>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                      {mod.grupo}
                    </span>
                  </div>
                </div>

                {editando === mod.id ? (
                  <input
                    type="text"
                    value={form.descricao}
                    onChange={(e) => setCampo('descricao', e.target.value)}
                    className="w-full text-sm border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500 mt-2"
                    placeholder="Descrição do módulo..."
                  />
                ) : (
                  <p className="text-sm text-gray-600 mt-2">
                    {mod.descricao || 'Sem descrição cadastrada no momento.'}
                  </p>
                )}
              </div>

              <div className="md:text-right shrink-0">
                <span className="inline-block px-3 py-1 bg-gray-50 rounded-full text-xs font-bold text-gray-600 border border-gray-200">
                  {mod._count?.tenantModulos ?? 0} empresas ativas
                </span>
              </div>
            </div>

            {editando === mod.id ? (
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 font-semibold">Plano</th>
                      <th className="px-3 py-2 font-semibold">Mensal (R$)</th>
                      <th className="px-3 py-2 font-semibold">Anual (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-800">Básico</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={form.precoBasico}
                          onChange={(e) => setCampo('precoBasico', e.target.value)}
                          className="w-28 border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={form.precoAnualBasico}
                          onChange={(e) => setCampo('precoAnualBasico', e.target.value)}
                          className="w-28 border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-800">Pro</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={form.preco}
                          onChange={(e) => setCampo('preco', e.target.value)}
                          className="w-28 border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={form.precoAnual}
                          onChange={(e) => setCampo('precoAnual', e.target.value)}
                          className="w-28 border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold text-gray-800">Enterprise</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={form.precoEnterprise}
                          onChange={(e) => setCampo('precoEnterprise', e.target.value)}
                          className="w-28 border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={form.precoAnualEnterprise}
                          onChange={(e) => setCampo('precoAnualEnterprise', e.target.value)}
                          className="w-28 border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {PLANO_KEYS.map((plano) => (
                  <div
                    key={plano}
                    className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      {PLANOS[plano].label}
                    </p>
                    <p className="text-lg font-extrabold text-gray-900 mt-0.5">
                      {money(precoPlano(mod, plano, 'MENSAL'))}
                      <span className="text-xs font-medium text-gray-400"> /mês</span>
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      {money(precoPlano(mod, plano, 'ANUAL'))}
                      <span className="text-xs font-medium text-gray-400"> /ano</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
              {editando === mod.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditando(null)}
                    className="p-2 border rounded-lg text-gray-500 hover:bg-gray-50"
                    disabled={salvando}
                  >
                    <X size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => salvarEdicao(mod.id)}
                    disabled={salvando}
                    className="flex items-center gap-2 px-3 py-2 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Salvar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => iniciarEdicao(mod)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Edit2 size={14} /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStatusModulo(mod)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-semibold ${
                      mod.ativo
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                    title={mod.ativo ? 'Desativar Módulo' : 'Ativar Módulo'}
                  >
                    <Power size={14} /> {mod.ativo ? 'Off' : 'On'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
