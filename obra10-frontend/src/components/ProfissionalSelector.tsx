import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Clock, Plus, Check } from 'lucide-react';
import api from '../services/api';

interface Profissional {
  funcaoCargo: string;
  empresaTerceira: string;
}

interface Props {
  obraId: string;
  selecionados: Profissional[];
  onAdd: (p: Profissional) => void;
  onRemove: (index: number) => void;
}

const FUNCOES_SUGERIDAS: Profissional[] = [
  { funcaoCargo: 'Pedreiro', empresaTerceira: 'Próprio' },
  { funcaoCargo: 'Carpinteiro', empresaTerceira: 'Próprio' },
  { funcaoCargo: 'Eletricista', empresaTerceira: 'Próprio' },
  { funcaoCargo: 'Armador', empresaTerceira: 'Próprio' },
  { funcaoCargo: 'Encanador', empresaTerceira: 'Próprio' },
  { funcaoCargo: 'Servente', empresaTerceira: 'Próprio' },
  { funcaoCargo: 'Mestre de Obra', empresaTerceira: 'Próprio' },
  { funcaoCargo: 'Ajudante', empresaTerceira: 'Terceirizado' },
];

/**
 * Seleção de profissional por toque — chips com busca rápida.
 * Recentes buscados da API (por usuário + obra), não por localStorage.
 * Máximo 3 toques para adicionar ao RDO.
 */
export const ProfissionalSelector: React.FC<Props> = ({ obraId, selecionados, onAdd, onRemove }) => {
  const [busca, setBusca] = useState('');
  const [recentes, setRecentes] = useState<Profissional[]>([]);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/rdos/profissionais/recentes`, { headers: { 'x-obra-id': obraId } })
      .then(r => setRecentes(r.data))
      .catch(() => setRecentes([]));
  }, [obraId]);

  const todos = busca.length > 0
    ? FUNCOES_SUGERIDAS.filter(p => p.funcaoCargo.toLowerCase().includes(busca.toLowerCase()) || p.empresaTerceira.toLowerCase().includes(busca.toLowerCase()))
    : recentes.length > 0 ? recentes : FUNCOES_SUGERIDAS;

  const jaSelecionado = (p: Profissional) =>
    selecionados.some(s => s.funcaoCargo === p.funcaoCargo && s.empresaTerceira === p.empresaTerceira);

  const iniciais = (nome: string) => nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-4">
      {/* Chips selecionados */}
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selecionados.map((p, i) => (
            <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5 text-sm">
              <div className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                {iniciais(p.funcaoCargo)}
              </div>
              <div>
                <span className="font-medium text-red-800">{p.funcaoCargo}</span>
                <span className="text-red-500 text-xs ml-1">({p.empresaTerceira})</span>
              </div>
              <button onClick={() => onRemove(i)} className="ml-1 text-red-400 hover:text-red-600 transition-colors">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onFocus={() => setMostrarBusca(true)}
          placeholder="Buscar função ou empresa..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
      </div>

      {/* Cards de profissional */}
      <div className="space-y-1.5">
        {!busca && recentes.length > 0 && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
            <Clock size={12} /> Recentes nesta obra
          </p>
        )}
        {todos.slice(0, 8).map((p, i) => {
          const sel = jaSelecionado(p);
          return (
            <button
              key={i}
              onClick={() => !sel && onAdd(p)}
              disabled={sel}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                sel
                  ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                  : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50 active:scale-98'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${sel ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                {sel ? <Check size={16} /> : <User size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{p.funcaoCargo}</p>
                <p className="text-xs text-gray-500">{p.empresaTerceira}</p>
              </div>
              {!sel && (
                <div className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 hover:border-red-500 hover:text-red-500 transition-colors">
                  <Plus size={14} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
