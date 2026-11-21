/* Busca de negócios em tempo real com a Google Places API (New).

   É a mesma fonte que o SitesLead usa (`/api/places` no código deles). Ao
   contrário do OpenStreetMap, que é um serviço voluntário e cai quando enche,
   aqui a resposta é imediata e traz telefone, site, nota e nº de avaliações.

   A chave: NÃO vai no repositório. Guarda-se em localStorage, no browser de
   quem usa a demo. Para produção, o normal é pôr um proxy (Vercel/Worker) à
   frente e restringir a chave ao domínio — está explicado no painel.

   Custo aproximado: Text Search devolve 20 resultados por pedido; com o field
   mask abaixo (campos Pro) ronda 32 USD por 1000 pedidos. Para uma demo, são
   cêntimos. */

window.Places = (function () {
  "use strict";

  var CLAVE = "escaparate_places_key";
  var URL = "https://places.googleapis.com/v1/places:searchText";
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
    "nextPageToken"
  ].join(",");

  function chave() {
    try { return (localStorage.getItem(CLAVE) || "").trim(); } catch (e) { return ""; }
  }
  function definirChave(k) {
    try { localStorage.setItem(CLAVE, (k || "").trim()); } catch (e) {}
  }
  function temChave() { return chave().length > 20; }

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

  function normalizar(places, nichoPedido) {
    var out = [];
    (places || []).forEach(function (p) {
      var tel = p.nationalPhoneNumber || p.internationalPhoneNumber || "";
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
        lon: p.location && p.location.longitude
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

  return { buscar: buscar, chave: chave, definirChave: definirChave, temChave: temChave };
})();
