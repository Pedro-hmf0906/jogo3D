# Shooter 3D — versão JavaScript / WebGL2

Port do projeto `jogo3d` (Python + GLFW + PyOpenGL + NumPy) para o navegador.
Mesma estrutura de módulos, mesmos nomes de funções (em camelCase), mesma matemática
e os mesmos shaders — só trocando a "cola" com o sistema (janela, teclado, arquivos).

## Como rodar

O jogo carrega os modelos `.obj` e os shaders com `fetch()`, e navegadores **não deixam**
fazer isso abrindo o `index.html` direto do disco (`file://`). Sirva a pasta com qualquer
servidor local:

```bash
cd jogo3d-webgl
python -m http.server 8000
```

Depois abra <http://localhost:8000> (jogo) ou:

- <http://localhost:8000/estudos/triangulo.html> — estudo 1
- <http://localhost:8000/estudos/cubo.html> — estudo 2

(No VS Code, a extensão *Live Server* também funciona.)

**Controles:** `WASD` ou setas = mover a nave · `ESC` = pausar / continuar.

## Estrutura

```
jogo3d-webgl/
├── index.html              página do jogo (um <canvas>)
├── css/estilo.css
├── src/
│   ├── main.js             ponto de entrada: contexto WebGL2, carrega recursos, loop
│   ├── jogo.js             estado do jogo: atualizar() e desenhar()
│   ├── entidades.js        Nave e novoAsteroide()
│   ├── config.js           constantes (limites, velocidades, spawn...)
│   ├── camera.js           CameraTerceiraPessoa
│   ├── math3d.js           matrizes 4x4 e vetores
│   ├── mesh.js             Mesh (VAO/VBO/EBO) e criarCubo()
│   ├── objLoader.js        leitor de OBJ feito do zero
│   ├── shader.js           classe Shader (compila e envia uniforms)
│   ├── input.js            Teclado
│   ├── canvas.js           ajusta o tamanho do canvas
│   └── shaders/            basico.vert, basico.frag
├── assets/models/          modelos .obj (Kenney Space Kit, CC0)
├── estudos/                triangulo e cubo (passos 1 e 2)
└── docs/CREDITOS.md
```

## Equivalência Python → JavaScript

| Python | JavaScript |
|---|---|
| `main.py` (loop e lógica) | `src/main.js` + `src/jogo.js` + `src/entidades.js` + `src/config.js` |
| `src/math3d.py` | `src/math3d.js` |
| `src/camera.py` | `src/camera.js` |
| `src/mesh.py` | `src/mesh.js` |
| `src/obj_loader.py` | `src/objLoader.js` |
| `src/shader.py` | `src/shader.js` |
| `src/shaders/*.vert/.frag` | `src/shaders/*.vert/.frag` |
| `estudos/triangulo.py`, `cubo.py` | `estudos/triangulo.js`, `cubo.js` |

## O que muda de verdade

- **WebGL2 em vez de OpenGL 3.3 core.** É o equivalente mais próximo (VAOs, índices de 32 bits,
  `layout (location = N)`). Nos shaders mudam só as duas primeiras linhas:
  `#version 330 core` → `#version 300 es` e, no fragment shader, `precision mediump float;`.
- **Matrizes.** Continuam "por linhas" com vetor coluna (`Proj * View * Model`), como no NumPy.
  Como o WebGL não aceita `GL_TRUE` (transpor) em `uniformMatrix4fv`, a transposição foi para
  `paraWebGL()` em `math3d.js`, chamada dentro de `Shader.setMat4`. `A @ B @ C` virou
  `multiplicar(A, B, C)`.
- **Sem GLFW.** O `<canvas>` é a janela; `requestAnimationFrame` é o loop; o teclado vem de
  eventos `keydown`/`keyup` (`input.js`). `glfw.swap_interval(1)` não é necessário: o navegador
  já sincroniza com o monitor.
- **ESC** pausa em vez de fechar (uma aba não "fecha" sozinha).
- **`dt` limitado a 50 ms**, para que voltar de outra aba não faça a nave/asteroides darem um salto.
- **`phong.vert`/`phong.frag`, `entities.py` e `game.py`** estavam vazios no zip original. Os dois
  últimos viraram `entidades.js` e `jogo.js` com a lógica que estava no `main.py`; os shaders de Phong
  não foram portados (não havia código), então ficam para a Semana 3.
- A pasta `venv/` do zip não entra no projeto JS.
