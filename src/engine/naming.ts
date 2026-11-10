import { Part } from '../types/mechanism';

/**
 * Retorna a menor letra alfabética disponível (A, B, C, ... Z, AA, AB...)
 */
export const getAvailableLetters = (count: number): string[] => {
  const letters: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i < 26) {
      letters.push(String.fromCharCode(65 + i));
    } else {
      const first = String.fromCharCode(65 + Math.floor(i / 26) - 1);
      const second = String.fromCharCode(65 + (i % 26));
      letters.push(`${first}${second}`);
    }
  }
  return letters;
};

/**
 * Reindexa e sincroniza estritamente as letras das peças e rótulos dos eixos:
 * - Peça 1: Letra A -> Eixos A1, A2, A3...
 * - Peça 2: Letra B -> Eixos B1, B2...
 * Ao excluir a peça B, a peça C passa a ser B (ou preenche a menor letra livre).
 */
export const syncPartsAndPivots = (parts: Part[]): Part[] => {
  const letters = getAvailableLetters(parts.length);

  return parts.map((part, pIdx) => {
    const letter = letters[pIdx];
    const pivots = part.pivots.map((pv, pvIdx) => ({
      ...pv,
      label: `${letter}${pvIdx + 1}`,
    }));

    return {
      ...part,
      letter,
      pivots,
    };
  });
};
