/**
 * Jogo: guarda o estado (nave, asteroides, vidas, fase, efeitos) e sabe se atualizar e se desenhar.
 *
 * Ideia: a nave fica parada em Z = 0 e o mundo vem na direção dela. Isso dá a impressão
 * de que a nave avança sozinha pelo eixo Z.
 *
 * A fase tem um comprimento (cfg.comprimento, definido pela dificuldade). Conforme a nave "avança", a distância
 * percorrida cresce até a NAVE-MÃE (a chegada). O céu (sol e planetas) é fixo e muito distante,
 * e só cresce de leve com o progresso: é o que dá a noção de viagem.
 */
import {
  COR_FUNDO, DISTANCIA_SPAWN, DISTANCIA_VISAO, NAVE_MAE,
  NEBLINA_FIM, NEBLINA_INICIO, QTD_ESTRELAS, TEMPO_INVULNERAVEL,
  VELOCIDADE_AVANCO, Z_DESPAWN,
  ALCANCE_TIRO, DIFICULDADES, INTERVALO_TIRO, PONTOS_ASTEROIDE, VELOCIDADE_TIRO,
} from './config.js';
import { CameraTerceiraPessoa } from './camera.js';
import { TECLAS } from './input.js';
import { Nave, novoAsteroide } from './entidades.js';
import {
  distancia, escala, multiplicar, perspectiva, rotacaoX, rotacaoY, rotacaoZ, translacao,
} from './math3d.js';

const aleatorio = (min, max) => min + Math.random() * (max - min);
const unitario = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };


/**
 * Converte um deslocamento relativo à nave em
 * uma posição do mundo, considerando sua inclinação.
 *
 * Os deslocamentos já estão nas unidades do jogo,
 * após a escala 0.8 e a rotação de 180° em Y.
 */
function pontoNaNave(nave, dx, dy, dz) {
  const c = Math.cos(nave.inclinacao);
  const s = Math.sin(nave.inclinacao);

  return [
    nave.pos[0] + dx * c - dy * s,
    nave.pos[1] + dx * s + dy * c,
    nave.pos[2] + dz,
  ];
}


// ---------- O CÉU ----------
// Tudo isto é fixo no mundo e MUITO longe. Com o progresso da fase, cada corpo se aproxima
// "aproxima" unidades (pouco), então cresce quase imperceptivelmente.
const SOL = { pos: [170, 70, -640], raio: 55, aproxima: 60 };
const PLANETAS = [
  // tipo = índice da textura (0 terra, 1 deserto, 2 gasoso, 3 gelo)
  { tipo: 0, pos: [-35, 14, -700], raio: 55, aproxima: 300, inclinacao: 0.3, giro: 0.02 },   // DESTINO
  { tipo: 1, pos: [-190, -45, -580], raio: 26, aproxima: 70, inclinacao: -0.4, giro: 0.05 },
  { tipo: 2, pos: [95, -55, -600], raio: 36, aproxima: 80, inclinacao: 0.15, giro: 0.04 },
  { tipo: 3, pos: [-175, 85, -650], raio: 22, aproxima: 60, inclinacao: 0.5, giro: 0.06 },
];
const CORES_FOGOS = [[0.3, 1, 0.5], [0.3, 0.9, 1], [1, 0.9, 0.3], [1, 0.4, 0.9], [1, 1, 1]];

/** Estrela do fundo: um cubinho que passa rápido, dando sensação de velocidade. */
function novaEstrela(z = aleatorio(DISTANCIA_SPAWN, 10)) {
  // a estrela só anda em Z, então seu X/Y não muda: de longe elas parecem
  // agrupadas no centro e vão se abrindo conforme chegam (efeito de túnel de velocidade)
  let x = aleatorio(-55, 55);
  const y = aleatorio(-35, 35);
  // mantém a área de jogo livre, para estrela não parecer asteroide
  if (Math.abs(x) < 8 && Math.abs(y) < 5) x = (x < 0 ? -1 : 1) * aleatorio(8, 38);
  return { pos: [x, y, z] };
}

