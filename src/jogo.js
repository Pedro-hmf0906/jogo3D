/**
 * Jogo: guarda o estado (nave, asteroides, vidas, fase, efeitos) e sabe se atualizar e se desenhar.
 *
 * Ideia: a nave fica parada em Z = 0 e o mundo vem na direção dela. Isso dá a impressão
 * de que a nave avança sozinha pelo eixo Z.
 *
 * A fase tem um comprimento (COMPRIMENTO_FASE). Conforme a nave "avança", a distância
 * percorrida cresce até a LINHA DE CHEGADA. O céu (sol e planetas) é fixo e muito distante,
 * e só cresce de leve com o progresso: é o que dá a noção de viagem.
 */
import {
  COMPRIMENTO_FASE, COR_FUNDO, DISTANCIA_SPAWN, DISTANCIA_VISAO, GATE_ALTURA, GATE_LARGURA,
  NEBLINA_FIM, NEBLINA_INICIO, QTD_ASTEROIDES, QTD_ESTRELAS, TEMPO_INVULNERAVEL,
  VELOCIDADE_AVANCO, VIDAS_INICIAIS, Z_DESPAWN,
  ALCANCE_TIRO, CARGAS_MAX, INTERVALO_TIRO, PONTOS_ASTEROIDE, TEMPO_RECARGA, VELOCIDADE_TIRO,
} from './config.js';
import { CameraTerceiraPessoa } from './camera.js';
import { TECLAS } from './input.js';
import { Nave, novoAsteroide } from './entidades.js';
import {
  distancia, escala, multiplicar, perspectiva, rotacaoX, rotacaoY, rotacaoZ, translacao,
} from './math3d.js';

