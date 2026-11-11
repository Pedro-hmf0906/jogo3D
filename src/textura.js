/**
 * Texturas geradas por código (procedurais): nenhuma imagem é carregada nem
 * desenhada em Canvas 2D. Calculamos a cor de cada pixel e entregamos o array
 * de bytes direto ao WebGL com texImage2D.
 */

/** Hash de 3 inteiros -> número pseudo-aleatório em [0, 1] (sempre o mesmo para a mesma entrada). */
function hash(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const suave = (t) => t * t * (3 - 2 * t);          // curva que suaviza a transição
const mistura = (a, b, t) => a + (b - a) * t;

/** Ruído de valor 3D: sorteia valores nos cantos de uma grade e interpola entre eles. */
function ruido3d(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = suave(x - x0), fy = suave(y - y0), fz = suave(z - z0);
  const c = (dx, dy, dz) => hash(x0 + dx, y0 + dy, z0 + dz);
  return mistura(
    mistura(mistura(c(0, 0, 0), c(1, 0, 0), fx), mistura(c(0, 1, 0), c(1, 1, 0), fx), fy),
    mistura(mistura(c(0, 0, 1), c(1, 0, 1), fx), mistura(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  );
}

/** Soma de ruídos em escalas cada vez menores: dá relevo natural (continentes -> detalhes). */
function fractal(x, y, z, oitavas = 5) {
  let soma = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < oitavas; i++) {
    soma += amp * ruido3d(x * freq, y * freq, z * freq);
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return soma / total;
}

const mix3 = (a, b, t) => a.map((c, i) => mistura(c, b[i], Math.min(1, Math.max(0, t))));

/** Cor do planeta para uma altura h (0..1) e latitude y (-1..1). */
function corDoPlaneta(h, y, ruidoFino) {
  let cor;
  if (h < 0.51) cor = mix3([0.03, 0.10, 0.32], [0.10, 0.36, 0.72], h / 0.51);             // oceano
  else if (h < 0.53) cor = [0.80, 0.74, 0.50];                                            // praia
  else if (h < 0.64) cor = mix3([0.18, 0.52, 0.20], [0.36, 0.42, 0.20], (h - 0.53) / 0.11); // florestas
  else cor = mix3([0.45, 0.37, 0.28], [0.92, 0.92, 0.96], (h - 0.64) / 0.10);             // montanhas e neve
  // gelo nos polos, com a borda irregular
  const gelo = (Math.abs(y) - (0.88 + 0.07 * ruidoFino)) / 0.05;
  return gelo > 0 ? mix3(cor, [0.95, 0.97, 1.0], gelo) : cor;
}

/** Deserto vermelho (tipo Marte): rochas escuras, poeira clara e calotas pequenas. */
function corDeserto(h, y, ruidoFino) {
  const cor = h < 0.45
    ? mix3([0.28, 0.10, 0.07], [0.62, 0.28, 0.12], h / 0.45)
    : mix3([0.62, 0.28, 0.12], [0.93, 0.68, 0.42], (h - 0.45) / 0.25);
  const gelo = (Math.abs(y) - (0.93 + 0.04 * ruidoFino)) / 0.03;
  return gelo > 0 ? mix3(cor, [0.96, 0.92, 0.88], gelo) : cor;
}

/** Gigante gasoso violeta: faixas horizontais deformadas pelo ruído e tempestades claras. */
function corGasoso(h, y, ruidoFino) {
  const faixa = 0.5 + 0.5 * Math.sin(y * 10 + h * 6);
  const cor = mix3([0.20, 0.17, 0.48], [0.68, 0.52, 0.86], faixa);
  return mix3(cor, [0.95, 0.80, 0.92], (ruidoFino - 0.58) * 3);
}

/** Mundo de gelo: azul-claro com rachaduras escuras. */
function corGelo(h, y, ruidoFino) {
  const cor = mix3([0.52, 0.70, 0.90], [0.97, 0.98, 1.0], (h - 0.3) / 0.4);
  // rachaduras = curvas de nível do relevo (h): linhas contínuas e finas, como gelo trincado
  const rachadura = Math.abs(h - 0.5) < 0.014 ? 0.5 : Math.abs(h - 0.41) < 0.009 ? 0.72 : 1;
  const granulado = 0.95 + 0.1 * ruidoFino;
  return cor.map((c) => c * rachadura * granulado);
}

/** Superfície do Sol: granulação laranja e amarela, com manchas mais escuras. */
function corSol(h, y, ruidoFino) {
  const cor = mix3([0.93, 0.33, 0.04], [1.0, 0.93, 0.55], (h - 0.35) / 0.35);
  const mancha = Math.max(0, 0.42 - h) * 3;           // pontos mais escuros onde o relevo é baixo
  return cor.map((c) => c * (0.88 + 0.24 * ruidoFino) * (1 - Math.min(0.6, mancha)));
}

const COR_POR_TIPO = { terra: corDoPlaneta, deserto: corDeserto, gasoso: corGasoso, gelo: corGelo, sol: corSol };
export const TIPOS_PLANETA = ['terra', 'deserto', 'gasoso', 'gelo'];

/**
 * Gera os pixels (RGBA) de uma textura de planeta, no formato equirretangular
 * (largura = longitude, altura = latitude). O ruído é calculado em 3D, sobre a
 * superfície da esfera, então não há emenda na borda esquerda/direita
 * nem esticamento nos polos.
 */
export function gerarPixelsPlaneta(largura = 256, altura = 128, tipo = 'terra') {
  const corDoTipo = COR_POR_TIPO[tipo];
  const dados = new Uint8Array(largura * altura * 4);
  for (let j = 0; j < altura; j++) {
    const theta = ((j + 0.5) / altura) * Math.PI;          // 0 (polo norte) .. PI (polo sul)
    for (let i = 0; i < largura; i++) {
      const phi = ((i + 0.5) / largura) * 2 * Math.PI;
      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.cos(theta);
      const z = Math.sin(theta) * Math.sin(phi);
      const h = fractal(x * 2.2 + 7, y * 2.2 + 7, z * 2.2 + 7);
      const fino = fractal(x * 9, y * 9, z * 9, 3);
      const [r, g, b] = corDoTipo(h, y, fino);
      const k = (j * largura + i) * 4;
      // um pouco de granulação para a superfície não ficar "lisa demais"
      const gr = 0.92 + 0.16 * fino;
      dados[k] = Math.min(255, r * gr * 255);
      dados[k + 1] = Math.min(255, g * gr * 255);
      dados[k + 2] = Math.min(255, b * gr * 255);
      dados[k + 3] = 255;
    }
  }
  return dados;
}

/** Cria o objeto de textura no WebGL a partir de um array RGBA. */
export function criarTextura(gl, dados, largura, altura) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, largura, altura, 0, gl.RGBA, gl.UNSIGNED_BYTE, dados);
  gl.generateMipmap(gl.TEXTURE_2D);   // versões menores, para não "cintilar" de longe
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function criarTexturaPlaneta(gl, tipo = 'terra', largura = 256, altura = 128) {
  return criarTextura(gl, gerarPixelsPlaneta(largura, altura, tipo), largura, altura);
}
