/**
 * Leitor de arquivos OBJ feito do zero (sem bibliotecas de terceiros).
 *
 * Um arquivo .obj é um texto. Cada linha começa com uma etiqueta:
 *     v  x y z        -> posição de um vértice
 *     vt u v          -> coordenada de textura
 *     vn x y z        -> normal (direção para onde a superfície aponta)
 *     f  a b c ...    -> uma face; cada item pode ser  v   v/vt   v//vn   v/vt/vn
 *     # ...           -> comentário (ignorado)
 *
 * O OBJ guarda posição, textura e normal em listas separadas e as faces apenas
 * apontam para elas. A placa de vídeo quer tudo junto em cada vértice, então o
 * leitor monta o array final:  x y z | nx ny nz | u v   (8 números por vértice).
 *
 * O que este leitor trata:
 *   - faces com 3 ou mais vértices (polígonos viram triângulos em "leque")
 *   - índices negativos (contam a partir do fim da lista)
 *   - modelos sem normais: calcula a normal de cada face (visual "facetado")
 *   - modelos sem textura: usa (0, 0)
 *
 * lerObj() só trabalha com texto (não precisa de WebGL), por isso dá para testar
 * no Node. carregarObj() faz o fetch e cria a Mesh.
 */
import { Mesh, FLOATS_POR_VERTICE } from './mesh.js';
import { normalizar, produtoVetorial, subtrair } from './math3d.js';

/** OBJ conta a partir de 1. Negativo conta a partir do último lido. */
function indice(valor, total) {
  return valor > 0 ? valor - 1 : total + valor;
}

function inteiro(texto) {
  const n = Number(texto);
  if (!Number.isInteger(n)) throw new Error(`inteiro inválido: ${texto}`);
  return n;
}

function decimal(texto) {
  const n = Number(texto);
  if (texto === undefined || Number.isNaN(n)) throw new Error(`número inválido: ${texto}`);
  return n;
}

/** Interpreta um item de face como '1', '1/2', '1//3' ou '1/2/3'. */
function lerVerticeFace(texto, nPos, nTex, nNor) {
  const partes = texto.split('/');
  const vi = indice(inteiro(partes[0]), nPos);
  const vti = partes.length > 1 && partes[1] ? indice(inteiro(partes[1]), nTex) : null;
  const vni = partes.length > 2 && partes[2] ? indice(inteiro(partes[2]), nNor) : null;
  return [vi, vti, vni];
}

/** Lê o texto de um .obj e devolve { vertices: Float32Array, indices: Uint32Array }. */
export function lerObj(texto, nome = 'obj') {
  const posicoes = [], texturas = [], normais = [];
  const vertices = [];      // lista de [x y z nx ny nz u v]
  const indices = [];
  const cache = new Map();  // "v/vt/vn" -> índice já criado (evita duplicar vértices)

  texto.split('\n').forEach((linhaBruta, i) => {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith('#')) return;
    const partes = linha.split(/\s+/);
    const etiqueta = partes[0];

    try {
      if (etiqueta === 'v') {
        posicoes.push(partes.slice(1, 4).map(decimal));
      } else if (etiqueta === 'vt') {
        texturas.push(partes.slice(1, 3).map(decimal));
      } else if (etiqueta === 'vn') {
        normais.push(partes.slice(1, 4).map(decimal));
      } else if (etiqueta === 'f') {
        const cantos = partes.slice(1).map((p) =>
          lerVerticeFace(p, posicoes.length, texturas.length, normais.length));
        // polígono -> triângulos em leque: (0,1,2), (0,2,3), (0,3,4)...
        for (let k = 1; k < cantos.length - 1; k++) {
          adicionarTriangulo([cantos[0], cantos[k], cantos[k + 1]],
            posicoes, texturas, normais, vertices, indices, cache);
        }
      }
      // outras etiquetas (o, g, s, usemtl, mtllib) são ignoradas
    } catch (erro) {
      throw new Error(`${nome}, linha ${i + 1}: não consegui ler '${linha}' (${erro.message})`);
    }
  });

  if (indices.length === 0) {
    throw new Error(`${nome}: o arquivo não tem nenhuma face (linhas 'f')`);
  }
  return { vertices: new Float32Array(vertices.flat()), indices: new Uint32Array(indices) };
}

function adicionarTriangulo(cantos, posicoes, texturas, normais, vertices, indices, cache) {
  // Se algum canto não tem normal, calcula a normal do triângulo (produto vetorial)
  let normalFace = null;
  if (cantos.some(([, , vni]) => vni === null)) {
    const [p0, p1, p2] = cantos.map(([vi]) => posicoes[vi]);
    const n = produtoVetorial(subtrair(p1, p0), subtrair(p2, p0));
    const tamanho = Math.hypot(n[0], n[1], n[2]);
    normalFace = tamanho > 0 ? normalizar(n) : [0, 1, 0];
  }

  for (const [vi, vti, vni] of cantos) {
    const chave = `${vi}/${vti}/${vni}`;
    if (vni !== null && cache.has(chave)) {   // vértice igual já existe: reaproveita
      indices.push(cache.get(chave));
      continue;
    }

    const pos = posicoes[vi];
    const nor = vni !== null ? normais[vni] : normalFace;
    const uv = vti !== null ? texturas[vti] : [0, 0];
    if (!pos || !nor || !uv) throw new Error('índice fora da lista');

    indices.push(vertices.length);
    if (vni !== null) cache.set(chave, vertices.length);
    vertices.push([...pos, ...nor, ...uv]);
  }
}

/**
 * Move o modelo para que o centro da sua caixa fique na origem (0, 0, 0).
 * Assim as rotações giram em torno do meio do objeto, e não de um ponto
 * qualquer (muitos modelos têm a origem na base).
 */
export function centralizar(vertices) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += FLOATS_POR_VERTICE) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], vertices[i + k]);
      max[k] = Math.max(max[k], vertices[i + k]);
    }
  }
  const centro = min.map((m, k) => (m + max[k]) / 2);
  for (let i = 0; i < vertices.length; i += FLOATS_POR_VERTICE) {
    for (let k = 0; k < 3; k++) vertices[i + k] -= centro[k];
  }
}

/** Baixa um arquivo .obj e devolve uma Mesh pronta para desenhar. */
export async function carregarObj(gl, url, { centralizar: deveCentralizar = false } = {}) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Não consegui ler ${url} (${resposta.status})`);
  const { vertices, indices } = lerObj(await resposta.text(), String(url));
  if (deveCentralizar) centralizar(vertices);
  console.log(`[OBJ] ${url}: ${vertices.length / FLOATS_POR_VERTICE} vértices, ${indices.length / 3} triângulos`);
  return new Mesh(gl, vertices, indices);
}
