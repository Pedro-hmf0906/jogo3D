#version 300 es
precision highp float;

in vec3 vPosMundo;
in vec3 vNormal;
in vec2 vUV;

uniform vec3 uCor;       // cor do material
uniform vec3 uCamPos;    // posição da câmera (para o brilho especular)
uniform float uBrilho;   // "shininess": quanto maior, menor e mais intenso o brilho
uniform float uKs;       // intensidade do especular do material
uniform float uNeblinaIni; // distância em que a neblina começa
uniform float uNeblinaFim; // distância em que o objeto some por completo
uniform vec3 uFundo;      // cor do fundo: a neblina de distância mistura os objetos com ela
uniform float uUsaNeblina; // 0.0 para o céu (sol e planetas distantes não somem na neblina)
uniform float uSemLuz;   // 1.0 = objeto que emite luz própria (estrelas, partículas)
uniform float uAmbiente; // quanto de luz ambiente o material recebe
uniform sampler2D uTextura;   // a textura (imagem "colada" no objeto)
uniform float uUsaTextura;    // 1.0 = cor vem da textura; 0.0 = cor sólida (uCor)

// Luz 1: HOLOFOTE preso à nave (cone de luz apontando para frente)
uniform vec3 uHoloPos;
uniform vec3 uHoloDir;     // direção em que o holofote aponta (unitária)
uniform vec3 uHoloCor;
uniform float uHoloCosInt; // cosseno do ângulo interno (luz plena)
uniform float uHoloCosExt; // cosseno do ângulo externo (luz zero)

// Luz 2: SOL DISTANTE (direcional: só tem direção, sem posição)
uniform vec3 uSolDir;      // unitária, aponta DO objeto PARA o sol
uniform vec3 uSolCor;

// Luz 3: LUZ DE EXPLOSÃO (pontual, forte e curta)
uniform vec3 uExplPos;
uniform vec3 uExplCor;     // já multiplicada pela intensidade (0 = apagada)

out vec4 FragColor;

// Difusa + especular de UMA luz. L = direção do pixel até a luz (unitária).
vec3 phong(vec3 N, vec3 V, vec3 L, vec3 luzCor, vec3 base) {
    float dif = max(dot(N, L), 0.0);                       // difusa (Lambert)
    vec3 R = reflect(-L, N);                                // direção do reflexo
    float esp = (dif > 0.0) ? pow(max(dot(R, V), 0.0), uBrilho) : 0.0;   // especular
    return dif * base * luzCor + esp * uKs * luzCor;
}

void main() {
    // NEBLINA: quanto mais longe da câmera, mais o objeto se funde com o fundo.
    // Faz os planetas "emergirem do escuro" em vez de aparecerem de repente.
    float neblina = uUsaNeblina * smoothstep(uNeblinaIni, uNeblinaFim, length(uCamPos - vPosMundo));

    if (uSemLuz > 0.5) {
        // objeto que emite luz: cor própria (ou a textura, no caso do Sol, vezes uCor)
        vec3 emitida = (uUsaTextura > 0.5) ? texture(uTextura, vUV).rgb * uCor : uCor;
        FragColor = vec4(mix(emitida, uFundo, neblina), 1.0);
        return;
    }

    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vPosMundo);

    // AMBIENTE: luz de fundo constante (o espaço nunca é preto total)
    // cor-base do pixel: lida da textura (usando o UV) ou a cor sólida do material
    vec3 base = (uUsaTextura > 0.5) ? texture(uTextura, vUV).rgb : uCor;
    vec3 cor = uAmbiente * base;

    // SOL: sem atenuação, vem sempre da mesma direção
    cor += phong(N, V, normalize(uSolDir), uSolCor, base);

    // HOLOFOTE: pontual com atenuação, limitada por um cone
    vec3 Lh = uHoloPos - vPosMundo;
    float dh = length(Lh);
    Lh = Lh / dh;
    float theta = dot(-Lh, normalize(uHoloDir));            // ângulo em relação ao eixo do cone
    float cone = clamp((theta - uHoloCosExt) / (uHoloCosInt - uHoloCosExt), 0.0, 1.0);
    float attH = 1.0 / (1.0 + 0.01 * dh + 0.0015 * dh * dh);
    cor += cone * attH * phong(N, V, Lh, uHoloCor, base);

    // EXPLOSÃO: pontual, enfraquece rápido com a distância
    vec3 Le = uExplPos - vPosMundo;
    float de = length(Le);
    Le = Le / de;
    float attE = 1.0 / (1.0 + 0.05 * de * de);
    cor += attE * phong(N, V, Le, uExplCor, base);

    FragColor = vec4(mix(cor, uFundo, neblina), 1.0);
}