export class Jogo {
  constructor(gl, { shader, malhaNave, malhasAsteroides, malhaCubo, malhaEsfera, texPlanetas, texSol }, teclado) {
    this.gl = gl;
    this.shader = shader;
    this.malhaNave = malhaNave;
    this.malhasAsteroides = malhasAsteroides;
    this.malhaCubo = malhaCubo;          // partículas, estrelas e linha de chegada
    this.malhaEsfera = malhaEsfera;      // sol e planetas
    this.texPlanetas = texPlanetas;      // uma textura por tipo de planeta
    this.texSol = texSol;
    this.teclado = teclado;
    this.camera = new CameraTerceiraPessoa();
    this.tempo = 0;
    // três luzes, todas atualizadas em atualizarEfeitos()
    this.luzes = {
      holofote: { pos: [0, 0, 0], dir: [0, 0, -1], cor: [0.75, 0.9, 1.0] },   // preso à nave
      // luz do Sol sobre a nave e as rochas: vem do lado do Sol (direita/cima) e um pouco
      // de trás da câmera, para que o que a câmera vê não fique todo em contraluz
      sol: { dir: unitario([0.55, 0.65, 0.35]), cor: [0.6, 0.34, 0.16] },
      explosao: { pos: [0, 0, 0], forca: 0 },                                 // acende nas batidas
    };
    this.estrelas = Array.from({ length: QTD_ESTRELAS }, () => novaEstrela());
    // o jogo abre no MENU, com a cena rodando ao fundo (modo demonstração)
    this.modo = 'menu';                       // 'menu' ou 'jogando'
    this.dificuldade = 'normal';
    this.cfg = DIFICULDADES.normal;
    this.reiniciar();
    this.aplicarModoNaPagina();
  }

  definirDificuldade(chave) {
    this.dificuldade = chave;
    this.cfg = DIFICULDADES[chave];
  }

  /** Começa uma partida na dificuldade escolhida. */
  iniciar(chave = this.dificuldade) {
    this.definirDificuldade(chave);
    this.modo = 'jogando';
    this.reiniciar();
    this.aplicarModoNaPagina();
  }

  irParaMenu() {
    this.modo = 'menu';
    this.reiniciar();
    this.aplicarModoNaPagina();
  }

  /** No menu, esconde o HUD (a página ganha a classe 'menu'). */
  aplicarModoNaPagina() {
    if (document.body) document.body.className = this.modo === 'menu' ? 'menu' : '';
  }

  reiniciar() {
    this.nave = new Nave();
    this.asteroides = Array.from({ length: this.cfg.asteroides }, () => novoAsteroide());
    this.vidas = this.cfg.vidas;
    this.colisoes = 0;
    this.pontos = 0;
    this.tiros = [];         // projéteis no ar
    this.recarga = 0;        // tempo até poder atirar de novo (intervalo dentro da rajada)
    this.carga = this.cfg.cargasMax; // bateria: cada tiro gasta 1; vai enchendo com o tempo
    this.cargaMostrada = null;
    this.canhao = 1;         // alterna entre o canhão da esquerda e o da direita
    this.distancia = 0;      // quanto a nave já percorreu na fase
    this.vitoria = false;
    this.tempoVitoria = 0;
    this.proximoFogo = 0;
    this.invulneravel = 0;   // tempo restante de invulnerabilidade
    this.tremor = 0;         // 0..1, balanço da câmera
    this.flash = 0;          // 0..1, fundo avermelhado
    this.particulas = [];
    this.fimDeJogo = false;
    this.chamaAcc = 0;       // acumulador de partículas da chama dos motores
    this.pctMostrado = -1;
    this.atualizarHud();
    this.atualizarProgresso();
    this.atualizarCarga();
    this.anunciar(this.modo === 'menu' ? 'menu' : 'jogo');
  }

  /** Avisa quem estiver ouvindo (a música) que o estado do jogo mudou: 'menu', 'jogo', 'vitoria' ou 'derrota'. */
  anunciar(estado) {
    if (this.aoMudarEstado) this.aoMudarEstado(estado);
  }

  /** Velocidade do mundo (unid./s): a base vezes o ritmo da dificuldade. */
  get velocidade() { return VELOCIDADE_AVANCO * this.cfg.velocidade * this.freio; }
  /** 1 = voo normal. Depois da vitória cai a 0 em NAVE_MAE.frenagem segundos: a nave "pousa" no hangar. */
  get freio() { return this.vitoria ? Math.max(0, 1 - this.tempoVitoria / NAVE_MAE.frenagem) : 1; }
  get progresso() { return Math.min(1, this.distancia / this.cfg.comprimento); }
  get distRestante() { return this.cfg.comprimento - this.distancia; }
  get terminou() { return this.fimDeJogo || this.vitoria; }

