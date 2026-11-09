import React, { useState } from 'react';
import { MechanismStore } from '../state/useMechanismStore';
import { Activity, ChevronDown, ChevronUp, Download } from 'lucide-react';

interface TelemetryDrawerProps {
  store: MechanismStore;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({ store }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeChart, setActiveChart] = useState<'speed' | 'accel' | 'pos'>('speed');

  const { parts, telemetry, exportCsv } = store;

  // Encontra todos os pivôs que estão com trace = true
  const tracedPivots = parts.flatMap((part) =>
    part.pivots
      .filter((pv) => pv.trace)
      .map((pv) => ({ part, pivot: pv }))
  );

  const [selectedPivotId, setSelectedPivotId] = useState<number | null>(null);

  const currentPivotId =
    selectedPivotId && tracedPivots.some((tp) => tp.pivot.id === selectedPivotId)
      ? selectedPivotId
      : tracedPivots[0]?.pivot.id ?? null;

  const samples = currentPivotId ? telemetry[currentPivotId] || [] : [];
  const latestSample = samples[samples.length - 1];

  if (tracedPivots.length === 0) {
    return null; // Não exibe se nenhum ponto estiver traçando
  }

  // Desenhar mini-gráfico SVG
  const renderSvgChart = () => {
    if (samples.length < 2) {
      return (
        <div className="h-28 flex items-center justify-center text-xs text-slate-400">
          Inicie a simulação para coletar dados cinemáticos...
        </div>
      );
    }

    const width = 600;
    const height = 110;
    const pad = 24;

    const values = samples.map((s) =>
      activeChart === 'speed' ? s.speed : activeChart === 'accel' ? s.accel : Math.hypot(s.x, s.y)
    );

    const maxVal = Math.max(1, ...values);

    const points = samples
      .map((_, idx) => {
        const x = pad + (idx / (samples.length - 1)) * (width - 2 * pad);
        const y = height - pad - (values[idx] / maxVal) * (height - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
          {/* Linhas de Grade Horizontal */}
          <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="currentColor" strokeOpacity="0.1" />
          <line
            x1={pad}
            y1={height / 2}
            x2={width - pad}
            y2={height / 2}
            stroke="currentColor"
            strokeOpacity="0.1"
          />
          <line
            x1={pad}
            y1={height - pad}
            x2={width - pad}
            y2={height - pad}
            stroke="currentColor"
            strokeOpacity="0.2"
          />

          {/* Curva de Telemetria */}
          <polyline
            fill="none"
            stroke={activeChart === 'speed' ? '#06b6d4' : activeChart === 'accel' ? '#f59e0b' : '#a855f7'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Rótulo de Escala Máxima */}
          <text x={pad + 4} y={pad - 4} fontSize="9" fill="currentColor" opacity="0.6">
            Max: {maxVal.toFixed(1)} {activeChart === 'speed' ? 'mm/s' : activeChart === 'accel' ? 'mm/s²' : 'mm'}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="absolute bottom-0 right-0 left-16 z-10 flex flex-col items-center pointer-events-none">
      {/* Botão de Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto mb-1 flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all"
      >
        <Activity className="w-3.5 h-3.5 text-blue-600" />
        <span>Telemetria Cinemática ({tracedPivots.length} ponto{tracedPivots.length > 1 ? 's' : ''})</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Painel do Gráfico */}
      {isOpen && (
        <div className="pointer-events-auto w-full max-w-4xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-x border-slate-200 dark:border-slate-800 rounded-t-xl shadow-2xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Ponto Traçador:
              </span>
              <select
                value={currentPivotId || ''}
                onChange={(e) => setSelectedPivotId(Number(e.target.value))}
                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 outline-none"
              >
                {tracedPivots.map((tp) => (
                  <option key={tp.pivot.id} value={tp.pivot.id}>
                    {tp.part.name} - Eixo #{tp.pivot.id % 1000}
                  </option>
                ))}
              </select>
            </div>

            {/* Abas do Tipo de Gráfico */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setActiveChart('speed')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeChart === 'speed'
                    ? 'bg-white dark:bg-slate-700 font-semibold shadow-sm text-cyan-600'
                    : 'text-slate-500'
                }`}
              >
                Velocidade (|v|)
              </button>
              <button
                onClick={() => setActiveChart('accel')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeChart === 'accel'
                    ? 'bg-white dark:bg-slate-700 font-semibold shadow-sm text-amber-600'
                    : 'text-slate-500'
                }`}
              >
                Aceleração (|a|)
              </button>
              <button
                onClick={() => setActiveChart('pos')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeChart === 'pos'
                    ? 'bg-white dark:bg-slate-700 font-semibold shadow-sm text-purple-600'
                    : 'text-slate-500'
                }`}
              >
                Raio Posição (|r|)
              </button>
            </div>

            {/* Exportar CSV */}
            {currentPivotId && (
              <button
                onClick={() => exportCsv(currentPivotId)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium text-slate-700 dark:text-slate-200 transition-colors"
                title="Exportar dados cinemáticos para arquivo CSV"
              >
                <Download className="w-3 h-3" />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>

          {/* Gráfico SVG */}
          {renderSvgChart()}

          {/* Valores instantâneos */}
          {latestSample && (
            <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono bg-slate-50 dark:bg-slate-800/50 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Posição (X, Y)</span>
                <span>
                  {latestSample.x.toFixed(1)}, {latestSample.y.toFixed(1)} mm
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Velocidade linear</span>
                <span className="text-cyan-600 font-semibold">{latestSample.speed.toFixed(1)} mm/s</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Aceleração linear</span>
                <span className="text-amber-600 font-semibold">{latestSample.accel.toFixed(1)} mm/s²</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Tempo Simulado</span>
                <span>{latestSample.time.toFixed(2)} s</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
