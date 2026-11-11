/**
 * Teclado: guarda quais teclas estão pressionadas agora.
 * Usa event.code (posição física da tecla), então WASD funciona em qualquer layout.
 */
export const TECLAS = {
  esquerda: ['KeyA', 'ArrowLeft'],
  direita: ['KeyD', 'ArrowRight'],
  cima: ['KeyW', 'ArrowUp'],
  baixo: ['KeyS', 'ArrowDown'],
  atirar: ['Space'],
};

const TECLAS_DO_JOGO = new Set(Object.values(TECLAS).flat());

export class Teclado {
  constructor(alvo = window) {
    this.pressionadas = new Set();
    alvo.addEventListener('keydown', (e) => {
      if (TECLAS_DO_JOGO.has(e.code)) e.preventDefault();   // setas não rolam a página
      this.pressionadas.add(e.code);
    });
    alvo.addEventListener('keyup', (e) => this.pressionadas.delete(e.code));
    // se a aba perder o foco, solta tudo (senão a nave "trava" andando)
    alvo.addEventListener('blur', () => this.pressionadas.clear());
  }

  /** true se QUALQUER uma das teclas estiver pressionada. */
  tecla(...codigos) {
    return codigos.some((c) => this.pressionadas.has(c));
  }
}
