/**
 * Jogo: guarda o estado (nave, asteroides, vidas, efeitos) e sabe se atualizar e se desenhar.
 *
 * Ideia: a nave fica parada em Z = 0 e os asteroides vêm na direção dela.
 * Isso dá a impressão de que a nave avança sozinha pelo eixo Z.
 */
import {
  COR_FUNDO, DISTANCIA_SPAWN, QTD_ASTEROIDES, QTD_ESTRELAS, TEMPO_INVULNERAVEL,
  VELOCIDADE_AVANCO, VIDAS_INICIAIS, Z_DESPAWN,
} from './config.js';
import { CameraTerceiraPessoa } from './camera.js';
import { TECLAS } from './input.js';
import { Nave, novoAsteroide } from './entidades.js';
import {
  distancia, escala, multiplicar, perspectiva, rotacaoX, rotacaoY, rotacaoZ, translacao,
} from './math3d.js';

const aleatorio = (min, max) => min + Math.random() * (max - min);

/** Estrela do fundo: um cubinho que passa rápido, dando sensação de velocidade. */
function novaEstrela(z = aleatorio(-120, 10)) {
  let x = aleatorio(-40, 40);
  const y = aleatorio(-25, 25);
  // mantém a área de jogo livre, para estrela não parecer asteroide
  if (Math.abs(x) < 8 && Math.abs(y) < 5) x = (x < 0 ? -1 : 1) * aleatorio(8, 38);
  return { pos: [x, y, z] };
}

export class Jogo {
  constructor(gl, { shader, malhaNave, malhasAsteroides, malhaCubo, malhaEsfera, texPlaneta }, teclado) {
    this.gl = gl;
    this.shader = shader;
    this.malhaNave = malhaNave;
    this.malhasAsteroides = malhasAsteroides;
    this.malhaCubo = malhaCubo;          // usado para partículas e estrelas
    this.malhaEsfera = malhaEsfera;      // o planeta
    this.texPlaneta = texPlaneta;
    this.planeta = { pos: [-34, 17, -135], raio: 24, angulo: 0 };
    this.teclado = teclado;
    this.camera = new CameraTerceiraPessoa();
    // três luzes, todas atualizadas em atualizarEfeitos()
    this.tempo = 0;
    this.luzes = {
      holofote: { pos: [0, 0, 0], dir: [0, 0, -1], cor: [0.75, 0.9, 1.0] },  // preso à nave
      sol: { dir: [0, 1, 0], cor: [0.6, 0.34, 0.16] },                       // distante e lento
      explosao: { pos: [0, 0, 0], forca: 0 },                                // acende nas batidas
    };
    this.estrelas = Array.from({ length: QTD_ESTRELAS }, () => novaEstrela());
    this.reiniciar();
  }

  reiniciar() {
    this.nave = new Nave();
    this.asteroides = Array.from({ length: QTD_ASTEROIDES }, () => novoAsteroide());
    this.vidas = VIDAS_INICIAIS;
    this.colisoes = 0;
    this.invulneravel = 0;   // tempo restante de invulnerabilidade
    this.tremor = 0;         // 0..1, balanço da câmera
    this.flash = 0;          // 0..1, fundo avermelhado
    this.particulas = [];
    this.fimDeJogo = false;
    this.atualizarHud();
  }

  /** dt = tempo desde o último quadro, em segundos. */
  atualizar(dt) {
    if (this.fimDeJogo) {            // game over: só os efeitos continuam
      this.atualizarEfeitos(dt);
      return;
    }

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
    this.verificarColisoes();
    this.atualizarEfeitos(dt);       // por último: o holofote segue a nave já movida
  }

  /**
   * Colisão esfera-esfera: bateu se a distância entre os centros for menor
   * que a soma dos raios. Durante a invulnerabilidade o asteroide atravessa a nave.
   */
  verificarColisoes() {
    if (this.invulneravel > 0) return;
    for (const a of this.asteroides) {
      if (distancia(this.nave.pos, a.pos) >= this.nave.raio + a.raio) continue;

      this.vidas -= 1;
      this.colisoes += 1;
      this.invulneravel = TEMPO_INVULNERAVEL;
      this.tremor = 1;
      this.flash = 1;
      this.explodir(a.pos, 22);                 // o asteroide se desfaz
      Object.assign(a, novoAsteroide(DISTANCIA_SPAWN));

      if (this.vidas <= 0) {
        this.fimDeJogo = true;
        this.explodir(this.nave.pos, 60);       // a nave também explode
      }
      this.atualizarHud();
      return;                                   // uma batida por vez
    }
  }

