/** Objetos do jogo: a nave do jogador e os asteroides. */
import {
  DISTANCIA_SPAWN, LIMITE_X, LIMITE_Y, VELOCIDADE_NAVE,
} from './config.js';

const aleatorio = (min, max) => min + Math.random() * (max - min);
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** A nave fica parada em Z = 0; só se move em X e Y. */
export class Nave {
  constructor() {
    this.pos = [0, 0, 0];
    this.inclinacao = 0;
    this.raio = 0.8;
  }

  atualizar(dx, dy, dt) {
    this.pos[0] = limitar(this.pos[0] + dx * VELOCIDADE_NAVE * dt, -LIMITE_X, LIMITE_X);
    this.pos[1] = limitar(this.pos[1] + dy * VELOCIDADE_NAVE * dt, -LIMITE_Y, LIMITE_Y);
    // a nave inclina ao virar, suavizando até o valor alvo
    const alvo = -dx * 0.5;
    this.inclinacao += (alvo - this.inclinacao) * Math.min(1, 8 * dt);
  }
}

/** Cria um asteroide com posição, modelo, tamanho e giro aleatórios. */
export function novoAsteroide(z = null) {
  const tam = aleatorio(0.6, 1.5); // Guardamos o tamanho numa variável primeiro
  return {
    pos: [aleatorio(-7, 7), aleatorio(-4, 4), z === null ? aleatorio(DISTANCIA_SPAWN, -10) : z],
    tipo: Math.floor(Math.random() * 3),
    tamanho: tam, 
    raio: tam * 0.9, // Adicionado: o raio de colisão baseia-se no tamanho visual do asteroide
    giro: [aleatorio(-2, 2), aleatorio(-2, 2)],
    angulo: [0, 0],
  };
}
