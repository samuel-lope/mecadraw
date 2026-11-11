import React, { useEffect } from 'react';
import { Part, Joint, MechanismAnalysis } from '../types/mechanism';
import {
  X,
  Sliders,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Link as LinkIcon,
  Cog,
  Zap,
  Info,
} from 'lucide-react';

interface DofDetailsModalProps {
  analysis: MechanismAnalysis;
  parts: Part[];
  joints: Joint[];
  onClose: () => void;
}

export const DofDetailsModal: React.FC<DofDetailsModalProps> = ({
  analysis,
  parts,
  joints: _joints,
  onClose,
}) => {
  // Fechar ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { dof, links, joints1, joints2, grashof, details } = analysis;
  const motorCount = details?.motorCount ?? (parts.some((p) => p.pivots.some((v) => v.motor)) ? 1 : 0);

  // Status visual
  const isKinematicOk = dof === 1;
  const isMultiDof = dof > 1;
  const isStatic = dof === 0;
  const isOverconstrained = dof < 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg ${
                isKinematicOk
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : isMultiDof
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              }`}
            >
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Análise de Mobilidade & Graus de Liberdade
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Critério de Gruebler-Kutzbach para Mecanismos Planares
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Banner de Diagnóstico do Mecanismo */}
          <div
            className={`flex items-start gap-3 p-3.5 rounded-lg border ${
              isKinematicOk
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                : isMultiDof
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="mt-0.5">
              {isKinematicOk ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle
                  className={`w-4 h-4 ${
                    isMultiDof
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>DOF = {dof}</span>
                <span className="text-xs font-normal opacity-90">
                  {isKinematicOk && '• Cinemático Determinado (1 Atuador)'}
                  {isMultiDof && `• Sub-restringido (${dof} Movimentos Livres)`}
                  {isStatic && '• Estrutura Estática Rígida (Sem Movimento)'}
                  {isOverconstrained && '• Estrutura Hiperestática (Super-restringida)'}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                {isKinematicOk &&
                  'O mecanismo possui mobilidade unitária (M = 1). Com exatamente 1 motor, todas as posições, velocidades e acelerações são unívocas e previsíveis.'}
                {isMultiDof &&
                  `O sistema possui ${dof} graus de liberdade independentes. Para que todos os elos tenham movimento controlado, seriam necessários ${dof} motores atuando em conjunto, ou fixar eixos adicionais ao terra.`}
                {isStatic &&
                  'O sistema possui mobilidade nula (M = 0). As juntas travam completamente os elos formando uma treliça estática.'}
                {isOverconstrained &&
                  'O sistema possui restrições redundantes (M < 0). Podem ocorrer conflitos geométricos ou tensões internas estáticas.'}
              </p>
            </div>
          </div>

          {/* Equação de Gruebler-Kutzbach */}
          <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 font-mono">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-sans font-semibold">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                Fórmula de Gruebler-Kutzbach para Mecanismos Planos
              </span>
              <span>2D Planar</span>
            </div>

            {/* Fórmula literal */}
            <div className="text-center text-sm md:text-base font-bold text-slate-700 dark:text-slate-200 py-1 border-b border-slate-200 dark:border-slate-700">
              M = 3 · (L − 1) − 2 · J₁ − J₂
            </div>

            {/* Substituição numérica detalhada */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs md:text-sm">
              <span className="font-bold text-blue-600 dark:text-blue-400">M</span>
              <span>=</span>
              <span className="bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                3 · ({links} − 1)
              </span>
              <span>−</span>
              <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                2 · ({joints1})
              </span>
              <span>−</span>
              <span className="bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                {joints2}
              </span>
              <span>=</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-white ${
                  isKinematicOk ? 'bg-emerald-600' : isMultiDof ? 'bg-amber-600' : 'bg-rose-600'
                }`}
              >
                {dof}
              </span>
            </div>
          </div>

          {/* Cards de Decomposição dos Termos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* L: Elos */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                <Layers className="w-3.5 h-3.5" />
                <span>Elos (L = {links})</span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <li className="flex justify-between">
                  <span>Elos Móveis:</span>
                  <span className="font-mono font-bold">{details?.movingLinksCount ?? parts.length}</span>
                </li>
                <li className="flex justify-between">
                  <span>Elo Terra (Solo):</span>
                  <span className="font-mono font-bold">{details?.hasGround ? '1' : '0'}</span>
                </li>
                {Boolean(details?.weldCount) && (
                  <li className="flex justify-between text-slate-500">
                    <span>Soldas (Coaxiais):</span>
                    <span className="font-mono">{details?.weldCount}</span>
                  </li>
                )}
              </ul>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                Cada elo livre possui 3 DOF planares (x, y, θ).
              </p>
            </div>

            {/* J1: Pares Inferiores */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Juntas J₁ ({joints1})</span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <li className="flex justify-between">
                  <span>Pinos Revolutos:</span>
                  <span className="font-mono font-bold">{details?.revoluteCount ?? 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Apoios ao Terra:</span>
                  <span className="font-mono font-bold">{details?.groundPivotsCount ?? 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Guias (Sliders):</span>
                  <span className="font-mono font-bold">{details?.slidersCount ?? 0}</span>
                </li>
              </ul>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                Pares cinemáticos que removem 2 DOF e permitem 1.
              </p>
            </div>

            {/* J2: Pares Superiores */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
                <Cog className="w-3.5 h-3.5" />
                <span>Pares J₂ ({joints2})</span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <li className="flex justify-between">
                  <span>Engrenamentos:</span>
                  <span className="font-mono font-bold">{details?.gearMeshesCount ?? 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Correias Dentadas:</span>
                  <span className="font-mono font-bold">{details?.beltsCount ?? 0}</span>
                </li>
                <li className="flex justify-between">
                  <span>Pino em Fenda:</span>
                  <span className="font-mono font-bold">{details?.pinInSlotsCount ?? 0}</span>
                </li>
              </ul>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                Pares superiores com contato linear / deslizante (permitem 2 DOF).
              </p>
            </div>
          </div>

          {/* Comparativo de Atuadores vs DOF */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Atuadores (Motores Ativos)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {motorCount === dof
                    ? 'Total de motores coincide perfeitamente com os graus de liberdade necessários.'
                    : motorCount < dof
                    ? `Faltam ${dof - motorCount} motor(es) ou restrições ao terra para controle total.`
                    : 'Há mais motores configurados do que graus de liberdade disponíveis.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold">
                {motorCount} {motorCount === 1 ? 'Motor' : 'Motores'}
              </span>
              <span>/</span>
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                {dof} DOF
              </span>
            </div>
          </div>

          {/* Dica / Recomendações Contextuais */}
          {isMultiDof && (
            <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex gap-2.5 text-[11px] text-blue-800 dark:text-blue-300">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="space-y-1">
                <p className="font-semibold">Como tornar o mecanismo cinemático (DOF = 1)?</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300">
                  <li>
                    Se houver engrenagens soltas no plano (sem suporte), fixe o centro ao solo usando a
                    ferramenta <strong>Fixar/Terra (G)</strong> ou adicione uma manivela que una os eixos.
                  </li>
                  <li>
                    Conecte barras livres através de <strong>Juntas Revolutas (J)</strong> aos elos principais.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Análise de Grashof se for Mecanismo de 4 Barras */}
          {grashof?.isFourBar && (
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-500" />
                  Critério de Grashof (Quadrilátero Articulado)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {grashof.condition}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Soma Menor + Maior (s + l):</span>
                  <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                    {grashof.sPlusL.toFixed(1)} mm
                  </div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Soma Intermediários (p + q):</span>
                  <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                    {grashof.pPlusQ.toFixed(1)} mm
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {grashof.sPlusL < grashof.pPlusQ
                  ? '✓ Mecanismo de Grashof (s + l < p + q): ao menos um elo consegue rotação completa contínua de 360°.'
                  : '⚠ Mecanismo Não-Grashof (s + l > p + q): nenhum elo consegue rotação de 360° (todos operam como balancins oscilantes).'}
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Pressione Esc para fechar</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