const aleatorio = (min, max) => min + Math.random() * (max - min);
const unitario = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };

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
    this.reiniciar();
  }

  reiniciar() {
    this.nave = new Nave();
    this.asteroides = Array.from({ length: QTD_ASTEROIDES }, () => novoAsteroide());
    this.vidas = VIDAS_INICIAIS;
    this.colisoes = 0;
    this.pontos = 0;
    this.tiros = [];         // projéteis no ar
    this.recarga = 0;        // tempo até poder atirar de novo (intervalo dentro da rajada)
    this.carga = CARGAS_MAX; // bateria: cada tiro gasta 1; vai enchendo com o tempo
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
    this.pctMostrado = -1;
    this.atualizarHud();
    this.atualizarProgresso();
    this.atualizarCarga();
  }

  get progresso() { return Math.min(1, this.distancia / COMPRIMENTO_FASE); }
  get distRestante() { return COMPRIMENTO_FASE - this.distancia; }
  get terminou() { return this.fimDeJogo || this.vitoria; }

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
    this.recarga -= dt;
    this.carga = Math.min(CARGAS_MAX, this.carga + dt / TEMPO_RECARGA);   // a bateria enche sozinha
    if (!this.vitoria && t.tecla(...TECLAS.atirar) && this.recarga <= 0 && this.carga >= 1) this.atirar();

    // ---------- ATUALIZAÇÃO ----------
    this.distancia += VELOCIDADE_AVANCO * dt;
    for (const a of this.asteroides) {
      if (a.ativo === false) continue;
      a.pos[2] += VELOCIDADE_AVANCO * dt;
      a.angulo[0] += a.giro[0] * dt;
      a.angulo[1] += a.giro[1] * dt;
      if (a.pos[2] > Z_DESPAWN) this.reciclar(a);
    }

    this.atualizarTiros(dt);
    if (!this.vitoria) {
      this.verificarColisoes();
      if (this.distancia >= COMPRIMENTO_FASE) this.vencer();      // cruzou a linha de chegada
    } else {
      this.tempoVitoria += dt;
      this.proximoFogo -= dt;
      if (this.tempoVitoria < 4 && this.proximoFogo <= 0) {       // fogos de artifício
        this.proximoFogo = 0.3;
        const cor = CORES_FOGOS[Math.floor(Math.random() * CORES_FOGOS.length)];
        this.explodir([aleatorio(-9, 9), aleatorio(-4, 6), aleatorio(-30, -12)], 40, cor);
      }
    }
    this.atualizarEfeitos(dt);       // por último: o holofote segue a nave já movida
    this.atualizarProgresso();
    this.atualizarCarga();
  }

  /** Dispara um projétil: sai de um dos dois canhões (nas asas), alternando. */
  atirar() {
    this.canhao = -this.canhao;
    const [x, y, z] = this.nave.pos;
    this.tiros.push({ pos: [x + this.canhao * 0.8, y, z - 1.2], morto: false });
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
        this.pontos += PONTOS_ASTEROIDE;
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
      e.pos[2] += VELOCIDADE_AVANCO * dt;
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
      if (this.fimDeJogo) fim.innerHTML = `GAME OVER<small>Pontos: ${this.pontos}<br>pressione R ou Enter para jogar de novo</small>`;
    }
    if (vit) {
      vit.hidden = !this.vitoria;
      if (this.vitoria) {
        vit.innerHTML = `VITÓRIA!<small>Pontos: ${this.pontos} · Vidas restantes: ${this.vidas} · Batidas: ${this.colisoes}<br>pressione R ou Enter para jogar de novo</small>`;
      }
    }
  }

  /** Indicador da bateria: bolinhas = tiros prontos; barra = quanto falta para o próximo. */
  atualizarCarga() {
    const prontas = Math.floor(this.carga + 1e-9);
    const pct = this.carga >= CARGAS_MAX ? 100 : Math.floor((this.carga - prontas) * 100);
    const chave = `${prontas}:${pct}`;
    if (chave === this.cargaMostrada) return;          // só mexe na página se algo mudou
    this.cargaMostrada = chave;
    const caixa = document.getElementById('carga');
    const texto = document.getElementById('cargaTxt');
    const barra = document.getElementById('cargaCheia');
    if (texto) texto.textContent = '●'.repeat(prontas) + '○'.repeat(CARGAS_MAX - prontas);
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
    if (texto) texto.textContent = pct >= 100 ? 'CHEGADA!' : `Chegada: ${pct}%`;
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

    this.desenharCeu();

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
      if (a.ativo === false) continue;
      const t = a.tamanho * 2.0;     // os modelos de rocha são pequenos (~0.9)
      shader.setMat4('uModel', multiplicar(
        translacao(...a.pos), rotacaoY(a.angulo[1]), rotacaoX(a.angulo[0]), escala(t, t, t),
      ));
      this.malhasAsteroides[a.tipo].desenhar();
    }

    // a partir daqui os objetos emitem luz própria (não recebem iluminação)
    shader.setFloat('uSemLuz', 1);

    // linha de chegada: só existe no mundo quando está dentro do alcance de visão
    const zPortal = -this.distRestante;
    if (zPortal > DISTANCIA_SPAWN && zPortal < 10) this.desenharLinhaDeChegada(zPortal);

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

  /** Portal verde (dois pilares e uma viga) com uma faixa quadriculada: a linha de chegada. */
  desenharLinhaDeChegada(z) {
    const { shader, malhaCubo } = this;
    const cubo = (x, y, w, h, d, cor) => {
      shader.setVec3('uCor', cor);
      shader.setMat4('uModel', multiplicar(translacao(x, y, z), escala(w, h, d)));
      malhaCubo.desenhar();
    };
    const pulso = 0.75 + 0.25 * Math.sin(this.tempo * 5);          // brilho pulsando
    const verde = [0.15 * pulso, 1.0 * pulso, 0.45 * pulso];
    const m = GATE_LARGURA / 2;
    const h = GATE_ALTURA / 2;

    cubo(-m, 0, 1.2, GATE_ALTURA, 1.2, verde);                      // pilar esquerdo
    cubo(m, 0, 1.2, GATE_ALTURA, 1.2, verde);                       // pilar direito
    cubo(0, h, GATE_LARGURA + 1.2, 1.2, 1.2, verde);                // viga de cima

    // faixa quadriculada pendurada na viga: 2 linhas alternando branco e cinza-escuro
    for (let linha = 0; linha < 2; linha++) {
      for (let i = 0; i < GATE_LARGURA; i++) {
        const claro = (i + linha) % 2 === 0;
        cubo(-m + 0.5 + i, h - 1.1 - linha, 1, 1, 0.4, claro ? [1, 1, 1] : [0.12, 0.12, 0.16]);
      }
    }
  }
}
