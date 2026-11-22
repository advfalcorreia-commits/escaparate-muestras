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

  // Cores que existem numa fachada, num toldo, num azulejo — nada de violeta
  // nem de azul de interface. Todas aguentam uma fotografia ao lado.
  var CORES = ["#9c3a1a", "#8c2f39", "#a8562a", "#b07a1e", "#6b6b1f",
               "#33584a", "#1f4f5c", "#2b3a55", "#4a3550", "#26221d"];

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
  /* sem acentos: ninguém escreve «Peluquería» com í numa barra de busca */
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  /* As URLs de foto da Google levam a chave na query — não podem ficar
     gravadas no localStorage quando se publica um site. */
  function semFotos(lead) {
    var o = {};
    Object.keys(lead || {}).forEach(function (k) {
      if (k !== "fotos" && k !== "fotoPrincipal" && k !== "fotoCreditos") o[k] = lead[k];
    });
    return o;
  }

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

  var VISTAS = ["entrar", "dashboard", "buscar", "gerando", "gerar", "dominio", "painel"];
  var COM_DOCK = ["dashboard", "buscar", "painel"];

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
    $("#btn-chave").hidden = !logado;
    $("#dock").hidden = !(logado && COM_DOCK.indexOf(v) >= 0);
    document.querySelectorAll(".dock button[data-ir]").forEach(function (b) {
      b.classList.toggle("ativo", b.getAttribute("data-ir") === v);
    });
    if (v === "dashboard") renderDashboard();
    if (v === "painel") renderPainel();
    if (v === "buscar") { montarGlobo(); renderCidadesLaterais(); }
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ entrar
  $("#form-entrar").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, nome = (f.nombre.value || "").trim(), mail = (f.email.value || "").trim();
    if (!nome || !mail) return;
    var k = (f.clave && f.clave.value || "").trim();
    if (k.length > 20) Places.definirChave(k);
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
    // sem nada gerado o gráfico é uma caixa vazia a fingir de gráfico: diz-se
    var vazio = !meses.some(function (m) { return m.geradas || m.vendidas; });
    var W = 520, base = 140, larg = W / meses.length, out = "";
    meses.forEach(function (m, i) {
      var x = i * larg + larg * 0.18, w = larg * 0.26;
      var hg = (m.geradas / max) * 100, hv = (m.vendidas / max) * 100;
      out += '<rect x="' + x + '" y="' + (base - hg) + '" width="' + w + '" height="' +
        Math.max(hg, 1) + '" rx="2" fill="#1b1916" opacity="' + (hg ? .95 : .18) + '"/>';
      out += '<rect x="' + (x + w + 3) + '" y="' + (base - hv) + '" width="' + w + '" height="' +
        Math.max(hv, 1) + '" rx="2" fill="#9c3a1a" opacity="' + (hv ? .95 : .18) + '"/>';
      out += '<text x="' + (x + w) + '" y="' + (base + 18) + '" fill="#8b8474" font-size="11" ' +
        'text-anchor="middle" font-family="Inter,system-ui,sans-serif">' + m.rotulo + "</text>";
    });
    out += '<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base +
      '" stroke="#d6cfc2"/>';
    if (vazio) {
      out += '<text x="' + W / 2 + '" y="' + (base / 2) + '" fill="#8b8474" ' +
        'font-size="12.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif">' +
        "Todavía no has generado ninguna web</text>";
    }
    svg.innerHTML = out;
  }

  function desenharDonut(vendidas, publicadas, borradores) {
    var total = vendidas + publicadas + borradores, svg = $("#donut");
    if (!total) {
      svg.innerHTML = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="#d6cfc2" stroke-width="6"/>';
      return;
    }
    var partes = [{ n: vendidas, cor: "#9c3a1a" }, { n: publicadas, cor: "#1b1916" },
                  { n: borradores, cor: "#b4ac9b" }];
    var acc = 0, out = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="#e7e1d5" stroke-width="6"/>';
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

  // ================================================================= BUSCA
  // Estado da busca ao vivo. `area` vem do Photon (nome + bbox), `nicho` do
  // catálogo, `texto` do que se escreve na barra.
  var area = null, nicho = null, texto = "", resultados = [], filtroAtual = "sem";
  var MAX_BUSCAS = 30;
  var buscasHoje = estado.buscasHoje || 0;
  var seqBusca = 0;

  function abrirModal(passo) {
    $("#modal-busca").hidden = false;
    document.body.style.overflow = "hidden";
    renderModal(passo);
  }
  function fecharModal() {
    $("#modal-busca").hidden = true;
    document.body.style.overflow = "";
    Globo.parar();
  }
  $("#mb-fechar").addEventListener("click", fecharModal);
  $("#modal-fundo").addEventListener("click", fecharModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("#modal-busca").hidden) fecharModal();
  });

  function renderModal(n) {
    ["p1", "p2", "p3"].forEach(function (id, i) {
      document.getElementById(id).classList.toggle("on", i < n);
    });
    $("#mb-passo").textContent = "Paso " + n + " de 3";
    var campo = $("#mb-campo");
    var mig = $("#mb-migalhas");
    var partes = [];
    if (area) partes.push('<span class="bc pais">España</span>' +
      '<span class="bc"><b>' + esc(area.nombre) + "</b></span>");
    if (nicho) partes.push('<span class="bc"><b>' +
      esc((window.NICHOS[nicho] || {}).nombre || nicho) + "</b></span>");
    mig.innerHTML = partes.join("");
    $("#mb-contador").textContent = buscasHoje + "/" + MAX_BUSCAS + " búsquedas hoy";

    if (n === 1) {
      $("#mb-pergunta").textContent = "¿Dónde buscas?";
      $("#mb-dica").textContent = "Escribe una ciudad o un barrio: Madrid, Centro, Salamanca…";
      campo.innerHTML =
        '<div class="autocomp"><div class="campo" style="margin:0">' +
        '<input id="mb-lugar" placeholder="Ej: Madrid · Centro" autocomplete="off"></div>' +
        '<div class="resultados" id="mb-sug" hidden></div></div>' +
        '<button class="bt" id="mb-cerca" style="width:100%;margin-top:10px">Cerca de mí</button>' +
        '<div class="chips" id="mb-recentes"></div>';
      ligarLugares($("#mb-lugar"), $("#mb-sug"), function (l) {
        area = l;
        renderModal(2);
      });
      ligarCercaDeMi($("#mb-cerca"));
      var rec = $("#mb-recentes");
      (estado.recentesAreas || []).slice(0, 5).forEach(function (r) {
        var b = el("button", "chip", esc(r.nombre));
        b.addEventListener("click", function () { area = r; renderModal(2); });
        rec.appendChild(b);
      });
      $("#mb-lugar").focus();
    }

    if (n === 2) {
      $("#mb-pergunta").textContent = "¿Qué buscas?";
      $("#mb-dica").textContent = "Un nicho del catálogo o lo que se te ocurra: «abogados», «bar»…";
      campo.innerHTML =
        '<div class="campo"><input id="mb-filtro" placeholder="Filtrar nichos…" autocomplete="off"></div>' +
        '<div class="nichos-grade" id="mb-nichos"></div>' +
        '<button class="bt verde" id="mb-buscar" style="width:100%;margin-top:14px">Buscar leads</button>';
      pintarNichosModal("");
      $("#mb-filtro").addEventListener("input", function (e) {
        pintarNichosModal(e.target.value.trim());
      });
      $("#mb-filtro").addEventListener("keydown", function (e) {
        if (e.key === "Enter") { texto = $("#mb-filtro").value.trim(); nicho = null; buscar(); }
      });
      $("#mb-buscar").addEventListener("click", buscar);
    }

    var cv = document.getElementById("globo");
    Globo.montar(cv);
    if (area && area.lat != null) {
      Globo.marcar(area.lat, area.lon);
      $("#globo-coords").textContent = "LAT " + Math.abs(area.lat).toFixed(4) + "° " +
        (area.lat < 0 ? "S" : "N") + " · LON " + Math.abs(area.lon).toFixed(4) + "° " +
        (area.lon < 0 ? "O" : "E");
    } else {
      Globo.marcar(null, null);
      $("#globo-coords").textContent = "— · —";
    }
  }

  /* autocomplete de lugar com Photon, à medida que se escreve */
  function ligarLugares(inp, sug, escolher) {
    var t;
    function pintar(texto_) {
      if (!texto_ || texto_.length < 2) { sug.hidden = true; return; }
      sug.innerHTML = '<div class="nada">Buscando…</div>';
      sug.hidden = false;
      Vivo.lugares(texto_, function (err, lista) {
        if (err || !lista.length) {
          sug.innerHTML = '<div class="nada">Ningún lugar encontrado. Prueba con ' +
            '«Madrid», «Sevilla» o un barrio.</div>';
          return;
        }
        sug.innerHTML = lista.map(function (l, i) {
          return '<div class="res" data-i="' + i + '"><span>' + esc(l.nombre) +
            (l.contexto ? ' <small style="opacity:.6">· ' + esc(l.contexto) + "</small>" : "") +
            "</span><small>" + esc(l.tipo) + " · " +
            Math.abs(l.lat).toFixed(3) + " / " + Math.abs(l.lon).toFixed(3) + "</small></div>";
        }).join("");
        sug.querySelectorAll("[data-i]").forEach(function (d) {
          d.addEventListener("click", function () { escolher(lista[+d.getAttribute("data-i")]); });
        });
      });
    }
    inp.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { pintar(inp.value.trim()); }, 320);
    });
    inp.addEventListener("focus", function () { if (inp.value.trim().length >= 2) pintar(inp.value.trim()); });
  }

  function ligarCercaDeMi(botao) {
    botao.addEventListener("click", function () {
      if (!navigator.geolocation) { brinde("Este navegador no da la ubicación."); return; }
      botao.textContent = "Buscando tu ubicación…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        area = {
          nombre: "Cerca de mí",
          lat: pos.coords.latitude, lon: pos.coords.longitude,
          bbox: [pos.coords.latitude - 0.02, pos.coords.longitude - 0.03,
                 pos.coords.latitude + 0.02, pos.coords.longitude + 0.03]
        };
        renderModal(2);
      }, function () {
        botao.textContent = "Cerca de mí";
        brinde("Sin permiso de ubicación. Escribe la zona a mano.");
      }, { timeout: 8000 });
    });
  }

  function pintarNichosModal(filtro) {
    var grade = $("#mb-nichos");
    if (!grade) return;
    grade.innerHTML = "";
    Object.keys(window.NICHOS).sort(function (a, b) {
      return window.NICHOS[a].nombre.localeCompare(window.NICHOS[b].nombre, "es");
    }).forEach(function (slug) {
      var n = window.NICHOS[slug];
      if (filtro && norm(n.nombre).indexOf(norm(filtro)) < 0) return;
      var cor = n.colores || {};
      var b = el("button", "nicho-item",
        '<span class="ic" style="background:' + esc(cor.acento || "#1b1916") + '">' +
        esc(n.nombre.charAt(0)) + "</span><span>" + esc(n.nombre) + "</span>");
      if (nicho === slug) b.style.borderColor = "#9c3a1a";
      b.addEventListener("click", function () {
        nicho = slug;
        texto = "";
        buscar();
      });
      grade.appendChild(b);
    });
  }

  // ------------------------------------------------------------ executar
  /* A amostra guardada usa rótulos como «Madrid · Centro»; o Photon devolve
     «Centro» com contexto «Madrid · …». Tentam-se as combinações. */
  function dadosGuardados(a, n) {
    var L = window.LEADS || {};
    var cidade = (a.contexto || "").split(" · ")[0];
    var tentativas = [
      a.nombre + "|" + n,
      cidade + " · " + a.nombre + "|" + n,
      a.nombre + " · " + cidade + "|" + n,
      cidade + "|" + n
    ];
    for (var i = 0; i < tentativas.length; i++) {
      if (L[tentativas[i]] && L[tentativas[i]].leads.length) return L[tentativas[i]];
    }
    return null;
  }

  /* texto livre: procura pelo nome do negócio dentro da zona, nos dados guardados */
  function guardadosPorTexto(a, txt) {
    var L = window.LEADS || {};
    var cidade = (a.contexto || "").split(" · ")[0];
    var alvo = norm(txt), out = [], vistos = {};
    Object.keys(L).forEach(function (k) {
      var d = L[k];
      var pertence = d.ciudad === a.nombre || d.ciudad === cidade ||
        d.ciudad.indexOf(a.nombre) >= 0 || d.ciudad.indexOf(cidade) >= 0;
      if (!pertence) return;
      (d.leads || []).forEach(function (l) {
        var nome = norm(l.nombre);
        if (nome.indexOf(alvo) >= 0 && !vistos[nome]) { vistos[nome] = 1; out.push(l); }
      });
    });
    return out;
  }

  function buscar() {
    if (!area) { brinde("Elige primero la zona."); return; }
    if (!nicho && texto.length < 3) { brinde("Elige un nicho o escribe al menos 3 letras."); return; }

    fecharModal();                     // primeiro fecha, senão o modal fica por cima

    if (!Places.temChave()) {
      mostrar("buscar");
      $("#chave-google").hidden = false;
      $("#busca-vazia").hidden = true;
      $("#busca-resultados").hidden = true;
      return;
    }
    $("#chave-google").hidden = true;
    mostrar("buscar");
    $("#busca-vazia").hidden = true;
    $("#busca-resultados").hidden = false;

    buscasHoje++;
    estado.buscasHoje = buscasHoje;
    if (!(estado.recentesAreas || []).some(function (r) { return r.nombre === area.nombre; })) {
      estado.recentesAreas = [area].concat(estado.recentesAreas || []).slice(0, 8);
    }
    gravar();
    renderCidadesLaterais();

    resultados = [];
    $("#res-cont").textContent = "";
    $("#vivo-zona").innerHTML = "<b>" + esc(area.nombre) + "</b> · " +
      esc(nicho ? ((window.NICHOS[nicho] || {}).nombre || nicho) : ("«" + texto + "»"));
    $("#alvos").innerHTML = '<div class="carregando"><i></i> Buscando en Google…</div>';
    $("#res-rodape").textContent = "";

    var consulta = texto && texto.length >= 3
      ? texto
      : ((window.NICHOS[nicho] || {}).nombre || nicho);
    var meu = ++seqBusca;
    Places.buscar(consulta, area, function (err, lista) {
      if (meu !== seqBusca) return;
      if (err) {
        $("#alvos").innerHTML = '<div class="vazio">Google Places respondió: <b>' +
          esc(err.message) + "</b><br><br>Revisa la clave (y que la <i>Places API (New)</i> " +
          "esté activada en el proyecto).</div>";
        fuente("erro");
        return;
      }
      lista.forEach(function (l) { if (!l.ciudad) l.ciudad = area.nombre; });
      resultados = lista;
      renderResultados();
      fuente("vivo");
    }, null, nicho);
  }

  /* indica de onde vieram os dados — é informação, não decoração */
  function fuente(tipo, forcar) {
    var el = $("#vivo-zona");
    var base = "<b>" + esc(area ? area.nombre : "") + "</b> · " +
      esc(nicho ? ((window.NICHOS[nicho] || {}).nombre || nicho) : ("«" + texto + "»"));
    var etiqueta = "";
    if (tipo === "vivo") etiqueta = ' <span class="pill ok">en vivo · Google Places</span>';
    else if (tipo === "guardado") {
      etiqueta = ' <span class="pill aviso">datos guardados</span>';
    } else if (tipo === "consultando") etiqueta = ' <span class="pill">consultando…</span>';
    else etiqueta = ' <span class="pill aviso">error de Google</span>';
    el.innerHTML = base + etiqueta;
  }

  function renderResultados() {
    var nombreNicho = nicho ? (window.NICHOS[nicho].nombre || nicho) : ("«" + texto + "»");
    var conWeb = resultados.filter(function (l) { return l.web; }).length;
    var sinWeb = resultados.length - conWeb;

    $("#res-cont").innerHTML = "<b>" + resultados.length + "</b> " +
      (resultados.length === 1 ? "leads" : "leads") + " · <b>" + sinWeb + "</b> sin web · <b>" +
      conWeb + "</b> ya tiene web";

    document.querySelectorAll(".filtro").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-filtro") === filtroAtual);
    });

    var lista = resultados.filter(function (l) {
      if (filtroAtual === "sem") return !l.web;
      if (filtroAtual === "com") return !!l.web;
      return true;
    });

    var cont = $("#alvos");
    cont.innerHTML = "";
    if (!lista.length) {
      cont.innerHTML = '<div class="vazio">Ningún negocio con ese filtro. ' +
        'Prueba «Todos» o cambia de nicho.</div>';
      $("#res-rodape").textContent = "";
      return;
    }
    lista.slice(0, 120).forEach(function (l) { cont.appendChild(tarjeta(l)); });
    $("#res-rodape").textContent = lista.length + (lista.length === 1
      ? " lead encontrado" : " leads encontrados") +
      (lista.length > 120 ? " · mostrando 120" : "");
  }

  function tarjeta(l) {
    var nichoSlug = l.nicho || nicho;
    var n = window.NICHOS[nichoSlug] || {};
    var cor = (n.colores || {}).acento || "#1b1916";
    var card = el("article", "alvo");
    card.innerHTML =
      '<div class="alvo-topo">' +
        (l.fotoPrincipal
          ? '<span class="alvo-ic foto"><img alt="" loading="lazy" src="' +
            esc(l.fotoPrincipal) + '"></span>'
          : '<span class="alvo-ic" style="background:' + esc(cor) + '">' +
            esc((l.nombre || "?").charAt(0).toUpperCase()) + "</span>") +
        "<div><h4>" + esc(l.nombre) + "</h4>" +
        (l.web ? '<span class="tag com">Ya tiene web</span>'
               : '<span class="tag sem">Sin web</span>') + "</div></div>" +
      '<div class="nota">' +
        (l.nota ? '<span class="estrela">★ ' + l.nota.toFixed(1) + "</span> " +
          (l.resenas ? '<span style="opacity:.7">(' + l.resenas + ")</span> " : "") : "") +
        (l.telefono ? esc(l.telefono) : "sin teléfono") +
        (l.direccion ? " · " + esc(l.direccion) : "") + "</div>" +
      '<div class="acoes">' +
        (l.web ? '<a class="mini" title="Su web" href="' + esc(l.web) +
          '" target="_blank" rel="noopener">' + SVG.web + "</a>" : "") +
        (l.telefono ? '<a class="mini" title="Llamar" href="tel:' +
          esc(l.telefono.replace(/[^\d+]/g, "")) + '">' + SVG.tel + "</a>" : "") +
        (l.telefono ? '<span class="mini" title="WhatsApp">' + SVG.wsp + "</span>" : "") +
        '<button class="bt verde pequeno">Generar sitio</button>' +
      "</div>";
    card.querySelector(".bt").addEventListener("click", function () {
      animarGerando(l, nichoSlug);
    });
    return card;
  }

  document.querySelectorAll(".filtro").forEach(function (b) {
    b.addEventListener("click", function () {
      filtroAtual = b.getAttribute("data-filtro");
      renderResultados();
    });
  });

  // barra de busca ao vivo, dentro dos resultados
  (function () {
    var inp = $("#vivo-texto");
    if (!inp) return;
    var t;
    inp.addEventListener("input", function () {
      clearTimeout(t);
      var v = inp.value.trim();
      t = setTimeout(function () {
        if (!area) {
          if (v.length >= 3) { abrirModal(1); }
          return;
        }
        if (v.length < 3) return;
        nicho = null; texto = v;
        buscar();
      }, 550);
    });
  })();

  $("#vivo-cerca").addEventListener("click", function () {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      area = {
        nombre: "Cerca de mí",
        lat: pos.coords.latitude, lon: pos.coords.longitude,
        bbox: [pos.coords.latitude - 0.02, pos.coords.longitude - 0.03,
               pos.coords.latitude + 0.02, pos.coords.longitude + 0.03]
      };
      if (nicho || texto.length >= 3) buscar();
      else abrirModal(2);
    }, function () { brinde("Sin permiso de ubicación."); });
  });

  // cidades recentes na barra lateral
  function renderCidadesLaterais() {
    var ul = $("#cidades-lista");
    if (!ul) return;
    ul.innerHTML = "";
    var rec = estado.recentesAreas || [];
    $("#cidades-vazio").hidden = rec.length > 0;
    rec.forEach(function (r) {
      var li = el("li");
      li.innerHTML = '<div><span class="cid">' + esc(r.nombre) + "</span></div>" +
        '<div class="chips-mini"><span>' +
        (r.bbox ? "zona" : "radio") + "</span></div>";
      li.addEventListener("click", function () { area = r; abrirModal(2); });
      ul.appendChild(li);
    });
  }

  $("#nova-busca").addEventListener("click", function () { abrirModal(1); });

  /* atalho no topo: abre o campo da chave sem passar pela busca */
  $("#btn-chave").addEventListener("click", function () {
    mostrar("buscar");
    fecharModal();
    $("#chave-google").hidden = false;
    $("#busca-vazia").hidden = true;
    $("#busca-resultados").hidden = true;
    $("#chave-input").value = Places.chave() || "";
    $("#chave-input").focus();
    window.scrollTo(0, 0);
    if (Places.temChave()) {
      $("#chave-google").querySelector("h3").textContent =
        "Clave de Google Places guardada";
    }
  });

  (function () {
    var b = $("#chave-guardar");
    if (!b) return;
    b.addEventListener("click", function () {
      var v = ($("#chave-input").value || "").trim();
      if (v.length < 20) { brinde("Esa clave parece incompleta."); return; }
      Places.definirChave(v);
      $("#chave-google").hidden = true;
      if (area && (nicho || texto.length >= 3)) {
        brinde("Clave guardada. Buscando…");
        buscar();
      } else {
        brinde("Clave guardada. Ahora elige la zona.");
        abrirModal(1);          // sem zona não há nada para buscar
      }
    });
    if (Places.temChave()) $("#chave-google").hidden = true;
    $("#chave-input").value = Places.chave() || "";
  })();

  function montarGlobo() {
    var cv = document.getElementById("globo");
    if (cv && $("#modal-busca").hidden === false) Globo.montar(cv);
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

  $("#ed-voltar").addEventListener("click", function () { mostrar("buscar"); });

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
      id: ja ? ja.id : Date.now(), lead: semFotos(ed.lead), nicho: ed.nicho,
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
            esc(w.cor || cor.acento || "#1b1916") + '">' +
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
  (function () {
    var c = document.getElementById("clave-entrada");
    if (c && Places.temChave()) c.value = Places.chave();
  })();
  mostrar(estado.usuario ? "dashboard" : "entrar");
})();