  /** dt = tempo desde o último quadro, em segundos. */
  atualizar(dt) {
    if (this.modo === 'menu') {      // modo demonstração: só o cenário se move
      this.atualizarDemo(dt);
      return;
    }
    if (this.fimDeJogo) {            // game over: só os efeitos continuam
      this.atualizarEfeitos(dt);
      return;
    }

    // ---------- ENTRADA ----------
    const t = this.teclado;
    const dx = Number(t.tecla(...TECLAS.direita)) - Number(t.tecla(...TECLAS.esquerda));
    const dy = Number(t.tecla(...TECLAS.cima)) - Number(t.tecla(...TECLAS.baixo));
    this.nave.atualizar(dx, dy, dt);
    this.emitirChama(dt);
    this.recarga -= dt;
    this.carga = Math.min(this.cfg.cargasMax, this.carga + dt / this.cfg.tempoRecarga);   // a bateria enche sozinha
    if (!this.vitoria && t.tecla(...TECLAS.atirar) && this.recarga <= 0 && this.carga >= 1) this.atirar();

    // ---------- ATUALIZAÇÃO ----------
    this.distancia += this.velocidade * dt;
    for (const a of this.asteroides) {
      if (a.ativo === false) continue;
      a.pos[2] += this.velocidade * dt;
      a.angulo[0] += a.giro[0] * dt;
      a.angulo[1] += a.giro[1] * dt;
      if (a.pos[2] > Z_DESPAWN) this.reciclar(a);
    }

    this.atualizarTiros(dt);
    if (!this.vitoria) {
      this.verificarColisoes();
      if (this.distancia >= this.cfg.comprimento) this.vencer();      // cruzou a linha de chegada
    } else {
      this.tempoVitoria += dt;
      this.proximoFogo -= dt;
      if (this.tempoVitoria < 4 && this.proximoFogo <= 0) {       // fogos de artifício
        this.proximoFogo = 0.3;
        const cor = CORES_FOGOS[Math.floor(Math.random() * CORES_FOGOS.length)];
        this.explodir([aleatorio(-9, 9), aleatorio(-3, 4), aleatorio(-30, -12)], 40, cor);
      }
    }
    this.atualizarEfeitos(dt);       // por último: o holofote segue a nave já movida
    this.atualizarProgresso();
    this.atualizarCarga();
  }

  /** Menu: o cenário continua passando ao fundo, mas sem controle, colisão, tiros nem progresso. */
  atualizarDemo(dt) {
    for (const a of this.asteroides) {
      if (a.ativo === false) continue;
      a.pos[2] += this.velocidade * dt;
      a.angulo[0] += a.giro[0] * dt;
      a.angulo[1] += a.giro[1] * dt;
      if (a.pos[2] > Z_DESPAWN) this.reciclar(a);
    }
    this.atualizarEfeitos(dt);
  }

  
  /**
   * Chamas dos quatro motores da X-wing.
   * Cada motor emite partículas que se afastam em +Z.
   */
  emitirChama(dt) {
    // Quatro motores, mantendo uma quantidade moderada
    // de partículas para preservar o desempenho.
    this.chamaAcc += dt * 55 * (0.35 + 0.65 * this.freio);

    const motores = [
      [-0.33,  0.20], // superior esquerdo
      [ 0.33,  0.20], // superior direito
      [-0.33, -0.20], // inferior esquerdo
      [ 0.33, -0.20], // inferior direito
    ];

    while (this.chamaAcc >= 1 && this.particulas.length < 700) {
      this.chamaAcc -= 1;

      for (const [mx, my] of motores) {
        const origem = pontoNaNave(
          this.nave,
          mx,
          my,
          1.10,
        );

        const vida = aleatorio(0.25, 0.45);

        this.particulas.push({
          pos: [
            origem[0] + aleatorio(-0.025, 0.025),
            origem[1] + aleatorio(-0.025, 0.025),
            origem[2],
          ],

          vel: [
            aleatorio(-0.4, 0.4),
            aleatorio(-0.4, 0.4),
            aleatorio(5, 9),
          ],

          vida,
          vidaMax: vida,
          tamanho: aleatorio(0.08, 0.14),
          cor: null,
        });
      }
    }

    if (this.chamaAcc > 5) {
      this.chamaAcc = 0;
    }
  }


  
  /** Dispara alternadamente dos dois canhões superiores. */
  atirar() {
    this.canhao = -this.canhao;

    // Posição alinhada à ponta do canhão superior.
    // O centro do feixe fica à frente da ponta
    // porque seu cubo possui comprimento 1.4.
    const pos = pontoNaNave(
      this.nave,
      this.canhao * 1.06,
      0.38,
      -1.30,
    );

    this.tiros.push({
      pos,
      morto: false,
    });

    this.recarga = INTERVALO_TIRO;
    this.carga -= 1;
  }


