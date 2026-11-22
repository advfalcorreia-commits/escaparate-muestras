/* Constrói a pré-visualização do site gerado.

   Três direções de arte, uma por família de nicho (`nicho.plantilla`):

     editorial  revista impressa — grelha assimétrica, serifa grande, fotos a
                sangrar, muito ar. Restauração, comércio, beleza.
     confianza  prospecto sóbrio — quase centrado, tipografia apertada, escala
                muito contrastada, zero decoração. Clínicas, advocacia.
     oficio     cartaz de obra — condensada enorme, números, blocos sólidos.
                Obras e ofícios.

   Recebe (lead, nicho, opcoes) e devolve uma string HTML completa, como o
   painel espera. Os textos editáveis levam `data-edit="chave"`.

   Sem gradientes coloridos, sem blobs, sem sombras difusas, sem cantos
   arredondados, sem emoji. O que faz parecer de estúdio é tipografia, grelha e
   contenção. */
window.Preview = (function () {
  "use strict";

  /* =================================================================== dados */
  var DIAS_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  var DIAS_OSM = ["mo", "tu", "we", "th", "fr", "sa", "su"];

  var ITENS = {
    editorial: ["Lo de siempre", "Producto de temporada", "Para compartir", "Postre de la casa"],
    confianza: ["Primera consulta", "Seguimiento", "Tratamiento", "Revisión"],
    oficio: ["Instalación", "Reparación", "Mantenimiento", "Reformas"]
  };

  var ROTULOS_GALERIA = {
    editorial: ["Interior", "Detalle", "El equipo", "Ambiente"],
    confianza: ["El espacio", "La consulta", "El equipo", "La sala"],
    oficio: ["El trabajo", "Detalle", "La obra", "El equipo"]
  };

  var FONTES = {
    editorial:
      "<link rel='preconnect' href='https://fonts.googleapis.com'>" +
      "<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>" +
      "<link href='https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..700&family=Karla:ital,wght@0,300..800;1,400&display=swap' rel='stylesheet'>",
    confianza:
      "<link rel='preconnect' href='https://fonts.googleapis.com'>" +
      "<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>" +
      "<link href='https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Instrument+Sans:ital,wght@0,400..700;1,400&display=swap' rel='stylesheet'>",
    oficio:
      "<link rel='preconnect' href='https://fonts.googleapis.com'>" +
      "<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>" +
      "<link href='https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,400..900;1,62..125,400..700&display=swap' rel='stylesheet'>"
  };

  /* ================================================================ básico */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function txtDe(opt) {
    var t = opt.textos || {};
    return function (k, porOmissao) {
      var v = t[k];
      return v != null && v !== "" ? v : porOmissao;
    };
  }

  function numero(n) {                       // 4.6 -> «4,6»; 132 -> «132»
    return String(n).replace(".", ",");
  }

  /* -------------------------------------------------------------- horário */
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
    return aberto
      ? { aberto: true, texto: "Abierto · hasta las " + ate }
      : { aberto: false, texto: "Cerrado ahora" };
  }

  /* ------------------------------------------------------------- materiais */
  function rgb(hex) {
    var h = String(hex || "#888").replace("#", "").trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = "888888";
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function lumin(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function contraste(a, b) {
    var x = lumin(rgb(a)), y = lumin(rgb(b));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function mistura(a, b, t) {
    var A = rgb(a), B = rgb(b);
    return "#" + A.map(function (v, i) {
      return ("0" + Math.round(v + (B[i] - v) * t).toString(16)).slice(-2);
    }).join("");
  }
  /* cor de texto legível sobre um fundo (>= 4,5:1) */
  function legivel(cor, fundo, min) {
    var alvo = lumin(rgb(fundo)) > 0.32 ? "#000000" : "#ffffff";
    var atual = cor, t = 0;
    while (contraste(atual, fundo) < (min || 4.5) && t < 1) {
      t += 0.04;
      atual = mistura(cor, alvo, t);
    }
    return atual;
  }
  /* texto por cima de uma cor sólida (botões, faixas) */
  function sobre(cor) {
    return contraste(cor, "#0b0d10") >= contraste(cor, "#ffffff") ? "#0b0d10" : "#ffffff";
  }

  /* ================================================================ tokens */
  function tokens(nicho, cor, escuro) {
    var n = nicho.colores || {};
    var papel = escuro ? "#0c0e12" : (n.papel || "#faf9f6");
    var tinta = escuro ? "#f2f1ec" : (n.tinta || "#1a1a1c");
    var superficie = escuro ? "#161a20" : (n.superficie || "#f1f0ed");
    var linha = escuro ? "rgba(242,241,236,.15)" : (n.linha || "#dbdad7");
    var acento = cor;
    var suave = escuro ? "#a4acb8" : legivel(n["texto-suave"] || mistura(tinta, papel, 0.45), papel, 4.5);
    var placa = escuro ? "#171c23" : mistura(acento, papel, 0.92);
    return {
      papel: papel,
      tinta: tinta,
      superficie: superficie,
      linha: linha,
      "linha-forte": escuro ? "rgba(242,241,236,.34)" : mistura(tinta, papel, 0.28),
      "texto-suave": suave,
      acento: acento,
      "acento-texto": legivel(acento, papel, 4.5),
      "acento-sobre": sobre(acento),
      "acento-suave": mistura(acento, papel, escuro ? 0.86 : 0.88),
      placa: placa,
      "placa-tinta": escuro ? "#3d4654" : mistura(acento, papel, 0.55),
      "placa-texto": legivel(suave, placa, 4.6),
      "barra-fundo": escuro ? "#07080b" : (n.tinta || "#16161a"),
      "barra-tinta": escuro ? "#f2f1ec" : (n.papel || "#faf9f6")
    };
  }

  function variveis(t) {
    return Object.keys(t).map(function (k) { return "--" + k + ":" + t[k] + ";"; }).join("");
  }

  /* ============================================================ fotografia
     A `<figcaption>` conta o que se vê. Sem `fotos`, debaixo da imagem está
     uma «placa» desenhada — monograma, trama e legenda — que parece impressa
     de propósito, não um buraco. */
  function placa(c, variante, numeroPlaca, rotulo) {
    return "<span class='placa placa-" + c.plantilla + " v" + (variante || 1) + "' aria-hidden='true'>" +
      "<span class='placa-trama'></span>" +
      (numeroPlaca ? "<span class='placa-num'>" + esc(numeroPlaca) + "</span>" : "") +
      "<span class='placa-marca'>" + esc(c.inicial) + "</span>" +
      "<span class='placa-cap'>" + esc(rotulo || "Fotografía del local") + "</span>" +
    "</span>";
  }

  function foto(c) {
    var c2 = c || {};
    var img = c2.src
      ? "<img src='" + esc(c2.src) + "' alt='" + esc(c2.alt || "") + "' loading='" +
        (c2.eager ? "eager" : "lazy") + "' decoding='async' onerror='this.remove()'>"
      : "";
    return "<figure class='foto " + (c2.classe || "") +
      (c2.ratio ? " r-" + c2.ratio : "") + "'>" +
      "<span class='foto-caixa'>" + placa(c, c2.variante, c2.numero, c2.rotulo) + img + "</span>" +
      (c2.legenda ? "<figcaption>" + c2.legenda + "</figcaption>" : "") +
    "</figure>";
  }

  /* legenda: o rótulo do assunto e, quando ainda não há fotografia, o aviso
     discreto de que falta — uma vez por moldura, não repetido em cada bloco */
  function legenda(rotulo, temFoto) {
    return "<span>" + esc(rotulo) + "</span>" +
      (temFoto ? "" : "<span class='credito'>Fotografía pendiente</span>");
  }

  /* o plano desenhado no lugar do mapa: ruas, quarteirões e um alfinete.
     Determinístico pelo nome do negócio — cada casa sai com o seu plano. */
  function plano(c) {
    function semente(s) {
      var h = 2166136261;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }
    var s = semente(c.nombre + "|" + c.ciudad);
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    var L = [], B = [], x, y, i;
    var xs = [], ys = [];
    x = 26 + rnd() * 18;
    while (x < 400) { xs.push(x); x += 30 + rnd() * 34; }
    y = 24 + rnd() * 16;
    while (y < 300) { ys.push(y); y += 26 + rnd() * 32; }
    var vias = "";
    for (i = 0; i < xs.length; i++) {
      vias += "<line x1='" + xs[i].toFixed(1) + "' y1='0' x2='" + xs[i].toFixed(1) + "' y2='320'/>";
    }
    for (i = 0; i < ys.length; i++) {
      vias += "<line x1='0' y1='" + ys[i].toFixed(1) + "' x2='420' y2='" + ys[i].toFixed(1) + "'/>";
    }
    // quarteirões: entre duas ruas, encolhidos
    for (i = 0; i < xs.length - 1; i++) {
      for (var j = 0; j < ys.length - 1; j++) {
        if (rnd() < 0.22) continue;
        var bx = xs[i] + 7, by = ys[j] + 7;
        var bw = xs[i + 1] - xs[i] - 14, bh = ys[j + 1] - ys[j] - 14;
        if (bw < 8 || bh < 8) continue;
        B.push(bx.toFixed(1) + "," + by.toFixed(1) + "," + bw.toFixed(1) + "," + bh.toFixed(1));
      }
    }
    var quadras = B.map(function (b) {
      var p = b.split(",");
      return "<rect x='" + p[0] + "' y='" + p[1] + "' width='" + p[2] + "' height='" + p[3] + "'/>";
    }).join("");
    // uma avenida mais larga, atravessada
    var av = ys[Math.floor(ys.length / 2)] || 160;
    return "<svg class='plano-svg' viewBox='0 0 420 320' role='img' aria-label='Plano de situación de " +
      esc(c.nombre) + ", " + esc(c.ciudad) + "'>" +
      "<rect width='420' height='320' style='fill:var(--papel)'/>" +
      "<g style='fill:var(--acento-suave);stroke:var(--linha);stroke-width:1'>" + quadras + "</g>" +
      "<g style='stroke:var(--papel);stroke-width:11'>" +
        "<line x1='0' y1='" + av.toFixed(1) + "' x2='420' y2='" + av.toFixed(1) + "'/></g>" +
      "<g style='stroke:var(--linha);stroke-width:1'>" +
        "<line x1='0' y1='" + (av - 5.5).toFixed(1) + "' x2='420' y2='" + (av - 5.5).toFixed(1) + "'/>" +
        "<line x1='0' y1='" + (av + 5.5).toFixed(1) + "' x2='420' y2='" + (av + 5.5).toFixed(1) + "'/></g>" +
      // alfinete
      "<g style='stroke:" + c.acento + ";stroke-width:2'>" +
        "<line x1='210' y1='160' x2='210' y2='120'/>" +
        "<rect x='199' y='147' width='22' height='22' transform='rotate(45 210 158)' style='fill:" + c.acento + ";stroke:none'/>" +
      "</g>" +
      "<circle cx='210' cy='158' r='3.2' style='fill:var(--papel)'/>" +
      // norte
      "<g style='stroke:var(--texto-suave);stroke-width:1;fill:var(--texto-suave)'>" +
        "<line x1='392' y1='40' x2='392' y2='18'/>" +
        "<path d='M392 14 L388 22 L396 22 Z'/>" +
      "</g>" +
      "</svg>";
  }

  function listaHorario(horario, bruto, classe) {
    if (!horario) {
      return bruto ? "<p class='horario-bruto'>" + esc(bruto) + "</p>" : "";
    }
    var hoje = (new Date().getDay() + 6) % 7;
    var linhas = horario.map(function (fx, i) {
      var texto = fx.length
        ? fx.map(function (p) { return p[0] + " – " + p[1]; }).join(" · ")
        : "Cerrado";
      return "<li class='" + (fx.length ? "" : "cerrado ") + (i === hoje ? "hoy" : "") + "'>" +
        "<span class='dia'>" + DIAS_ES[i] + "</span>" +
        "<span class='hora'>" + texto + "</span></li>";
    }).join("");
    return "<ul class='horario " + (classe || "") + "'>" + linhas + "</ul>";
  }

  /* ============================================================ contexto */
  function contexto(lead, nicho, opt) {
    var txt = txtDe(opt);
    var sec = opt.secoes || {};
    var ligada = function (k) { return sec[k] !== false; };
    var et = nicho.etiquetas || {};
    var plantilla = nicho.plantilla === "confianza" || nicho.plantilla === "oficio"
      ? nicho.plantilla : "editorial";
    var escuro = opt.modelo === "oscuro";

    var ciudad = opt.ciudad != null ? opt.ciudad : (lead.ciudad || "");
    var direccion = opt.direccion != null ? opt.direccion : (lead.direccion || "");
    var telefono = opt.whatsapp != null ? opt.whatsapp : (lead.telefono || "");
    var horarioTexto = opt.horario != null ? opt.horario : (lead.horario_osm || "");
    var destino = (opt.cta || "").trim();
    var telDigitos = String(telefono || "").replace(/[^\d+]/g, "");
    var hrefCta = destino || (telefono
      ? "https://wa.me/" + String(telefono).replace(/[^\d]/g, "")
      : "#donde");
    var horario = parseHorario(horarioTexto);
    var fotos = Array.isArray(lead.fotos) ? lead.fotos.filter(Boolean) : [];
    var acento = opt.cor || (nicho.colores || {}).acento || "#8c2f39";
    var t = tokens(nicho, acento, escuro);

    return {
      lead: lead, nicho: nicho, opt: opt, txt: txt, ligada: ligada,
      plantilla: plantilla, escuro: escuro, tok: t,
      et: et, ciudad: ciudad, direccion: direccion, telefono: telefono,
      telHref: telDigitos ? "tel:" + telDigitos : "#donde",
      horario: horario, horarioTexto: horarioTexto,
      estado: estadoAberto(horario),
      hrefCta: hrefCta, cta: et.cta || "Contactar",
      nombre: lead.nombre || "", inicial: (lead.nombre || "?").trim().charAt(0).toUpperCase(),
      nota: lead.nota != null && lead.nota > 0 ? numero(lead.nota) : "",
      resenas: lead.resenas ? numero(lead.resenas) : "",
      fotos: fotos, acento: acento,
      itens: ITENS[plantilla], rotulos: ROTULOS_GALERIA[plantilla]
    };
  }

  function alt(c, o) { return (o || "Interior") + " de " + c.nombre + (c.ciudad ? ", " + c.ciudad : ""); }

  /* =================================================================== doc */
  function doc(html) {
    return "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
      html.cab +
      "<link rel='stylesheet' href='preview.css'>" +
      "</head><body class='p-" + html.plantilla + (html.escuro ? " noche" : "") + "'>" +
      "<a class='salto' href='#contenido'>Saltar al contenido</a>" +
      html.corpo +
      "</body></html>";
  }

  function cabFonte(c) {
    var t = c.tok;
    return {
      plantilla: c.plantilla,
      escuro: c.escuro,
      cab: "<title>" + esc(c.nombre) + (c.ciudad ? " · " + esc(c.ciudad) : "") + "</title>" +
        "<meta name='description' content='" + esc(c.nombre + ", " + c.ciudad + ". " + c.cta + ".") + "'>" +
        FONTES[c.plantilla] +
        "<style>:root{" + variveis(t) + "}</style>"
    };
  }

  function nav(c, marca) {
    var out = [];
    if (c.ligada("sobre")) out.push("<a href='#casa' data-edit='et_sobre'>" + esc(c.et.sobre_titulo || "El local") + "</a>");
    if (c.ligada("carta")) out.push("<a href='#carta' data-edit='et_carta'>" + esc(c.et.seccion_carta || "Servicios") + "</a>");
    if (c.ligada("galeria")) out.push("<a href='#galeria' data-edit='et_galeria'>Galería</a>");
    out.push("<a href='#donde' data-edit='et_donde'>" + esc(c.et.donde_titulo || "Dónde estamos") + "</a>");
    return out.join("");
  }

  function celulas(c) {                          // dados práticos, 3 ou 4
    var out = [
      "<div class='cel'><dt>Ahora</dt><dd><span class='estado'>" +
        "<span class='punto" + (c.estado.aberto ? "" : " cerrado") + "' aria-hidden='true'></span>" +
        esc(c.estado.texto) + "</span></dd></div>",
      "<div class='cel'><dt>Dónde</dt><dd>" + esc(c.direccion || "—") +
        (c.ciudad ? "<br>" + esc(c.ciudad) : "") + "</dd></div>",
      "<div class='cel'><dt>Teléfono</dt><dd>" +
        (c.telefono ? "<a href='" + esc(c.telHref) + "'>" + esc(c.telefono) + "</a>" : "—") + "</dd></div>"
    ];
    if (c.nota) out.push("<div class='cel'><dt>Opiniones</dt><dd><span class='nota-num'>" + esc(c.nota) +
      "</span> sobre 5" + (c.resenas ? " · " + esc(c.resenas) + " reseñas" : "") + "</dd></div>");
    return out.join("");
  }

  function linhaEndereco(c) {
    return [c.direccion, c.ciudad].filter(Boolean).map(esc).join(" · ");
  }

  function itensDaCarta(c) {
    return c.itens.map(function (nome, i) {
      return { nome: nome, tag: i === 0 ? "La casa" : "", desc: "Descripción de ejemplo. Aquí va lo que te cuente el dueño." };
    });
  }

  /* A frase de abertura tem de se ler como a escreveria o dono, não como a
     coseria uma máquina com os campos da Google («En Calle Mayor 3. Taberna
     atiende a su barrio: aquí está lo práctico —»). Sem telefone nem avaliação
     enfiados à força: o número já está no botão ao lado. */
  function entradilla(c, estilo) {
    var sitio = String(c.direccion || c.ciudad || "").replace(/[.\s]+$/, "");

    if (estilo === "oficio") {
      return c.nombre + " trabaja en " + (c.ciudad || "la zona") + " y los alrededores. " +
        "Llama o escribe por WhatsApp y te dice cómo resolverlo.";
    }
    if (estilo === "confianza") {
      return c.nombre + " atiende con cita previa" + (sitio ? " en " + sitio : "") + ". " +
        "Puedes pedirla por teléfono o por WhatsApp; aquí tienes el horario y cómo llegar.";
    }
    return c.nombre + (sitio ? " está en " + sitio : "") + ". " +
      "Si vienes, aquí tienes el horario y cómo llegar.";
  }

  /* ============================================================ EDITORIAL */
  function editorial(c) {
    var cab = cabFonte(c);
    var navHtml = nav(c);
    var fotos = c.fotos;

    var portadaFoto = foto({
      plantilla: "editorial", inicial: c.inicial, variante: 1,
      numero: "01", rotulo: "Interior",
      src: fotos[0] || null, alt: alt(c, "Interior"), eager: true,
      legenda: "<span>Interior del local" + (fotos[0] ? "" : " · falta la fotografía") + "</span>" +
        "<span class='credito'>" + esc(c.ciudad) + "</span>"
    });

    var casaSrc = fotos[1] || null;
    var casaFoto = foto({
      plantilla: "editorial", inicial: c.inicial, variante: 3, ratio: "45", rotulo: "El equipo",
      src: casaSrc, alt: alt(c, "El equipo"),
      legenda: legenda("El equipo", !!casaSrc)
    });

    var galeria = [0, 1, 2, 3].map(function (i) {
      var src = fotos[2 + i] || null;
      return foto({
        plantilla: "editorial", inicial: c.inicial, variante: (i % 4) + 1,
        ratio: ["169", "45", "11", "43"][i], classe: "g" + (i + 1),
        numero: "0" + (i + 1), rotulo: c.rotulos[i],
        src: src, alt: alt(c, c.rotulos[i]),
        legenda: "<span data-edit='gal" + (i + 1) + "'>" + esc(c.rotulos[i]) + "</span>" +
          (src ? "" : "<span class='credito'>pendiente</span>")
      });
    }).join("");

    var corpo = [
      "<header class='e-cab'>",
        "<div class='e-cinta'><div class='e-cinta-in'>",
          "<span class='e-cinta-zona'>", esc(c.ciudad || "España"), "</span>",
          "<span class='e-cinta-sep' aria-hidden='true'></span>",
          "<span class='e-cinta-nicho'>", esc(c.nicho.nombre || ""), "</span>",
          "<span class='e-cinta-dir'>", esc(c.direccion), "</span>",
        "</div></div>",
        "<div class='e-cab-in'>",
          "<a class='e-marca' href='#contenido' data-edit='nombre'>", esc(c.nombre), "</a>",
          "<nav class='e-nav' aria-label='Secciones'>", navHtml, "</nav>",
          c.telefono ? "<a class='e-tel' href='" + esc(c.telHref) + "'>" + esc(c.telefono) + "</a>" : "",
        "</div>",
      "</header>",

      "<main id='contenido'>",

      "<section class='e-portada'>",
        "<div class='e-portada-txt'>",
          "<p class='e-kicker'><span>", esc(c.ciudad), "</span>", c.nota
            ? " <span class='e-kicker-nota'>· " + esc(c.nota) + " sobre 5" +
              (c.resenas ? " (" + esc(c.resenas) + ")" : "") + "</span>" : "", "</p>",
          "<h1 data-edit='h1'>", esc(c.txt("h1", c.nombre)), "</h1>",
          "<p class='e-entradilla' data-edit='entradilla'>",
            esc(c.txt("entradilla", entradilla(c, "editorial"))),
          "</p>",
          "<div class='e-acciones'>",
            "<a class='e-boton' href='", esc(c.hrefCta), "' data-edit='cta'>", esc(c.cta), "</a>",
            c.telefono ? "<a class='e-enlace' href='" + esc(c.telHref) + "'>Llamar · " + esc(c.telefono) + "</a>" : "",
          "</div>",
        "</div>",
        "<div class='e-portada-foto'>", portadaFoto, "</div>",
      "</section>",

      "<div class='e-franja'><div class='e-franja-in'>", celulas(c), "</div></div>",

      c.ligada("sobre") ? [
        "<section class='e-sec wrap' id='casa'>",
          "<div class='e-cab-sec'><span class='e-num'>01</span>",
            "<h2 data-edit='et_sobre2'>", esc(c.et.sobre_titulo || "El local"), "</h2>",
            "<span class='e-sec-nota'>Texto de ejemplo</span></div>",
          "<div class='e-casa'>",
            "<div class='e-casa-txt'>",
              "<p class='e-lede' data-edit='sobre1'>", esc(c.txt("sobre1",
                c.nombre + " está en " + (c.direccion || c.ciudad) + ". Aquí va la historia del " +
                "negocio: cuánto lleva abierto, quién lo lleva y qué lo hace distinto del de al lado.")),
              "</p>",
              "<p data-edit='sobre2'>", esc(c.txt("sobre2",
                "Dos o tres párrafos escritos de verdad pesan más que cualquier adorno. Cuando el " +
                "dueño pone aquí sus palabras, la web deja de ser una plantilla y pasa a ser suya.")),
              "</p>",
            "</div>",
            "<div class='e-casa-foto'>", casaFoto, "</div>",
          "</div>",
        "</section>"
      ].join("") : "",

      c.ligada("carta") ? [
        "<section class='e-sec wrap' id='carta'>",
          "<div class='e-cab-sec'><span class='e-num'>02</span>",
            "<h2 data-edit='et_carta2'>", esc(c.et.seccion_carta || "Servicios"), "</h2>",
            "<span class='e-sec-nota'>", esc(c.nicho.nombre || ""), "</span></div>",
          "<ul class='e-platos'>",
            itensDaCarta(c).map(function (it, i) {
              return "<li class='e-plato'><div class='e-plato-cab'>" +
                "<h3 data-edit='item" + (i + 1) + "'>" + esc(it.nome) + "</h3>" +
                "<span class='e-puntos' aria-hidden='true'></span>" +
                (it.tag ? "<span class='e-tag'>" + esc(it.tag) + "</span>" : "") +
                "</div><p>" + esc(it.desc) + "</p></li>";
            }).join(""),
          "</ul>",
          "<p class='e-nota-pie'>Los precios y las descripciones los pone el dueño: aquí se ve el sitio que ocupan, no un texto inventado.</p>",
        "</section>"
      ].join("") : "",

      c.ligada("galeria") ? [
        "<section class='e-sec wrap' id='galeria'>",
          "<div class='e-cab-sec'><span class='e-num'>03</span><h2>Galería</h2>",
            "<span class='e-sec-nota'>", fotos.length > 2
              ? esc((fotos.length - 2) + ((fotos.length - 2) === 1 ? " fotografía" : " fotografías"))
              : "Sin fotografías todavía", "</span></div>",
          "<div class='e-galeria'>", galeria, "</div>",
        "</section>"
      ].join("") : "",

      "<section class='e-sec wrap' id='donde'>",
        "<div class='e-cab-sec'><span class='e-num'>04</span>",
          "<h2 data-edit='et_donde2'>", esc(c.et.donde_titulo || "Dónde estamos"), "</h2></div>",
        "<div class='e-donde'>",
          "<div class='e-donde-txt'>",
            "<address data-edit='direccion'>",
              "<strong>", esc(c.nombre), "</strong>",
              esc(c.direccion), (c.direccion ? "<br>" : ""), esc(c.ciudad),
            "</address>",
            c.ligada("horario") ? "<div class='e-horario'>" + listaHorario(c.horario, c.horarioTexto) + "</div>" : "",
            "<div class='e-contacto'>",
              c.telefono ? "<a href='" + esc(c.telHref) + "'>" + esc(c.telefono) + "</a>" : "",
              "<a href='https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent((c.nombre + " " + c.direccion + " " + c.ciudad).trim()) +
                "' target='_blank' rel='noopener'>Abrir en Google Maps</a>",
            "</div>",
          "</div>",
          c.ligada("mapa") ? "<figure class='e-mapa'>" + plano(c) +
            "<figcaption>Plano de situación · " + esc(c.ciudad) + "</figcaption></figure>" : "",
        "</div>",
      "</section>",

      "<section class='e-cierre'>",
        "<div class='wrap e-cierre-in'>",
          "<p class='e-cierre-kicker'>", esc(c.ciudad), "</p>",
          "<h2 data-edit='cierre'>", esc(c.txt("cierre", "Le esperamos.")), "</h2>",
          "<a class='e-boton' href='", esc(c.hrefCta), "'>", esc(c.cta), "</a>",
        "</div>",
      "</section>",

      "</main>",

      "<footer class='e-pie'><div class='wrap e-pie-in'>",
        "<div><p class='e-pie-marca'>", esc(c.nombre), "</p>",
          linhaEndereco(c), c.telefono ? "<br>" + esc(c.telefono) : "", "</div>",
        "<div class='e-pie-liga'><a href='#'>Aviso legal</a> · <a href='#'>Privacidad</a> · <a href='#'>Cookies</a></div>",
        "<div class='e-pie-ano'>© 2026 ", esc(c.nombre), "</div>",
      "</div></footer>",

      "<div class='muestra-venda'>Muestra · generada en la demo</div>"
    ].join("");

    return { plantilla: cab.plantilla, escuro: cab.escuro, cab: cab.cab, corpo: corpo };
  }

  /* ============================================================= CONFIanza */
  function confianza(c) {
    var cab = cabFonte(c);
    var fotos = c.fotos;

    var portadaFoto = foto({
      plantilla: "confianza", inicial: c.inicial, variante: 1, rotulo: "El espacio",
      src: fotos[0] || null, alt: alt(c, "El espacio"), eager: true,
      legenda: "<span>El espacio" + (fotos[0] ? "" : " · fotografía pendiente") + "</span>"
    });
    var casaFoto = foto({
      plantilla: "confianza", inicial: c.inicial, variante: 2, ratio: "43", rotulo: "El equipo",
      src: fotos[1] || null, alt: alt(c, "El equipo"),
      legenda: legenda("El equipo", !!fotos[1])
    });
    var casaFoto2 = foto({
      plantilla: "confianza", inicial: c.inicial, variante: 4, ratio: "43", rotulo: "La consulta",
      src: fotos[2] || null, alt: alt(c, "La consulta"),
      legenda: legenda("La consulta", !!fotos[2])
    });

    var galeria = [0, 1, 2].map(function (i) {
      var src = fotos[3 + i] || null;
      return foto({
        plantilla: "confianza", inicial: c.inicial, variante: (i % 3) + 1, ratio: "45",
        rotulo: c.rotulos[i],
        src: src, alt: alt(c, c.rotulos[i]),
        legenda: "<span data-edit='gal" + (i + 1) + "'>" + esc(c.rotulos[i]) + "</span>" +
          (src ? "" : "<span class='credito'>pendiente</span>")
      });
    }).join("");

    var pratica = itensDaCarta(c);

    var corpo = [
      "<header class='c-cab'>",
        "<div class='c-cab-in'>",
          "<a class='c-marca' href='#contenido' data-edit='nombre'>", esc(c.nombre), "</a>",
          "<nav class='c-nav' aria-label='Secciones'>", nav(c), "</nav>",
          c.telefono ? "<a class='c-tel' href='" + esc(c.telHref) + "'>" + esc(c.telefono) + "</a>" : "",
        "</div>",
      "</header>",

      "<main id='contenido'>",

      "<section class='c-portada'>",
        "<div class='c-portada-txt wrap'>",
          "<p class='c-kicker'><span class='c-regra' aria-hidden='true'></span>",
            esc(c.ciudad), " · ", esc(c.nicho.nombre || ""),
            "<span class='c-regra' aria-hidden='true'></span></p>",
          "<h1 data-edit='h1'>", esc(c.txt("h1", c.nombre)), "</h1>",
          "<p class='c-entradilla' data-edit='entradilla'>",
            esc(c.txt("entradilla", entradilla(c, "confianza"))),
          "</p>",
          "<div class='c-acciones'>",
            "<a class='c-boton' href='", esc(c.hrefCta), "' data-edit='cta'>", esc(c.cta), "</a>",
            c.telefono ? "<a class='c-enlace' href='" + esc(c.telHref) + "'>o llame al " + esc(c.telefono) + "</a>" : "",
          "</div>",
        "</div>",
        "<div class='c-portada-foto'>", portadaFoto, "</div>",
      "</section>",

      "<div class='c-franja'><div class='c-franja-in wrap'>", celulas(c), "</div></div>",

      c.ligada("sobre") ? [
        "<section class='c-sec' id='casa'>",
          "<div class='c-sec-in'>",
            "<p class='c-rotulo'>", esc(c.et.sobre_titulo || "Quiénes somos"), "</p>",
            "<p class='c-lede' data-edit='sobre1'>", esc(c.txt("sobre1",
              c.nombre + " está en " + (c.direccion || c.ciudad) + ". Aquí va, en dos o tres " +
              "frases, quién atiende, cuánto lleva abierto y con qué criterio trabaja.")),
            "</p>",
            "<p class='c-parrafo' data-edit='sobre2'>", esc(c.txt("sobre2",
              "Un párrafo largo se lee mejor en columna estrecha y con la línea bien medida. " +
              "Esta sección es la que convence al dueño de que la web es suya.")),
            "</p>",
            "<div class='c-fotos'>", casaFoto, casaFoto2, "</div>",
            "<p class='c-demo'>Texto de ejemplo · lo escribe el dueño.</p>",
          "</div>",
        "</section>"
      ].join("") : "",

      c.ligada("carta") ? [
        "<section class='c-sec c-sec-lista' id='carta'>",
          "<div class='c-sec-in'>",
            "<p class='c-rotulo'>", esc(c.nicho.nombre || "Servicios"), "</p>",
            "<h2 class='c-h2' data-edit='et_carta2'>", esc(c.et.seccion_carta || "Servicios"), "</h2>",
            "<ol class='c-praticas'>",
              pratica.map(function (it, i) {
                return "<li class='c-pratica'><span class='c-pnum'>0" + (i + 1) + "</span>" +
                  "<span class='c-pnome' data-edit='item" + (i + 1) + "'>" + esc(it.nome) + "</span>" +
                  "<span class='c-pdesc'>" + esc(it.desc) + "</span></li>";
              }).join(""),
            "</ol>",
            "<p class='c-demo'>Los precios y las descripciones los pone el dueño.</p>",
          "</div>",
        "</section>"
      ].join("") : "",

      c.ligada("galeria") ? [
        "<section class='c-sec' id='galeria'>",
          "<div class='c-sec-in'>",
            "<p class='c-rotulo'>Galería</p>",
            "<h2 class='c-h2'>El espacio</h2>",
            "<div class='c-galeria'>", galeria, "</div>",
          "</div>",
        "</section>"
      ].join("") : "",

      "<section class='c-sec' id='donde'>",
        "<div class='c-sec-in'>",
          "<p class='c-rotulo'>", esc(c.et.donde_titulo || "Dónde estamos"), "</p>",
          "<div class='c-donde'>",
            "<div>",
              "<address data-edit='direccion'><strong>", esc(c.nombre), "</strong>",
                esc(c.direccion), (c.direccion ? "<br>" : ""), esc(c.ciudad), "</address>",
              c.ligada("horario") ? listaHorario(c.horario, c.horarioTexto, "c-horario") : "",
              "<div class='c-contacto'>",
                c.telefono ? "<a href='" + esc(c.telHref) + "'>" + esc(c.telefono) + "</a>" : "",
                "<a href='https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent((c.nombre + " " + c.direccion + " " + c.ciudad).trim()) +
                  "' target='_blank' rel='noopener'>Cómo llegar</a>",
              "</div>",
            "</div>",
            c.ligada("mapa") ? "<figure class='c-mapa'>" + plano(c) +
              "<figcaption>Plano de situación</figcaption></figure>" : "",
          "</div>",
        "</div>",
      "</section>",

      "<section class='c-cierre'>",
        "<div class='wrap'>",
          "<p class='c-rotulo'>", esc(c.ciudad), "</p>",
          "<h2 data-edit='cierre'>", esc(c.txt("cierre", "Pida su cita.")), "</h2>",
          "<a class='c-boton' href='", esc(c.hrefCta), "'>", esc(c.cta), "</a>",
        "</div>",
      "</section>",

      "</main>",

      "<footer class='c-pie'><div class='wrap c-pie-in'>",
        "<div><p class='c-pie-marca'>", esc(c.nombre), "</p>",
          linhaEndereco(c), c.telefono ? "<br>" + esc(c.telefono) : "", "</div>",
        "<div class='c-pie-liga'><a href='#'>Aviso legal</a><a href='#'>Privacidad</a><a href='#'>Cookies</a></div>",
        "<div class='c-pie-ano'>© 2026 ", esc(c.nombre), "</div>",
      "</div></footer>",

      "<div class='muestra-venda'>Muestra · generada en la demo</div>"
    ].join("");

    return { plantilla: cab.plantilla, escuro: cab.escuro, cab: cab.cab, corpo: corpo };
  }

  /* ================================================================ OFICIO */
  function oficio(c) {
    var cab = cabFonte(c);
    var fotos = c.fotos;

    var portadaFoto = foto({
      plantilla: "oficio", inicial: c.inicial, variante: 1, rotulo: "El trabajo",
      src: fotos[0] || null, alt: alt(c, "El trabajo"), eager: true
    });
    var casaFoto = foto({
      plantilla: "oficio", inicial: c.inicial, variante: 2, ratio: "45", rotulo: "El equipo",
      src: fotos[1] || null, alt: alt(c, "El equipo"),
      legenda: legenda("El equipo", !!fotos[1])
    });
    var galeria = [0, 1, 2, 3].map(function (i) {
      var src = fotos[2 + i] || null;
      return foto({
        plantilla: "oficio", inicial: c.inicial, variante: (i % 4) + 1, ratio: "11",
        rotulo: c.rotulos[i],
        src: src, alt: alt(c, c.rotulos[i]),
        legenda: "<span data-edit='gal" + (i + 1) + "'>" + esc(c.rotulos[i]) + "</span>"
      });
    }).join("");

    var passos = [
      ["01", "Presupuesto", "Visita y número cerrado antes de empezar."],
      ["02", "Ejecución", "Plazos dichos en la primera visita se cumplen."],
      ["03", "Entrega", "Se limpia y se revisa con el cliente delante."]
    ];

    var servicos = itensDaCarta(c);

    var corpo = [
      "<header class='o-cab'>",
        "<div class='o-cab-in'>",
          "<a class='o-marca' href='#contenido' data-edit='nombre'>", esc(c.nombre), "</a>",
          "<nav class='o-nav' aria-label='Secciones'>", nav(c), "</nav>",
          c.telefono ? "<a class='o-tel' href='" + esc(c.telHref) + "'>" + esc(c.telefono) + "</a>" : "",
        "</div>",
      "</header>",

      "<main id='contenido'>",

      "<section class='o-portada'>",
        "<div class='wrap'>",
          "<p class='o-kicker'><span class='o-kicker-zona'>", esc(c.ciudad), "</span>",
            "<span class='o-kicker-nicho'>", esc(c.nicho.nombre || ""), "</span></p>",
          "<h1 data-edit='h1'>", esc(c.txt("h1", c.nombre)), "</h1>",
          "<div class='o-portada-pie'>",
            "<p class='o-entradilla' data-edit='entradilla'>",
              esc(c.txt("entradilla", entradilla(c, "oficio"))),
            "</p>",
            "<div class='o-acciones'>",
              "<a class='o-boton' href='", esc(c.hrefCta), "' data-edit='cta'>", esc(c.cta), "</a>",
            "</div>",
          "</div>",
        "</div>",
        "<div class='o-portada-foto'>", portadaFoto,
          "<span class='o-selo' aria-hidden='true'>", esc(c.ciudad), "</span></div>",
      "</section>",

      "<div class='o-passos'><div class='o-passos-in wrap'>",
        passos.map(function (p) {
          return "<div class='o-passo'><span class='o-passo-num'>" + p[0] + "</span>" +
            "<span class='o-passo-nome'>" + p[1] + "</span>" +
            "<span class='o-passo-desc'>" + p[2] + "</span></div>";
        }).join(""),
      "</div></div>",

      "<div class='o-franja'><div class='o-franja-in wrap'>", celulas(c), "</div></div>",

      c.ligada("sobre") ? [
        "<section class='o-sec wrap' id='casa'>",
          "<div class='o-sec-cab'><h2 data-edit='et_sobre2'>", esc(c.et.sobre_titulo || "Quiénes somos"), "</h2>",
            "<span class='o-sec-num'>A</span></div>",
          "<div class='o-casa'>",
            "<div class='o-casa-foto'>", casaFoto, "</div>",
            "<div class='o-casa-txt'>",
              "<p class='o-lede' data-edit='sobre1'>", esc(c.txt("sobre1",
                c.nombre + " está en " + (c.direccion || c.ciudad) + ". Aquí va quién lo lleva, " +
                "cuántos años lleva trabajando y qué tipo de encargos acepta.")),
              "</p>",
              "<p data-edit='sobre2'>", esc(c.txt("sobre2",
                "Con dos o tres frases de verdad, esta columna basta. Lo que no va aquí es " +
                "«soluciones integrales para su hogar»: eso lo dice todo el mundo.")),
              "</p>",
              "<ul class='o-selos'>",
                "<li>Presupuesto por escrito</li>",
                "<li>Oficio con factura</li>",
                "<li>Se trabaja en la zona</li>",
              "</ul>",
            "</div>",
          "</div>",
        "</section>"
      ].join("") : "",

      c.ligada("carta") ? [
        "<section class='o-sec o-sec-servicos' id='carta'>",
          "<div class='wrap'>",
            "<div class='o-sec-cab'><h2 data-edit='et_carta2'>", esc(c.et.seccion_carta || "Servicios"), "</h2>",
              "<span class='o-sec-num'>B</span></div>",
            "<div class='o-servicos'>",
              servicos.map(function (it, i) {
                return "<div class='o-servico'><span class='o-servico-num'>0" + (i + 1) + "</span>" +
                  "<h3 data-edit='item" + (i + 1) + "'>" + esc(it.nome) + "</h3>" +
                  "<p>" + esc(it.desc) + "</p></div>";
              }).join(""),
            "</div>",
            "<p class='o-demo'>Los precios y el detalle los pone el dueño.</p>",
          "</div>",
        "</section>"
      ].join("") : "",

      c.ligada("galeria") ? [
        "<section class='o-sec' id='galeria'>",
          "<div class='wrap'>",
            "<div class='o-sec-cab'><h2>Galería</h2><span class='o-sec-num'>C</span></div>",
            "<div class='o-galeria'>", galeria, "</div>",
          "</div>",
        "</section>"
      ].join("") : "",

      "<section class='o-sec' id='donde'>",
        "<div class='wrap'>",
          "<div class='o-sec-cab'><h2 data-edit='et_donde2'>", esc(c.et.donde_titulo || "Dónde estamos"), "</h2>",
            "<span class='o-sec-num'>D</span></div>",
          "<div class='o-donde'>",
            "<div class='o-donde-txt'>",
              "<address data-edit='direccion'><strong>", esc(c.nombre), "</strong>",
                esc(c.direccion), (c.direccion ? "<br>" : ""), esc(c.ciudad), "</address>",
              c.ligada("horario") ? listaHorario(c.horario, c.horarioTexto, "o-horario") : "",
              "<div class='o-contacto'>",
                c.telefono ? "<a href='" + esc(c.telHref) + "'>" + esc(c.telefono) + "</a>" : "",
                "<a href='https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent((c.nombre + " " + c.direccion + " " + c.ciudad).trim()) +
                  "' target='_blank' rel='noopener'>Cómo llegar</a>",
              "</div>",
            "</div>",
            c.ligada("mapa") ? "<figure class='o-mapa'>" + plano(c) +
              "<figcaption>zona de trabajo · " + esc(c.ciudad) + "</figcaption></figure>" : "",
          "</div>",
        "</div>",
      "</section>",

      "<section class='o-cierre'>",
        "<div class='wrap o-cierre-in'>",
          "<h2 data-edit='cierre'>", esc(c.txt("cierre", "Hablemos de su obra.")), "</h2>",
          "<a class='o-boton o-boton-claro' href='", esc(c.hrefCta), "'>", esc(c.cta), "</a>",
        "</div>",
      "</section>",

      "</main>",

      "<footer class='o-pie'><div class='wrap o-pie-in'>",
        "<div><p class='o-pie-marca'>", esc(c.nombre), "</p>",
          linhaEndereco(c), c.telefono ? "<br>" + esc(c.telefono) : "", "</div>",
        "<div class='o-pie-liga'><a href='#'>Aviso legal</a><a href='#'>Privacidad</a><a href='#'>Cookies</a></div>",
        "<div class='o-pie-ano'>© 2026 ", esc(c.nombre), "</div>",
      "</div></footer>",

      "<div class='muestra-venda'>Muestra · generada en la demo</div>"
    ].join("");

    return { plantilla: cab.plantilla, escuro: cab.escuro, cab: cab.cab, corpo: corpo };
  }

  /* ================================================================ público */
  var RENDER = { editorial: editorial, confianza: confianza, oficio: oficio };

  function construir(lead, nicho, opcoes) {
    lead = lead || {}; nicho = nicho || {}; opcoes = opcoes || {};
    var c = contexto(lead, nicho, opcoes);
    var r = (RENDER[c.plantilla] || editorial)(c);
    return doc(r);
  }

  return { construir: construir, esc: esc };
})();
