/**
 * Câmera em terceira pessoa: fica atrás e acima da nave, olhando para frente.
 *
 * A nave avança para -Z (para dentro da tela). A câmera segue o X e o Y da nave,
 * mas só em parte (fator 0.6), o que dá uma sensação de movimento mais suave,
 * como em jogos de nave clássicos.
 */
import { lookAt } from './math3d.js';

export class CameraTerceiraPessoa {
  constructor({ deslocamento = [0, 2, 7], distanciaOlhar = 15, seguir = 0.6 } = {}) {
    this.deslocamento = deslocamento;
    this.distanciaOlhar = distanciaOlhar;
    this.seguir = seguir;
    this.olho = [0, 0, 0];
  }

  matrizView(posicaoAlvo) {
    const base = [
      posicaoAlvo[0] * this.seguir,
      posicaoAlvo[1] * this.seguir,
      posicaoAlvo[2],
    ];
    // onde a câmera está
    this.olho = [
      base[0] + this.deslocamento[0],
      base[1] + this.deslocamento[1],
      base[2] + this.deslocamento[2],
    ];
    // para onde ela olha
    const pontoOlhado = [base[0], base[1], base[2] - this.distanciaOlhar];
    return lookAt(this.olho, pontoOlhado, [0, 1, 0]);
  }
}