  /**
   * Move os projéteis e testa se acertaram algum asteroide (esfera contra esfera, como na
   * colisão da nave). Como o tiro é rápido, testamos 3 pontos do trajeto do quadro
   * (início, meio e fim) para ele não "atravessar" um asteroide entre dois quadros.
   */
  atualizarTiros(dt) {
    for (const b of this.tiros) {
      const z0 = b.pos[2];
      b.pos[2] -= VELOCIDADE_TIRO * dt;
      for (const a of this.asteroides) {
        if (a.ativo === false) continue;
        const acertou = [0, 0.5, 1].some((f) => distancia([b.pos[0], b.pos[1], z0 + (b.pos[2] - z0) * f], a.pos) < a.raio + 0.35);
        if (!acertou) continue;
        this.pontos += PONTOS_ASTEROIDE * this.cfg.mult;      // a dificuldade multiplica os pontos
        this.tremor = Math.max(this.tremor, 0.15);
        this.explodir(a.pos, 16, [1.0, 0.75, 0.3]);       // asteroide destruído
        this.reciclar(a);
        b.morto = true;
        this.atualizarHud();
        break;
      }
    }
    this.tiros = this.tiros.filter((b) => !b.morto && b.pos[2] > this.nave.pos[2] - ALCANCE_TIRO);
  }

  /**
   * Manda o asteroide de volta para o fundo, MAS só se ele ainda chegaria à nave
   * antes da linha de chegada (com 80 unidades de folga). Perto do fim os asteroides
   * deixam de nascer: a reta final fica livre e o portal aparece limpo.
   */
  reciclar(a) {
    if (this.distRestante > -DISTANCIA_SPAWN + 80) {
      Object.assign(a, novoAsteroide(DISTANCIA_SPAWN), { ativo: true });
    } else {
      a.ativo = false;
    }
  }

  vencer() {
    this.anunciar('vitoria');
    this.vitoria = true;
    this.tempoVitoria = 0;
    this.proximoFogo = 0;
    this.atualizarHud();
  }

  /**
   * Colisão esfera-esfera: bateu se a distância entre os centros for menor
   * que a soma dos raios. Durante a invulnerabilidade o asteroide atravessa a nave.
   */
  verificarColisoes() {
    if (this.invulneravel > 0 || this.vitoria || this.fimDeJogo) return;   // sem dano depois de a fase acabar
    for (const a of this.asteroides) {
      if (a.ativo === false) continue;
      if (distancia(this.nave.pos, a.pos) >= this.nave.raio + a.raio) continue;

      this.vidas -= 1;
      this.colisoes += 1;
      this.invulneravel = TEMPO_INVULNERAVEL;
      this.tremor = 1;
      this.flash = 1;
      this.explodir(a.pos, 22);                 // o asteroide se desfaz
      this.reciclar(a);

      if (this.vidas <= 0) {
        this.fimDeJogo = true;
        this.anunciar('derrota');
        this.explodir(this.nave.pos, 60);       // a nave também explode
      }
      this.atualizarHud();
      return;                                   // uma batida por vez
    }
  }

  // ---------- EFEITOS ----------

  /**
   * Cria uma explosão: partículas (cubinhos) saindo em todas as direções.
   * Sem `cor`, é uma explosão de fogo (e acende a luz laranja); com `cor`, é um fogo de artifício.
   */
  explodir(centro, quantidade, cor = null) {
    if (!cor) {
      this.luzes.explosao.pos = [...centro];
      this.luzes.explosao.forca = quantidade >= 60 ? 1.6 : 1;
    }
    for (let i = 0; i < quantidade; i++) {
      // direção aleatória: sorteia um vetor e normaliza
      let d;
      do { d = [aleatorio(-1, 1), aleatorio(-1, 1), aleatorio(-1, 1)]; }
      while (d[0] ** 2 + d[1] ** 2 + d[2] ** 2 > 1 || d[0] ** 2 + d[1] ** 2 + d[2] ** 2 < 0.01);
      const v = aleatorio(3, 9) / Math.hypot(...d);
      const vida = aleatorio(0.5, 1.1);
      this.particulas.push({
        pos: [...centro], vel: [d[0] * v, d[1] * v, d[2] * v],
        vida, vidaMax: vida, tamanho: aleatorio(0.1, 0.28), cor,
      });
    }
  }

