/* Painel: dashboard -> nova busca (3 passos) -> resultados -> gerando ->
   editor (modelo, secções, cor, botões, contacto, edição a clique) -> domínio
   -> venda. Tudo no browser; estado em localStorage. */

(function () {
  "use strict";

  var CHAVE = "escaparate_demo_v3";
  var estado = carregar();
  var wiz = { pais: null, ciudad: null, nicho: null };
  var ed = null;
  var timerGerando = null;

  var CORES = ["#8c2f39", "#b45309", "#0f766e", "#1d4ed8", "#7c3aed",
               "#be123c", "#15803d", "#0e7490", "#4d7c0f", "#0f172a"];

  var SVG = {
    tel: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.6.6 4 .6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.4.2 2.8.6 4 .1.4 0 .8-.2 1.1l-2.3 2.7z"/></svg>',
    wsp: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.5-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 01-1.9-1.2 7.2 7.2 0 01-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4L10.5 7c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.7 2.7 4.2 3.7 1.5.6 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1z"/></svg>',
    web: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18a15 15 0 010-18"/></svg>'
  };

  // ------------------------------------------------------------- utilidades
  function $(s) { return document.querySelector(s); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function carregar() {
    try {
      var d = JSON.parse(localStorage.getItem(CHAVE) || "{}");
      return { usuario: d.usuario || null, webs: d.webs || [], recentes: d.recentes || [] };
    } catch (e) { return { usuario: null, webs: [], recentes: [] }; }
  }
  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {}
  }
  function esc(s) { return Preview.esc(s); }
  function slugificar(s) {
    return String(s || "").toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "").slice(0, 40);
  }

  var brindeT;
  function brinde(msg) {
    var b = $("#brinde");
    b.textContent = msg;
    b.classList.add("visivel");
    clearTimeout(brindeT);
    brindeT = setTimeout(function () { b.classList.remove("visivel"); }, 3400);
  }

  var VISTAS = ["entrar", "dashboard", "buscar", "resultados", "gerando",
                "gerar", "dominio", "painel"];
  var COM_DOCK = ["dashboard", "buscar", "resultados", "painel"];

  function mostrar(v) {
    VISTAS.forEach(function (x) {
      var n = document.getElementById("v-" + x);
      if (n) n.classList.toggle("ativa", x === v);
    });
    var logado = !!estado.usuario;
    $("#usuario-topo").textContent = logado ? estado.usuario.nombre : "";
    var av = $("#avatar");
    av.hidden = !logado;
    if (logado) av.textContent = estado.usuario.nombre.charAt(0);
    $("#btn-sair").hidden = !logado;
    $("#dock").hidden = !(logado && COM_DOCK.indexOf(v) >= 0);
    document.querySelectorAll(".dock button[data-ir]").forEach(function (b) {
      b.classList.toggle("ativo", b.getAttribute("data-ir") === v);
    });
    if (v === "dashboard") renderDashboard();
    if (v === "painel") renderPainel();
    if (v === "buscar") montarGlobo();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ entrar
  $("#form-entrar").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, nome = (f.nombre.value || "").trim(), mail = (f.email.value || "").trim();
    if (!nome || !mail) return;
    estado.usuario = { nombre: nome, email: mail };
    gravar(); mostrar("dashboard");
    brinde("Hola, " + nome + ". Pulsa «Buscar» para empezar.");
  });
  $("#btn-sair").addEventListener("click", function () {
    estado.usuario = null; gravar(); mostrar("entrar");
  });
  $("#ir-inicio").addEventListener("click", function (e) {
    e.preventDefault(); mostrar(estado.usuario ? "dashboard" : "entrar");
  });
  document.querySelectorAll(".dock button[data-ir]").forEach(function (b) {
    b.addEventListener("click", function () {
      var ir = b.getAttribute("data-ir");
      if (ir === "buscar") { wiz = { pais: null, ciudad: null, nicho: null }; abrirPasso(1); }
      mostrar(ir);
    });
  });
  $("#dock-avatar").addEventListener("click", function () { mostrar("painel"); });

  // --------------------------------------------------------------- dashboard
  function renderDashboard() {
    var webs = estado.webs;
    var vendidas = webs.filter(function (w) { return w.vendida; });
    var factura = vendidas.reduce(function (s, w) { return s + (Number(w.precio) || 0); }, 0);
    var taxa = webs.length ? Math.round(vendidas.length / webs.length * 100) : 0;

    $("#k-factura").textContent = factura.toLocaleString("es-ES") + " €";
    $("#k-geradas").textContent = webs.length;
    $("#k-vendidas").textContent = vendidas.length;
    $("#k-conversao").textContent = taxa + " % de conversión";
    $("#d-vendida").textContent = vendidas.length;
    $("#d-publicada").textContent = webs.length - vendidas.length;
    $("#d-borrador").textContent = 0;

    var cid = {}, nic = {}, tot = 0;
    Object.keys(window.LEADS || {}).forEach(function (k) {
      var d = window.LEADS[k];
      cid[d.ciudad] = 1; nic[d.nicho] = 1; tot += d.leads.length;
    });
    $("#c-leads").textContent = tot.toLocaleString("es-ES");
    $("#c-cidades").textContent = Object.keys(cid).length;
    $("#c-nichos").textContent = Object.keys(nic).length;

    desenharBarras(webs);
    desenharDonut(vendidas.length, webs.length - vendidas.length, 0);
  }

  function desenharBarras(webs) {
    var svg = $("#barras"), meses = [], hoje = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      meses.push({
        rotulo: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
        geradas: 0, vendidas: 0
      });
    }
    webs.forEach(function (w) {
      var d = new Date(w.data || Date.now());
      var diff = (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth());
      if (diff >= 0 && diff < 6) {
        var m = meses[5 - diff];
        m.geradas++;
        if (w.vendida) m.vendidas++;
      }
    });
    var max = Math.max(1, Math.max.apply(null, meses.map(function (m) {
      return Math.max(m.geradas, m.vendidas);
    })));
    var W = 520, base = 140, larg = W / meses.length, out = "";
    meses.forEach(function (m, i) {
      var x = i * larg + larg * 0.18, w = larg * 0.26;
      var hg = (m.geradas / max) * 100, hv = (m.vendidas / max) * 100;
      out += '<rect x="' + x + '" y="' + (base - hg) + '" width="' + w + '" height="' +
        Math.max(hg, 1) + '" rx="3" fill="#3b82f6" opacity="' + (hg ? .95 : .18) + '"/>';
      out += '<rect x="' + (x + w + 3) + '" y="' + (base - hv) + '" width="' + w + '" height="' +
        Math.max(hv, 1) + '" rx="3" fill="#22c55e" opacity="' + (hv ? .95 : .18) + '"/>';
      out += '<text x="' + (x + w) + '" y="' + (base + 18) + '" fill="#8896b8" font-size="11" ' +
        'text-anchor="middle" font-family="Karla,sans-serif">' + m.rotulo + "</text>";
    });
    out += '<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base +
      '" stroke="rgba(255,255,255,.12)"/>';
    svg.innerHTML = out;
  }

  function desenharDonut(vendidas, publicadas, borradores) {
    var total = vendidas + publicadas + borradores, svg = $("#donut");
    if (!total) {
      svg.innerHTML = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="6"/>';
      return;
    }
    var partes = [{ n: vendidas, cor: "#22c55e" }, { n: publicadas, cor: "#3b82f6" },
                  { n: borradores, cor: "#64748b" }];
    var acc = 0, out = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>';
    partes.forEach(function (p) {
      if (!p.n) return;
      var dash = (p.n / total * 100).toFixed(2);
      out += '<circle cx="21" cy="21" r="15.9" fill="none" stroke="' + p.cor +
        '" stroke-width="6" stroke-dasharray="' + dash + ' ' + (100 - dash) +
        '" stroke-dashoffset="' + (25 - acc).toFixed(2) + '"/>';
      acc += p.n / total * 100;
    });
    svg.innerHTML = out;
  }

  // ------------------------------------------------------------------ wizard
  function abrirPasso(n) {
    ["p1", "p2", "p3"].forEach(function (id, i) {
      document.getElementById(id).classList.toggle("on", i < n);
    });
    $("#wiz-passo").textContent = "Paso " + n + " de 3";
    var corpo = $("#wiz-corpo-campo");
    var migalhas = $("#wiz-migalhas");
    migalhas.innerHTML = "";
    if (wiz.ciudad) migalhas.innerHTML += '<span class="migalha">📍 <b>' + esc(wiz.ciudad) + "</b></span>";
    if (wiz.nicho) migalhas.innerHTML += '<span class="migalha"><b>' +
      esc((window.NICHOS[wiz.nicho] || {}).nombre || wiz.nicho) + "</b></span>";
    $("#wiz-contador").textContent =
      Object.keys(window.LEADS || {}).length + " combinaciones de ciudad y nicho cargadas";

    if (n === 1) {
      $("#wiz-pergunta").textContent = "¿Qué país?";
      $("#wiz-dica").textContent = "De momento trabajamos solo en España.";
      corpo.innerHTML = '<div class="pais-lista">' +
        '<div class="pais" data-pais="ES">🇪🇸 España</div>' +
        '<div class="pais off">🇵🇹 Portugal <small style="color:var(--suave)">pronto</small></div>' +
        '<div class="pais off">🇫🇷 Francia <small style="color:var(--suave)">pronto</small></div></div>';
      corpo.querySelector("[data-pais]").addEventListener("click", function () {
        wiz.pais = "ES"; abrirPasso(2);
      });
    }

    if (n === 2) {
      $("#wiz-pergunta").textContent = "¿Qué ciudad?";
      $("#wiz-dica").textContent = "Escribe y elige de la lista.";
      var cidades = {};
      Object.keys(window.LEADS || {}).forEach(function (k) {
        var d = window.LEADS[k];
        cidades[d.ciudad] = (cidades[d.ciudad] || 0) + d.leads.length;
      });
      var lista = Object.keys(cidades).sort(function (a, b) { return a.localeCompare(b, "es"); });
      corpo.innerHTML = '<div class="campo"><input id="wiz-cidade" placeholder="Ej: Madrid" ' +
        'autocomplete="off"></div><div class="chips" id="wiz-chips"></div>';
      var chips = $("#wiz-chips");
      var sugest = (estado.recentes || []).slice();
      lista.forEach(function (c) { if (sugest.indexOf(c) < 0) sugest.push(c); });
      sugest.slice(0, 8).forEach(function (c) {
        var b = el("button", "chip", esc(c));
        b.addEventListener("click", function () { escolherCidade(c); });
        chips.appendChild(b);
      });
      var inp = $("#wiz-cidade");
      inp.addEventListener("input", function () {
        chips.innerHTML = "";
        var q = inp.value.trim().toLowerCase();
        lista.filter(function (c) { return c.toLowerCase().indexOf(q) >= 0; })
          .slice(0, 10).forEach(function (c) {
            var b = el("button", "chip", esc(c) + ' <small style="color:var(--suave)">' +
              cidades[c] + "</small>");
            b.addEventListener("click", function () { escolherCidade(c); });
            chips.appendChild(b);
          });
      });
      inp.focus();
    }

    if (n === 3) {
      $("#wiz-pergunta").textContent = "¿Qué nicho?";
      $("#wiz-dica").textContent = "Cada nicho trae su paleta y sus etiquetas.";
      corpo.innerHTML = '<div class="campo"><input id="wiz-filtro" placeholder="Filtrar nichos…" ' +
        'autocomplete="off"></div><div class="nichos-grade" id="wiz-nichos"></div>';
      pintarNichos(nichosDa(wiz.ciudad), "");
      $("#wiz-filtro").addEventListener("input", function (e) {
        pintarNichos(nichosDa(wiz.ciudad), e.target.value.trim().toLowerCase());
      });
    }
    Globo.marcar(null, null);
    if (wiz.ciudad && window.CIDADES && window.CIDADES[wiz.ciudad]) {
      Globo.marcar(window.CIDADES[wiz.ciudad][0], window.CIDADES[wiz.ciudad][1]);
      $("#globo-coords").textContent = latlon(wiz.ciudad);
    } else {
      $("#globo-coords").textContent = "— · —";
    }
  }

  function nichosDa(ciudad) {
    var cont = {};
    Object.keys(window.LEADS || {}).forEach(function (k) {
      var d = window.LEADS[k];
      if (d.ciudad === ciudad) cont[d.nicho] = d.leads.length;
    });
    return cont;
  }

  function pintarNichos(disp, filtro) {
    var grade = $("#wiz-nichos");
    grade.innerHTML = "";
    var nomes = function (n) { return (window.NICHOS[n] || {}).nombre || n; };
    Object.keys(disp).sort(function (a, b) {
      return nomes(a).localeCompare(nomes(b), "es");
    }).forEach(function (n) {
      var nome = nomes(n);
      if (filtro && nome.toLowerCase().indexOf(filtro) < 0) return;
      var cor = (window.NICHOS[n] || {}).colores || {};
      var b = el("button", "nicho-item",
        '<span class="ic" style="background:' + esc(cor.acento || "#3b82f6") + '">' +
        esc(nome.charAt(0)) + "</span><span>" + esc(nome) +
        ' <small style="color:var(--suave)">' + disp[n] + "</small></span>");
      b.addEventListener("click", function () { wiz.nicho = n; verResultados(); });
      grade.appendChild(b);
    });
  }

  function escolherCidade(c) {
    wiz.ciudad = c; wiz.nicho = null;
    if (estado.recentes.indexOf(c) < 0) estado.recentes.unshift(c);
    estado.recentes = estado.recentes.slice(0, 6);
    gravar(); abrirPasso(3);
  }

  function latlon(cidade) {
    var c = (window.CIDADES || {})[cidade];
    if (!c) return "— · —";
    return "LAT " + Math.abs(c[0]).toFixed(4) + "° " + (c[0] < 0 ? "S" : "N") +
      " · LON " + Math.abs(c[1]).toFixed(4) + "° " + (c[1] < 0 ? "O" : "E");
  }

  function montarGlobo() {
    var cv = document.getElementById("globo");
    if (cv && !cv.dataset.pronto) { Globo.montar(cv); cv.dataset.pronto = "1"; }
  }

  $("#wiz-voltar").addEventListener("click", function () {
    var n = ["p1", "p2", "p3"].filter(function (id) {
      return document.getElementById(id).classList.contains("on");
    }).length;
    if (n <= 1) { mostrar("dashboard"); return; }
    abrirPasso(n - 1);
  });
  $("#nova-busca").addEventListener("click", function () {
    wiz = { pais: null, ciudad: null, nicho: null };
    abrirPasso(1); mostrar("buscar");
  });

  // -------------------------------------------------------------- resultados
  function verResultados() {
    var d = (window.LEADS || {})[wiz.ciudad + "|" + wiz.nicho];
    if (!d || !d.leads.length) { brinde("Sin negocios para esa combinación."); return; }
    mostrar("resultados");
    renderResultados(d);
  }

  function renderResultados(d) {
    var nicho = window.NICHOS[d.nicho] || {};
    var semWeb = d.leads.filter(function (l) { return !l.web; }).length;
    $("#res-titulo").textContent = nicho.nombre + " · " + d.ciudad;
    $("#res-sub").textContent = d.leads.length + " negocios · " + semWeb + " sin web";

    var rec = $("#recentes");
    rec.innerHTML = "";
    (estado.recentes || []).forEach(function (c) {
      var li = el("li", null, "📍 " + esc(c));
      li.addEventListener("click", function () { wiz.ciudad = c; abrirPasso(3); mostrar("buscar"); });
      rec.appendChild(li);
    });
    if (!estado.recentes.length) rec.innerHTML = '<li style="cursor:default">—</li>';

    var cont = $("#alvos");
    cont.innerHTML = "";
    d.leads.forEach(function (l) {
      var cor = nicho.colores || {};
      var card = el("article", "alvo");
      card.innerHTML =
        '<div class="alvo-topo">' +
          '<span class="alvo-ic" style="background:' + esc(cor.acento || "#3b82f6") + '">' +
            esc((l.nombre || "?").charAt(0).toUpperCase()) + "</span>" +
          "<div><h4>" + esc(l.nombre) + "</h4>" +
          (l.web ? '<span class="tag com">Ya tiene web</span>'
                 : '<span class="tag sem">Sin web</span>') + "</div></div>" +
        '<div class="nota">' + (l.telefono ? "☎ " + esc(l.telefono) : "sin teléfono") +
          (l.direccion ? " · " + esc(l.direccion) : "") + "</div>" +
        '<div class="acoes">' +
          (l.web ? '<a class="mini" title="Su web" href="' + esc(l.web) +
            '" target="_blank" rel="noopener">' + SVG.web + "</a>" : "") +
          (l.telefono ? '<a class="mini" title="Llamar" href="tel:' +
            esc(l.telefono.replace(/[^\d+]/g, "")) + '">' + SVG.tel + "</a>" : "") +
          (l.telefono ? '<span class="mini" title="WhatsApp">' + SVG.wsp + "</span>" : "") +
          '<button class="bt verde pequeno">⚡ Generar sitio</button>' +
        "</div>";
      card.querySelector(".bt").addEventListener("click", function () {
        animarGerando(l, d.nicho);
      });
      cont.appendChild(card);
    });
  }

  // ------------------------------------------------------------------ gerando
  function animarGerando(lead, nichoSlug) {
    var nicho = window.NICHOS[nichoSlug] || {};
    $("#g-titulo").textContent = lead.nombre;
    $("#g-sub").textContent = (nicho.nombre || nichoSlug) + " · " + (lead.ciudad || "");
    var itens = document.querySelectorAll("#g-check li");
    itens.forEach(function (i) { i.classList.remove("on"); });
    mostrar("gerando");

    var t0 = Date.now(), dur = 2400, crono = $("#g-crono");
    clearInterval(timerGerando);
    timerGerando = setInterval(function () {
      var t = Date.now() - t0;
      crono.textContent = (t / 1000).toFixed(1) + "s";
      var passo = Math.floor(t / (dur / itens.length));
      itens.forEach(function (i, k) { i.classList.toggle("on", k <= passo); });
      if (t >= dur) { clearInterval(timerGerando); abrirEditor(lead, nichoSlug); }
    }, 60);
  }

  // ------------------------------------------------------------------ editor
  var SECOES = [
    ["sobre", "Sobre nosotros"], ["carta", "Servicios / carta"],
    ["galeria", "Galería"], ["horario", "Horario"], ["mapa", "Mapa"]
  ];

  function abrirEditor(lead, nichoSlug) {
    var nicho = window.NICHOS[nichoSlug] || {};
    var ja = estado.webs.filter(function (w) {
      return w.lead.nombre === lead.nombre && w.nicho === nichoSlug;
    })[0];
    ed = {
      lead: lead, nicho: nichoSlug,
      modelo: (ja && ja.modelo) || "claro",
      secoes: (ja && ja.secoes) || { sobre: true, carta: true, galeria: true, horario: true, mapa: true },
      cor: (ja && ja.cor) || (nicho.colores || {}).acento,
      cta: ja ? (ja.cta || "") : "",
      ciudad: ja ? ja.ciudad : (lead.ciudad || ""),
      direccion: ja ? ja.direccion : (lead.direccion || ""),
      whatsapp: ja ? ja.whatsapp : (lead.telefono || ""),
      horario: ja ? ja.horario : (lead.horario_osm || ""),
      textos: (ja && ja.textos) || {},
      slug: (ja && ja.slug) || slugificar(lead.nombre)
    };
    pintarPainel();
    atualizarPreview();
    mostrar("gerar");
  }

  function pintarPainel() {
    var nicho = window.NICHOS[ed.nicho] || {};

    document.querySelectorAll("#ed-modelo button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-modelo") === ed.modelo);
    });

    var ul = $("#ed-secoes");
    ul.innerHTML = "";
    SECOES.forEach(function (par) {
      var li = el("li", null, "<span>" + par[1] + "</span>");
      var bt = el("button", "interruptor" + (ed.secoes[par[0]] !== false ? " on" : ""));
      bt.addEventListener("click", function () {
        ed.secoes[par[0]] = ed.secoes[par[0]] === false;
        bt.classList.toggle("on", ed.secoes[par[0]] !== false);
        atualizarPreview();
      });
      li.appendChild(bt);
      ul.appendChild(li);
    });

    var co = $("#ed-cores");
    co.innerHTML = "";
    var paleta = CORES.slice();
    var acentoNicho = (nicho.colores || {}).acento;
    if (acentoNicho && paleta.indexOf(acentoNicho) < 0) paleta.unshift(acentoNicho);
    paleta.forEach(function (c) {
      var b = el("button", ed.cor === c ? "on" : "");
      b.style.background = c;
      b.title = c;
      b.addEventListener("click", function () {
        ed.cor = c;
        co.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        atualizarPreview();
      });
      co.appendChild(b);
    });

    $("#ed-cta").value = ed.cta || "";
    $("#ed-ciudad").value = ed.ciudad || "";
    $("#ed-direccion").value = ed.direccion || "";
    $("#ed-whatsapp").value = ed.whatsapp || "";
    $("#ed-horario").value = ed.horario || "";
  }

  function atualizarPreview() {
    var nicho = window.NICHOS[ed.nicho] || {};
    var ifr = $("#preview");
    ifr.addEventListener("load", tornarEditavel, { once: true });
    ifr.srcdoc = Preview.construir(ed.lead, nicho, {
      modelo: ed.modelo, secoes: ed.secoes, cor: ed.cor, cta: ed.cta,
      ciudad: ed.ciudad, direccion: ed.direccion, whatsapp: ed.whatsapp,
      horario: ed.horario, textos: ed.textos
    });
  }

  /* clicar num texto da pré-visualização para o editar — como no original */
  function tornarEditavel() {
    var ifr = $("#preview"), doc;
    try { doc = ifr.contentDocument; } catch (e) { return; }
    if (!doc) return;
    doc.querySelectorAll("[data-edit]").forEach(function (node) {
      if (node.tagName === "A") return;
      node.contentEditable = "true";
      node.spellcheck = false;
      node.addEventListener("input", function () {
        var k = node.getAttribute("data-edit");
        if (k) ed.textos[k] = node.textContent;
        marcarSujo();
      });
      node.addEventListener("blur", gravarSeNecessario);
    });
  }

  function marcarSujo() {
    var t = $("#ed-estado");
    if (t) { t.textContent = "Editando…"; t.className = "tag com"; }
  }
  function gravarSeNecessario() {
    var t = $("#ed-estado");
    if (t) { t.textContent = "Guardado"; t.className = "tag sem"; }
  }

  document.querySelectorAll("#ed-modelo button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!ed) return;
      ed.modelo = b.getAttribute("data-modelo");
      document.querySelectorAll("#ed-modelo button").forEach(function (x) {
        x.classList.toggle("on", x === b);
      });
      atualizarPreview();
    });
  });

  [["#ed-cta", "cta"], ["#ed-ciudad", "ciudad"], ["#ed-direccion", "direccion"],
   ["#ed-whatsapp", "whatsapp"], ["#ed-horario", "horario"]].forEach(function (par) {
    var inp = $(par[0]);
    if (!inp) return;
    inp.addEventListener("input", function () {
      if (!ed) return;
      ed[par[1]] = inp.value;
      marcarSujo();
      clearTimeout(inp._t);
      inp._t = setTimeout(function () { atualizarPreview(); gravarSeNecessario(); }, 450);
    });
  });

  document.querySelectorAll(".lienzo-barra button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".lienzo-barra button").forEach(function (x) {
        x.classList.toggle("ativo", x === b);
      });
      $("#preview").style.width = b.getAttribute("data-ancho");
    });
  });

  $("#ed-voltar").addEventListener("click", function () { mostrar("resultados"); });

  $("#ed-dominio").addEventListener("click", function () {
    if (!ed) return;
    $("#dom-slug").value = ed.slug || slugificar(ed.lead.nombre);
    mostrar("dominio");
  });

  // ------------------------------------------------------------------ domínio
  $("#dom-voltar").addEventListener("click", function () { mostrar("gerar"); });

  $("#dom-publicar").addEventListener("click", function () {
    if (!ed) return;
    var slug = slugificar($("#dom-slug").value) || slugificar(ed.lead.nombre);
    ed.slug = slug;
    var ja = estado.webs.filter(function (w) {
      return w.lead.nombre === ed.lead.nombre && w.nicho === ed.nicho;
    })[0];
    var registo = {
      id: ja ? ja.id : Date.now(), lead: ed.lead, nicho: ed.nicho,
      modelo: ed.modelo, secoes: ed.secoes, cor: ed.cor, cta: ed.cta,
      ciudad: ed.ciudad, direccion: ed.direccion, whatsapp: ed.whatsapp,
      horario: ed.horario, textos: ed.textos, slug: slug,
      publicada: true, vendida: ja ? ja.vendida : false,
      precio: ja ? ja.precio : 0, data: new Date().toISOString()
    };
    if (ja) {
      estado.webs = estado.webs.map(function (w) { return w.id === ja.id ? registo : w; });
    } else {
      estado.webs.unshift(registo);
    }
    gravar();
    mostrar("painel");
    brinde("Publicado en escaparate.es/" + slug);
  });

  // ------------------------------------------------------------------- painel
  function renderPainel() {
    var cont = $("#painel-lista");
    cont.innerHTML = "";
    $("#painel-vazio").hidden = estado.webs.length > 0;
    estado.webs.forEach(function (w) {
      var nicho = window.NICHOS[w.nicho] || {};
      var cor = nicho.colores || {};
      var card = el("article", "alvo");
      card.innerHTML =
        '<div class="alvo-topo">' +
          '<span class="alvo-ic" style="background:' +
            esc(w.cor || cor.acento || "#3b82f6") + '">' +
            esc((w.lead.nombre || "?").charAt(0)) + "</span>" +
          "<div><h4>" + esc(w.lead.nombre) + "</h4>" +
          (w.vendida ? '<span class="tag sem">Vendida</span>'
                     : '<span class="tag com">Publicada</span>') + "</div></div>" +
        '<div class="nota">' + esc(nicho.nombre || w.nicho) + " · " +
          esc(w.ciudad || "") + " · escaparate.es/" + esc(w.slug || "") + "</div>" +
        '<div class="acoes">' +
          '<button class="bt pequeno" data-ver>Ver web</button>' +
          (w.vendida
            ? '<span class="tag sem">' + esc(w.precio) + " €</span>"
            : '<input class="mini-input" style="width:74px;padding:6px 8px" type="number" ' +
              'min="0" step="10" value="450" data-prezo>' +
              '<button class="bt verde pequeno" data-vender>Vender</button>') +
          '<button class="bt pequeno" data-borrar>×</button>' +
        "</div>";
      card.querySelector("[data-ver]").addEventListener("click", function () {
        abrirEditor(w.lead, w.nicho);
      });
      var bv = card.querySelector("[data-vender]");
      if (bv) bv.addEventListener("click", function () {
        var prezo = Math.max(0, Number(card.querySelector("[data-prezo]").value) || 0);
        w.vendida = true; w.precio = prezo;
        gravar(); renderPainel();
        brinde("Vendida por " + prezo + " € · " + w.lead.nombre);
      });
      card.querySelector("[data-borrar]").addEventListener("click", function () {
        estado.webs = estado.webs.filter(function (x) { return x.id !== w.id; });
        gravar(); renderPainel();
        brinde("Quitada de la lista.");
      });
      cont.appendChild(card);
    });
  }

  // ----------------------------------------------------------------- arranque
  montarGlobo();
  mostrar(estado.usuario ? "dashboard" : "entrar");
})();
