/**
 * Passo 2: cubo 3D girando com projeção perspectiva.
 *
 * Novidades em relação ao triângulo:
 *   - Matrizes (model, view, projection) — agora vindas de src/math3d.js
 *   - Teste de profundidade (objetos da frente escondem os de trás)
 *   - EBO: lista de índices, para não repetir vértices
 *   - Animação: o cubo gira com o passar do tempo
 */
import { ajustarCanvas } from '../src/canvas.js';
import { multiplicar, perspectiva, rotacaoX, rotacaoY, translacao } from '../src/math3d.js';
import { Shader } from '../src/shader.js';

const VERTEX_SHADER = `
#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

uniform mat4 uMVP;      // matriz final = projeção * view * model
out vec3 vColor;

void main() {
    gl_Position = uMVP * vec4(aPos, 1.0);
    vColor = aColor;
}
`;

const FRAGMENT_SHADER = `
#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 FragColor;

void main() {
    FragColor = vec4(vColor, 1.0);
}
`;

const canvas = document.getElementById('tela');
const gl = canvas.getContext('webgl2');
const shader = new Shader(gl, VERTEX_SHADER, FRAGMENT_SHADER);

// 8 vértices do cubo: x, y, z, r, g, b
const vertices = new Float32Array([
  -0.5, -0.5, -0.5,   1.0, 0.0, 0.0,   // 0
   0.5, -0.5, -0.5,   0.0, 1.0, 0.0,   // 1
   0.5,  0.5, -0.5,   0.0, 0.0, 1.0,   // 2
  -0.5,  0.5, -0.5,   1.0, 1.0, 0.0,   // 3
  -0.5, -0.5,  0.5,   1.0, 0.0, 1.0,   // 4
   0.5, -0.5,  0.5,   0.0, 1.0, 1.0,   // 5
   0.5,  0.5,  0.5,   1.0, 1.0, 1.0,   // 6
  -0.5,  0.5,  0.5,   0.3, 0.3, 0.3,   // 7
]);

// 6 faces x 2 triângulos x 3 índices
const indices = new Uint32Array([
  0, 1, 2,  2, 3, 0,   // trás
  4, 5, 6,  6, 7, 4,   // frente
  0, 4, 7,  7, 3, 0,   // esquerda
  1, 5, 6,  6, 2, 1,   // direita
  3, 2, 6,  6, 7, 3,   // topo
  0, 1, 5,  5, 4, 0,   // base
]);

const vao = gl.createVertexArray();
const vbo = gl.createBuffer();
const ebo = gl.createBuffer();

gl.bindVertexArray(vao);

gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

const tam = Float32Array.BYTES_PER_ELEMENT;
const passo = 6 * tam;
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, passo, 0);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, passo, 3 * tam);
gl.enableVertexAttribArray(1);

// Liga o teste de profundidade (essencial em 3D)
gl.enable(gl.DEPTH_TEST);

function quadro(agoraMs) {
  if (ajustarCanvas(canvas)) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    const tempo = agoraMs / 1000;

    // MODEL: posiciona/gira o objeto no mundo
    const model = multiplicar(rotacaoY(tempo), rotacaoX(tempo * 0.5));
    // VIEW: a "câmera". Aqui ela fica parada; o mundo é afastado 3 unidades.
    const view = translacao(0.0, 0.0, -3.0);
    // PROJECTION: perspectiva
    const proj = perspectiva(60.0, canvas.width / canvas.height, 0.1, 100.0);

    const mvp = multiplicar(proj, view, model);

    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    shader.usar();
    shader.setMat4('uMVP', mvp);   // o Shader já transpõe para o WebGL

    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);
