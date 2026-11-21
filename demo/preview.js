/* Monta a vista prévia de uma web a partir de um negócio real + um nicho.
   Usa as mesmas classes e o mesmo CSS do layout editorial do gerador
   (preview.css), por isso o que se vê aqui é o desenho verdadeiro do produto.
   O texto é copy neutra de demonstração — no produto real escreve-se a partir
   do que o dono conta. */

window.Preview = (function () {

  var LEMAS = {
    editorial: "de barrio, de siempre",
    confianza: "cuidarte, bien",
    oficio: "trabajo bien hecho"
  };

  var ITENS = {
    editorial: ["Lo de siempre", "Producto de temporada", "Para compartir", "Postre de la casa"],
    confianza: ["Primera consulta", "Seguimiento", "Tratamiento", "Revisión"],
    oficio: ["Instalación", "Reparación", "Mantenimiento", "Urgencias 24 h"]
  };

  var DIAS_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  var DIAS_OSM = ["mo", "tu", "we", "th", "fr", "sa", "su"];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* "Mo-Fr 09:00-18:00; Sa 10:00-14:00" -> [[faixas], ...] por dia (seg..dom) */
  function parseHorario(texto) {
    var saida = [[], [], [], [], [], [], []];
    if (!texto) return null;
    var achou = false;
    texto.split(/[;,]/).forEach(function (bloco) {
      var m = bloco.trim().match(/^([A-Za-z]{2})(?:\s*-\s*([A-Za-z]{2}))?\s+([\d:,\- ]+)$/);
      if (!m) return;
      var ini = m[1].toLowerCase(), fim = (m[2] || m[1]).toLowerCase();
      var i = DIAS_OSM.indexOf(ini), f = DIAS_OSM.indexOf(fim);
      if (i < 0 || f < 0) return;
      var faixas = [], re = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, g;
      while ((g = re.exec(m[3])) !== null) faixas.push([g[1], g[2]]);
      if (!faixas.length) return;
      var dias = i <= f ? DIAS_OSM.slice(i, f + 1) : DIAS_OSM.slice(i).concat(DIAS_OSM.slice(0, f + 1));
      dias.forEach(function (d) {
        saida[DIAS_OSM.indexOf(d)] = saida[DIAS_OSM.indexOf(d)].concat(faixas);
        achou = true;
      });
    });
    return achou ? saida : null;
  }

  function blocoHorario(horario, bruto) {
    if (!horario) {
      if (!bruto) return "";
      return '<p class="horario-bruto">' + esc(bruto) + "</p>";
    }
    var hoje = (new Date().getDay() + 6) % 7;
    var agora = new Date().getHours() * 60 + new Date().getMinutes();
    var linhas = horario.map(function (fx, i) {
      var texto = fx.length ? fx.map(function (p) { return p[0] + " – " + p[1]; }).join(" · ") : "Cerrado";
      var classe = (fx.length ? "abierto" : "cerrado") + (i === hoje ? " hoy" : "");
      return '<li class="' + classe + '"><span class="d">' + DIAS_ES[i] +
             '</span><span class="h">' + texto + "</span></li>";
    }).join("");
    return '<ul class="horario">' + linhas + "</ul>";
  }

  function estadoAberto(horario) {
    if (!horario) return { aberto: false, texto: "Consulta el horario" };
    var idx = (new Date().getDay() + 6) % 7;
    var mins = new Date().getHours() * 60 + new Date().getMinutes();
    function lim(f) {
      function a(t) { var p = t.split(":"); return (+p[0]) * 60 + (+p[1]); }
      var a1 = a(f[0]), b1 = a(f[1]);
      if (b1 <= a1) b1 += 1440;
      return [a1, b1];
    }
    var aberto = false, ate = "";
    horario[idx].forEach(function (f) {
      var l = lim(f);
      if (mins >= l[0] && mins < l[1]) { aberto = true; ate = f[1]; }
    });
    if (!aberto) horario[(idx + 6) % 7].forEach(function (f) {
      var l = lim(f);
      if (mins + 1440 >= l[0] && mins + 1440 < l[1]) { aberto = true; ate = f[1]; }
    });
    return aberto ? { aberto: true, texto: "Abierto · hasta las " + ate }
                  : { aberto: false, texto: "Cerrado ahora" };
  }

  function foto(faixa, rotulo) {
    return '<div class="foto-vazia"><span>' + esc(rotulo) +
           '</span><small>Foto del negocio</small></div>';
  }

  function construir(lead, nicho) {
    var et = nicho.etiquetas || {};
    var plt = nicho.plantilla || "editorial";
    var itens = ITENS[plt] || ITENS.editorial;
    var horario = parseHorario(lead.horario_osm);
    var estado = estadoAberto(horario);
    var tel = lead.telefono || "";
    var telLink = tel.replace(/[^\d+]/g, "");
    var inicial = (lead.nombre || "?").trim().charAt(0).toUpperCase();
    var acento = (nicho.colores || {}).acento || "#8c2f39";

    var lista = itens.map(function (nome, i) {
      return '<li class="plato"><div class="plato-linea"><h4>' + esc(nome) + "</h4>" +
             (i === 0 ? '<span class="etiqueta">La casa</span>' : "") +
             '<span class="puntos"></span></div>' +
             '<p>Descripción de ejemplo. Aquí va lo que te cuente el dueño.</p></li>';
    }).join("");

    return [
      "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>",
      "<meta name='viewport' content='width=device-width, initial-scale=1'>",
      "<title>", esc(lead.nombre), " · ", esc(lead.ciudad || ""), "</title>",
      "<link rel='preconnect' href='https://fonts.googleapis.com'>",
      "<link href='https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Karla:ital,wght@0,300..700;1,400&display=swap' rel='stylesheet'>",
      "<style>:root{",
        "--papel:", esc(nicho.colores.papel), ";--tinta:", esc(nicho.colores.tinta),
        ";--acento:", esc(acento), ";--acento-suave:", esc(nicho.colores["acento-suave"]),
        ";--linha:", esc(nicho.colores.linha), ";--texto-suave:", esc(nicho.colores["texto-suave"]),
        ";--superficie:", esc(nicho.colores.superficie), "}",
        ".foto-vazia{display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "gap:8px;background:", esc(nicho.colores["acento-suave"]), ";aspect-ratio:4/3;",
        "border:1px solid ", esc(nicho.colores.linha), "}",
        ".foto-vazia span{font-family:'Fraunces',Georgia,serif;font-size:clamp(52px,9vw,86px);",
        "color:", esc(acento), ";line-height:1;opacity:.55}",
        ".foto-vazia small{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;",
        "color:", esc(nicho.colores["texto-suave"]), ";font-weight:700}",
        ".portada-foto .foto-vazia{aspect-ratio:3/2}",
        ".casa figure .foto-vazia{aspect-ratio:4/5}",
        ".horario-bruto{font-size:14px;color:", esc(nicho.colores["texto-suave"]), "}",
        ".muestra-venda{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);",
        "background:", esc(nicho.colores.tinta), ";color:", esc(nicho.colores.papel),
        ";font:600 10px/1 'Karla',sans-serif;letter-spacing:.14em;text-transform:uppercase;",
        "padding:8px 14px;opacity:.92;pointer-events:none;z-index:99}",
        "</style>",
      "<link rel='stylesheet' href='preview.css'>",
      "</head><body>",

      "<header class='cab'><div class='cab-in'>",
        "<a class='marca'>", esc(lead.nombre), "</a>",
        "<nav class='nav'>",
          "<a href='#casa'>", esc(et.sobre_titulo || "Quiénes somos"), "</a>",
          "<a href='#carta'>", esc(et.seccion_carta || "Servicios"), "</a>",
          "<a href='#donde'>", esc(et.donde_titulo || "Dónde estamos"), "</a>",
        "</nav>",
        tel ? "<a class='cab-tel'>" + esc(tel) + "</a>" : "",
      "</div></header>",

      "<section class='portada wrap'><div class='portada-grid'><div>",
        "<p class='kicker'>", esc(lead.ciudad || ""), esc(lead.categoria ? " · " + lead.categoria : ""), "</p>",
        "<h1>", esc(lead.nombre), "<br><em>", esc(LEMAS[plt]), "</em></h1>",
        "<p class='entradilla'>En ", esc(lead.direccion || lead.ciudad || "el barrio"),
        ", ", esc(lead.nombre), " atiende a su barrio. Aquí está lo práctico: horario, ",
        "contacto y lo que ofrece. Cambia los textos por los que te cuente el dueño.</p>",
        "<div class='portada-acciones'><a class='boton'>", esc(et.cta || "Contactar"), "</a>",
        tel ? "<a class='enlace'>Llamar · " + esc(tel) + "</a>" : "",
        "</div></div>",
        "<figure class='portada-foto'>", foto("", inicial), "</figure>",
      "</div></section>",

      "<div class='franja'><div class='franja-in'>",
        "<dl class='celda'><dt>Ahora</dt><dd><span class='estado'><span class='punto",
          estado.aberto ? "" : " cerrado", "'></span><span>", esc(estado.texto), "</span></span></dd></dl>",
        "<dl class='celda'><dt>Dónde</dt><dd>", esc(lead.direccion || "—"), "<br>",
          esc(lead.cp || ""), " ", esc(lead.ciudad || ""), "</dd></dl>",
        "<dl class='celda'><dt>Teléfono</dt><dd>", esc(tel || "—"), "</dd></dl>",
      "</div></div>",

      "<section class='seccion wrap' id='casa'><div class='cab-seccion'><span class='num'>01</span>",
        "<h2>", esc(et.sobre_titulo || "Quiénes somos"), "</h2></div>",
        "<div class='casa'><div><p>", esc(lead.nombre), " está en ",
        esc(lead.direccion || ""), ", ", esc(lead.ciudad || ""),
        ". Este párrafo es el sitio donde va la historia del negocio: cuánto lleva abierto, ",
        "quién lo lleva y qué lo hace distinto.</p>",
        "<p>La segunda columna muestra cómo queda el texto largo sin cansar. Con dos o tres ",
        "párrafos escritos de verdad, esta sección es la que convence al dueño de que la web ",
        "es suya.</p></div>",
        "<figure>", foto("", inicial), "</figure></div></section>",

      "<section class='seccion wrap' id='carta'><div class='cab-seccion'><span class='num'>02</span>",
        "<h2>", esc(et.seccion_carta || "Servicios"), "</h2></div>",
        "<div class='categorias'><div class='categoria'>",
        "<h3>", esc(nicho.nombre), "</h3>",
        "<p class='cat-nota'>Los precios y descripciones los pone el dueño.</p>",
        "<ul class='platos'>", lista, "</ul>",
        "</div></div></section>",

      "<section class='seccion wrap' id='donde'><div class='cab-seccion'><span class='num'>03</span>",
        "<h2>", esc(et.donde_titulo || "Dónde estamos"), "</h2></div>",
        "<div class='donde'><div><address><strong>", esc(lead.nombre), "</strong>",
        esc(lead.direccion || ""), "<br>", esc(lead.cp || ""), " ", esc(lead.ciudad || ""),
        "</address>", blocoHorario(horario, lead.horario_osm),
        "<div class='contacto'>", tel ? "<a>" + esc(tel) + "</a>" : "",
        lead.web ? "<a>" + esc(lead.web) + "</a>" : "",
        "<a>Abrir en Google Maps</a></div></div>",
        "<div class='foto-vazia' style='aspect-ratio:4/3'>",
        "<span>", esc(inicial), "</span><small>Mapa del negocio</small></div>",
        "</div></section>",

      "<section class='cierre'><div class='wrap'><h2>Le esperamos.</h2>",
        "<a class='boton'>", esc(et.cta || "Contactar"), "</a></div></section>",

      "<footer class='pie'><div class='wrap pie-in'><div>",
        "<div class='pie-marca'>", esc(lead.nombre), "</div>",
        esc(lead.direccion || ""), " · ", esc(lead.ciudad || ""), "<br>", esc(tel || ""),
        "</div><div><a>Aviso legal</a> · <a>Privacidad</a> · <a>Cookies</a><br>",
        "© 2026 ", esc(lead.nombre), "</div></div></footer>",

      "<div class='muestra-venda'>Muestra · generada en la demo</div>",
      "</body></html>"
    ].join("");
  }

  return { construir: construir, esc: esc };
})();
