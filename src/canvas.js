/**
 * Ajusta o tamanho interno do canvas ao tamanho que ele ocupa na tela
 * (o equivalente de glfw.get_framebuffer_size no código em Python).
 * Devolve false se a área de desenho estiver vazia.
 */
export function ajustarCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const largura = Math.floor(canvas.clientWidth * dpr);
  const altura = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== largura || canvas.height !== altura) {
    canvas.width = largura;
    canvas.height = altura;
  }
  return largura > 0 && altura > 0;
}
