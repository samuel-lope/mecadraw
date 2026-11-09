import React from 'react';
import { MechanismStore } from '../state/useMechanismStore';
import { Trash2, Copy, Link, Unlink } from 'lucide-react';

interface InspectorPanelProps {
  store: MechanismStore;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ store }) => {
  const {
    parts,
    joints,
    selection,
    setSelection,
    updatePart,
    deletePart,
    deletePivot,
    disconnectJoint,
    togglePivotGround,
    togglePivotMotor,
    togglePivotSlider,
    togglePivotTrace,
    duplicateSelected,
  } = store;

  const selPart = parts.find((p) => p.id === selection.partId);
  const selPivot = selPart?.pivots.find((v) => v.id === selection.pivotId);

  // Juntas conectadas ao pivô selecionado
  const connectedJoints = selPivot
    ? joints.filter((j) => j.p1 === selPivot.id || j.p2 === selPivot.id)
    : [];

  if (!selPart) {
    return (
      <aside className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 text-xs text-slate-500 select-none overflow-y-auto">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Propriedades</h3>
        <p className="leading-relaxed">
          Selecione uma peça ou eixo no canvas para editar dimensões, restrições e acionamento.
        </p>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Dicas Rápidas:</span>
          <span>• <b>Desenhar Elo</b>: Escolha 'Barra' e arraste de um ponto a outro.</span>
          <span>• <b>Juntas Automáticas</b>: Soltar uma extremidade sobre um eixo une-os.</span>
          <span>• <b>Girar</b>: Arraste a pequena alça azul no topo da peça.</span>
          <span>• <b>Slider Linear</b>: Marque 'Slider' no pivô para criar uma guia de pistão.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-3.5 flex flex-col gap-4 text-xs text-slate-700 dark:text-slate-200 select-none overflow-y-auto shrink-0">
      {/* Cabeçalho da Peça */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <input
            type="text"
            value={selPart.name}
            onChange={(e) => updatePart(selPart.id, (p) => ({ ...p, name: e.target.value }))}
            className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 outline-none text-slate-900 dark:text-slate-50 w-full mr-2"
          />
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            {selPart.type}
          </span>
        </div>
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={duplicateSelected}
            className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors"
          >
            <Copy className="w-3 h-3" />
            <span>Duplicar</span>
          </button>
          <button
            onClick={() => deletePart(selPart.id)}
            className="flex items-center justify-center gap-1 py-1 px-2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-medium transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Excluir</span>
          </button>
        </div>
      </div>

      {/* Dimensões Geométricas */}
      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
          Geometria
        </h4>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">
              {selPart.type === 'circle' ? 'Diâmetro (mm)' : 'Comprimento (mm)'}
            </span>
            <input
              type="number"
              step="1"
              value={Math.round(selPart.w * 10) / 10}
              onChange={(e) => {
                const val = Math.max(10, parseFloat(e.target.value) || 10);
                updatePart(selPart.id, (p) => {
                  const factor = val / p.w;
                  return {
                    ...p,
                    w: val,
                    h: p.type === 'circle' ? val : p.h,
                    pivots: p.pivots.map((pv) => ({ ...pv, lx: pv.lx * factor })),
                  };
                });
              }}
              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
            />
          </label>

          {selPart.type !== 'circle' && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">Largura/Espessura (mm)</span>
              <input
                type="number"
                step="1"
                value={Math.round(selPart.h * 10) / 10}
                onChange={(e) => {
                  const val = Math.max(8, parseFloat(e.target.value) || 8);
                  updatePart(selPart.id, (p) => ({ ...p, h: val }));
                }}
                className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">Ângulo (°)</span>
            <input
              type="number"
              step="1"
              value={Math.round(((selPart.rot * 180) / Math.PI) % 360)}
              onChange={(e) => {
                const deg = parseFloat(e.target.value) || 0;
                updatePart(selPart.id, (p) => ({ ...p, rot: (deg * Math.PI) / 180 }));
              }}
              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">Posição X (mm)</span>
            <input
              type="number"
              step="1"
              value={Math.round(selPart.x * 10) / 10}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                updatePart(selPart.id, (p) => ({ ...p, x: val }));
              }}
              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
            />
          </label>
        </div>
      </div>

      {/* Lista de Eixos */}
      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
            Eixos ({selPart.pivots.length})
          </h4>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {selPart.pivots.map((pv, idx) => {
            const isPvSel = selPivot?.id === pv.id;
            return (
              <button
                key={pv.id}
                onClick={() => setSelection({ partId: selPart.id, pivotId: pv.id })}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  isPvSel
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                Eixo {idx + 1}
                {pv.motor ? ' ⚙' : pv.fixed ? ' ▲' : ''}
                {pv.slider?.enabled ? ' ⇄' : ''}
                {pv.trace ? ' ✎' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhes do Eixo Selecionado */}
      {selPivot ? (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-3 bg-slate-50/60 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Eixo Selecionado
            </span>
            <button
              onClick={() => deletePivot(selPart.id, selPivot.id)}
              disabled={selPart.pivots.length <= 1}
              className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30"
              title="Excluir este Eixo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500">Local X (mm)</span>
              <input
                type="number"
                step="1"
                value={Math.round(selPivot.lx * 10) / 10}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updatePart(selPart.id, (p) => ({
                    ...p,
                    pivots: p.pivots.map((v) => (v.id === selPivot.id ? { ...v, lx: val } : v)),
                  }));
                }}
                className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-500">Local Y (mm)</span>
              <input
                type="number"
                step="1"
                value={Math.round(selPivot.ly * 10) / 10}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updatePart(selPart.id, (p) => ({
                    ...p,
                    pivots: p.pivots.map((v) => (v.id === selPivot.id ? { ...v, ly: val } : v)),
                  }));
                }}
                className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
              />
            </label>
          </div>

          {/* Toggles de Engenharia */}
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(selPivot.fixed)}
                onChange={() => togglePivotGround(selPivot.id)}
                className="accent-blue-600 rounded"
              />
              <span>Fixo ao Plano / Terra (▲)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(selPivot.motor)}
                onChange={() => togglePivotMotor(selPivot.id)}
                className="accent-amber-500 rounded"
              />
              <span>Motor Acionador (⚙ Gira o elo)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(selPivot.slider?.enabled)}
                onChange={() => togglePivotSlider(selPivot.id)}
                className="accent-cyan-500 rounded"
              />
              <span>Guia Linear Prismática (⇄ Slider)</span>
            </label>

            {selPivot.slider?.enabled && (
              <div className="pl-5 flex items-center gap-2">
                <span className="text-[10px] text-slate-500">Ângulo da Guia (°):</span>
                <input
                  type="number"
                  step="5"
                  value={Math.round(((selPivot.slider.angle * 180) / Math.PI) % 360)}
                  onChange={(e) => {
                    const deg = parseFloat(e.target.value) || 0;
                    updatePart(selPart.id, (p) => ({
                      ...p,
                      pivots: p.pivots.map((v) =>
                        v.id === selPivot.id && v.slider
                          ? { ...v, slider: { ...v.slider, angle: (deg * Math.PI) / 180 } }
                          : v
                      ),
                    }));
                  }}
                  className="w-16 p-1 text-center rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(selPivot.trace)}
                onChange={() => togglePivotTrace(selPivot.id)}
                className="accent-purple-500 rounded"
              />
              <span>Traçar Curva de Acoplamento (✎)</span>
            </label>
          </div>

          {/* Juntas Vinculadas */}
          {connectedJoints.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                Juntas Conectadas:
              </span>
              {connectedJoints.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between text-xs py-1 px-1.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
                >
                  <span className="flex items-center gap-1">
                    <Link className="w-3 h-3 text-blue-500" />
                    <span>Junta #{j.id % 1000}</span>
                  </span>
                  <button
                    onClick={() => disconnectJoint(j.id)}
                    className="p-1 hover:text-rose-500"
                    title="Soltar esta junta"
                  >
                    <Unlink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-400 italic text-[11px]">
          Clique em um eixo acima para editar motor, fixação ou guia linear.
        </p>
      )}
    </aside>
  );
};
