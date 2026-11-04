#version 300 es
precision mediump float;

in vec3 vNormal;

uniform vec3 uCor;     // cor sólida do objeto

out vec4 FragColor;

void main() {
    // PROVISÓRIO: só para dar noção de volume. O modelo de Phong
    // completo (ambiente + difusa + especular) vem na Semana 3.
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(0.5, 1.0, 0.8));   // direção de onde vem a luz
    float difusa = max(dot(N, L), 0.0);

    vec3 cor = uCor * (0.25 + 0.75 * difusa);
    FragColor = vec4(cor, 1.0);
}
