/* Busca de negócios em tempo real com a Google Places API (New).

   É a mesma fonte que o SitesLead usa (`/api/places` no código deles). Ao
   contrário do OpenStreetMap, que é um serviço voluntário e cai quando enche,
   aqui a resposta é imediata e traz telefone, site, nota e nº de avaliações.

   A chave: NÃO vai no repositório. Guarda-se em localStorage, no browser de
   quem usa a demo. Para produção, o normal é pôr um proxy (Vercel/Worker) à
   frente e restringir a chave ao domínio — está explicado no painel.

   Custo aproximado: Text Search devolve 20 resultados por pedido; com o field
   mask abaixo (nota + nº de avaliações = escalão Enterprise) ronda 32 USD por
   1000 pedidos. Para uma demo, são cêntimos.

   Fotografias: `places.photos` é pedido só pelo nome do recurso. Os campos que
   o acompanham (`widthPx`, `heightPx`, `authorAttributions`) sobem a fatura ao
   escalão seguinte e não são precisos aqui: a escolha da capa por resolução e
   contraste faz-se em `motor/fotos.py`, que tem a foto em disco. Se um dia se
   quiser a capa decidida no browser, é só acrescentar esses campos ao mask —
   o código já os usa quando vêm. */

window.Places = (function () {
  "use strict";

  var CLAVE = "escaparate_places_key";
  var URL = "https://places.googleapis.com/v1/places:searchText";
  var FOTO_URL = "https://places.googleapis.com/v1/";
  var ANCHO_FOTO = 1600;            // capa a 3:2 em ecrã retina sem pesar
  var MAX_FOTOS = 6;                // mais do que isto é peso sem proveito
  var MASK = [
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.location",
    "places.primaryType",
    "places.types",
    "places.googleMapsUri",
    "places.photos",
    "nextPageToken"
  ].join(",");

  function chave() {
    try { return (localStorage.getItem(CLAVE) || "").trim(); } catch (e) { return ""; }
  }
  function definirChave(k) {
    try { localStorage.setItem(CLAVE, (k || "").trim()); } catch (e) {}
  }
  function temChave() { return chave().length > 20; }

  /* ------------------------------------------------------------------ fotos
     A Places devolve `places.photos[].name`, tipo «places/ChIJ…/photos/AeJ…».
     Cada foto serve-se em `{FOTO_URL}{name}/media?maxWidth=…&key=…`.

     O `name` traz barras — é caminho, não query: codifica-se segmento a
     segmento, senão a barra vira %2F e o pedido dá 404. A chave vai na query
     porque é assim que a Places API autentica pedidos de media; por isso as
     URLs devolvidas aqui são privadas de quem tem a chave e não vão para
     nenhum sítio publicado. */

  /* Aceita o `name` da Places, uma URL já montada ou um objeto {name}.
     Devolve só o recurso, sem prefixo nem barras a mais. */
  function _recurso(foto) {
    var nome = typeof foto === "string" ? foto : (foto && foto.name) || "";
    nome = String(nome).trim();
    if (!nome) return "";
    nome = nome.replace(/^https?:\/\/places\.googleapis\.com\/v1\//i, "");
    nome = nome.split("?")[0].split("#")[0];        // tira query e fragmento
    nome = nome.replace(/\/media\/?$/i, "");        // e o sufixo de media
    return nome.replace(/^\/+/, "").replace(/\/+$/, "");
  }

  /* URL pronta para `<img src>`. Sem chave devolve "" em vez de rebentar:
     o painel funciona sem fotografias, só fica mais feio. O `k` explícito
     existe para os testes; em produção lê-se a chave do browser. */
  function fotoUrl(foto, ancho, k) {
    var recurso = _recurso(foto);
    var chave_ = typeof k === "string" ? k : chave();
    if (!recurso || !chave_) return "";
    var caminho = recurso.split("/").map(function (s) { return encodeURIComponent(s); })
      .join("/");
    return FOTO_URL + caminho + "/media?maxWidth=" + (ancho || ANCHO_FOTO) +
      "&key=" + encodeURIComponent(chave_);
  }

  /* Pontuação de capa, só com o que a resposta traz. Se `widthPx`/`heightPx`
     não vierem (mask mínimo), sobra a ordem do Google — que já é por
     relevância — e o desempate fica por conta dela. */
  function _pontosFoto(f, i) {
    var p = 0;
    var w = +((f && f.widthPx) || 0) || 0;
    var h = +((f && f.heightPx) || 0) || 0;
    if (w && h) {
      var racio = w / h;
      if (racio >= 1.2 && racio <= 1.9) p += 3;   // a capa é horizontal
      else if (racio < 0.8) p -= 2;               // vertical estreita
      var lado = Math.min(w, h);
      if (lado >= 1200) p += 3;
      else if (lado >= 800) p += 2;
      else if (lado >= 500) p += 1;
      else if (lado < 300) p -= 2;
    }
    return p - i * 0.35;                          // a ordem do Google vale
  }

  function _credito(f) {
    var a = (f && f.authorAttributions) || [];
    for (var i = 0; i < a.length; i++) {
      if (a[i] && a[i].displayName) return String(a[i].displayName);
    }
    return "";
  }

  /* Devolve {fotos: [url…], fotoPrincipal, fotoCreditos: […]}. Sempre arrays,
     mesmo quando não há chave, fotos ou o negócio é nulo. */
  function _fotos(place, k) {
    var lista = (place && place.photos) || [];
    var candidatas = [], vistos = {};
    for (var i = 0; i < lista.length; i++) {
      var recurso = _recurso(lista[i]);
      if (!recurso || vistos[recurso]) continue;   // repetidas: só uma vez
      vistos[recurso] = 1;
      candidatas.push({ recurso: recurso, i: i,
                        pontos: _pontosFoto(lista[i], i),
                        credito: _credito(lista[i]) });
    }
    candidatas.sort(function (a, b) {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      return a.i - b.i;                            // empate: ordem do Google
    });
    var fotos = [], creditos = [];
    for (var j = 0; j < candidatas.length && fotos.length < MAX_FOTOS; j++) {
      var url = fotoUrl(candidatas[j].recurso, ANCHO_FOTO, k);
      if (!url) break;                             // sem chave: nenhuma serve
      fotos.push(url);
      creditos.push(candidatas[j].credito);
    }
    return { fotos: fotos, fotoPrincipal: fotos.length ? fotos[0] : "",
             fotoCreditos: creditos };
  }

  function rectangulo(area) {
    if (!area || !area.bbox) return null;
    var b = area.bbox;                       // sul, oeste, norte, leste
    return {
      rectangle: {
        low: { latitude: b[0], longitude: b[1] },
        high: { latitude: b[2], longitude: b[3] }
      }
    };
  }

  // tipo do Google -> nicho do catálogo (para a paleta e as etiquetas)
  var TIPO_A_NICHO = {
    lawyer: "abogado", restaurant: "restaurante", bar: "bar", cafe: "cafeteria",
    pub: "cerveceria", bakery: "panaderia", meal_takeaway: "restaurante",
    hair_salon: "peluqueria", hair_care: "peluqueria", beauty_salon: "estetica",
    spa: "estetica", dentist: "clinica-dental", veterinary_care: "veterinaria",
    gym: "gimnasio", yoga_studio: "yoga", florist: "floristeria",
    clothing_store: "moda", jewelry_store: "joyeria", book_store: "libreria",
    furniture_store: "muebles", electrician: "electricista", plumber: "fontanero",
    painter: "pintor", locksmith: "cerrajero", moving_company: "mudanzas",
    roofing_contractor: "reformas", general_contractor: "reformas",
    real_estate_agency: "inmobiliaria", accounting: "gestoria",
    travel_agency: "agencia-viajes", driving_school: "autoescuela",
    physiotherapist: "fisioterapia", optician: "optica", lodging: "hotel-rural",
    pet_groomer: "estetica-canina", laundry: "limpieza", car_repair: "reformas"
  };

  /* `clave` só serve para os testes: em produção usa-se a chave guardada no
     browser. A forma devolvida é a que o preview consome — não mexer sem
     avisar quem constrói o layout. */
  function normalizar(places, nichoPedido, clave) {
    var out = [];
    var k = typeof clave === "string" && clave ? clave : chave();
    (places || []).forEach(function (p) {
      if (!p) return;
      var tel = p.nationalPhoneNumber || p.internationalPhoneNumber || "";
      var foto = _fotos(p, k);
      out.push({
        nombre: (p.displayName && p.displayName.text) || "",
        telefono: tel,
        direccion: (p.formattedAddress || "").replace(/,?\s*España\s*$/, ""),
        web: p.websiteUri || "",
        tipo: p.primaryType || (p.types && p.types[0]) || "",
        nota: p.rating || null,
        resenas: p.userRatingCount || 0,
        maps: p.googleMapsUri || "",
        nicho: nichoPedido || TIPO_A_NICHO[p.primaryType] || null,
        lat: p.location && p.location.latitude,
        lon: p.location && p.location.longitude,
        fotos: foto.fotos,
        fotoPrincipal: foto.fotoPrincipal,
        fotoCreditos: foto.fotoCreditos
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

  /* texto: «abogados», «peluquería», o nome de um negócio
     area:   {nombre, bbox, lat, lon}
     cb(err, lista, meta) */
  function buscar(texto, area, cb, pagina, nichoPedido) {
    var k = chave();
    if (!k) { cb(new Error("sin clave de Google Places"), []); return; }

    var corpo = {
      textQuery: texto + (area && area.nombre ? " en " + area.nombre : ""),
      languageCode: "es",
      regionCode: "ES",
      maxResultCount: 20,
      rankPreference: "RELEVANCE"
    };
    var restr = rectangulo(area);
    if (restr) corpo.locationRestriction = restr;
    else if (area && area.lat != null) {
      corpo.locationBias = {
        circle: { center: { latitude: area.lat, longitude: area.lon }, radius: 5000 }
      };
    }
    if (pagina) corpo.pageToken = pagina;

    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 15000);

    fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": k,
        "X-Goog-FieldMask": MASK
      },
      body: JSON.stringify(corpo),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(t);
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
    }).then(function (res) {
      if (!res.ok) {
        var msg = (res.d.error && res.d.error.message) || ("HTTP " + res.status);
        cb(new Error(msg), []);
        return;
      }
      cb(null, normalizar(res.d.places, nichoPedido), { seguinte: res.d.nextPageToken || null });
    }).catch(function (e) {
      clearTimeout(t);
      cb(new Error(e.name === "AbortError" ? "Google tardó demasiado" : e.message), []);
    });
  }

  return {
    buscar: buscar,
    chave: chave,
    definirChave: definirChave,
    temChave: temChave,
    /* útil para quem constrói o layout: pedir a mesma foto noutro tamanho
       sem refazer os URLs que vêm em `lead.fotos` */
    fotoUrl: fotoUrl,
    normalizar: normalizar,
    ANCHO_FOTO: ANCHO_FOTO,
    MAX_FOTOS: MAX_FOTOS
  };
})();