  // ---------- EFEITOS ----------

  /** Cria uma explosão: partículas (cubinhos) saindo em todas as direções. */
  explodir(centro, quantidade) {
    // a explosão também acende uma luz laranja no ponto onde aconteceu
    this.luzes.explosao.pos = [...centro];
    this.luzes.explosao.forca = quantidade >= 60 ? 1.6 : 1;
    for (let i = 0; i < quantidade; i++) {
      // direção aleatória: sorteia um vetor e normaliza
      let d;
      do { d = [aleatorio(-1, 1), aleatorio(-1, 1), aleatorio(-1, 1)]; }
      while (d[0] ** 2 + d[1] ** 2 + d[2] ** 2 > 1 || d[0] ** 2 + d[1] ** 2 + d[2] ** 2 < 0.01);
      const v = aleatorio(3, 9) / Math.hypot(...d);
      const vida = aleatorio(0.5, 1.1);
      this.particulas.push({
        pos: [...centro], vel: [d[0] * v, d[1] * v, d[2] * v],
        vida, vidaMax: vida, tamanho: aleatorio(0.1, 0.28),
      });
    }
  }

  atualizarEfeitos(dt) {
    this.tempo += dt;
    this.planeta.angulo += 0.06 * dt;    // o planeta gira devagar
    const { holofote, sol, explosao } = this.luzes;

    // HOLOFOTE: fica na frente da nave, acompanha seu X/Y e vira junto com a inclinação
    const [nx, ny, nz] = this.nave.pos;
    holofote.pos = [nx, ny + 0.3, nz - 0.8];
    const giro = -this.nave.inclinacao * 0.5;
    const tam = Math.hypot(giro, 1);
    holofote.dir = [giro / tam, 0, -1 / tam];

    // SOL: gira devagar em volta do cenário (um ciclo a cada ~21 s):
    // quando passa por trás ilumina o que a câmera vê; pela frente deixa tudo em contraluz
    const ang = this.tempo * 0.3;
    const v = [Math.cos(ang) * 0.7, 0.9, Math.sin(ang) * 0.7];
    const n = Math.hypot(...v);
    sol.dir = v.map((c) => c / n);

    // EXPLOSÃO: a luz apaga em ~0,5 s
    explosao.forca = Math.max(0, explosao.forca - 2.2 * dt);

    this.invulneravel = Math.max(0, this.invulneravel - dt);
    this.tremor = Math.max(0, this.tremor - 2.5 * dt);
    this.flash = Math.max(0, this.flash - 3 * dt);

    for (const p of this.particulas) {
      p.vida -= dt;
      const freio = Math.max(0, 1 - 1.5 * dt);          // vai perdendo velocidade
      p.vel = p.vel.map((c) => c * freio);
      p.pos = p.pos.map((c, i) => c + p.vel[i] * dt);
    }
    this.particulas = this.particulas.filter((p) => p.vida > 0);

    for (const e of this.estrelas) {
      e.pos[2] += VELOCIDADE_AVANCO * dt;
      if (e.pos[2] > 10) Object.assign(e, novaEstrela(-120));
    }
  }

  atualizarHud() {
    const hud = document.getElementById('hud');
    const fim = document.getElementById('fim');
    if (hud) hud.textContent = `Vidas: ${'♥'.repeat(Math.max(0, this.vidas))}   ·   Batidas: ${this.colisoes}`;
    if (fim) fim.hidden = !this.fimDeJogo;
  }

  // ---------- DESENHO ----------

