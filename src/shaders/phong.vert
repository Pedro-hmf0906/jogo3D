#version 300 es

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aUV;      // coordenada de textura

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

out vec3 vPosMundo;   // posição do pixel no mundo (para calcular a direção da luz)
out vec3 vNormal;     // normal no mundo
out vec2 vUV;

void main() {
    vec4 posMundo = uModel * vec4(aPos, 1.0);
    vPosMundo = posMundo.xyz;
    vUV = aUV;
    // matriz normal: mantém a normal correta mesmo com escala
    vNormal = mat3(transpose(inverse(uModel))) * aNormal;
    gl_Position = uProj * uView * posMundo;
}