  atualizarEfeitos(dt) {
    this.tempo += dt;
    const { holofote, explosao } = this.luzes;

    // HOLOFOTE: fica na frente da nave, acompanha seu X/Y e vira junto com a inclinação
    const [nx, ny, nz] = this.nave.pos;
    holofote.pos = [nx, ny + 0.3, nz - 0.8];
    const giro = -this.nave.inclinacao * 0.5;
    const tam = Math.hypot(giro, 1);
    holofote.dir = [giro / tam, 0, -1 / tam];

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
      e.pos[2] += this.velocidade * dt;
      if (e.pos[2] > 10) Object.assign(e, novaEstrela(DISTANCIA_SPAWN));
    }
  }

  atualizarHud() {
    const hud = document.getElementById('hud');
    const fim = document.getElementById('fim');
    const vit = document.getElementById('vitoria');
    if (hud) hud.textContent = `Vidas: ${'♥'.repeat(Math.max(0, this.vidas))}   ·   Pontos: ${this.pontos}   ·   Batidas: ${this.colisoes}`;
    if (fim) {
      fim.hidden = !this.fimDeJogo;
      if (this.fimDeJogo) fim.innerHTML = `GAME OVER<small>Pontos: ${this.pontos}<br>pressione R ou Enter para jogar de novo · M para o menu</small>`;
    }
    if (vit) {
      vit.hidden = !this.vitoria;
      if (this.vitoria) {
        vit.innerHTML = `VITÓRIA!<small>Pouso concluído na nave-mãe Aurora<br>Pontos: ${this.pontos} · Vidas restantes: ${this.vidas} · Batidas: ${this.colisoes} · ${this.cfg.nome}<br>pressione R ou Enter para jogar de novo · M para o menu</small>`;
      }
    }
  }

  /** Indicador da bateria: bolinhas = tiros prontos; barra = quanto falta para o próximo. */
  atualizarCarga() {
    const prontas = Math.floor(this.carga + 1e-9);
    const max = this.cfg.cargasMax;
    const pct = this.carga >= max ? 100 : Math.floor((this.carga - prontas) * 100);
    const chave = `${prontas}:${pct}`;
    if (chave === this.cargaMostrada) return;          // só mexe na página se algo mudou
    this.cargaMostrada = chave;
    const caixa = document.getElementById('carga');
    const texto = document.getElementById('cargaTxt');
    const barra = document.getElementById('cargaCheia');
    if (texto) texto.textContent = '●'.repeat(prontas) + '○'.repeat(max - prontas);
    if (barra) barra.style.width = `${pct}%`;
    if (caixa) caixa.className = prontas >= 1 ? 'pronta' : 'recarregando';
  }

  /** Barra de progresso até a linha de chegada (só mexe na página quando a porcentagem muda). */
  atualizarProgresso() {
    const pct = Math.floor(this.progresso * 100);
    if (pct === this.pctMostrado) return;
    this.pctMostrado = pct;
    const texto = document.getElementById('pct');
    const barra = document.getElementById('barraCheia');
    if (texto) texto.textContent = pct >= 100 ? 'POUSO!' : `Nave-mãe: ${pct}%`;
    if (barra) barra.style.width = `${pct}%`;
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
    shader.setMat4('uProj', perspectiva(60.0, largura / altura, 0.1, DISTANCIA_VISAO));
    shader.setVec3('uCamPos', this.camera.olho);
    shader.setVec3('uFundo', fundo.slice(0, 3));
    shader.setFloat('uNeblinaIni', NEBLINA_INICIO);
    shader.setFloat('uNeblinaFim', NEBLINA_FIM);
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
    shader.setFloat('uUsaNeblina', 1);
    shader.setInt('uTextura', 0);        // a textura fica na unidade 0
    shader.setFloat('uUsaCorVertice', 0);
    shader.setFloat('uEmissaoMotor', 0);

    this.desenharCeu();

    // nave: pisca durante a invulnerabilidade, some no game over e não aparece no menu
    const piscaOculta = this.invulneravel > 0 && Math.floor(this.invulneravel * 10) % 2 === 0;
    if (!this.fimDeJogo && !piscaOculta && this.modo !== 'menu') {
      // O modelo Kenney vem com a frente apontando para +Z; nosso jogo avança para -Z,
      // então giramos 180 graus em Y. Se a nave aparecer "de costas", remova a rotacaoY.
      shader.setMat4('uModel', multiplicar(
        translacao(...this.nave.pos),
        rotacaoZ(this.nave.inclinacao),
        rotacaoY(Math.PI),
        escala(0.8, 0.8, 0.8),
      ));
      // a nave usa as cores do .mtl (laranja, cinza e branco); uCor = branco deixa as cores como estão
      shader.setVec3('uCor', [1, 1, 1]);
      shader.setFloat('uUsaCorVertice', 1);
      shader.setFloat('uAmbiente', 0.32);   // a câmera vê a nave por trás: um pouco mais de luz de fundo
      
      shader.setFloat('uBrilho', 60);
      shader.setFloat('uKs', 0.8);

      // Brilho pulsante dos motores.
      // Diminui durante a frenagem após a vitória.
      const pulsoMotor =
        (0.75 + 0.25 * Math.sin(this.tempo * 8)) *
        this.freio;

      shader.setFloat('uEmissaoMotor', pulsoMotor);

      this.malhaNave.desenhar();

      // Desativa a emissão para os outros objetos.
      shader.setFloat('uEmissaoMotor', 0);

      shader.setFloat('uUsaCorVertice', 0);
      shader.setFloat('uAmbiente', 0.2);
    }

    
    // Asteroides: cada um com sua própria matriz Model.
    // Somente o modelo com cristais utiliza as cores do MTL.
    shader.setFloat('uBrilho', 10);
    shader.setFloat('uKs', 0.25);

    let tipoAnterior = -1;

    for (const a of this.asteroides) {
      if (a.ativo === false) continue;

      // Evita reenviar as configurações quando o tipo
      // do asteroide é igual ao do desenho anterior.
      if (a.tipo !== tipoAnterior) {
        const possuiCristais = a.tipo === 2;

        if (possuiCristais) {
          // Usa as cores armazenadas nos vértices
          // pelo leitor OBJ/MTL, sem alterar suas cores.
          shader.setFloat('uUsaCorVertice', 1);
          shader.setVec3('uCor', [1, 1, 1]);
        } else {
          // Mantém a cor sólida dos outros asteroides.
          shader.setFloat('uUsaCorVertice', 0);
          shader.setVec3('uCor', [0.7, 0.55, 0.4]);
        }

        tipoAnterior = a.tipo;
      }

      const t = a.tamanho * 2.0;

      shader.setMat4('uModel', multiplicar(
        translacao(...a.pos),
        rotacaoY(a.angulo[1]),
        rotacaoX(a.angulo[0]),
        escala(t, t, t),
      ));

      this.malhasAsteroides[a.tipo].desenhar();
    }

    // Restaura a cor sólida para a nave-mãe
    // e os demais objetos desenhados posteriormente.
    shader.setFloat('uUsaCorVertice', 0);


    // nave-mãe (a chegada): o casco recebe iluminação (sol e holofote); as luzes emitem a sua própria.
    // Ela some na neblina de longe e só começa a ser desenhada quando está a menos de 450 unidades.
    const zNaveMae = -this.distRestante;
    const naveMaeNoAlcance = zNaveMae > -450;
    if (naveMaeNoAlcance) {
      shader.setFloat('uBrilho', 30);
      shader.setFloat('uKs', 0.35);
      for (const [xa, xb, ya, yb, za, zb, cor] of this.caixasNaveMae(zNaveMae)) this.desenharCaixa(xa, xb, ya, yb, za, zb, cor);
    }

    // a partir daqui os objetos emitem luz própria (não recebem iluminação)
    shader.setFloat('uSemLuz', 1);
    if (naveMaeNoAlcance) this.desenharLuzesNaveMae(zNaveMae);

    // tiros: feixes compridos e finos, que emitem luz própria
    shader.setVec3('uCor', [0.4, 1.0, 0.85]);
    for (const b of this.tiros) {
      shader.setMat4('uModel', multiplicar(translacao(...b.pos), escala(0.14, 0.14, 1.4)));
      this.malhaCubo.desenhar();
    }

    // estrelas
    shader.setVec3('uCor', [0.9, 0.92, 1.0]);
    for (const e of this.estrelas) {
      // o cubinho cresce com a distância, para a estrela continuar visível (>= 2 pixels) lá longe
      const t = 0.12 + 0.004 * Math.max(0, -e.pos[2]);
      shader.setMat4('uModel', multiplicar(translacao(...e.pos), escala(t, t, t)));
      this.malhaCubo.desenhar();
    }

    // partículas: encolhem e escurecem enquanto morrem (fogo: amarelo -> vermelho)
    for (const p of this.particulas) {
      const k = p.vida / p.vidaMax;                      // 1 (nova) -> 0 (morrendo)
      const s = p.tamanho * (0.3 + 0.7 * k);
      const cor = p.cor ? p.cor.map((c) => c * (0.35 + 0.65 * k)) : [1.0, 0.25 + 0.65 * k, 0.1];
      shader.setVec3('uCor', cor);
      shader.setMat4('uModel', multiplicar(translacao(...p.pos), escala(s, s, s)));
      this.malhaCubo.desenhar();
    }
  }

  /**
   * O céu: um Sol visível ao lado e planetas com textura, todos fixos e muito distantes.
   * Crescem quase nada com o progresso. Não entram na neblina e cada planeta é iluminado
   * pela direção REAL do Sol (por isso aparecem com um lado claro e outro escuro).
   */
  desenharCeu() {
    const { gl, shader } = this;
    const p = this.progresso;
    shader.setFloat('uUsaNeblina', 0);
    gl.activeTexture(gl.TEXTURE0);

    // Sol: emite luz própria, com textura de granulação, girando bem devagar
    const posSol = [SOL.pos[0], SOL.pos[1], SOL.pos[2] + SOL.aproxima * p];
    gl.bindTexture(gl.TEXTURE_2D, this.texSol);
    shader.setFloat('uSemLuz', 1);
    shader.setFloat('uUsaTextura', 1);
    shader.setVec3('uCor', [1.15, 1.15, 1.15]);
    shader.setMat4('uModel', multiplicar(
      translacao(...posSol), rotacaoY(this.tempo * 0.01), escala(SOL.raio, SOL.raio, SOL.raio),
    ));
    this.malhaEsfera.desenhar();

    // planetas: textura + Phong, com a luz vindo do Sol
    shader.setFloat('uSemLuz', 0);
    shader.setFloat('uAmbiente', 0.35);
    shader.setFloat('uBrilho', 25);
    shader.setFloat('uKs', 0.15);
    shader.setVec3('uSolCor', [1.0, 0.92, 0.8]);
    for (const pl of PLANETAS) {
      const pos = [pl.pos[0], pl.pos[1], pl.pos[2] + pl.aproxima * p];
      shader.setVec3('uSolDir', unitario(posSol.map((c, i) => c - pos[i])));
      gl.bindTexture(gl.TEXTURE_2D, this.texPlanetas[pl.tipo]);
      shader.setMat4('uModel', multiplicar(
        translacao(...pos), rotacaoZ(pl.inclinacao), rotacaoY(this.tempo * pl.giro),
        escala(pl.raio, pl.raio, pl.raio),
      ));
      this.malhaEsfera.desenhar();
    }

    // volta ao normal para os objetos do jogo
    shader.setFloat('uUsaTextura', 0);
    shader.setFloat('uAmbiente', 0.2);
    shader.setFloat('uUsaNeblina', 1);
    shader.setVec3('uSolDir', this.luzes.sol.dir);
    shader.setVec3('uSolCor', this.luzes.sol.cor);
  }

  /** Desenha um paralelepípedo (um cubo esticado) entre os cantos (xa,ya,za) e (xb,yb,zb). */
  desenharCaixa(xa, xb, ya, yb, za, zb, cor) {
    this.shader.setVec3('uCor', cor);
    this.shader.setMat4('uModel', multiplicar(
      translacao((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2), escala(xb - xa, yb - ya, zb - za),
    ));
    this.malhaCubo.desenhar();
  }

  /**
   * As caixas do casco da NAVE-MÃE, em coordenadas do mundo. z0 = onde fica a face da frente
   * (a boca do hangar); o hangar se estende para -Z. Cada item: [xa, xb, ya, yb, za, zb, cor].
   * Quatro blocos formam um tubo em volta da abertura, então as faces internas do túnel
   * já têm as normais certas para o Phong iluminar o hangar por dentro.
   */
  caixasNaveMae(z0) {
    const { largura, altura, tunel, hangarLargura, hangarAltura } = NAVE_MAE;
    const hx = largura / 2, hy = altura / 2, ox = hangarLargura / 2, oy = hangarAltura / 2;
    const zf = z0, zb = z0 - tunel;
    const casco = [0.55, 0.60, 0.70], interno = [0.20, 0.22, 0.30];
    const placaA = [0.68, 0.72, 0.82], placaB = [0.45, 0.50, 0.60];
    const e = 0.3;       // espessura do revestimento interno
    const c = [
      // tubo do hangar: esquerda, direita, cima e baixo da abertura
      [-hx, -ox, -hy, hy, zb, zf, casco], [ox, hx, -hy, hy, zb, zf, casco],
      [-ox, ox, oy, hy, zb, zf, casco], [-ox, ox, -hy, -oy, zb, zf, casco],
      // revestimento escuro por dentro do túnel
      [-ox, -ox + e, -oy, oy, zb, zf, interno], [ox - e, ox, -oy, oy, zb, zf, interno],
      [-ox, ox, oy - e, oy, zb, zf, interno], [-ox, ox, -oy, -oy + e, zb, zf, interno],
      // parede do fundo do hangar
      [-hx, hx, -hy, hy, zb - 4, zb, interno],
      // torre de comando com duas antenas, aparecendo acima da face da frente
      [-10, 10, hy, hy + 14, z0 - 44, z0 - 12, casco],
      [-7.5, -6, hy + 14, hy + 30, z0 - 30, z0 - 28.5, placaB], [6, 7.5, hy + 14, hy + 30, z0 - 30, z0 - 28.5, placaB],
      // aletas laterais
      [hx, hx + 22, -3, 3, z0 - 64, z0 - 8, placaB], [-hx - 22, -hx, -3, 3, z0 - 64, z0 - 8, placaB],
    ];
    // placas em relevo na frente: dão textura de "chapas" ao casco
    for (const lado of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        const ya = -hy + 2 + r * 15;
        const xs = lado < 0 ? [-hx + 2, -ox - 2] : [ox + 2, hx - 2];
        c.push([xs[0], xs[1], ya, ya + 13, zf, zf + 0.5, (r + (lado > 0 ? 1 : 0)) % 2 ? placaA : placaB]);
      }
    }
    return c;
  }

  /** As luzes da nave-mãe (emitem luz própria): moldura, faróis, janelas e as luzes guia do hangar. */
  desenharLuzesNaveMae(z0) {
    const { largura, altura, tunel, hangarLargura, hangarAltura } = NAVE_MAE;
    const hy = altura / 2, ox = hangarLargura / 2, oy = hangarAltura / 2;
    const zb = z0 - tunel;
    const luz = (x, y, z, w, h, d, cor) => this.desenharCaixa(x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2, cor);
    const pulso = 0.7 + 0.3 * Math.sin(this.tempo * 4);
    const pisca = Math.floor(this.tempo * 2) % 2;

    // moldura laranja em volta da boca do hangar
    const laranja = [1.0 * pulso, 0.55 * pulso, 0.1 * pulso];
    luz(0, oy + 0.5, z0 + 0.6, hangarLargura + 2, 1, 0.5, laranja);
    luz(0, -oy - 0.5, z0 + 0.6, hangarLargura + 2, 1, 0.5, laranja);
    luz(-ox - 0.5, 0, z0 + 0.6, 1, hangarAltura, 0.5, laranja);
    luz(ox + 0.5, 0, z0 + 0.6, 1, hangarAltura, 0.5, laranja);

    // faróis nos quatro cantos, piscando em pares alternados
    [[-1, 1], [1, -1], [-1, -1], [1, 1]].forEach(([sx, sy], i) => {
      const ligado = (i < 2 ? pisca : 1 - pisca) === 1;
      luz(sx * (ox + 2), sy * (oy + 2), z0 + 0.8, 1.4, 1.4, 1.0, ligado ? [1, 0.2, 0.2] : [0.25, 0.05, 0.05]);
    });

    // janelas nas chapas da frente (algumas apagadas)
    for (const lado of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 6; k++) {
          const apagada = (r * 6 + k + (lado > 0 ? 3 : 0)) % 4 === 0;
          luz(lado * (ox + 4 + k * 3.8), -hy + 8.5 + r * 15, z0 + 0.7, 2.2, 1.2, 0.3, apagada ? [0.25, 0.22, 0.12] : [1.0, 0.88, 0.5]);
        }
      }
    }

    // luzes guia no chão do hangar: "correm" na direção do fundo, mostrando por onde entrar
    for (let k = 0; k < Math.floor((tunel - 3) / 4); k++) {
      const b = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.tempo * 6 - k * 0.7));
      for (const lado of [-1, 1]) luz(lado * (ox - 0.8), -oy + 0.45, z0 - 3 - k * 4, 0.5, 0.3, 1.4, [0.2 * b, 1.0 * b, 0.75 * b]);
    }
    // luzes de teto
    for (let k = 0; k < Math.floor((tunel - 8) / 9) + 1; k++) luz(0, oy - 0.45, z0 - 8 - k * 9, 3.5, 0.25, 1.1, [0.75, 0.82, 1.0]);
    // painel brilhante na parede do fundo e a plataforma de pouso no chão, onde a nave para
    // (ela freia 22 a 32 unidades depois da boca, conforme a dificuldade)
    luz(0, 0, zb + 0.15, 14, 7, 0.3, [0.25 * pulso, 0.7 * pulso, 1.0 * pulso]);
    luz(0, -oy + 0.35, z0 - 27, 12, 0.1, 12, [0.1 * pulso, 0.4 * pulso, 0.9 * pulso]);
    // pontas das antenas, piscando
    for (const sx of [-1, 1]) luz(sx * 6.5, hy + 30.5, z0 - 29.5, 1.2, 1.2, 1.2, pisca ? [1, 0.2, 0.2] : [0.3, 0.05, 0.05]);
  }
}
