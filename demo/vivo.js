/* Autocomplete de zonas (cidades, distritos, bairros) com o Photon do Komoot.

   Só isto: a busca de negócios passou a ser a Google Places (`places.js`),
   porque o Overpass — que é voluntário — cai quando enche e não serve para uma
   interface a sério. */

window.Vivo = (function () {
  "use strict";

  var PHOTON = "https://photon.komoot.io/api/";

  function lugares(texto, cb) {
    if (!texto || texto.length < 2) { cb(null, []); return; }
    // sem `lang=es`: o Photon só aceita default/de/en/fr e responde com erro
    var url = PHOTON + "?q=" + encodeURIComponent(texto) + "&limit=8";
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var out = [];
      (d.features || []).forEach(function (f) {
        var p = f.properties || {};
        if (p.countrycode && p.countrycode !== "ES") return;
        var ext = p.extent;
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

  return { lugares: lugares };
})();
