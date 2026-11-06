/**
 * Mesh = a "malha" de um modelo 3D: vértices + índices guardados na placa de vídeo.
 *
 * Cada vértice tem 8 números:
 *     posição (x, y, z) | normal (nx, ny, nz) | textura (u, v)
 * A normal indica para onde a superfície "aponta" (usada na iluminação).
 * O (u, v) diz qual ponto da imagem de textura cai naquele vértice.
 * O leitor de OBJ (objLoader.js) gera exatamente esses mesmos arrays.
 */
export const FLOATS_POR_VERTICE = 8;

export class Mesh {
  constructor(gl, vertices, indices) {
    this.gl = gl;
    vertices = new Float32Array(vertices);
    indices = new Uint32Array(indices);
    this.nIndices = indices.length;

    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    this.ebo = gl.createBuffer();

    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const tam = Float32Array.BYTES_PER_ELEMENT;
    const passo = FLOATS_POR_VERTICE * tam;
    // atributo 0: posição
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, passo, 0);
    gl.enableVertexAttribArray(0);
    // atributo 1: normal
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, passo, 3 * tam);
    gl.enableVertexAttribArray(1);
    // atributo 2: coordenadas de textura
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, passo, 6 * tam);
    gl.enableVertexAttribArray(2);

    gl.bindVertexArray(null);
  }

  desenhar() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.nIndices, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
}

/**
 * Cubo de lado 1 centrado na origem. Tem 24 vértices (4 por face),
 * porque cada face precisa da sua própria normal.
 */
export function criarCubo(gl) {
  // (normal, eixo u, eixo v) de cada face; u x v = normal
  const faces = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],     // +X
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],    // -X
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],     // +Y
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],    // -Y
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],     // +Z
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],    // -Z
  ];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];

  // ponto = centro + a*u + b*v
  const canto = (centro, u, v, a, b) =>
    centro.map((c, i) => c + a * u[i] + b * v[i]);

  const vertices = [];
  const indices = [];
  faces.forEach(([n, u, v], i) => {
    const centro = n.map((x) => x * 0.5);
    const cantos = [
      canto(centro, u, v, -0.5, -0.5),
      canto(centro, u, v, +0.5, -0.5),
      canto(centro, u, v, +0.5, +0.5),
      canto(centro, u, v, -0.5, +0.5),
    ];
    cantos.forEach((c, k) => vertices.push(...c, ...n, ...uvs[k]));
    const base = i * 4;
    indices.push(base, base + 1, base + 2, base + 2, base + 3, base);
  });

  return new Mesh(gl, vertices, indices);
}

/**
 * Esfera de raio 1 centrada na origem, com normais e coordenadas de textura (u, v).
 * u vai de 0 a 1 em volta do equador (longitude); v vai de 0 a 1 do polo norte ao sul.
 * A primeira e a última coluna ficam na mesma posição, mas com u = 0 e u = 1:
 * é a "emenda" da textura.
 */
export function criarEsfera(gl, setores = 48, aneis = 24) {
  const vertices = [];
  const indices = [];
  for (let j = 0; j <= aneis; j++) {
    const theta = (j / aneis) * Math.PI;
    for (let i = 0; i <= setores; i++) {
      const phi = (i / setores) * 2 * Math.PI;
      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.cos(theta);
      const z = Math.sin(theta) * Math.sin(phi);
      vertices.push(x, y, z, x, y, z, i / setores, j / aneis);   // posição = normal (raio 1)
    }
  }
  for (let j = 0; j < aneis; j++) {
    for (let i = 0; i < setores; i++) {
      const a = j * (setores + 1) + i;
      const b = a + setores + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return new Mesh(gl, vertices, indices);
}
