#version 300 es

layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

out vec3 vNormal;

void main() {
    gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
    // Leva a normal para o espaço do mundo (vale enquanto não houver escala não uniforme;
    // na etapa do Phong vamos usar a matriz normal correta).
    vNormal = mat3(uModel) * aNormal;
}
