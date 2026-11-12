import React, { useState } from 'react';
import { MechanismStore } from '../state/useMechanismStore';
import { Trash2, Copy, Link, Unlink, Plus, Eye, EyeOff, Palette, RotateCcw } from 'lucide-react';
import { calculateGearRadii } from '../engine/gearGeometry';
import { calculateBeltGeometry } from '../engine/beltGeometry';
import { ElementStyle, StrokeLineStyle } from '../types/mechanism';

const PRESET_COLORS = [
  '#2563eb', // Azul Royal
  '#06b6d4', // Ciano
  '#10b981', // Esmeralda / Verde
  '#f59e0b', // Âmbar / Laranja
  '#ef4444', // Vermelho
  '#8b5cf6', // Roxo
  '#475569', // Cinza Aço
  '#1e293b', // Antracite / Grafite
];

interface AppearanceSectionProps {
  title?: string;
  style?: ElementStyle;
  defaultStroke?: string;
  defaultFill?: string;
  defaultWidth?: number;
  defaultOpacity?: number;
  onChange: (patch: Partial<ElementStyle>) => void;
  onReset: () => void;
}

const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  title = 'Aparência & Estilo',
  style,
  defaultStroke = '#2563eb',
  defaultFill = '#2563eb',
  defaultWidth = 1.5,
  defaultOpacity = 0.15,
  onChange,
  onReset,
}) => {
  const currentStroke = style?.strokeColor || defaultStroke;
  const currentFill = style?.fillColor || defaultFill;
  const currentWidth = style?.strokeWidth !== undefined ? style.strokeWidth : defaultWidth;
  const currentStyle = style?.strokeStyle || 'solid';
  const currentOpacity = style?.opacity !== undefined ? style.opacity : defaultOpacity;

  return (
    <div className="flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
            {title}
          </h4>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Restaurar estilo padrão"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Restaurar</span>
        </button>
      </div>

      {/* Paleta rápida de cores */}
      <div className="flex items-center justify-between gap-1">
        {PRESET_COLORS.map((hex) => (
          <button
            key={hex}
            onClick={() => onChange({ strokeColor: hex, fillColor: hex })}
            className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 hover:scale-110 transition-transform shadow-xs cursor-pointer"
            style={{ backgroundColor: hex }}
            title={`Definir cor ${hex}`}
          />
        ))}
      </div>

      {/* Cor do Contorno */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500 font-medium">Cor do Contorno</span>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={currentStroke.startsWith('#') && currentStroke.length === 7 ? currentStroke : '#2563eb'}
            onChange={(e) => onChange({ strokeColor: e.target.value })}
            className="w-6 h-6 p-0 border border-slate-300 dark:border-slate-700 rounded cursor-pointer bg-transparent"
          />
          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 uppercase">
            {currentStroke}
          </span>
        </div>
      </div>

      {/* Espessura da Linha */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-500 font-medium">Espessura da Linha</span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
            {currentWidth} px
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          step="0.5"
          value={currentWidth}
          onChange={(e) => onChange({ strokeWidth: parseFloat(e.target.value) })}
          className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
        />
      </div>

      {/* Tipo de Linha */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 font-medium">Tipo de Linha</span>
        <select
          value={currentStyle}
          onChange={(e) => onChange({ strokeStyle: e.target.value as StrokeLineStyle })}
          className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <option value="solid">Sólida (──────)</option>
          <option value="dashed">Tracejada (– – –)</option>
          <option value="dotted">Pontilhada (· · ·)</option>
          <option value="dashdot">Traço-Ponto (– · –)</option>
        </select>
      </div>

      {/* Cor de Preenchimento */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500 font-medium">Preenchimento</span>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={currentFill.startsWith('#') && currentFill.length === 7 ? currentFill : '#2563eb'}
            onChange={(e) => onChange({ fillColor: e.target.value })}
            className="w-6 h-6 p-0 border border-slate-300 dark:border-slate-700 rounded cursor-pointer bg-transparent"
          />
          <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 uppercase">
            {currentFill}
          </span>
        </div>
      </div>

      {/* Opacidade do Preenchimento */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-500 font-medium">Opacidade</span>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
            {Math.round(currentOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={currentOpacity}
          onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
        />
      </div>
    </div>
  );
};

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
    updatePartStyle,
    resetPartStyle,
    deletePart,
    deletePivot,
    connectJoint,
    disconnectJoint,
    updateJointStyle,
    resetJointStyle,
    addSlotToPart,
    updateSlot,
    deleteSlot,
    connectPinToSlot,
    updateGear,
    connectGears,
    connectBelt,
    lockCoaxialGears,
    unlockCoaxialGears,
    camera,
    setCamera,
    togglePivotGround,
    togglePivotMotor,
    togglePivotSlider,
    togglePivotTrace,
    duplicateSelected,
    togglePartVisibility,
    showAllParts,
    simSpeed,
  } = store;

  const [selectedTargetPivotId, setSelectedTargetPivotId] = useState<string>('');

  const selPart = parts.find((p) => p.id === selection.partId);
  const selPivot = selPart?.pivots.find((v) => v.id === selection.pivotId);

  // Outros alvos (eixos, fendas e engrenagens) disponíveis para conexão
  const otherTargets: {
    type: 'pivot' | 'slot' | 'gear' | 'weld' | 'belt';
    id: string;
    label: string;
    part: typeof parts[0];
    pivot?: typeof parts[0]['pivots'][0];
    slot?: NonNullable<typeof parts[0]['slots']>[0];
  }[] = [];

  if (selPart) {
    parts.forEach((p) => {
      if (p.id !== selPart.id) {
        if (selPivot) {
          p.pivots.forEach((pv) => {
            otherTargets.push({
              type: 'pivot',
              id: `pivot:${pv.id}`,
              label: `Eixo ${pv.label} (Peça ${p.letter || 'A'})`,
              part: p,
              pivot: pv,
            });
          });
          (p.slots || []).forEach((sl) => {
            otherTargets.push({
              type: 'slot',
              id: `slot:${p.id}:${sl.id}`,
              label: `Fenda ${sl.label} (Peça ${p.letter || 'A'})`,
              part: p,
              slot: sl,
            });
          });
        }
        if (selPart.type === 'gear' && p.type === 'gear' && p.gear) {
          otherTargets.push({
            type: 'gear',
            id: `gear:${p.id}`,
            label: `Engrenar com Peça ${p.letter || 'A'} (${p.gear.teeth}D)`,
            part: p,
          });
          otherTargets.push({
            type: 'belt',
            id: `belt:${p.id}`,
            label: `Correia Dentada c/ Peça ${p.letter || 'A'} (${p.gear.teeth}D)`,
            part: p,
          });
          otherTargets.push({
            type: 'weld',
            id: `weld:${p.id}`,
            label: `Travar no Mesmo Eixo com Peça ${p.letter || 'A'} (Solidária)`,
            part: p,
          });
        }
      }
    });
  }

  // Juntas conectadas ao pivô ou à engrenagem selecionada
  const connectedJoints = selPart
    ? joints
        .filter((j) => {
          if (selPivot && (j.p1 === selPivot.id || j.p2 === selPivot.id)) return true;
          return (
            (j.type === 'gear' || j.type === 'weld' || j.type === 'belt') &&
            (j.part1Id === selPart.id || j.part2Id === selPart.id)
          );
        })
        .map((j) => {
          if (j.type === 'pin-in-slot' && j.slotId) {
            let partnerInfo = 'Fenda Desconhecida';
            for (const p of parts) {
              const sl = p.slots?.find((s) => s.id === j.slotId);
              if (sl) {
                partnerInfo = `Peça ${p.letter || 'A'} — Fenda ${sl.label || 'S'}`;
              }
            }
            return { joint: j, partnerInfo, isSlot: true };
          }
          if (j.type === 'gear') {
            const partnerPartId = (selPart && j.part1Id === selPart.id) ? j.part2Id : j.part1Id;
            const partnerPart = parts.find((p) => p.id === partnerPartId);
            return {
              joint: j,
              partnerInfo: `Engrenada c/ Peça ${partnerPart?.letter || 'A'} (i = ${(j.gearRatio || 1).toFixed(2)})`,
              isSlot: false,
            };
          }
          if (j.type === 'belt') {
            const partnerPartId = (selPart && j.part1Id === selPart.id) ? j.part2Id : j.part1Id;
            const partnerPart = parts.find((p) => p.id === partnerPartId);
            return {
              joint: j,
              partnerInfo: `Correia Dentada c/ Peça ${partnerPart?.letter || 'B'} (${partnerPart?.gear?.teeth || 20}D)`,
              isSlot: false,
            };
          }
          if (j.type === 'weld') {
            const partnerPartId = (selPart && j.part1Id === selPart.id) ? j.part2Id : j.part1Id;
            const partnerPart = parts.find((p) => p.id === partnerPartId);
            return {
              joint: j,
              partnerInfo: `Eixo Composto c/ Peça ${partnerPart?.letter || 'B'} (Solidária)`,
              isSlot: false,
            };
          }
          const partnerId = selPivot ? (j.p1 === selPivot.id ? j.p2 : j.p1) : j.p2;
          let partnerInfo = 'Eixo Desconhecido';
          for (const p of parts) {
            for (const pv of p.pivots) {
              if (pv.id === partnerId) {
                partnerInfo = `Peça ${p.letter || 'A'} (${pv.label})`;
              }
            }
          }
          return { joint: j, partnerInfo, isSlot: false };
        })
    : [];

  if (!selPart) {
    const selJoint = joints.find((j) => j.id === selection.jointId);
    if (selJoint && selJoint.type === 'belt') {
      const p1 = parts.find((p) => p.id === selJoint.part1Id);
      const p2 = parts.find((p) => p.id === selJoint.part2Id);
      const geom = p1 && p2 ? calculateBeltGeometry(p1, p2) : null;

      return (
        <aside className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4 text-xs select-none overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                Correia Dentada
              </h3>
            </div>
            <button
              onClick={() => {
                disconnectJoint(selJoint.id);
                setSelection({});
              }}
              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
              title="Excluir Correia"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {geom && p1 && p2 ? (
            <div className="flex flex-col gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                  Polias Conectadas
                </span>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Polia 1 ({p1.letter || 'A'}):</span>
                  <span className="font-mono font-medium">{p1.gear?.teeth} dentes (m={p1.gear?.module})</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Polia 2 ({p2.letter || 'B'}):</span>
                  <span className="font-mono font-medium">{p2.gear?.teeth} dentes (m={p2.gear?.module})</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Relação de Transmissão:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {geom.ratio >= 1 ? `1 : ${(1 / geom.ratio).toFixed(2)}` : `${geom.ratio.toFixed(2)} : 1`} ({geom.ratio.toFixed(2)})
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                  Dados Métricos da Correia
                </span>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Comprimento Total (L):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{geom.totalLength.toFixed(1)} mm</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Quantidade de Dentes:</span>
                  <span className="font-mono font-medium">{geom.teethCount} dentes</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Passo Circular (p = π·m):</span>
                  <span className="font-mono font-medium">{geom.pitch.toFixed(2)} mm</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Distância entre Centros (d):</span>
                  <span className="font-mono font-medium">{geom.d.toFixed(1)} mm</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span>Comprimento do Vão Reto:</span>
                  <span className="font-mono font-medium">{geom.spanLength.toFixed(1)} mm</span>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded text-[11px] text-blue-700 dark:text-blue-300">
                A correia dentada transmite rotação no mesmo sentido. Arrastar qualquer uma das engrenagens ajusta dinamicamente o comprimento e a quantidade de dentes.
              </div>

              <AppearanceSection
                title="Estilo da Correia"
                style={selJoint.style}
                defaultStroke={selJoint.color || '#1e293b'}
                defaultFill="#06b6d4"
                defaultWidth={selJoint.beltWidth || 5}
                defaultOpacity={0.15}
                onChange={(patch) => updateJointStyle(selJoint.id, patch)}
                onReset={() => resetJointStyle(selJoint.id)}
              />
            </div>
          ) : (
            <div className="text-slate-400">Engrenagens da correia indisponíveis.</div>
          )}
        </aside>
      );
    }

    return (
      <aside className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 text-xs text-slate-500 select-none overflow-y-auto">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Propriedades</h3>
        <p className="leading-relaxed">
          Selecione uma peça ou eixo no canvas para editar dimensões, restrições e conexões.
        </p>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Dicas Práticas:</span>
          <span>• <b>Ajustar Barra</b>: Arraste qualquer eixo para esticar/encurtar a barra na tela.</span>
          <span>• <b>Eixos Conectados</b>: Arrastar um eixo de junta altera todas as barras conectadas ao nó.</span>
          <span>• <b>Editar Conexões</b>: Use o painel abaixo para unir ou soltar eixos diretamente.</span>
          <span>• <b>Velocidade</b>: O controle de RPM responde instantaneamente durante a simulação.</span>
        </div>

        {/* Peças Ocultas */}
        {parts.some((p) => p.hidden) && (
          <div className="flex flex-col gap-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-100 text-[11px] uppercase tracking-wider">
                Peças Ocultas ({parts.filter((p) => p.hidden).length})
              </span>
              <button
                onClick={showAllParts}
                className="text-[10px] text-blue-600 hover:underline font-medium"
              >
                Exibir Todas
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {parts
                .filter((p) => p.hidden)
                .map((hp) => (
                  <div
                    key={hp.id}
                    className="flex items-center justify-between py-1 px-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Peça {hp.letter || 'A'} ({hp.name})
                    </span>
                    <button
                      onClick={() => togglePartVisibility(hp.id)}
                      className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Exibir</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-3.5 flex flex-col gap-4 text-xs text-slate-700 dark:text-slate-200 select-none overflow-y-auto shrink-0">
      {/* Cabeçalho da Peça */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-slate-50">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center font-mono text-xs font-bold">
              {selPart.letter || 'A'}
            </span>
            <span>Peça {selPart.letter || 'A'}</span>
            <span className="text-slate-400 font-normal text-xs">({selPart.name})</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            {selPart.type}
          </span>
        </div>
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => togglePartVisibility(selPart.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors"
            title="Ocultar Peça e Eixos (H)"
          >
            <EyeOff className="w-3 h-3" />
            <span>Ocultar</span>
          </button>
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
          {selPart.type === 'gear' ? 'Geometria da Engrenagem' : 'Geometria da Peça'}
        </h4>

        {selPart.type === 'gear' && selPart.gear ? (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-medium">Nº de Dentes (z)</span>
                <input
                  type="number"
                  min="6"
                  max="120"
                  step="1"
                  value={selPart.gear.teeth}
                  onChange={(e) => {
                    const z = Math.max(6, parseInt(e.target.value) || 6);
                    updateGear(selPart.id, { teeth: z });
                  }}
                  className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-medium">Módulo m (mm)</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  step="0.5"
                  value={selPart.gear.module}
                  onChange={(e) => {
                    const m = Math.max(1, parseFloat(e.target.value) || 1);
                    updateGear(selPart.id, { module: m });
                  }}
                  className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
              </label>

              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] text-slate-500 font-medium">Perfil do Dente</span>
                <select
                  value={selPart.gear.profile || 'involute'}
                  onChange={(e) => {
                    updateGear(selPart.id, {
                      profile: e.target.value as 'involute' | 'trapezoidal' | 'cycloidal',
                    });
                  }}
                  className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
                >
                  <option value="involute">Evolvente de Círculo (ISO DIN 867)</option>
                  <option value="cycloidal">Cicloidal (Ogival / Fina)</option>
                  <option value="trapezoidal">Trapezoidal / Dentes Retos</option>
                </select>
              </label>
            </div>

            {/* Dados Técnicos Calculados da Engrenagem */}
            {(() => {
              const radii = calculateGearRadii(selPart.gear.teeth, selPart.gear.module);
              return (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Diâm. Primitivo (Dp):</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {(radii.pitch * 2).toFixed(1)} mm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Diâm. Externo (Da):</span>
                    <span>{(radii.addendum * 2).toFixed(1)} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Diâm. Raiz (Df):</span>
                    <span>{(radii.dedendum * 2).toFixed(1)} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Passo Circular (p):</span>
                    <span>{radii.circularPitch.toFixed(2)} mm</span>
                  </div>
                </div>
              );
            })()}

            {/* Eixo Solidário (Redução Composta / Eixo Compartilhado) */}
            {(() => {
              const weldJoint = joints.find(
                (j) => j.type === 'weld' && (j.part1Id === selPart.id || j.part2Id === selPart.id)
              );
              const partnerId = weldJoint ? (weldJoint.part1Id === selPart.id ? weldJoint.part2Id : weldJoint.part1Id) : null;
              const partnerPart = partnerId ? parts.find((p) => p.id === partnerId) : null;

              if (weldJoint && partnerPart) {
                return (
                  <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/40 rounded-md border border-blue-200 dark:border-blue-900 text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        🔗 Eixo Composto (Solidária)
                      </span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">
                        Travada com Peça {partnerPart.letter || 'B'} ({partnerPart.gear?.teeth}D) — Giro 1:1
                      </span>
                    </div>
                    <button
                      onClick={() => unlockCoaxialGears(selPart.id, partnerPart.id)}
                      className="px-2 py-1 text-[10px] font-medium bg-white dark:bg-slate-800 text-rose-600 hover:bg-rose-50 rounded border border-rose-200 dark:border-rose-900/50 transition-colors"
                      title="Destravar do mesmo eixo"
                    >
                      Destravar
                    </button>
                  </div>
                );
              }

              // Se não estiver travada, verificar se há engrenagem concêntrica próxima
              const concentric = parts.find(
                (p) => p.id !== selPart.id && p.type === 'gear' && Math.hypot(p.x - selPart.x, p.y - selPart.y) <= 8
              );
              if (concentric) {
                return (
                  <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/40 rounded-md border border-amber-200 dark:border-amber-900 text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        Engrenagem Concêntrica
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        Alinhada ao centro da Peça {concentric.letter || 'B'}
                      </span>
                    </div>
                    <button
                      onClick={() => lockCoaxialGears(selPart.id, concentric.id)}
                      className="px-2 py-1 text-[10px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Travar Eixo
                    </button>
                  </div>
                );
              }

              return null;
            })()}

            {/* Toggle de Contatos de Engrenagem */}
            <label className="flex items-center justify-between py-1 px-1 cursor-pointer">
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                Linha de Ação e Contatos
              </span>
              <input
                type="checkbox"
                checked={camera.showGearContacts !== false}
                onChange={(e) => setCamera((c) => ({ ...c, showGearContacts: e.target.checked }))}
                className="accent-blue-600 rounded"
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">
                {selPart.type === 'circle'
                  ? 'Diâmetro (mm)'
                  : selPart.type === 'bar'
                  ? 'Entre Eixos L (mm)'
                  : 'Comprimento (mm)'}
              </span>
              <input
                type="number"
                step="1"
                value={
                  selPart.type === 'bar' && selPart.pivots.length >= 2
                    ? Math.round(
                        Math.hypot(
                          selPart.pivots[1].lx - selPart.pivots[0].lx,
                          selPart.pivots[1].ly - selPart.pivots[0].ly
                        ) * 10
                      ) / 10
                    : Math.round(selPart.w * 10) / 10
                }
                onChange={(e) => {
                  const val = Math.max(10, parseFloat(e.target.value) || 10);
                  updatePart(selPart.id, (p) => {
                    if (p.type === 'bar' && p.pivots.length >= 2) {
                      const newL = val;
                      const newW = newL + p.h;
                      const origL = Math.hypot(p.pivots[1].lx - p.pivots[0].lx, p.pivots[1].ly - p.pivots[0].ly) || 1;
                      const scale = newL / origL;
                      return {
                        ...p,
                        w: newW,
                        pivots: p.pivots.map((pv, idx) => {
                          if (idx === 0) return { ...pv, lx: -newL / 2, ly: 0 };
                          if (idx === 1) return { ...pv, lx: newL / 2, ly: 0 };
                          return { ...pv, lx: pv.lx * scale };
                        }),
                        slots: (p.slots || []).map((sl) => ({
                          ...sl,
                          length: Math.min(sl.length, Math.max(20, newW - 24)),
                        })),
                      };
                    }
                    const factor = val / p.w;
                    return {
                      ...p,
                      w: val,
                      h: p.type === 'circle' ? val : p.h,
                      pivots: p.pivots.map((pv) => ({
                        ...pv,
                        lx: pv.lx * factor,
                        ly: p.type === 'circle' ? pv.ly * factor : pv.ly,
                      })),
                    };
                  });
                }}
                className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
              />
            </label>

            {selPart.type !== 'circle' && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500">
                  {selPart.type === 'bar' ? 'Espessura h (mm)' : 'Largura (mm)'}
                </span>
                <input
                  type="number"
                  step="1"
                  value={Math.round(selPart.h * 10) / 10}
                  onChange={(e) => {
                    const val = Math.max(8, parseFloat(e.target.value) || 8);
                    updatePart(selPart.id, (p) => {
                      if (p.type === 'bar' && p.pivots.length >= 2) {
                        const L = Math.hypot(
                          p.pivots[1].lx - p.pivots[0].lx,
                          p.pivots[1].ly - p.pivots[0].ly
                        );
                        return { ...p, h: val, w: L + val };
                      }
                      const factorY = val / (p.h || 1);
                      return {
                        ...p,
                        h: val,
                        pivots: p.pivots.map((pv) => ({ ...pv, ly: pv.ly * factorY })),
                      };
                    });
                  }}
                  className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
              </label>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-1">
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

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">Posição Y (mm)</span>
            <input
              type="number"
              step="1"
              value={Math.round(selPart.y * 10) / 10}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                updatePart(selPart.id, (p) => ({ ...p, y: val }));
              }}
              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
            />
          </label>

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
        </div>
      </div>

      {/* Aparência & Estilo */}
      <AppearanceSection
        title={selPart.type === 'gear' ? 'Estilo da Engrenagem' : 'Aparência & Estilo'}
        style={selPart.style}
        defaultStroke={selPart.color || '#2563eb'}
        defaultFill={selPart.color || '#2563eb'}
        defaultWidth={1.5}
        defaultOpacity={0.15}
        onChange={(patch) => updatePartStyle(selPart.id, patch)}
        onReset={() => resetPartStyle(selPart.id)}
      />

      {/* Lista de Eixos com Identificadores */}
      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
          Eixos da Peça ({selPart.pivots.length})
        </h4>

        <div className="flex flex-wrap gap-1.5">
          {selPart.pivots.map((pv, idx) => {
            const isPvSel = selPivot?.id === pv.id;
            const label = pv.label || `${selPart.name.charAt(0).toUpperCase()}${idx + 1}`;
            return (
              <button
                key={pv.id}
                onClick={() => setSelection({ partId: selPart.id, pivotId: pv.id })}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  isPvSel
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {label}
                {pv.motor ? ' ⚙' : pv.fixed ? ' ▲' : ''}
                {pv.slider?.enabled ? ' ⇄' : ''}
                {pv.trace ? ' ✎' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fendas da Peça */}
      <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
            Fendas da Peça ({(selPart.slots || []).length})
          </h4>
          <button
            onClick={() => addSlotToPart(selPart.id, 80, 0, true, 0, 0)}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-medium py-0.5 px-1.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900"
          >
            <Plus className="w-3 h-3" />
            <span>+ Fenda</span>
          </button>
        </div>

        {(selPart.slots || []).length > 0 ? (
          <div className="flex flex-col gap-2">
            {(selPart.slots || []).map((slot) => (
              <div
                key={slot.id}
                className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-blue-600 dark:text-blue-400">
                    {slot.label || `Fenda ${slot.id}`}
                  </span>
                  <button
                    onClick={() => deleteSlot(selPart.id, slot.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    title="Excluir fenda"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500">Comprimento (mm)</span>
                    <input
                      type="number"
                      min="20"
                      max="500"
                      step="5"
                      value={slot.length}
                      onChange={(e) => {
                        const val = Math.max(10, parseFloat(e.target.value) || 10);
                        updateSlot(selPart.id, slot.id, { length: val });
                      }}
                      className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </label>
                  {selPart.type === 'bar' ? (
                    <div className="flex flex-col gap-0.5 opacity-80">
                      <span className="text-[10px] text-slate-500">Alinhamento</span>
                      <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-blue-600 dark:text-blue-400 font-mono font-medium text-center border border-slate-200 dark:border-slate-700">
                        Centro da Barra
                      </span>
                    </div>
                  ) : (
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Ângulo (°)</span>
                      <input
                        type="number"
                        step="5"
                        value={Math.round(((slot.angle * 180) / Math.PI) % 360)}
                        onChange={(e) => {
                          const deg = parseFloat(e.target.value) || 0;
                          updateSlot(selPart.id, slot.id, { angle: (deg * Math.PI) / 180 });
                        }}
                        className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-slate-500">Local X (mm)</span>
                    <input
                      type="number"
                      step="1"
                      value={Math.round(slot.lx * 10) / 10}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateSlot(selPart.id, slot.id, { lx: val });
                      }}
                      className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                    />
                  </label>
                  {selPart.type !== 'bar' && (
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Local Y (mm)</span>
                      <input
                        type="number"
                        step="1"
                        value={Math.round(slot.ly * 10) / 10}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          updateSlot(selPart.id, slot.id, { ly: val });
                        }}
                        className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono"
                      />
                    </label>
                  )}
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer mt-0.5">
                  <input
                    type="checkbox"
                    checked={slot.closedEnds !== false}
                    onChange={(e) => updateSlot(selPart.id, slot.id, { closedEnds: e.target.checked })}
                    className="accent-blue-600 rounded"
                  />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300">Batentes Fechados</span>
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 italic text-[10px]">Nenhuma fenda nesta peça.</p>
        )}
      </div>

      {/* Detalhes do Eixo Selecionado & Gestão de Conexões */}
      {selPivot ? (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-3 bg-slate-50/70 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-100">Identificador:</span>
              <input
                type="text"
                value={selPivot.label || ''}
                placeholder={`Eixo ${selPart.pivots.indexOf(selPivot) + 1}`}
                onChange={(e) => {
                  const val = e.target.value;
                  updatePart(selPart.id, (p) => ({
                    ...p,
                    pivots: p.pivots.map((v) => (v.id === selPivot.id ? { ...v, label: val } : v)),
                  }));
                }}
                className="w-20 px-1.5 py-0.5 font-bold font-mono text-xs rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
              />
            </div>
            <button
              onClick={() => deletePivot(selPart.id, selPivot.id)}
              disabled={selPart.pivots.length <= 1 || (selPart.type === 'bar' && selPart.pivots.indexOf(selPivot) < 2)}
              className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30"
              title={selPart.type === 'bar' && selPart.pivots.indexOf(selPivot) < 2 ? "Extremidades da barra não podem ser excluídas" : "Excluir este Eixo"}
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
              <span className="text-[10px] text-slate-500">
                {selPart.type === 'bar' && selPart.pivots.indexOf(selPivot) < 2
                  ? 'Local Y (Centro)'
                  : 'Local Y (mm)'}
              </span>
              <input
                type="number"
                step="1"
                disabled={selPart.type === 'bar' && selPart.pivots.indexOf(selPivot) < 2}
                value={
                  selPart.type === 'bar' && selPart.pivots.indexOf(selPivot) < 2
                    ? 0
                    : Math.round(selPivot.ly * 10) / 10
                }
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updatePart(selPart.id, (p) => ({
                    ...p,
                    pivots: p.pivots.map((v) => (v.id === selPivot.id ? { ...v, ly: val } : v)),
                  }));
                }}
                className={`p-1 rounded font-mono ${
                  selPart.type === 'bar' && selPart.pivots.indexOf(selPivot) < 2
                    ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none'
                }`}
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
              <span>Motor Acionador (⚙)</span>
            </label>

            {selPivot.motor && (
              <div className="pl-5 flex flex-col gap-1.5 py-1 px-1.5 bg-amber-50/50 dark:bg-amber-950/20 rounded border border-amber-200/50 dark:border-amber-900/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">Velocidade RPM:</span>
                  <input
                    type="number"
                    min="5"
                    max="400"
                    step="5"
                    value={selPivot.motorRpm || simSpeed}
                    onChange={(e) => {
                      const val = Math.max(5, Number(e.target.value) || 60);
                      updatePart(selPart.id, (p) => ({
                        ...p,
                        pivots: p.pivots.map((v) => (v.id === selPivot.id ? { ...v, motorRpm: val } : v)),
                      }));
                    }}
                    className="w-16 p-1 text-center font-mono rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">Sentido:</span>
                  <button
                    onClick={() => {
                      const newDir = (selPivot.motorDir ?? 1) === 1 ? -1 : 1;
                      updatePart(selPart.id, (p) => ({
                        ...p,
                        pivots: p.pivots.map((v) => (v.id === selPivot.id ? { ...v, motorDir: newDir } : v)),
                      }));
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
                  >
                    {(selPivot.motorDir ?? 1) === 1 ? '↻ Horário' : '↺ Anti-horário'}
                  </button>
                </div>
              </div>
            )}

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
              <div className="pl-5 flex flex-col gap-1.5 py-1 px-1.5 bg-cyan-50/50 dark:bg-cyan-950/20 rounded border border-cyan-200/50 dark:border-cyan-900/50">
                <div className="flex items-center justify-between text-xs">
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
                    className="w-16 p-1 text-center rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500">Comprimento (mm):</span>
                  <input
                    type="number"
                    min="40"
                    max="600"
                    step="10"
                    value={selPivot.slider.length || 180}
                    onChange={(e) => {
                      const len = Math.max(40, parseFloat(e.target.value) || 180);
                      updatePart(selPart.id, (p) => ({
                        ...p,
                        pivots: p.pivots.map((v) =>
                          v.id === selPivot.id && v.slider
                            ? { ...v, slider: { ...v.slider, length: len } }
                            : v
                        ),
                      }));
                    }}
                    className="w-16 p-1 text-center rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                  />
                </div>
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

            {selPivot.trace && (
              <div className="pl-5 flex flex-col gap-1 py-1 px-1.5 bg-purple-50/50 dark:bg-purple-950/20 rounded border border-purple-200/50 dark:border-purple-900/50">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-purple-800 dark:text-purple-300 font-medium">Duração do Rastro:</span>
                  <span className="font-mono font-semibold text-purple-700 dark:text-purple-300">
                    {(selPivot.traceDuration ?? 3.0) === 0 ? 'Infinito' : `${(selPivot.traceDuration ?? 3.0).toFixed(1)}s`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={selPivot.traceDuration ?? 3.0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updatePart(selPart.id, (p) => ({
                        ...p,
                        pivots: p.pivots.map((v) =>
                          v.id === selPivot.id ? { ...v, traceDuration: val } : v
                        ),
                      }));
                    }}
                    className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Juntas Vinculadas com Detalhes Claros */}
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-semibold text-slate-500 block mb-1">
              Conexões do Eixo ({connectedJoints.length}):
            </span>
            {connectedJoints.length > 0 ? (
              <div className="flex flex-col gap-1 mb-2">
                {connectedJoints.map(({ joint: j, partnerInfo }) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between text-xs py-1 px-1.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
                  >
                    <span className="flex items-center gap-1 truncate mr-1" title={partnerInfo}>
                      <Link className="w-3 h-3 text-blue-500 shrink-0" />
                      <span className="truncate">{partnerInfo}</span>
                    </span>
                    <button
                      onClick={() => disconnectJoint(j.id)}
                      className="p-1 hover:text-rose-500 text-slate-400 shrink-0"
                      title="Desconectar esta junta"
                    >
                      <Unlink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic mb-2">Este eixo não está conectado a outro.</p>
            )}

            {/* Criar Conexão Direta via Seletor */}
            {otherTargets.length > 0 && (
              <div className="flex flex-col gap-1 bg-white dark:bg-slate-800/80 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Unir com outro elemento:
                </span>
                <div className="flex gap-1">
                  <select
                    value={selectedTargetPivotId}
                    onChange={(e) => setSelectedTargetPivotId(e.target.value)}
                    className="flex-1 text-[11px] p-1 bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded outline-none"
                  >
                    <option value="">Selecione eixo ou fenda...</option>
                    {otherTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (!selectedTargetPivotId) return;
                      const target = otherTargets.find((t) => t.id === selectedTargetPivotId);
                      if (!target) return;
                      if (target.type === 'pivot' && target.pivot && selPivot) {
                        connectJoint({ part: selPart, pivot: selPivot }, { part: target.part, pivot: target.pivot });
                      } else if (target.type === 'slot' && target.slot && selPivot) {
                        connectPinToSlot({ part: selPart, pivot: selPivot }, { part: target.part, slot: target.slot });
                      } else if (target.type === 'gear') {
                        connectGears(selPart, target.part);
                      } else if (target.type === 'belt') {
                        connectBelt(selPart.id, target.part.id);
                      } else if (target.type === 'weld') {
                        lockCoaxialGears(selPart.id, target.part.id);
                      }
                      setSelectedTargetPivotId('');
                    }}
                    disabled={!selectedTargetPivotId}
                    className="flex items-center gap-0.5 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded font-medium text-xs transition-colors"
                    title="Conectar"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Unir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-slate-400 italic text-[11px]">
          Clique em um eixo acima para editar identificador, motor ou conexões.
        </p>
      )}
      {/* Peças Ocultas */}
      {parts.some((p) => p.hidden) && (
        <div className="flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-100 text-[11px] uppercase tracking-wider">
              Peças Ocultas ({parts.filter((p) => p.hidden).length})
            </span>
            <button
              onClick={showAllParts}
              className="text-[10px] text-blue-600 hover:underline font-medium"
            >
              Exibir Todas
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {parts
              .filter((p) => p.hidden)
              .map((hp) => (
                <div
                  key={hp.id}
                  className="flex items-center justify-between py-1 px-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Peça {hp.letter || 'A'} ({hp.name})
                  </span>
                  <button
                    onClick={() => togglePartVisibility(hp.id)}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Exibir</span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </aside>
  );
};
