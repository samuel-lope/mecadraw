import React from 'react';
import { MechanismStore } from '../state/useMechanismStore';
import { ToolType } from '../types/mechanism';
import {
  MousePointer,
  Minus,
  Square,
  Circle,
  Triangle,
  PlusCircle,
  RectangleHorizontal,
  Link2,
  Trash2,
  Anchor,
  Cog,
  MoveHorizontal,
  PenTool,
} from 'lucide-react';

interface ToolPaletteProps {
  store: MechanismStore;
}

interface ToolDef {
  id: ToolType;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
  group?: string;
}

const TOOLS: ToolDef[] = [
  { id: 'sel', label: 'Selecionar', icon: <MousePointer className="w-4 h-4" />, shortcut: 'V' },
  { id: 'bar', label: 'Barra', icon: <Minus className="w-4 h-4" />, shortcut: 'B' },
  { id: 'rect', label: 'Retângulo', icon: <Square className="w-4 h-4" />, shortcut: 'R' },
  { id: 'circle', label: 'Círculo', icon: <Circle className="w-4 h-4" />, shortcut: 'C' },
  { id: 'tri', label: 'Triângulo', icon: <Triangle className="w-4 h-4" />, shortcut: 'T' },
  { id: 'axis', label: '+ Eixo', icon: <PlusCircle className="w-4 h-4" />, shortcut: 'A' },
  { id: 'slot', label: '+ Fenda', icon: <RectangleHorizontal className="w-4 h-4" />, shortcut: 'F' },
  { id: 'joint', label: 'Junta', icon: <Link2 className="w-4 h-4" />, shortcut: 'J' },
  { id: 'ground', label: 'Fixar', icon: <Anchor className="w-4 h-4" />, shortcut: 'G' },
  { id: 'motor', label: 'Motor', icon: <Cog className="w-4 h-4" />, shortcut: 'M' },
  { id: 'slider', label: 'Slider', icon: <MoveHorizontal className="w-4 h-4" />, shortcut: 'S' },
  { id: 'trace', label: 'Traçar', icon: <PenTool className="w-4 h-4" />, shortcut: 'P' },
  { id: 'del', label: 'Excluir', icon: <Trash2 className="w-4 h-4" />, shortcut: 'X' },
];

export const ToolPalette: React.FC<ToolPaletteProps> = ({ store }) => {
  const { tool, setTool } = store;

  return (
    <aside className="w-16 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-2 gap-1 select-none z-10 shrink-0">
      {TOOLS.map((t, idx) => {
        const isCurrent = tool === t.id;

        return (
          <React.Fragment key={t.id}>
            {idx === 7 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-800 my-1" />}
            <button
              onClick={() => setTool(t.id)}
              className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-xs relative ${
                isCurrent
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={`${t.label} (Tecla ${t.shortcut})`}
            >
              {t.icon}
              <span className="text-[10px] leading-tight">{t.label}</span>
              <span
                className={`absolute top-0.5 right-1 text-[9px] font-mono opacity-50 ${
                  isCurrent ? 'text-white' : 'text-slate-400'
                }`}
              >
                {t.shortcut}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </aside>
  );
};
