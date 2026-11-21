/* Constrói a pré-visualização do site gerado.
   Recebe o negócio, o nicho e as opções do editor (modelo, secções, cor,
   destino dos botões, textos editados). Devolve HTML com o CSS do layout
   editorial (preview.css) — o mesmo do gerador Python.

   Os textos levam `data-edit="chave"` para o painel os poder tornar editáveis
   a clique, como no editor original. */

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
      var dias = i <= f ? DIAS_OSM.slice(i, f + 1)
                        : DIAS_OSM.slice(i).concat(DIAS_OSM.slice(0, f + 1));
      dias.forEach(function (d) {
        saida[DIAS_OSM.indexOf(d)] = saida[DIAS_OSM.indexOf(d)].concat(faixas);
        achou = true;
      });
    });
    return achou ? saida : null;
  }

  function blocoHorario(horario, bruto) {
    if (!horario) {
      return bruto ? '<p class="horario-bruto">' + esc(bruto) + "</p>" : "";
    }
    var hoje = (new Date().getDay() + 6) % 7;
    var linhas = horario.map(function (fx, i) {
      var texto = fx.length
        ? fx.map(function (p) { return p[0] + " – " + p[1]; }).join(" · ")
        : "Cerrado";
      var classe = (fx.length ? "abierto" : "cerrado") + (i === hoje ? " hoy" : "");
      return '<li class="' + classe + '"><span class="d">' + DIAS_ES[i] +
             '</span><span class="h">' + texto + "</span></li>";
    }).join("");
    return '<ul class="horario">' + linhas + "</ul>";
  }

  function estadoAberto(horario) {
    if (!horario) return {
      aberto: false, texto: "Consulta el horario",
      abertoTexto: "Consulta el horario", cerradoTexto: "Consulta el horario"
    };
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
    return aberto
      ? { aberto: true, texto: "Abierto · hasta las " + ate, abertoTexto: "Abierto · hasta las " + ate }
      : { aberto: false, texto: "Cerrado ahora", cerradoTexto: "Cerrado ahora" };
  }

  /* ------------------------------------------------------------------ */
  function construir(lead, nicho, opt) {
    opt = opt || {};
    var ed = function (k) { return (opt.textos || {})[k]; };
    var txt = function (k, porOmissao) {
      var v = ed(k);
      return v != null && v !== "" ? v : porOmissao;
    };
    var sec = opt.secoes || {};
    var ligada = function (k) { return sec[k] !== false; };

    var et = nicho.etiquetas || {};
    var plt = nicho.plantilla || "editorial";
    var itens = ITENS[plt] || ITENS.editorial;
    var cor = opt.cor || (nicho.colores || {}).acento || "#8c2f39";

    var ciudad = opt.ciudad != null ? opt.ciudad : (lead.ciudad || "");
    var direccion = opt.direccion != null ? opt.direccion : (lead.direccion || "");
    var whatsapp = opt.whatsapp != null ? opt.whatsapp : (lead.telefono || "");
    var horarioTexto = opt.horario != null ? opt.horario : (lead.horario_osm || "");
    var destino = (opt.cta || "").trim();
    var hrefCta = destino || (whatsapp
      ? "https://wa.me/" + whatsapp.replace(/[^\d]/g, "")
      : "#");

    var horario = parseHorario(horarioTexto);
    var estado = estadoAberto(horario);
    var inicial = (lead.nombre || "?").trim().charAt(0).toUpperCase();
    var escuro = opt.modelo === "oscuro";

    // variante escura: o mesmo layout, paleta invertida e tipografia maior
    var cssEscuro = escuro ? [
      "body{background:#0b0e13;color:#f2f5fa}",
      ".cab{background:#0b0e13;border-color:rgba(255,255,255,.10)}",
      ".cab-tel{border-color:" + esc(cor) + "}",
      ".nav a{color:#9aa7bd}.nav a:hover{color:#fff}",
      ".portada h1{color:#fff;letter-spacing:-.04em}",
      ".portada h1 em{color:" + esc(cor) + "}",
      ".entradilla{color:#a8b3c7}",
      ".boton{background:" + esc(cor) + ";border-color:" + esc(cor) + ";color:#0b0e13}",
      ".franja,.celda,.plato,.horario li,.categoria,.lista li{border-color:rgba(255,255,255,.10)}",
      ".celda dt,.kicker,.num{color:" + esc(cor) + "}",
      ".cab-seccion{border-color:rgba(255,255,255,.16)}",
      ".cab-seccion h2,.categoria h3,.resena blockquote{color:#fff}",
      ".plato p,.casa p,.donde address,.horario .d{color:#a8b3c7}",
      ".pie{border-color:rgba(255,255,255,.10);color:#8b98ae}",
      ".foto-vazia{background:#141a24}"
    ].join("") : "";

    // ---------------------------------------------------------------- head
    var out = [
      "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>",
      "<meta name='viewport' content='width=device-width, initial-scale=1'>",
      "<title>", esc(lead.nombre), " · ", esc(ciudad), "</title>",
      "<link rel='preconnect' href='https://fonts.googleapis.com'>",
      "<link href='https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Karla:ital,wght@0,300..800;1,400&display=swap' rel='stylesheet'>",
      "<style>:root{",
        "--papel:", esc(escuro ? "#0b0e13" : nicho.colores.papel), ";",
        "--tinta:", esc(escuro ? "#f2f5fa" : nicho.colores.tinta), ";",
        "--acento:", esc(cor), ";",
        "--acento-suave:", esc(escuro ? "rgba(255,255,255,.08)" : nicho.colores["acento-suave"]), ";",
        "--linha:", esc(escuro ? "rgba(255,255,255,.12)" : nicho.colores.linha), ";",
        "--texto-suave:", esc(escuro ? "#a8b3c7" : nicho.colores["texto-suave"]), ";",
        "--superficie:", esc(escuro ? "#141a24" : nicho.colores.superficie), "}",
        ".foto-vazia{display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "gap:8px;background:", esc(escuro ? "#141a24" : nicho.colores["acento-suave"]), ";",
        "border:1px solid ", esc(escuro ? "rgba(255,255,255,.10)" : nicho.colores.linha), "}",
        ".foto-vazia span{font-family:'Fraunces',Georgia,serif;font-size:clamp(52px,9vw,86px);",
        "color:", esc(cor), ";line-height:1;opacity:.6}",
        ".foto-vazia small{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;",
        "color:", esc(escuro ? "#8b98ae" : nicho.colores["texto-suave"]), ";font-weight:700}",
        ".portada-foto .foto-vazia{aspect-ratio:3/2}",
        ".casa figure .foto-vazia{aspect-ratio:4/5}",
        ".horario-bruto{font-size:14px;color:", esc(nicho.colores["texto-suave"]), "}",
        "[data-edit]{outline:none}",
        "[data-edit]:hover{box-shadow:0 0 0 2px rgba(59,130,246,.45);border-radius:2px}",
        ".muestra-venda{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);",
        "background:#111;color:#fff;font:600 10px/1 'Karla',sans-serif;letter-spacing:.14em;",
        "text-transform:uppercase;padding:8px 14px;opacity:.9;pointer-events:none;z-index:99}",
        "</style>",
      "<link rel='stylesheet' href='preview.css'>",
      // as variantes têm de vir DEPOIS do CSS do layout, senão ele ganha
      cssEscuro ? "<style>" + cssEscuro + "</style>" : "",
      "</head><body>",

      // ------------------------------------------------------------ cabecera
      "<header class='cab'><div class='cab-in'>",
        "<a class='marca' data-edit='nombre'>", esc(lead.nombre), "</a>",
        "<nav class='nav'>",
          ligada("sobre") ? "<a href='#casa' data-edit='et_sobre'>" + esc(et.sobre_titulo || "Quiénes somos") + "</a>" : "",
          ligada("carta") ? "<a href='#carta' data-edit='et_carta'>" + esc(et.seccion_carta || "Servicios") + "</a>" : "",
          ligada("galeria") ? "<a href='#galeria' data-edit='et_galeria'>Galería</a>" : "",
          "<a href='#donde' data-edit='et_donde'>" + esc(et.donde_titulo || "Dónde estamos") + "</a>",
        "</nav>",
        whatsapp ? "<a class='cab-tel'>" + esc(whatsapp) + "</a>" : "",
      "</div></header>",

      // -------------------------------------------------------------- portada
      "<section class='portada wrap'><div class='portada-grid'><div>",
        "<p class='kicker'>", esc(ciudad), "</p>",
        "<h1 data-edit='h1'>", esc(txt("h1", lead.nombre)), "</h1>",
        "<p class='entradilla' data-edit='entradilla'>",
          esc(txt("entradilla", "En " + (direccion || ciudad) + ", " + lead.nombre +
            " atiende a su barrio. Aquí está lo práctico: horario, contacto y lo que ofrece.")),
        "</p>",
        "<div class='portada-acciones'>",
          "<a class='boton' href='", esc(hrefCta), "' data-edit='cta'>",
            esc(et.cta || "Contactar"), "</a>",
          whatsapp ? "<a class='enlace'>Llamar · " + esc(whatsapp) + "</a>" : "",
        "</div></div>",
        "<figure class='portada-foto'>", foto(inicial), "</figure>",
      "</div></section>",

      // --------------------------------------------------------------- franja
      "<div class='franja'><div class='franja-in'>",
        "<dl class='celda'><dt>Ahora</dt><dd><span class='estado'><span class='punto",
          estado.aberto ? "" : " cerrado", "'></span><span>", esc(estado.texto),
          "</span></span></dd></dl>",
        "<dl class='celda'><dt>Dónde</dt><dd>", esc(direccion || "—"), "<br>", esc(ciudad), "</dd></dl>",
        "<dl class='celda'><dt>Teléfono</dt><dd>", esc(whatsapp || "—"), "</dd></dl>",
      "</div></div>",

      // ----------------------------------------------------------------- casa
      ligada("sobre") ? [
        "<section class='seccion wrap' id='casa'><div class='cab-seccion'><span class='num'>01</span>",
          "<h2 data-edit='et_sobre2'>", esc(et.sobre_titulo || "Quiénes somos"), "</h2></div>",
          "<div class='casa'><div>",
          "<p data-edit='sobre1'>", esc(txt("sobre1", lead.nombre + " está en " +
            (direccion || "") + ", " + ciudad + ". Aquí va la historia del negocio: cuánto " +
            "lleva abierto, quién lo lleva y qué lo hace distinto.")), "</p>",
          "<p data-edit='sobre2'>La segunda columna muestra cómo queda el texto largo sin " +
            "cansar. Con dos o tres párrafos escritos de verdad, esta sección es la que " +
            "convence al dueño de que la web es suya.</p>",
          "</div><figure>", foto(inicial), "</figure></div></section>"
      ].join("") : "",

      // ---------------------------------------------------------------- carta
      ligada("carta") ? [
        "<section class='seccion wrap' id='carta'><div class='cab-seccion'><span class='num'>02</span>",
          "<h2 data-edit='et_carta2'>", esc(et.seccion_carta || "Servicios"), "</h2></div>",
          "<div class='categorias'><div class='categoria'>",
          "<h3>", esc(nicho.nombre), "</h3>",
          "<p class='cat-nota'>Los precios y descripciones los pone el dueño.</p>",
          "<ul class='platos'>",
          itens.map(function (nome, i) {
            return "<li class='plato'><div class='plato-linea'><h4>" + esc(nome) + "</h4>" +
              (i === 0 ? "<span class='etiqueta'>La casa</span>" : "") +
              "<span class='puntos'></span></div>" +
              "<p>Descripción de ejemplo. Aquí va lo que te cuente el dueño.</p></li>";
          }).join(""),
          "</ul></div></div></section>"
      ].join("") : "",

      // -------------------------------------------------------------- galeria
      ligada("galeria") ? [
        "<section class='seccion wrap' id='galeria'><div class='cab-seccion'>",
          "<span class='num'>03</span><h2>Galería</h2></div>",
          "<div class='galeria'>",
          [0, 1, 2, 3].map(function () { return "<figure>" + foto(inicial) + "</figure>"; }).join(""),
          "</div></section>"
      ].join("") : "",

      // ---------------------------------------------------------------- donde
      "<section class='seccion wrap' id='donde'><div class='cab-seccion'><span class='num'>04</span>",
        "<h2 data-edit='et_donde2'>", esc(et.donde_titulo || "Dónde estamos"), "</h2></div>",
        "<div class='donde'><div><address><strong>", esc(lead.nombre), "</strong>",
        esc(direccion), "<br>", esc(ciudad), "</address>",
        ligada("horario") ? blocoHorario(horario, horarioTexto) : "",
        "<div class='contacto'>", whatsapp ? "<a>" + esc(whatsapp) + "</a>" : "",
        "<a>Abrir en Google Maps</a></div></div>",
        ligada("mapa")
          ? "<div class='foto-vazia' style='aspect-ratio:4/3'><span>" + esc(inicial) +
            "</span><small>Mapa del negocio</small></div>"
          : "",
        "</div></section>",

      // -------------------------------------------------------------- cierre
      "<section class='cierre'><div class='wrap'>",
        "<h2 data-edit='cierre'>Le esperamos.</h2>",
        "<a class='boton' href='", esc(hrefCta), "'>", esc(et.cta || "Contactar"), "</a>",
      "</div></section>",

      "<footer class='pie'><div class='wrap pie-in'><div>",
        "<div class='pie-marca'>", esc(lead.nombre), "</div>",
        esc(direccion), " · ", esc(ciudad), "<br>", esc(whatsapp),
        "</div><div><a>Aviso legal</a> · <a>Privacidad</a> · <a>Cookies</a><br>",
        "© 2026 ", esc(lead.nombre), "</div></div></footer>",

      "<div class='muestra-venda'>Muestra · generada en la demo</div>",
      "</body></html>"
    ];
    return out.join("");
  }

  function foto(inicial) {
    return "<div class='foto-vazia'><span>" + esc(inicial) +
           "</span><small>Foto del negocio</small></div>";
  }

  return { construir: construir, esc: esc };
})();
