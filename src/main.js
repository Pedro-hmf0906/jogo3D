/**
 * Jogo 3D - Shooter em trilhos (WebGL2)
 *
 * Controles:  WASD ou setas = mover a nave   |   ESPAÇO = atirar   |   ESC = pausar / continuar   |   R ou Enter = reiniciar (após o game over)   |   M = menu
 */
import { ajustarCanvas } from './canvas.js';
import { Jogo } from './jogo.js';
import { Menu } from './menu.js';
import { Teclado } from './input.js';
import { criarCubo, criarEsfera } from './mesh.js';
import { carregarObj } from './objLoader.js';
import { Shader } from './shader.js';
import { criarTexturaPlaneta, TIPOS_PLANETA } from './textura.js';

// URLs relativas a este arquivo (funcionam em qualquer pasta onde o projeto esteja)
const MODELOS = new URL('../assets/models/', import.meta.url);
const SHADERS = new URL('./shaders/', import.meta.url);

function mostrarErro(mensagem) {
  const el = document.getElementById('erro');
  el.textContent = mensagem;
  el.hidden = false;
  console.error(mensagem);
}

async function iniciar() {
  const canvas = document.getElementById('tela');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    mostrarErro('Este navegador não suporta WebGL2.');
    return;
  }
  gl.enable(gl.DEPTH_TEST);

  let recursos;
  try {
    const [shader, malhaNave, ...malhasAsteroides] = await Promise.all([
      Shader.carregar(gl, new URL('phong.vert', SHADERS), new URL('phong.frag', SHADERS)),
      // Modelos carregados pelo NOSSO leitor de OBJ
      carregarObj(gl, new URL('craft_speederD.obj', MODELOS), { centralizar: true }),
      ...['meteor_detailed.obj', 'rock_largeA.obj', 'rock_crystals.obj'].map(
        (nome) => carregarObj(gl, new URL(nome, MODELOS), { centralizar: true })),
    ]);
    recursos = { shader, malhaNave, malhasAsteroides, malhaCubo: criarCubo(gl),
      malhaEsfera: criarEsfera(gl), texPlanetas: TIPOS_PLANETA.map((tipo) => criarTexturaPlaneta(gl, tipo)),
      texSol: criarTexturaPlaneta(gl, 'sol') };
  } catch (erro) {
    const aviso = location.protocol === 'file:'
      ? '\n\nVocê abriu o arquivo direto do disco. Rode um servidor local (veja o README), por ex.: python -m http.server'
      : '';
    mostrarErro(`Falha ao carregar o jogo: ${erro.message}${aviso}`);
    return;
  }

  const jogo = new Jogo(gl, recursos, new Teclado());
  const menu = new Menu(jogo);          // o jogo abre no menu (jogo.modo === 'menu')

  let pausado = false;
  const avisoPausa = document.getElementById('pausa');
  window.addEventListener('keydown', (e) => {
    if (jogo.modo !== 'jogando') return;        // no menu, quem trata o teclado é o Menu
    if ((e.code === 'KeyR' || e.code === 'Enter') && jogo.terminou) jogo.reiniciar();
    if (e.code === 'KeyM' && (pausado || jogo.terminou)) {    // volta ao menu
      pausado = false;
      avisoPausa.hidden = true;
      jogo.irParaMenu();
      menu.abrir();
    }
    if (e.code === 'Escape' && !e.repeat) {
      pausado = !pausado;
      avisoPausa.hidden = !pausado;
    }
  });

  let ultimo = performance.now() / 1000;
  function quadro(agoraMs) {
    const agora = agoraMs / 1000;
    // limita o dt: ao voltar de outra aba, o tempo parado não vira um "pulo" gigante
    const dt = Math.min(agora - ultimo, 0.05);
    ultimo = agora;

    if (ajustarCanvas(canvas)) {
      if (!pausado) jogo.atualizar(dt);
      jogo.desenhar(canvas.width, canvas.height);
    }
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}

iniciar();
