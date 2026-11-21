/* Busca em tempo real: Photon para lugares, Overpass para os negócios.

   Antes o demo filtrava um ficheiro pré-calculado com 6 negócios por nicho —
   Madrid · Centro dava 5 leads, o que não serve. Agora pergunta-se ao
   OpenStreetMap no momento: escreve-se a zona, escolhe-se o nicho, e vêm todos
   os que existirem de facto.

   Espelhos do Overpass por ordem, com tempo limite curto porque isto é uma
   interface: mais vale falhar depressa e avisar do que ficar a rodar. */

window.Vivo = (function () {
  "use strict";

  var PHOTON = "https://photon.komoot.io/api/";
  var ESPELHOS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  // como a lista guardada aparece logo, pode-se esperar mais pelo live
  var TENTATIVAS = [
    { ep: ESPELHOS[1], ms: 9000 },
    { ep: ESPELHOS[0], ms: 9000 },
    { ep: ESPELHOS[1], ms: 18000 },
    { ep: ESPELHOS[0], ms: 18000 }
  ];

  // (chave,valor) -> slug do nicho, a partir do catálogo
  var mapaTags = null;
  // os genéricos primeiro, senão «restaurant» fica com «asador» e «hairdresser»
  // com «barberia» só por ordem alfabética
  var PRIORIDADE = ["restaurante", "bar", "cafeteria", "peluqueria", "estetica",
    "veterinaria", "optica", "floristeria", "moda", "joyeria", "libreria",
    "muebles", "gimnasio", "yoga", "abogado", "gestoria", "inmobiliaria",
    "autoescuela", "academia", "agencia-viajes", "arquitecto", "fontanero",
    "electricista", "reformas", "pintor", "cerrajero", "jardineria",
    "climatizacion", "mudanzas", "limpieza", "carpinteria", "desatascos",
    "albanileria", "instalaciones", "clinica-dental", "fisioterapia",
    "psicologia", "nutricion", "podologia", "logopedia", "panaderia",
    "pasteleria", "estetica-canina", "hotel-rural"];

  function construirMapa() {
    if (mapaTags) return mapaTags;
    mapaTags = {};
    var ordem = {};
    PRIORIDADE.forEach(function (n, i) { ordem[n] = i; });
    var slugs = Object.keys(window.NICHOS || {}).sort(function (a, b) {
      var oa = ordem[a] == null ? 999 : ordem[a], ob = ordem[b] == null ? 999 : ordem[b];
      return oa - ob || a.localeCompare(b);
    });
    slugs.forEach(function (slug) {
      (window.NICHOS[slug].osm || []).forEach(function (t) {
        var i = t.indexOf("=");
        var k = t.slice(0, i), v = t.slice(i + 1);
        if (!mapaTags[k + "=" + v]) mapaTags[k + "=" + v] = slug;
      });
    });
    return mapaTags;
  }

  function pedido(ep, q, ms) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(ep, {
      method: "POST",
      body: new URLSearchParams({ data: q }),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (txt) {
      var d = JSON.parse(txt);
      if (d.remark && /timed out|out of memory/i.test(d.remark)) throw new Error(d.remark);
      return d;
    }).catch(function (e) { clearTimeout(t); throw e; });
  }

  /* ---------------------------------------------------------------- Photon */
  function lugares(texto, cb) {
    if (!texto || texto.length < 2) { cb(null, []); return; }
    // sem `lang=es`: o Photon só aceita default/de/en/fr e responde com erro
    var url = PHOTON + "?q=" + encodeURIComponent(texto) + "&limit=8";
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var out = [];
      (d.features || []).forEach(function (f) {
        var p = f.properties || {};
        if (p.countrycode && p.countrycode !== "ES") return;
        var ext = p.extent;                     // [minLon, maxLat, maxLon, minLat]
        var lon = f.geometry.coordinates[0], lat = f.geometry.coordinates[1];
        out.push({
          nombre: p.name,
          contexto: [p.city, p.state, p.county].filter(Boolean).join(" · "),
          tipo: p.type || p.osm_value || "",
          lat: lat, lon: lon,
          bbox: ext ? [ext[3], ext[0], ext[1], ext[2]] : null   // sul, oeste, norte, leste
        });
      });
      cb(null, out);
    }).catch(function (e) { cb(e, []); });
  }

  /* -------------------------------------------------------------- Overpass */
  function expressao(tags) {
    var porChave = {};
    tags.forEach(function (t) {
      var i = t.indexOf("=");
      var k = t.slice(0, i), v = t.slice(i + 1);
      (porChave[k] = porChave[k] || []).push(v);
    });
    return Object.keys(porChave).map(function (k) {
      var vs = porChave[k];
      return vs.length === 1
        ? '["' + k + '"="' + vs[0] + '"]'
        : '["' + k + '"~"^(' + vs.join("|") + ')$"]';
    }).join("");
  }

  function montarConsulta(area, tags, nombre, limite) {
    var zona = "";
    if (area.bbox) {
      zona = "(" + area.bbox.map(function (v) { return v.toFixed(5); }).join(",") + ")";
    } else if (area.lat != null) {
      zona = "(around:" + (area.raio || 5000) + "," +
             area.lat.toFixed(5) + "," + area.lon.toFixed(5) + ")";
    } else {
      return null;
    }
    var partes = [];
    if (tags && tags.length) partes.push("nwr" + expressao(tags) + zona);
    if (nombre && nombre.length >= 3) {
      var limpo = nombre.replace(/["\\]/g, "");
      partes.push('nwr["name"~"' + limpo + '",i]' + zona);
    }
    if (!partes.length) return null;
    return "[out:json][timeout:40];\n(\n" + partes.join("\n") + "\n);\n" +
           "out tags center " + (limite || 400) + ";";
  }

  function normalizar(elements) {
    var mapa = construirMapa();
    var out = [], vistos = {};
    (elements || []).forEach(function (e) {
      var t = e.tags || {};
      var nome = (t.name || "").trim();
      if (!nome) return;
      var chave = nome.toLowerCase();
      if (vistos[chave]) return;
      vistos[chave] = 1;

      var nicho = null;
      for (var i = 0; i < 8 && !nicho; i++) {
        var k = ["amenity", "shop", "craft", "office", "leisure", "tourism",
                 "healthcare", "sport"][i];
        if (t[k] && mapa[k + "=" + t[k]]) nicho = mapa[k + "=" + t[k]];
      }
      var rua = t["addr:street"];
      var num = t["addr:housenumber"];
      out.push({
        nombre: nome,
        nicho: nicho,
        tipo: t.amenity || t.shop || t.craft || t.office || t.healthcare || "",
        categoria: t.cuisine || "",
        direccion: rua ? (num ? rua + ", " + num : rua) : "",
        cp: t["addr:postcode"] || "",
        ciudad: t["addr:city"] || t["addr:suburb"] || "",
        telefono: t.phone || t["contact:phone"] || t["contact:mobile"] || "",
        whatsapp: t["contact:whatsapp"] || "",
        web: t.website || t["contact:website"] || "",
        horario: t.opening_hours || "",
        lat: e.lat || (e.center || {}).lat,
        lon: e.lon || (e.center || {}).lon
      });
    });
    // quem não tem site primeiro: é o cliente
    out.sort(function (a, b) {
      if (!!a.web !== !!b.web) return a.web ? 1 : -1;
      if (!!a.telefono !== !!b.telefono) return a.telefono ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
    return out;
  }

  function negocios(area, tags, nombre, cb, limite, rapido) {
    var q = montarConsulta(area, tags, nombre, limite);
    if (!q) { cb(new Error("sem área"), []); return; }

    var lista = rapido ? TENTATIVAS.slice(0, 2) : TENTATIVAS;
    var i = 0;
    function tentar() {
      if (i >= lista.length) { cb(new Error("Overpass indisponível"), []); return; }
      var t = lista[i++];
      pedido(t.ep, q, t.ms)
        .then(function (d) { cb(null, normalizar(d.elements)); })
        .catch(function () { tentar(); });
    }
    tentar();
  }

  return {
    lugares: lugares,
    negocios: negocios,
    montarConsulta: montarConsulta,
    normalizar: normalizar,
    expressao: expressao
  };
})();
