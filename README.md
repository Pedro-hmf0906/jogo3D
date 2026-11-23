# Rumo a Thalassa — Shooter 3D em WebGL

Jogo 3D de nave em trilhos (estilo *Star Fox*), feito com **WebGL2 puro** e JavaScript, **sem nenhuma
biblioteca** (nem three.js, nem de matemática: as matrizes, o leitor de OBJ, os shaders, as texturas e a música
são código da equipe).

**Trabalho 2 — Computação Gráfica (UECE).** Equipe: *[NOME 1], [NOME 2], [NOME 3]*

| | |
|---|---|
| 🎮 Jogar online | *[LINK DO GITHUB PAGES]* |
| 🖥️ Slides | *[LINK DOS SLIDES]* |
| 🎬 Vídeo de demonstração | *[LINK DO VÍDEO]* |

## História

Ano 2387. Thalassa, um mundo de oceanos, está ficando sem energia. Você pilota a **Falcão-1**, a única nave veloz
o bastante para cruzar o Cinturão de Kepler, um campo de rochas e cristais instáveis. Desvie dos asteroides,
destrua o que puder com a bateria de tiros (que recarrega devagar) e **pouse no hangar da nave-mãe Aurora**
antes que as luzes de Thalassa se apaguem.

## Como rodar (tutorial)

**Não há compilação.** Basta um navegador com WebGL2 (Chrome, Edge, Firefox ou Brave).

**Opção A — online:** abra o link do GitHub Pages acima.

**Opção B — no computador:** o jogo carrega modelos e shaders com `fetch()`, e os navegadores **não permitem isso
abrindo o `index.html` direto do disco**. Sirva a pasta com um servidor local:

```bash
git clone <URL-DESTE-REPOSITORIO>
cd <pasta-do-repositorio>
python3 -m http.server 8000        # no Windows: python -m http.server 8000
```

Depois abra <http://localhost:8000>. (No VS Code, a extensão *Live Server* também serve.)
Se a tela ficar em branco depois de atualizar os arquivos, recarregue com **Ctrl+Shift+R**.

## Controles

| Tecla | Ação |
|---|---|
| `W A S D` ou setas | mover a nave |
| `ESPAÇO` | atirar (cada tiro gasta uma carga da bateria) |
| `ESC` | pausar / continuar |
| `M` | voltar ao menu (pausado ou depois do fim da partida) |
| `R` ou `Enter` | jogar de novo (depois do fim da partida) |
| `N` | ligar / desligar a música |

No menu: `↑ ↓` escolhem, `← →` mudam a dificuldade, `Enter` confirma (o mouse também funciona).

## Dificuldades

| | Fácil | Normal | Difícil |
|---|---|---|---|
| Duração da travessia | 45 s | 60 s | 75 s |
| Ritmo | normal | normal | **rápido (×1,4)** |
| Vidas | 5 | 3 | 2 |
| Asteroides | 55 | 90 | 100 |
| Bateria de tiros | 4 (recarga 1,8 s) | 3 (2,5 s) | 3 (3,2 s) |
| Pontos por asteroide | ×1 | ×2 | ×3 |

## Requisitos do enunciado → onde estão

| Requisito | Onde |
|---|---|
| Projeção perspectiva e câmera | `src/math3d.js` (`perspectiva`, `lookAt`) e `src/camera.js` (3ª pessoa seguindo a nave) |
| Iluminação de Phong (ambiente + difusa + especular, **por pixel**) | `src/shaders/phong.frag` |
| Fontes de luz com movimento | `src/jogo.js`: **holofote** preso à nave (cone, vira com a inclinação), **luz de explosão** (acende onde há batida), **Sol** direcional |
| Objetos animados por transformações geométricas | asteroides (giro e avanço), nave (inclinação nas curvas), planetas e Sol (rotação), partículas e tiros |
| Objeto com textura | planetas e Sol: texturas procedurais (`src/textura.js`) enviadas com `texImage2D` |
| Objeto com cor sólida | asteroides (`uCor` no shader) |
| Leitor de OBJ próprio | `src/objLoader.js` (também lê o `.mtl` com as cores dos materiais) |
| Teclado / mouse | `src/input.js`, `src/menu.js` |
| Só WebGL para desenhar | o `canvas` só cria o contexto; todo o desenho é WebGL2 |

## Estrutura

```
index.html          página, HUD, menu e telas (HTML por cima do canvas)
css/estilo.css
src/
  main.js           inicialização, loop, pausa, ligação com a música
  jogo.js           estado do jogo, regras, desenho (céu, nave-mãe, asteroides, partículas)
  config.js         constantes e presets de dificuldade
  entidades.js      nave e asteroides
  camera.js  math3d.js  shader.js  mesh.js  canvas.js  input.js
  objLoader.js      leitor de OBJ e MTL
  textura.js        texturas procedurais (planetas e Sol)
  menu.js           menu: Iniciar, Dificuldade, História
  musica.js         trilha gerada em tempo real (Web Audio)
  shaders/          phong.vert, phong.frag
assets/models/      modelos .obj/.mtl (Kenney, CC0)
docs/CREDITOS.md
estudos/            primeiros testes: triângulo e cubo
```

## Observações

- **HUD, menu e telas são HTML** sobre o canvas (texto e barras). Toda a cena 3D é desenhada só com WebGL.
- **A música usa a Web Audio API**, que já vem no navegador (sem bibliotecas nem arquivos de áudio).
- A nave avança sozinha pelo eixo Z e o jogador controla X e Y. O que parece movimento da nave é o mundo vindo
  na direção dela; o céu (Sol e planetas) é fixo e muito distante.
- A chegada (a nave-mãe) é feita só com caixas, em código, e o casco recebe a iluminação de Phong.

## Créditos

Modelos 3D: *Space Kit* de [Kenney](https://www.kenney.nl) (CC0). Detalhes em [`docs/CREDITOS.md`](docs/CREDITOS.md).