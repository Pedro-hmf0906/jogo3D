/**
 * Funções de matemática 3D (matrizes 4x4 e vetores) em JavaScript puro.
 *
 * Convenção (a mesma da versão em Python): matrizes guardadas "por linhas",
 * ou seja, m[linha * 4 + coluna], e vetores coluna. Por isso a ordem é:
 *     Projeção * View * Model
 *
 * O WebGL espera as matrizes "por colunas" e NÃO aceita transpor no envio
 * (o parâmetro transpose de uniformMatrix4fv tem que ser false). Então a
 * transposição é feita aqui, em paraWebGL(), que a classe Shader chama.
 */

export function identidade() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

// math3d.js
export function distancia(v1, v2) {
    const dx = v1[0] - v2[0];
    const dy = v1[1] - v2[1];
    const dz = v1[2] - v2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function translacao(x, y, z) {
  const m = identidade();
  m[3] = x; m[7] = y; m[11] = z;
  return m;
}

export function escala(sx, sy, sz) {
  const m = identidade();
  m[0] = sx; m[5] = sy; m[10] = sz;
  return m;
}

export function rotacaoX(ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const m = identidade();
  m[5] = c;  m[6] = -s;
  m[9] = s;  m[10] = c;
  return m;
}

export function rotacaoY(ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const m = identidade();
  m[0] = c;   m[2] = s;
  m[8] = -s;  m[10] = c;
  return m;
}

export function rotacaoZ(ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const m = identidade();
  m[0] = c;  m[1] = -s;
  m[4] = s;  m[5] = c;
  return m;
}

/** Matriz de projeção perspectiva: objetos distantes ficam menores. */
export function perspectiva(fovGraus, aspecto, perto, longe) {
  const f = 1.0 / Math.tan((fovGraus * Math.PI / 180) / 2.0);
  const m = new Float32Array(16);
  m[0] = f / aspecto;
  m[5] = f;
  m[10] = (longe + perto) / (perto - longe);
  m[11] = (2.0 * longe * perto) / (perto - longe);
  m[14] = -1.0;
  return m;
}

/**
 * Multiplica matrizes da esquerda para a direita:
 * multiplicar(A, B, C) = A * B * C  (equivale ao A @ B @ C do NumPy).
 */
export function multiplicar(...matrizes) {
  return matrizes.reduce((a, b) => {
    const r = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let soma = 0;
        for (let k = 0; k < 4; k++) soma += a[i * 4 + k] * b[k * 4 + j];
        r[i * 4 + j] = soma;
      }
    }
    return r;
  });
}

/** Transpõe para o formato que o WebGL espera (por colunas). */
export function paraWebGL(m) {
  const r = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) r[j * 4 + i] = m[i * 4 + j];
  }
  return r;
}

// ---------- vetores (arrays simples [x, y, z]) ----------
export const subtrair = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const produtoEscalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const produtoVetorial = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function normalizar(v) {
  const tamanho = Math.hypot(v[0], v[1], v[2]);
  if (tamanho === 0) return [v[0], v[1], v[2]];
  return [v[0] / tamanho, v[1] / tamanho, v[2] / tamanho];
}

/**
 * Matriz VIEW: coloca a câmera em 'olho', olhando para 'alvo'.
 * 'cima' indica onde é o "para cima" do mundo, normalmente [0, 1, 0].
 */
export function lookAt(olho, alvo, cima) {
  const frente = normalizar(subtrair(alvo, olho));
  const direita = normalizar(produtoVetorial(frente, cima));
  const cimaReal = produtoVetorial(direita, frente);

  const m = identidade();
  m[0] = direita[0];   m[1] = direita[1];   m[2] = direita[2];
  m[4] = cimaReal[0];  m[5] = cimaReal[1];  m[6] = cimaReal[2];
  m[8] = -frente[0];   m[9] = -frente[1];   m[10] = -frente[2];
  m[3] = -produtoEscalar(direita, olho);
  m[7] = -produtoEscalar(cimaReal, olho);
  m[11] = produtoEscalar(frente, olho);
  return m;
}
