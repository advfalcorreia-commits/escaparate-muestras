/* O painel da demo: entrar -> buscar -> generar -> panel.
   Tudo vive no browser (localStorage). Não há servidor, não há conta a sério,
   não sai nada daqui. */

(function () {
  "use strict";

  var CHAVE = "escaparate_demo_v1";
  var estado = carregar();
  var alvoAtual = null;   // { lead, nicho }

  // ------------------------------------------------------------ utilidades
  function $(sel) { return document.querySelector(sel); }
  function carregar() {
    try {
      var d = JSON.parse(localStorage.getItem(CHAVE) || "{}");
      return { usuario: d.usuario || null, webs: d.webs || [] };
    } catch (e) { return { usuario: null, webs: [] }; }
  }
  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {}
  }
  function esc(s) { return Preview.esc(s); }

  var brindeTimer;
  function brinde(msg) {
    var b = $("#brinde");
    b.textContent = msg;
    b.classList.add("visivel");
    clearTimeout(brindeTimer);
    brindeTimer = setTimeout(function () { b.classList.remove("visivel"); }, 3200);
  }

  var VISTAS = ["entrar", "buscar", "generar", "panel"];
  function mostrar(vista) {
    VISTAS.forEach(function (v) {
      var el = document.getElementById("v-" + v);
      if (el) el.classList.toggle("ativa", v === vista);
    });
    var logado = !!estado.usuario;
    $("#usuario-topo").textContent = logado ? estado.usuario.nombre : "";
    $("#btn-sair").hidden = !logado;
    $("#cinta").hidden = !logado;
    window.scrollTo(0, 0);
  }

  // ----------------------------------------------------------------- entrar
  $("#form-entrar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = ev.target;
    var nome = (f.nombre.value || "").trim();
    var email = (f.email.value || "").trim();
    if (!nome || !email) return;
    estado.usuario = { nombre: nome, email: email };
    gravar();
    prepararSelects();
    mostrar("buscar");
    brinde("Hola, " + nome + ". Elige una ciudad y un nicho.");
  });

  $("#btn-sair").addEventListener("click", function () {
    estado.usuario = null;
    gravar();
    mostrar("entrar");
  });

  $("#ir-inicio").addEventListener("click", function (ev) {
    ev.preventDefault();
    mostrar(estado.usuario ? "buscar" : "entrar");
  });

  // ----------------------------------------------------------------- buscar
  function prepararSelects() {
    var selC = $("#sel-ciudad"), selN = $("#sel-nicho");
    if (selC.options.length) return;

    var cidades = {}, nichos = {};
    Object.keys(window.LEADS || {}).forEach(function (k) {
      var d = window.LEADS[k];
      cidades[d.ciudad] = (cidades[d.ciudad] || 0) + d.leads.length;
      nichos[d.nicho] = true;
    });
    Object.keys(cidades).sort().forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c;
      selC.appendChild(o);
    });
    Object.keys(nichos).sort().forEach(function (n) {
      var o = document.createElement("option");
      o.value = n;
      o.textContent = (window.NICHOS[n] || {}).nombre || n;
      selN.appendChild(o);
    });
  }

  $("#btn-buscar").addEventListener("click", function () {
    var cidade = $("#sel-ciudad").value, nicho = $("#sel-nicho").value;
    var d = (window.LEADS || {})[cidade + "|" + nicho];
    var cont = $("#resultados"), res = $("#resumen");

    if (!d || !d.leads || !d.leads.length) {
      cont.innerHTML = '<div class="vazio">No hay negocios guardados para ' + esc(cidade) +
        " · " + esc(nicho) + ".<br>Prueba otra combinación: la demo trae una muestra ya descargada " +
        "de OpenStreetMap.</div>";
      res.innerHTML = "";
      return;
    }

    var semWeb = d.leads.filter(function (l) { return !l.web; }).length;
    res.innerHTML =
      "<span><b>" + d.leads.length + "</b> negocios en " + esc(cidade) + "</span>" +
      '<span class="pill ok">' + semWeb + " sin web</span>" +
      '<span class="pill aviso">' + (d.leads.length - semWeb) + " con web</span>" +
      '<span class="pill">Fuente: OpenStreetMap</span>';

    cont.innerHTML = d.leads.map(function (l, i) {
      var morada = [l.direccion, l.cp, l.ciudad].filter(Boolean).join(", ") || "Sin dirección";
      return '<article class="alvo">' +
        "<h3>" + esc(l.nombre) + "</h3>" +
        '<p class="meta">' + esc(morada) + "</p>" +
        '<div class="fila">' +
        (l.web ? '<span class="pill">Ya tiene web</span>'
               : '<span class="pill aviso">Sin web</span>') +
        (l.telefono ? '<span class="pill ok">' + esc(l.telefono) + "</span>"
                    : '<span class="pill">Sin teléfono</span>') +
        '<button class="boton pequeno" data-i="' + i + '">Generar web</button>' +
        "</div></article>";
    }).join("");

    cont.querySelectorAll("button[data-i]").forEach(function (b) {
      b.addEventListener("click", function () {
        var l = d.leads[+b.getAttribute("data-i")];
        abrirGerar(l, nicho);
      });
    });
  });

  // ---------------------------------------------------------------- gerar
  function abrirGerar(lead, nichoSlug) {
    var nicho = window.NICHOS[nichoSlug];
    alvoAtual = { lead: lead, nicho: nichoSlug };

    $("#g-nombre").textContent = lead.nombre;
    var dados = [
      ["Ciudad", [lead.direccion, lead.cp, lead.ciudad].filter(Boolean).join(", ") || "—"],
      ["Teléfono", lead.telefono || "—"],
      ["Horario", lead.horario_osm || "—"],
      ["Nicho", nicho.nombre + " · " + nicho.plantilla]
    ];
    $("#g-dados").innerHTML = dados.map(function (d) {
      return "<li><b>" + esc(d[0]) + "</b><span>" + esc(d[1]) + "</span></li>";
    }).join("");

    var jaExiste = estado.webs.filter(function (w) {
      return w.lead.nombre === lead.nombre && w.nicho === nichoSlug;
    })[0];
    $("#btn-vender").disabled = !!(jaExiste && jaExiste.vendida);
    $("#btn-vender").textContent = jaExiste && jaExiste.vendida
      ? "Ya está vendida" : "Marcar como vendida";
    $("#g-precio").value = (jaExiste && jaExiste.precio) || 450;

    var ifr = $("#preview");
    ifr.srcdoc = Preview.construir(lead, nicho);
    mostrar("generar");
  }

  $("#btn-voltar").addEventListener("click", function () { mostrar("buscar"); });

  document.querySelectorAll(".lienzo-barra button").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".lienzo-barra button").forEach(function (x) {
        x.classList.toggle("ativo", x === b);
      });
      $("#preview").style.width = b.getAttribute("data-ancho");
    });
  });

  $("#btn-vender").addEventListener("click", function () {
    if (!alvoAtual) return;
    var prezo = Math.max(0, Number($("#g-precio").value) || 0);
    var existente = estado.webs.filter(function (w) {
      return w.lead.nombre === alvoAtual.lead.nombre && w.nicho === alvoAtual.nicho;
    })[0];

    if (existente) {
      existente.precio = prezo;
      existente.vendida = true;
      existente.data = new Date().toISOString();
    } else {
      estado.webs.unshift({
        id: Date.now(),
        lead: alvoAtual.lead,
        nicho: alvoAtual.nicho,
        precio: prezo,
        vendida: true,
        data: new Date().toISOString()
      });
    }
    gravar();
    desenharPainel();
    mostrar("panel");
    brinde("Vendida por " + prezo + " € · " + alvoAtual.lead.nombre);
  });

  // ---------------------------------------------------------------- painel
  function desenharPainel() {
    var corpo = $("#tabla");
    var total = estado.webs.length;
    var vendidas = estado.webs.filter(function (w) { return w.vendida; });
    var facturado = vendidas.reduce(function (s, w) { return s + (Number(w.precio) || 0); }, 0);

    $("#st-geradas").textContent = total;
    $("#st-vendidas").textContent = vendidas.length;
    $("#st-ingresos").textContent = facturado.toLocaleString("es-ES") + " €";

    $("#panel-vazio").hidden = total > 0;

    corpo.innerHTML = estado.webs.map(function (w) {
      var n = window.NICHOS[w.nicho] || {};
      return "<tr>" +
        '<td data-r="Negocio"><span class="nome">' + esc(w.lead.nombre) + "</span>" +
          '<span class="sub">' + esc(w.lead.direccion || "") + "</span></td>" +
        '<td data-r="Ciudad">' + esc(w.lead.ciudad || "—") + "</td>" +
        '<td data-r="Nicho">' + esc(n.nombre || w.nicho) + "</td>" +
        '<td data-r="Estado"><span class="estado vendida">Vendida</span></td>' +
        '<td data-r="Precio">' + esc(w.precio) + " €</td>" +
        '<td data-r=""><div class="acoes">' +
          '<button class="boton sec pequeno" data-ver="' + w.id + '">Ver web</button>' +
          '<button class="boton sec pequeno" data-borrar="' + w.id + '">Borrar</button>' +
        "</div></td></tr>";
    }).join("");

    corpo.querySelectorAll("button[data-ver]").forEach(function (b) {
      b.addEventListener("click", function () {
        var w = estado.webs.filter(function (x) { return x.id == b.getAttribute("data-ver"); })[0];
        if (w) abrirGerar(w.lead, w.nicho);
      });
    });
    corpo.querySelectorAll("button[data-borrar]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.webs = estado.webs.filter(function (x) {
          return x.id != b.getAttribute("data-borrar");
        });
        gravar(); desenharPainel();
        brinde("Eliminada de la lista. La web del cliente no se toca: la demo no publica nada.");
      });
    });
  }

  // -------------------------------------------------------------- arranque
  prepararSelects();
  desenharPainel();
  mostrar(estado.usuario ? "buscar" : "entrar");
})();
