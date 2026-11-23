/**
 * Música de fundo gerada por código (Web Audio, que já vem no navegador).
 * Não há arquivos de áudio: tudo é calculado em tempo real. Não toca nenhum efeito
 * sonoro (no espaço não há som de tiro): só uma trilha ambiente.
 *
 * Camadas:
 *   - PAD:  acordes longos e suaves (Lá menor, Fá, Dó, Sol), de ondas "serra" com filtro
 *   - SINOS: um arpejo com as notas do acorde, bem mais presente durante o jogo
 *   - REVERB: eco de "sala grande", gerado a partir de ruído que vai sumindo
 *
 * O navegador só deixa tocar áudio depois de um clique ou tecla do jogador,
 * por isso a música começa no primeiro gesto (veja main.js).
 */

/** Número de nota MIDI -> frequência em Hz (A4 = 69 = 440 Hz). */
export const midiParaHz = (n) => 440 * 2 ** ((n - 69) / 12);

// Notas MIDI de cada acorde: Am, F, C, G (do grave para o agudo)
export const PROGRESSAO = [
  [45, 48, 52, 57],
  [41, 45, 48, 53],
  [48, 52, 55, 60],
  [43, 47, 50, 55],
];
const PADRAO_ARPEJO = [0, 2, 1, 3, 2, 1, 3, 2];   // quais notas do acorde, em ordem
const VOLUME = 0.22;                               // volume geral (baixo, para não incomodar)
const ANTECEDENCIA = 1.2;                          // agenda notas com 1,2 s de folga (aguenta aba em 2º plano)

function lerMudo() {
  try { return localStorage.getItem('musicaMudo') === '1'; } catch { return false; }
}

export class Musica {
  constructor(Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext) {
    this.Contexto = Contexto;
    this.ctx = null;
    this.bpm = 66;
    this.estado = 'menu';
    this.intensidade = 0.3;       // 0..1: quanto o arpejo aparece
    this.mudo = lerMudo();
    this.passo = 0;               // contador de colcheias
    this.proxima = 0;             // instante (s) da próxima colcheia
    this.timer = null;
  }

