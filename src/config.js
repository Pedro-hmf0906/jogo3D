// Constantes do jogo (equivalem às do topo do main.py).
export const QTD_ASTEROIDES = 90;       // mais asteroides porque agora eles ocupam um corredor bem mais longo
export const LIMITE_X = 4.5;            // até onde a nave pode ir
export const LIMITE_Y = 2.8;
export const DISTANCIA_SPAWN = -320.0;  // onde asteroides e estrelas nascem: bem longe, escondidos pela neblina
export const Z_DESPAWN = 8.0;           // passou da câmera: volta para o fundo
export const VELOCIDADE_NAVE = 6.0;
export const VELOCIDADE_AVANCO = 18.0;
export const COR_FUNDO = [0.02, 0.02, 0.07, 1.0];

// ---- vida e efeitos ----
export const VIDAS_INICIAIS = 3;
export const TEMPO_INVULNERAVEL = 1.5;   // segundos sem levar dano depois de uma batida
export const QTD_ESTRELAS = 160;

// ---- fase e linha de chegada ----
export const COMPRIMENTO_FASE = 1800;      // distância até a linha de chegada (a 18 u/s dá ~100 s de jogo)
export const GATE_LARGURA = 18;            // largura do portal da linha de chegada
export const GATE_ALTURA = 11;

// ---- distância de visão e neblina ----
// A neblina mistura os objetos com o fundo entre INICIO e FIM (distância da câmera).
// Tudo nasce além de NEBLINA_FIM, então nada "aparece do nada": surge do escuro aos poucos.
export const NEBLINA_INICIO = 140.0;
export const NEBLINA_FIM = 300.0;
export const DISTANCIA_VISAO = 800.0;      // plano distante da câmera (precisa cobrir o sol e os planetas do céu)

// ---- tiros e pontuação ----
export const VELOCIDADE_TIRO = 70.0;       // unidades por segundo, para frente (-Z)
export const INTERVALO_TIRO = 0.2;         // segundos entre um tiro e outro dentro de uma rajada
export const CARGAS_MAX = 3;               // quantos tiros a nave guarda (bateria cheia)
export const TEMPO_RECARGA = 2.5;          // segundos para recuperar UM tiro. (CARGAS_MAX = 1 e TEMPO_RECARGA = 3: um tiro de cada vez)
export const ALCANCE_TIRO = 170.0;         // o tiro some depois de percorrer essa distância
export const PONTOS_ASTEROIDE = 100;

// ---- dificuldades (escolhidas no menu) ----
// 'normal' usa os valores base definidos acima; as outras variam vidas, tráfego e bateria de tiros.
export const DIFICULDADES = {
  facil:   { nome: 'Fácil',   vidas: 5, asteroides: 55,  cargasMax: 4, tempoRecarga: 1.8, mult: 1 },
  normal:  { nome: 'Normal',  vidas: VIDAS_INICIAIS, asteroides: QTD_ASTEROIDES, cargasMax: CARGAS_MAX, tempoRecarga: TEMPO_RECARGA, mult: 2 },
  dificil: { nome: 'Difícil', vidas: 2, asteroides: 130, cargasMax: 3, tempoRecarga: 3.2, mult: 3 },
};
export const ORDEM_DIFICULDADES = ['facil', 'normal', 'dificil'];
