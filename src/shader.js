/**
 * Classe Shader: compila um par vertex/fragment e permite enviar valores
 * (uniforms) para a placa de vídeo.
 *
 * Os shaders ficam em arquivos .vert/.frag na pasta src/shaders e são lidos
 * com fetch() por Shader.carregar(). Também dá para criar direto de texto
 * (usado nos estudos).
 */
import { paraWebGL } from './math3d.js';

function compilar(gl, tipo, codigo) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, codigo.trim());   // '#version' precisa ser a 1ª linha
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const nome = tipo === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`Erro ao compilar o ${nome} shader:\n${log}`);
  }
  return shader;
}

export class Shader {
  constructor(gl, codigoVert, codigoFrag) {
    this.gl = gl;
    const vs = compilar(gl, gl.VERTEX_SHADER, codigoVert);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, codigoFrag);

    this.programa = gl.createProgram();
    gl.attachShader(this.programa, vs);
    gl.attachShader(this.programa, fs);
    gl.linkProgram(this.programa);
    if (!gl.getProgramParameter(this.programa, gl.LINK_STATUS)) {
      throw new Error(`Erro ao ligar o programa:\n${gl.getProgramInfoLog(this.programa)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.locais = new Map();   // cache: nome do uniform -> posição
  }

  static async carregar(gl, urlVert, urlFrag) {
    const [vert, frag] = await Promise.all(
      [urlVert, urlFrag].map(async (url) => {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error(`Não consegui ler ${url} (${resposta.status})`);
        return resposta.text();
      })
    );
    return new Shader(gl, vert, frag);
  }

  usar() {
    this.gl.useProgram(this.programa);
  }

  local(nome) {
    if (!this.locais.has(nome)) {
      this.locais.set(nome, this.gl.getUniformLocation(this.programa, nome));
    }
    return this.locais.get(nome);
  }

  setMat4(nome, matriz) {
    // Nossas matrizes são "por linhas"; o WebGL quer "por colunas".
    this.gl.uniformMatrix4fv(this.local(nome), false, paraWebGL(matriz));
  }

  setVec3(nome, v) {
    this.gl.uniform3f(this.local(nome), v[0], v[1], v[2]);
  }

  setFloat(nome, valor) {
    this.gl.uniform1f(this.local(nome), valor);
  }
}
