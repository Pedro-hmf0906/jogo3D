/**
 * Passo 1: desenhar um triângulo colorido.
 *
 * No navegador o canvas já cria a "janela" e o contexto WebGL2 para nós
 * (o papel do GLFW na versão em Python). O desenho é feito pela API do WebGL.
 */
import { ajustarCanvas } from '../src/canvas.js';
import { Shader } from '../src/shader.js';

// ---------------------------------------------------------------
// SHADERS (programas que rodam na placa de vídeo, escritos em GLSL)
// ---------------------------------------------------------------
// Vertex shader: roda uma vez por vértice e decide a POSIÇÃO.
const VERTEX_SHADER = `
#version 300 es
layout (location = 0) in vec3 aPos;     // posição do vértice
layout (location = 1) in vec3 aColor;   // cor do vértice
out vec3 vColor;                        // enviada ao fragment shader

void main() {
    gl_Position = vec4(aPos, 1.0);
    vColor = aColor;
}
`;

// Fragment shader: roda uma vez por pixel e decide a COR.
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

// 1) Compila os shaders e junta em um "programa"
const shader = new Shader(gl, VERTEX_SHADER, FRAGMENT_SHADER);

// 2) Dados do triângulo: x, y, z, r, g, b para cada vértice
const vertices = new Float32Array([
  // posição            cor
  -0.5, -0.5, 0.0,      1.0, 0.0, 0.0,   // esquerda-baixo: vermelho
   0.5, -0.5, 0.0,      0.0, 1.0, 0.0,   // direita-baixo : verde
   0.0,  0.5, 0.0,      0.0, 0.0, 1.0,   // topo          : azul
]);

// 3) VAO e VBO: "caixas" que guardam os dados dentro da placa de vídeo
const vao = gl.createVertexArray();
const vbo = gl.createBuffer();

gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const tam = Float32Array.BYTES_PER_ELEMENT;
const tamanhoVertice = 6 * tam;   // 6 floats por vértice

// atributo 0 = posição (3 floats, começa no byte 0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, tamanhoVertice, 0);
gl.enableVertexAttribArray(0);
// atributo 1 = cor (3 floats, começa depois dos 3 primeiros)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, tamanhoVertice, 3 * tam);
gl.enableVertexAttribArray(1);

// 4) Loop principal
function quadro() {
  if (ajustarCanvas(canvas)) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.15, 1.0);   // cor de fundo
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.usar();
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);    // desenha 3 vértices como triângulo
  }
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);