  desenhar(largura, altura) {
    if (altura === 0) return;
    const { gl, shader } = this;

    // o fundo fica avermelhado por um instante quando a nave leva dano
    const f = this.flash * 0.6;
    const fundo = [
      COR_FUNDO[0] + (0.55 - COR_FUNDO[0]) * f,
      COR_FUNDO[1] + (0.05 - COR_FUNDO[1]) * f,
      COR_FUNDO[2] + (0.05 - COR_FUNDO[2]) * f,
      1.0,
    ];
    gl.viewport(0, 0, largura, altura);
    gl.clearColor(...fundo);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // tremor: desloca o ponto que a câmera segue por um valor aleatório
    const [px, py, pz] = this.nave.pos;
    const alvoCamera = [
      px + (Math.random() - 0.5) * this.tremor * 1.2,
      py + (Math.random() - 0.5) * this.tremor * 1.2,
      pz,
    ];

    shader.usar();
    shader.setMat4('uView', this.camera.matrizView(alvoCamera));
    shader.setVec3('uCamPos', this.camera.olho);
    const { holofote, sol, explosao } = this.luzes;
    shader.setVec3('uHoloPos', holofote.pos);
    shader.setVec3('uHoloDir', holofote.dir);
    shader.setVec3('uHoloCor', holofote.cor);
    shader.setFloat('uHoloCosInt', Math.cos((14 * Math.PI) / 180));   // luz plena até 14°
    shader.setFloat('uHoloCosExt', Math.cos((30 * Math.PI) / 180));   // apaga em 30°
    shader.setVec3('uSolDir', sol.dir);
    shader.setVec3('uSolCor', sol.cor);
    const forcaExpl = explosao.forca * 2.5;
    shader.setVec3('uExplPos', explosao.pos);
    shader.setVec3('uExplCor', [1.0 * forcaExpl, 0.55 * forcaExpl, 0.2 * forcaExpl]);
    shader.setFloat('uSemLuz', 0);
    shader.setFloat('uAmbiente', 0.2);
    shader.setFloat('uUsaTextura', 0);
    shader.setInt('uTextura', 0);        // a textura fica na unidade 0
    shader.setMat4('uProj', perspectiva(60.0, largura / altura, 0.1, 200.0));

    // planeta com TEXTURA: a cor de cada pixel vem da imagem gerada em textura.js
    const pl = this.planeta;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texPlaneta);
    shader.setFloat('uUsaTextura', 1);
    shader.setFloat('uAmbiente', 0.4);   // planeta enorme e distante: fica legível mesmo à noite
    shader.setFloat('uBrilho', 25);
    shader.setFloat('uKs', 0.15);
    shader.setMat4('uModel', multiplicar(
      translacao(...pl.pos), rotacaoZ(0.35), rotacaoY(pl.angulo), escala(pl.raio, pl.raio, pl.raio),
    ));
    this.malhaEsfera.desenhar();
    shader.setFloat('uUsaTextura', 0);   // o resto usa cor sólida
    shader.setFloat('uAmbiente', 0.2);

    // nave: pisca durante a invulnerabilidade e some no game over
    const piscaOculta = this.invulneravel > 0 && Math.floor(this.invulneravel * 10) % 2 === 0;
    if (!this.fimDeJogo && !piscaOculta) {
      // O modelo Kenney vem com a frente apontando para +Z; nosso jogo avança para -Z,
      // então giramos 180 graus em Y. Se a nave aparecer "de costas", remova a rotacaoY.
      shader.setMat4('uModel', multiplicar(
        translacao(...this.nave.pos),
        rotacaoZ(this.nave.inclinacao),
        rotacaoY(Math.PI),
        escala(0.8, 0.8, 0.8),
      ));
      shader.setVec3('uCor', [0.2, 0.6, 1.0]);
      shader.setFloat('uBrilho', 80);   // nave: brilho forte e concentrado (metálica)
      shader.setFloat('uKs', 1.0);
      this.malhaNave.desenhar();
    }

    // asteroides: cada um com sua própria matriz model
    shader.setVec3('uCor', [0.7, 0.55, 0.4]);
    shader.setFloat('uBrilho', 10);     // rochas: brilho fraco e espalhado
    shader.setFloat('uKs', 0.25);
    for (const a of this.asteroides) {
      const t = a.tamanho * 2.0;     // os modelos de rocha são pequenos (~0.9)
      shader.setMat4('uModel', multiplicar(
        translacao(...a.pos), rotacaoY(a.angulo[1]), rotacaoX(a.angulo[0]), escala(t, t, t),
      ));
      this.malhasAsteroides[a.tipo].desenhar();
    }

    // a partir daqui os objetos emitem luz própria (não recebem iluminação)
    shader.setFloat('uSemLuz', 1);

    // estrelas
    shader.setVec3('uCor', [0.9, 0.92, 1.0]);
    for (const e of this.estrelas) {
      shader.setMat4('uModel', multiplicar(translacao(...e.pos), escala(0.12, 0.12, 0.12)));
      this.malhaCubo.desenhar();
    }

    // partículas: encolhem e passam de amarelo para vermelho enquanto morrem
    for (const p of this.particulas) {
      const k = p.vida / p.vidaMax;                      // 1 (nova) -> 0 (morrendo)
      const s = p.tamanho * (0.3 + 0.7 * k);
      shader.setVec3('uCor', [1.0, 0.25 + 0.65 * k, 0.1]);
      shader.setMat4('uModel', multiplicar(translacao(...p.pos), escala(s, s, s)));
      this.malhaCubo.desenhar();
    }
  }
}
