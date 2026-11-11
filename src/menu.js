/**
 * Menu inicial: Iniciar, Dificuldade e História.
 *
 * É um HTML por cima do canvas. Ao fundo, o jogo roda em "modo demonstração"
 * (veja Jogo.atualizarDemo), então o menu aparece sobre o espaço em movimento.
 * Funciona com o teclado (setas/WASD + Enter) e com o mouse (clique).
 */
import { DIFICULDADES, ORDEM_DIFICULDADES } from './config.js';

export class Menu {
  constructor(jogo) {
    this.jogo = jogo;
    this.sel = 0;            // item destacado
    this.tela = 'menu';      // 'menu' ou 'historia'
    this.caixaMenu = document.getElementById('menu');
    this.caixaHistoria = document.getElementById('historia');
    this.itens = [...document.querySelectorAll('#opcoes li')];
    this.nomeDif = document.getElementById('difNome');
    this.infoDif = document.getElementById('difInfo');

    this.itens.forEach((li, i) => {
      li.addEventListener('mouseenter', () => { this.sel = i; this.desenhar(); });
      li.addEventListener('click', () => { this.sel = i; this.ativar(); });
    });
    const voltar = document.getElementById('voltarHistoria');
    if (voltar) voltar.addEventListener('click', () => this.mostrar('menu'));

    window.addEventListener('keydown', (e) => this.tecla(e));
    this.desenhar();
  }

  /** Reabre o menu principal (depois de voltar do jogo). */
  abrir() {
    this.sel = 0;
    this.tela = 'menu';
    this.desenhar();
  }

  mostrar(tela) {
    this.tela = tela;
    this.desenhar();
  }

  get acaoAtual() {
    return this.itens[this.sel].dataset.acao;
  }

  tecla(e) {
    if (this.jogo.modo !== 'menu') return;        // fora do menu, estas teclas são do jogo

    if (this.tela === 'historia') {
      if (['Enter', 'Escape', 'Backspace'].includes(e.code)) { e.preventDefault(); this.mostrar('menu'); }
      return;
    }

    const n = this.itens.length;
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': this.sel = (this.sel + n - 1) % n; break;
      case 'ArrowDown': case 'KeyS': this.sel = (this.sel + 1) % n; break;
      case 'ArrowLeft': case 'KeyA': this.mudarDificuldade(-1); break;
      case 'ArrowRight': case 'KeyD': this.mudarDificuldade(+1); break;
      case 'Digit1': this.jogo.definirDificuldade('facil'); break;
      case 'Digit2': this.jogo.definirDificuldade('normal'); break;
      case 'Digit3': this.jogo.definirDificuldade('dificil'); break;
      case 'Enter': this.ativar(); break;
      default: return;
    }
    e.preventDefault();
    this.desenhar();
  }

  mudarDificuldade(passo) {
    const i = ORDEM_DIFICULDADES.indexOf(this.jogo.dificuldade);
    const n = ORDEM_DIFICULDADES.length;
    this.jogo.definirDificuldade(ORDEM_DIFICULDADES[(i + passo + n) % n]);
  }

  /** Executa o item selecionado. */
  ativar() {
    switch (this.acaoAtual) {
      case 'iniciar': this.jogo.iniciar(this.jogo.dificuldade); break;
      case 'dificuldade': this.mudarDificuldade(+1); break;
      case 'historia': this.tela = 'historia'; break;
      default: break;
    }
    this.desenhar();
  }

  /** Atualiza a página: qual tela aparece, item destacado e texto da dificuldade. */
  desenhar() {
    const noMenu = this.jogo.modo === 'menu';
    this.caixaMenu.hidden = !(noMenu && this.tela === 'menu');
    this.caixaHistoria.hidden = !(noMenu && this.tela === 'historia');
    this.itens.forEach((li, i) => { li.className = i === this.sel ? 'sel' : ''; });

    const d = DIFICULDADES[this.jogo.dificuldade];
    this.nomeDif.textContent = d.nome;
    this.infoDif.textContent =
      `${d.vidas} vidas · ${d.asteroides} asteroides · bateria de ${d.cargasMax} tiros (recarga de ${d.tempoRecarga} s) · pontos ×${d.mult}`;
  }
}
