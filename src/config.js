// Constantes do jogo (equivalem às do topo do main.py).
export const QTD_ASTEROIDES = 25;
export const LIMITE_X = 4.5;            // até onde a nave pode ir
export const LIMITE_Y = 2.8;
export const DISTANCIA_SPAWN = -80.0;   // onde os asteroides nascem (fundo)
export const Z_DESPAWN = 8.0;           // passou da câmera: volta para o fundo
export const VELOCIDADE_NAVE = 6.0;
export const VELOCIDADE_AVANCO = 18.0;
export const COR_FUNDO = [0.02, 0.02, 0.07, 1.0];

// ---- vida e efeitos ----
export const VIDAS_INICIAIS = 3;
export const TEMPO_INVULNERAVEL = 1.5;   // segundos sem levar dano depois de uma batida
export const QTD_ESTRELAS = 90;