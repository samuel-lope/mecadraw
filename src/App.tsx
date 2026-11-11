import React, { useEffect } from 'react';
import { useMechanismStore } from './state/useMechanismStore';
import { TopBar } from './components/TopBar';
import { ToolPalette } from './components/ToolPalette';
import { CadCanvas } from './components/CadCanvas';
import { InspectorPanel } from './components/InspectorPanel';
import { TelemetryDrawer } from './components/TelemetryDrawer';
import { ToolType } from './types/mechanism';

export const App: React.FC = () => {
  const store = useMechanismStore();
  const {
    setTool,
    simRunning,
    startSimulation,
    pauseSimulation,
    undo,
    redo,
    selection,
    deletePart,
    deletePivot,
    duplicateSelected,
  } = store;

  // Atalhos de teclado globais
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se o usuário estiver digitando em um input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Espaço = Iniciar / Pausar Simulação
      if (e.code === 'Space') {
        e.preventDefault();
        if (simRunning) pauseSimulation();
        else startSimulation();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Duplicar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Excluir
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.pivotId && selection.partId) {
          deletePivot(selection.partId, selection.pivotId);
        } else if (selection.partId) {
          deletePart(selection.partId);
        }
        return;
      }

      const k = e.key.toLowerCase();

      // Ocultar peça selecionada (H)
      if (k === 'h' && selection.partId) {
        e.preventDefault();
        store.togglePartVisibility(selection.partId);
        return;
      }

      // Mapeamento de ferramentas
      const keyMap: Record<string, ToolType> = {
        v: 'sel',
        b: 'bar',
        l: 'bar',
        r: 'rect',
        c: 'circle',
        t: 'tri',
        e: 'gear',
        d: 'belt',
        a: 'axis',
        f: 'slot',
        j: 'joint',
        g: 'ground',
        m: 'motor',
        s: 'slider',
        p: 'trace',
        x: 'del',
      };

      if (keyMap[k]) {
        setTool(keyMap[k]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    simRunning,
    startSimulation,
    pauseSimulation,
    undo,
    redo,
    selection,
    deletePart,
    deletePivot,
    duplicateSelected,
    setTool,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100">
      <TopBar store={store} />
      <div className="flex flex-1 min-h-0 min-w-0 relative">
        <ToolPalette store={store} />
        <div className="flex-1 relative flex min-w-0 min-h-0">
          <CadCanvas store={store} />
          <TelemetryDrawer store={store} />
        </div>
        <InspectorPanel store={store} />
      </div>
    </div>
  );
};
