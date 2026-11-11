import React, { useState } from 'react';
import { MechanismStore } from '../state/useMechanismStore';
import { PRESETS } from '../engine/presets';
import { DofDetailsModal } from './DofDetailsModal';
import {
  Play,
  Pause,
  RotateCcw,
  Undo2,
  Redo2,
  Download,
  Upload,
  Maximize2,
  Eye,
  Grid,
  Magnet,
  Sparkles,
  Settings,
  Info,
} from 'lucide-react';

interface TopBarProps {
  store: MechanismStore;
}

export const TopBar: React.FC<TopBarProps> = ({ store }) => {
  const {
    simRunning,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    simSpeed,
    setSimSpeed,
    simDir,
    setSimDir,
    simLockedUp,
    analysis,
    parts,
    joints,
    camera,
    setCamera,
    undo,
    redo,
    loadPreset,
    clearAll,
    exportJson,
    importJson,
  } = store;

  const [showDofModal, setShowDofModal] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) importJson(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 gap-2 select-none z-20">
      {/* Esquerda: Logo + Presets + Simulação */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100 text-base tracking-tight mr-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <span>Meca</span>
          <span className="text-blue-600 dark:text-blue-400">Draw</span>
        </div>

        {/* Botão Play / Pause */}
        <button
          onClick={simRunning ? pauseSimulation : startSimulation}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            simRunning
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
          }`}
          title="Iniciar ou Pausar Simulação (Espaço)"
        >
          {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{simRunning ? 'Pausar' : 'Simular'}</span>
        </button>

        {/* Reiniciar */}
        <button
          onClick={resetSimulation}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Reiniciar Posição Original"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reiniciar</span>
        </button>

        {/* Inverter Sentido */}
        <button
          onClick={() => setSimDir((d) => (d === 1 ? -1 : 1))}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Alternar Sentido Horário / Anti-horário"
        >
          {simDir === 1 ? '↻ Horário' : '↺ Anti-horário'}
        </button>

        {/* Controle de Velocidade do Motor */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 ml-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-semibold w-14 text-center">
            {simSpeed} RPM
          </span>
          <input
            type="range"
            min="10"
            max="300"
            step="5"
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
            className="w-20 sm:w-28 accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
            title="Velocidade angular do motor (10 - 300 RPM)"
          />
        </div>
      </div>

      {/* Centro: Telemetria Mecânica & Indicadores de Engenharia */}
      <div className="flex items-center gap-2">
        {/* Badge Interativo de Mobilidade (DOF) */}
        <button
          onClick={() => setShowDofModal(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold font-mono border cursor-pointer hover:ring-2 hover:ring-blue-400/50 hover:shadow-sm active:scale-95 transition-all outline-none ${
            analysis.dof === 1
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              : analysis.dof > 1
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
          }`}
          title="Clique para ver a decomposição detalhada dos Graus de Liberdade (Gruebler-Kutzbach)"
        >
          <span>DOF: {analysis.dof}</span>
          <span className="text-[10px] opacity-75 font-sans">
            {analysis.dof === 1
              ? '(Cinemático OK)'
              : analysis.dof > 1
              ? `(${analysis.dof} Motores)`
              : '(Hiperestático)'}
          </span>
          <Info className="w-3 h-3 opacity-60 ml-0.5" />
        </button>

        {/* Badge de Grashof (se for 4 barras) */}
        {analysis.grashof?.isFourBar && (
          <div
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
            title={`Condição de Grashof: s+l=${analysis.grashof.sPlusL.toFixed(1)} mm, p+q=${analysis.grashof.pPlusQ.toFixed(1)} mm`}
          >
            <span>Grashof:</span>
            <span className="font-semibold capitalize">{analysis.grashof.condition}</span>
          </div>
        )}

        {/* Alerta de Travamento (Singularidade / Lockup) */}
        {simLockedUp && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-600 text-white animate-bounce">
            ⚠ Ponto Morto / Travamento
          </div>
        )}
      </div>

      {/* Direita: Ferramentas de Câmera, Presets, Undo/Redo e Arquivo */}
      <div className="flex items-center gap-1.5">
        {/* Seletor de Presets */}
        <div className="relative flex items-center">
          <select
            onChange={(e) => {
              if (e.target.value) {
                loadPreset(e.target.value as keyof typeof PRESETS);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 cursor-pointer outline-none hover:border-blue-500"
          >
            <option value="" disabled>
              ⚙ Exemplos Prontos
            </option>
            <option value="fourBar">4-Barras (Crank-Rocker)</option>
            <option value="sliderCrank">Biela-Manivela (Pistão)</option>
            <option value="quickReturn">Retorno Rápido (Quick-Return)</option>
            <option value="gearTrain">Trem de Engrenagens (3 Estágios)</option>
            <option value="chebyshev">Chebyshev (Linha Reta)</option>
            <option value="pantograph">Pantógrafo</option>
            <option value="jansenLeg">Theo Jansen (Perna Mecânica)</option>
          </select>
        </div>

        {/* Snap Toggles */}
        <button
          onClick={() => setCamera((c) => ({ ...c, snapToGrid: !c.snapToGrid }))}
          className={`p-1.5 rounded text-xs transition-colors ${
            camera.snapToGrid
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Snap à Grade"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setCamera((c) => ({ ...c, snapToPivots: !c.snapToPivots }))}
          className={`p-1.5 rounded text-xs transition-colors ${
            camera.snapToPivots
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Snap Magnético aos Eixos"
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setCamera((c) => ({ ...c, showDimensions: !c.showDimensions }))}
          className={`p-1.5 rounded text-xs transition-colors ${
            camera.showDimensions
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Exibir Cotas e Dimensões"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setCamera((c) => ({ ...c, showGearContacts: !c.showGearContacts }))}
          className={`p-1.5 rounded text-xs transition-colors ${
            camera.showGearContacts !== false
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Exibir Linhas de Ação e Contatos de Engrenagens"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Trajetórias e Duração do Rastro */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCamera((c) => ({ ...c, showTrails: !c.showTrails }))}
            className={`p-1.5 rounded text-xs transition-colors ${
              camera.showTrails
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Exibir Trajetórias (Curvas de Acoplamento)"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          {camera.showTrails && (
            <select
              value={camera.trailDuration}
              onChange={(e) => setCamera((c) => ({ ...c, trailDuration: parseFloat(e.target.value) }))}
              className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 outline-none cursor-pointer"
              title="Duração do rastro com fade-out temporal"
            >
              <option value="1">1s</option>
              <option value="2">2s</option>
              <option value="3">3s</option>
              <option value="5">5s</option>
              <option value="8">8s</option>
              <option value="0">Infinito</option>
            </select>
          )}
        </div>

        <button
          onClick={() => setCamera((c) => ({ ...c, x: 0, y: 0, zoom: 1.2 }))}
          className="p-1.5 rounded text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Centralizar Visualização (Reset Zoom)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          className="p-1.5 rounded text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={redo}
          className="p-1.5 rounded text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refazer (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Importar / Exportar */}
        <label
          className="p-1.5 rounded text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Importar Arquivo (.json)"
        >
          <Upload className="w-3.5 h-3.5" />
          <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
        </label>

        <button
          onClick={exportJson}
          className="p-1.5 rounded text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Salvar Projeto (.json)"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={clearAll}
          className="px-2 py-1 rounded text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          title="Limpar Área de Trabalho"
        >
          Limpar
        </button>
      </div>

      {/* Modal de Detalhes de Mobilidade (DOF) */}
      {showDofModal && (
        <DofDetailsModal
          analysis={analysis}
          parts={parts}
          joints={joints}
          onClose={() => setShowDofModal(false)}
        />
      )}
    </header>
  );
};
