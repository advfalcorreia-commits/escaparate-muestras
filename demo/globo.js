/* Globo de pontos desenhado em canvas — o que no SitesLead é um modelo 3D do
   Spline, aqui são ~1400 pontos projetados à mão. Sem bibliotecas, sem textura,
   sem ficheiro de modelo: 3 KB de JavaScript e roda a 60 fps.

   Uso:
     Globo.montar(canvas)
     Globo.marcar(40.4168, -3.7038)   // desenha o pino na cidade
     Globo.parar()                    // liberta o requestAnimationFrame
*/

window.Globo = (function () {
  "use strict";

  var PONTOS = null;
  var canvas = null, ctx = null, raf = null;
  var rot = 0.6, alvo = null, larg = 300, alt = 300, dpr = 1;

  // as cores do painel (painel.css): tinta, régua e óxido
  var TINTA = "27,25,22";
  var REGUA = "180,172,155";
  var ACENTO = "156,58,26";

  function gerarPontos(n) {
    // espiral de Fibonacci: distribuição uniforme na esfera
    var pts = [], inc = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var t = inc * i;
      pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);   // x, y (=sen lat), z
    }
    return pts;
  }

  function projetar(p, rot) {
    var cos = Math.cos(rot), sin = Math.sin(rot);
    var x = p[0] * cos - p[2] * sin;
    var z = p[0] * sin + p[2] * cos;
    return [x, p[1], z];
  }

  function desenhar() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, larg, alt);

    var cx = larg / 2, cy = alt / 2, raio = Math.min(larg, alt) * 0.40;

    // Sem halo, sem brilho, sem desfoque: um halo luminoso atrás de uma esfera
    // de pontos é a assinatura visual de um render de IA. Aqui desenha-se como
    // se desenhava à mão — aro, equador e pontos de tinta.
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(" + REGUA + ",.9)";
    ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.stroke();

    // equador: a única pista de que aquilo é uma esfera e não um disco
    ctx.strokeStyle = "rgba(" + REGUA + ",.5)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, raio, raio * 0.30, 0, 0, Math.PI * 2);
    ctx.stroke();

    // pontos da esfera
    for (var i = 0; i < PONTOS.length; i++) {
      var q = projetar(PONTOS[i], rot);
      if (q[2] <= 0) continue;                       // meia esfera de trás
      var x = cx + q[0] * raio;
      var y = cy - q[1] * raio;
      var a = 0.06 + q[2] * 0.42;                    // mais opaco à frente
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + q[2] * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + TINTA + "," + a.toFixed(3) + ")";
      ctx.fill();
    }

    // pino da cidade escolhida
    if (alvo) {
      var lat = alvo[0] * Math.PI / 180, lon = alvo[1] * Math.PI / 180;
      var p3 = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
      var pp = projetar(p3, rot);
      if (pp[2] > 0) {
        var px = cx + pp[0] * raio, py = cy - pp[1] * raio;
        // um círculo fino e um ponto cheio: marca-se, não se ilumina
        ctx.strokeStyle = "rgba(" + ACENTO + ",.38)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgb(" + ACENTO + ")"; ctx.fill();
      }
    }
  }

  function ciclo() {
    rot += 0.0028;
    desenhar();
    raf = requestAnimationFrame(ciclo);
  }

  function medir() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    larg = Math.max(120, r.width);
    alt = Math.max(120, r.height);
    canvas.width = larg * dpr;
    canvas.height = alt * dpr;
    canvas.style.width = larg + "px";
    canvas.style.height = alt + "px";
    desenhar();
  }

  function montar(el) {
    if (!el || !el.getContext) return;
    canvas = el;
    ctx = canvas.getContext("2d");
    if (!PONTOS) PONTOS = gerarPontos(1400);
    medir();
    // remove o listener anterior: o mesmo módulo serve o modal e o scanner
    window.removeEventListener("resize", medir);
    window.addEventListener("resize", medir);
    if (!raf) ciclo();
  }

  function marcar(lat, lon) {
    alvo = (lat == null || lon == null) ? null : [lat, lon];
    desenhar();
  }

  function parar() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  return { montar: montar, marcar: marcar, parar: parar };
})();
