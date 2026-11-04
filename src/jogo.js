/**
 * Jogo: guarda o estado (nave, asteroides, câmera) e sabe se atualizar e se desenhar.
 *
 * Ideia: a nave fica parada em Z = 0 e os asteroides vêm na direção dela.
 * Isso dá a impressão de que a nave avança sozinha pelo eixo Z.
 */
import {
  COR_FUNDO, DISTANCIA_SPAWN, QTD_ASTEROIDES, VELOCIDADE_AVANCO, Z_DESPAWN,
} from './config.js';
import { CameraTerceiraPessoa } from './camera.js';
import { TECLAS } from './input.js';
import { Nave, novoAsteroide } from './entidades.js';
import {
  escala, multiplicar, perspectiva, rotacaoX, rotacaoY, rotacaoZ, translacao,
} from './math3d.js';

export class Jogo {
  constructor(gl, { shader, malhaNave, malhasAsteroides }, teclado) {
    this.gl = gl;
    this.shader = shader;
    this.malhaNave = malhaNave;
    this.malhasAsteroides = malhasAsteroides;
    this.teclado = teclado;

    this.camera = new CameraTerceiraPessoa();
    this.nave = new Nave();
    this.asteroides = Array.from({ length: QTD_ASTEROIDES }, () => novoAsteroide());
  }

  /** dt = tempo desde o último quadro, em segundos. */
  atualizar(dt) {
    // ---------- ENTRADA ----------
    const t = this.teclado;
    const dx = Number(t.tecla(...TECLAS.direita)) - Number(t.tecla(...TECLAS.esquerda));
    const dy = Number(t.tecla(...TECLAS.cima)) - Number(t.tecla(...TECLAS.baixo));
    this.nave.atualizar(dx, dy, dt);

    // ---------- ATUALIZAÇÃO ----------
    for (const a of this.asteroides) {
      a.pos[2] += VELOCIDADE_AVANCO * dt;
      a.angulo[0] += a.giro[0] * dt;
      a.angulo[1] += a.giro[1] * dt;
      if (a.pos[2] > Z_DESPAWN) Object.assign(a, novoAsteroide(DISTANCIA_SPAWN));
    }
  }

  desenhar(largura, altura) {
    if (altura === 0) return;
    const { gl, shader } = this;

    gl.viewport(0, 0, largura, altura);
    gl.clearColor(...COR_FUNDO);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    shader.usar();
    shader.setMat4('uView', this.camera.matrizView(this.nave.pos));
    shader.setMat4('uProj', perspectiva(60.0, largura / altura, 0.1, 200.0));

    // nave: translação * inclinação * escala (a ordem importa!)
    // O modelo Kenney vem com a frente apontando para +Z; nosso jogo avança para -Z,
    // então giramos 180 graus em Y. Se a nave aparecer "de costas", remova a rotacaoY.
    const modeloNave = multiplicar(
      translacao(...this.nave.pos),
      rotacaoZ(this.nave.inclinacao),
      rotacaoY(Math.PI),
      escala(0.8, 0.8, 0.8),
    );
    shader.setMat4('uModel', modeloNave);
    shader.setVec3('uCor', [0.2, 0.6, 1.0]);
    this.malhaNave.desenhar();

    // asteroides: cada um com sua própria matriz model
    shader.setVec3('uCor', [0.7, 0.55, 0.4]);
    for (const a of this.asteroides) {
      const t = a.tamanho * 2.0;     // os modelos de rocha são pequenos (~0.9)
      const modelo = multiplicar(
        translacao(...a.pos),
        rotacaoY(a.angulo[1]),
        rotacaoX(a.angulo[0]),
        escala(t, t, t),
      );
      shader.setMat4('uModel', modelo);
      this.malhasAsteroides[a.tipo].desenhar();
    }
  }
}