  /** Começa a tocar. Chamar a partir de um gesto do jogador (tecla ou clique). */
  iniciar() {
    if (!this.Contexto) return;                         // sem Web Audio: o jogo roda sem música
    if (!this.ctx) this.criar();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.timer) {
      this.proxima = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.agendar(), 100);
    }
  }

  criar() {
    const ctx = new this.Contexto();
    this.ctx = ctx;
    this.mestre = ctx.createGain();
    this.mestre.gain.value = 0;                          // entra suave (sobe aos poucos)
    this.mestre.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulso(3.2);
    const volumeReverb = ctx.createGain();
    volumeReverb.gain.value = 0.55;
    this.reverb.connect(volumeReverb);
    volumeReverb.connect(this.mestre);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.5;
    this.padGain.connect(this.mestre);
    this.padGain.connect(this.reverb);

    this.arpGain = ctx.createGain();
    this.arpGain.gain.value = 0;
    this.arpGain.connect(this.mestre);
    this.arpGain.connect(this.reverb);

    this.modo(this.estado);
  }

  /** Resposta ao impulso do reverb: ruído que decai. É isso que dá o "eco de sala grande". */
  impulso(segundos) {
    const taxa = this.ctx.sampleRate;
    const n = Math.floor(taxa * segundos);
    const buffer = this.ctx.createBuffer(2, n, taxa);
    for (let canal = 0; canal < 2; canal++) {
      const dados = buffer.getChannelData(canal);
      for (let i = 0; i < n; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2.5;
    }
    return buffer;
  }

  /** Duração de uma colcheia em segundos. */
  get colcheia() { return 30 / this.bpm; }

  /** Agenda as notas dos próximos instantes. Chamado várias vezes por segundo. */
  agendar() {
    while (this.proxima < this.ctx.currentTime + ANTECEDENCIA) {
      this.tocarPasso(this.passo, this.proxima);
      this.proxima += this.colcheia;
      this.passo += 1;
    }
  }

  tocarPasso(passo, t) {
    const acorde = PROGRESSAO[Math.floor(passo / 16) % PROGRESSAO.length];   // um acorde a cada 2 compassos
    if (passo % 16 === 0) this.pad(acorde, t, 16 * this.colcheia);
    if (passo % 2 === 0) {
      this.sino(midiParaHz(acorde[PADRAO_ARPEJO[(passo / 2) % PADRAO_ARPEJO.length]] + 24), t, 0.55);
    } else if (this.intensidade > 0.6) {                                       // no jogo, o arpejo fica mais cheio
      this.sino(midiParaHz(acorde[(passo >> 1) % acorde.length] + 36), t, 0.22);
    }
  }

  /** Acorde longo: cada nota vira duas ondas serra levemente desafinadas, passando por um filtro grave. */
  pad(acorde, t, duracao) {
    const ctx = this.ctx;
    for (const nota of acorde) {
      for (const desafino of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiParaHz(nota);
        osc.detune.value = desafino;
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = 650;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.09, t + 2);                 // entra devagar
        env.gain.setValueAtTime(0.09, t + duracao);
        env.gain.linearRampToValueAtTime(0, t + duracao + 1.5);        // sai sobrepondo o próximo acorde
        osc.connect(filtro);
        filtro.connect(env);
        env.connect(this.padGain);
        osc.start(t);
        osc.stop(t + duracao + 1.6);
      }
    }
  }

  /** Nota curta de "sino": ataque rápido e decaimento longo. */
  sino(hz, t, volume, destino = this.arpGain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(volume, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    osc.connect(env);
    env.connect(destino);
    osc.start(t);
    osc.stop(t + 1.6);
  }

  /** Pequena fanfarra (Dó maior subindo) para a vitória. */
  fanfarra() {
    const t0 = this.ctx.currentTime + 0.05;
    [72, 76, 79, 84, 88, 91].forEach((nota, i) => this.sino(midiParaHz(nota), t0 + i * 0.14, 0.5, this.mestre));
  }

  /**
   * Muda o "humor" da música conforme o estado do jogo:
   *   'menu' calma | 'jogo' arpejo cheio | 'derrota' some devagar | 'vitoria' fanfarra
   * Em 'jogo', o andamento (bpm) vem da dificuldade.
   */
  modo(estado, bpm) {
    this.estado = estado;
    if (bpm) this.bpm = bpm;
    else if (estado === 'menu') this.bpm = 66;
    this.intensidade = { menu: 0.3, jogo: 1, derrota: 0, vitoria: 0.6 }[estado] ?? 0.3;
    if (!this.ctx) return;
    const agora = this.ctx.currentTime;
    this.arpGain.gain.setTargetAtTime(this.intensidade * 0.5, agora, 0.6);
    this.mestre.gain.setTargetAtTime(this.mudo ? 0 : VOLUME * (estado === 'derrota' ? 0.35 : 1), agora, estado === 'derrota' ? 1.2 : 0.5);
    if (estado === 'vitoria' && !this.mudo) this.fanfarra();
  }

  /** Liga/desliga o som (a escolha fica salva no navegador). Devolve true se ficou mudo. */
  alternar() {
    this.mudo = !this.mudo;
    try { localStorage.setItem('musicaMudo', this.mudo ? '1' : '0'); } catch { /* sem armazenamento: tudo bem */ }
    if (this.ctx) this.mestre.gain.setTargetAtTime(this.mudo ? 0 : VOLUME, this.ctx.currentTime, 0.2);
    return this.mudo;
  }

  /** Pausa/retoma o relógio do áudio junto com o jogo. */
  pausar(sim) {
    if (!this.ctx) return;
    if (sim) this.ctx.suspend(); else this.ctx.resume();
  }
}
