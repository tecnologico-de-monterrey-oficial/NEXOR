// main.js

const map = L.map('map').setView([25.6866, -100.3161], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let storeData = [];
let markers = [];
let manualMarker = null;
let socioLayer, popTrafficLayer, municipalIncomeLayer, municipalPopulationLayer;
let socioData = null;
let popTrafficData = null;
let successDataMap = {};
let municipioData = [];
let seguridadMensual = {};

const infoFilters = {
  MTS2VENTAS_NUM: true,
  ENTORNO_DES: true,
  NIVELSOCIOECONOMICO_DES: true,
  Porcentaje_Exito: true,
  socioLayer: true,
  popTrafficLayer: true,
  municipalIncomeLayer: true,
  showCompetition: true,
  municipalPopulationLayer: true,
  showPoints: true
};

document.querySelectorAll('.info-toggle').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    infoFilters[checkbox.value] = checkbox.checked;
    renderMarkers();
    toggleMapLayers();
  });
});

Promise.all([
  fetch("data/nuevo_leon_ingresos_mensuales_FINAL(2).json").then(r => r.json()),
  fetch("data/nuevo_leon_poblacion_municipios.json").then(r => r.json()),
  fetch("data/pop_traffic_mock_nl_tam.geojson").then(r => r.json()),
  fetch("data/indice_seguridad_normalizado_nl_abril2024_abril2025.json").then(r => r.json()),
  fetch("data/DIM_TIENDA_REAL.json").then(r => r.json()),
  fetch("data/nearest_competition.json").then(r => r.json())
]).then(([incomeData, popData, trafficData, securityData, storeData, competitionData]) => {
  // store them in global vars
});


fetch('data/indice_seguridad_normalizado_nl_abril2024_abril2025.json')
  .then(res => res.json())
  .then(data => {
    data.forEach(entry => {
      seguridadMensual[entry.municipio.trim().toLowerCase()] = entry.indice_mensual;
    });
  });

fetch('data/Resumen_Porcentaje_Exito_Tiendas_Limpio.json')
  .then(res => res.json())
  .then(successData => {
    successData.forEach(row => {
      successDataMap[row.TIENDA_ID] = row;
    });
    return fetch('data/DIM_TIENDA_REAL.json');
  })
  .then(res => res.json())
  .then(data => {
    storeData = data.filter(d =>
      typeof d.LATITUD_NUM === 'number' &&
      typeof d.LONGITUD_NUM === 'number'
    );
    storeData.forEach(store => {
      const match = successDataMap[store.TIENDA_ID];
      if (match) {
        store.Porcentaje_Exito = match.Porcentaje_Exito;
        store.Rango_Exito = match.Rango_Exito;
      }
    });
    renderMarkers();
    toggleMapLayers();
  });

let competitionMap = {};
fetch('data/nearest_competition.json')
  .then(res => res.json())
  .then(data => {
    data.forEach(row => {
      competitionMap[row.TIENDA_ID] = {
        nombre: row.nombre,
        distancia: parseFloat(row.distancia)
      };
    });
  });

function renderMarkers() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  storeData.forEach(store => {
    const lat = store.LATITUD_NUM;
    const lon = store.LONGITUD_NUM;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;
    let info = `<b>Store ID: ${store.TIENDA_ID}</b><br>`;
    if (infoFilters.MTS2VENTAS_NUM) info += `🧾 Sales Area: ${store.MTS2VENTAS_NUM} m²<br>`;
    if (infoFilters.ENTORNO_DES) info += `🏙️ Environment: ${store.ENTORNO_DES}<br>`;
    if (infoFilters.NIVELSOCIOECONOMICO_DES) info += `💼 Socioeconomic: ${store.NIVELSOCIOECONOMICO_DES}<br>`;
    const comp = competitionMap[store.TIENDA_ID];
    if (comp && infoFilters.showCompetition) {
      info += `🏪 Nearest Competition: ${comp.nombre}<br>📏 Distance: ${comp.distancia.toFixed(1)} m<br>`;
    }
    if (store.Porcentaje_Exito !== undefined && infoFilters.Porcentaje_Exito) {
      info += `📊 Success: ${store.Porcentaje_Exito.toFixed(1)}% ${getSuccessBadge(store.Rango_Exito)}<br>`;
    }
    const marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(info);
    marker.on('click', () => showDetails(store));
    markers.push(marker);
  });
}

function getNearestCompetitor(lat, lon) {
  let minDist = Infinity;
  let nearest = null;
  const point = turf.point([lon, lat]);

  storeData.forEach(store => {
    const comp = competitionMap[store.TIENDA_ID];
    if (!store.LATITUD_NUM || !store.LONGITUD_NUM) return;

    const storePoint = turf.point([store.LONGITUD_NUM, store.LATITUD_NUM]);
    const dist = turf.distance(point, storePoint, { units: "meters" });

    if (dist < minDist) {
      minDist = dist;
      nearest = { ...comp, distance: dist };
    }
  });

  return nearest;
}


function getSuccessBadge(rango) {
  const color = { 'Alto': 'green', 'Medio': 'orange', 'Bajo': 'red' }[rango] || 'gray';
  return `<span style="color:${color}; font-weight:bold;">(${rango})</span>`;
}

function showDetails(store) {
  const container = document.getElementById("tables-container");
  const comp = competitionMap[store.TIENDA_ID];

  let html = `<table>`;
  html += `<tr><th>Store ID</th><td>${store.TIENDA_ID}</td></tr>`;
  if (infoFilters.MTS2VENTAS_NUM) html += `<tr><th>Sales Area</th><td>${store.MTS2VENTAS_NUM} m²</td></tr>`;
  if (infoFilters.ENTORNO_DES) html += `<tr><th>Environment</th><td>${store.ENTORNO_DES}</td></tr>`;
  if (infoFilters.NIVELSOCIOECONOMICO_DES) html += `<tr><th>Socioeconomic Level</th><td>${store.NIVELSOCIOECONOMICO_DES}</td></tr>`;
  if (comp) html += `<tr><th>Closest Competition</th><td>${comp.nombre} (${comp.distancia.toFixed(1)} m)</td></tr>`;
  if (store.Porcentaje_Exito !== undefined && infoFilters.Porcentaje_Exito)
    html += `<tr><th>Success</th><td>${store.Porcentaje_Exito.toFixed(1)}% ${getSuccessBadge(store.Rango_Exito)}</td></tr>`;
  html += `<tr><th>Lat</th><td>${store.LATITUD_NUM}</td></tr>`;
  html += `<tr><th>Lon</th><td>${store.LONGITUD_NUM}</td></tr>`;
  html += `</table>`;

  container.innerHTML = html;
}

function toggleMapLayers() {
  if (socioLayer) infoFilters.socioLayer ? map.addLayer(socioLayer) : map.removeLayer(socioLayer);
  if (popTrafficLayer) infoFilters.popTrafficLayer ? map.addLayer(popTrafficLayer) : map.removeLayer(popTrafficLayer);
  if (municipalIncomeLayer) infoFilters.municipalIncomeLayer ? map.addLayer(municipalIncomeLayer) : map.removeLayer(municipalIncomeLayer);
  if (municipalPopulationLayer) infoFilters.municipalPopulationLayer ? map.addLayer(municipalPopulationLayer) : map.removeLayer(municipalPopulationLayer);
}

fetch('data/nuevo_leon_ingresos_mensuales_FINAL(2).json')
  .then(res => res.json())
  .then(data => {
    municipioData = data;
    return fetch('data/nuevo_leon_municipios.geojson');
  })
  .then(res => res.json())
  .then(geo => {
    geo.features.forEach(f => {
      const name = f.properties.name.trim().toLowerCase();
      const match = municipioData.find(d => d.municipio.trim().toLowerCase() === name);
      if (match) {
        f.properties.ingreso_mensual = match.ingreso_mensual;
        const ingreso = match.ingreso_mensual;
        f.properties.nivel_seguridad = ingreso > 8500 ? "Alto" : ingreso > 7000 ? "Medio" : "Bajo";
      }
    });

    municipalIncomeLayer = L.geoJSON(geo, {
      style: feature => ({
        fillColor: getIncomeColor(feature.properties.ingreso_mensual),
        weight: 1,
        color: "#666",
        fillOpacity: 0.6
      }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        layer.bindPopup(`
          <b>${props.name}</b><br>
          💵 Ingreso mensual: $${props.ingreso_mensual?.toLocaleString() || 'N/D'}<br>
          🛡️ Seguridad: ${props.nivel_seguridad || 'N/D'}
        `);
        layer.on('click', () => showMunicipioDetails(props));
      }
    });

    if (infoFilters.municipalIncomeLayer) {
      map.addLayer(municipalIncomeLayer);
    }
  });

function getSuccessBadge(rango) {
  const color = { 'Alto': 'green', 'Medio': 'orange', 'Bajo': 'red' }[rango] || 'gray';
  return `<span style="color:${color}; font-weight:bold;">(${rango})</span>`;
}

let municipioPoblacionData = [];

fetch('data/nuevo_leon_poblacion_municipios.json')
  .then(res => res.json())
  .then(poblacionData => {
    municipioPoblacionData = poblacionData;
    return fetch('data/nuevo_leon_municipios.geojson');
  })
  .then(res => res.json())
  .then(geo => {
    geo.features.forEach(f => {
      const name = f.properties.name.trim().toLowerCase();
      const match = municipioPoblacionData.find(d => d.municipio.trim().toLowerCase() === name);
      if (match) {
        f.properties.poblacion = match.poblacion;
      }
    });

    municipalPopulationLayer = L.geoJSON(geo, {
      style: feature => ({
        fillColor: getPopulationColor(feature.properties.poblacion),
        weight: 1,
        color: "#555",
        fillOpacity: 0.5
      }),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        layer.bindPopup(`
          <b>${props.name}</b><br>
          👥 Población: ${props.poblacion?.toLocaleString() || 'N/D'}
        `);
        layer.on('click', () => showMunicipioDetails(props));
      }
    });

    if (infoFilters.municipalPopulationLayer) {
      map.addLayer(municipalPopulationLayer);
    }
  });

function getIncomeColor(val) {
  return val > 9000 ? '#084081' :
         val > 8000 ? '#0868ac' :
         val > 7000 ? '#2b8cbe' :
         val > 6000 ? '#4eb3d3' :
         val > 5000 ? '#7bccc4' :
         val > 4000 ? '#a8ddb5' :
                      '#ccebc5';
}

function getPopulationColor(val) {
  return val > 500000 ? '#08306b' :
         val > 250000 ? '#2171b5' :
         val > 100000 ? '#4292c6' :
         val > 50000  ? '#6baed6' :
         val > 20000  ? '#9ecae1' :
         val > 10000  ? '#c6dbef' :
                        '#deebf7';
}

function showMunicipioDetails(props) {
  const container = document.getElementById("tables-container");
  container.innerHTML = `
    <table>
      <tr><th>Municipio</th><td>${props.name}</td></tr>
      <tr><th>Ingreso mensual</th><td>$${props.ingreso_mensual?.toLocaleString() || 'N/D'}</td></tr>
      <tr><th>Seguridad</th><td>${props.nivel_seguridad || 'N/D'}</td></tr>
      <tr><th>Población</th><td>${props.poblacion?.toLocaleString() || 'N/D'}</td></tr>
    </table>
  `;

  const chartData = seguridadMensual[props.name.trim().toLowerCase()];
  renderChart(chartData || []);
}

document.getElementById("plot-point").addEventListener("click", () => {
  const lat = parseFloat(document.getElementById("input-lat").value);
  const lon = parseFloat(document.getElementById("input-lon").value);
  if (!isNaN(lat) && !isNaN(lon)) {
    plotCoordinateFromClick(lat, lon);
  } else {
    alert("Please enter valid coordinates.");
  }
});

map.on("click", function (e) {
  const lat = e.latlng.lat.toFixed(6);
  const lon = e.latlng.lng.toFixed(6);

  L.popup()
    .setLatLng([lat, lon])
    .setContent(`<b>Coordinates:</b><br>${lat}, ${lon}`)
    .openOn(map);

  document.getElementById("input-lat").value = lat;
  document.getElementById("input-lon").value = lon;
  plotCoordinateFromClick(parseFloat(lat), parseFloat(lon));

});

function countNearbyCompetitors(lat, lon, radiusMeters = 1000) {
  let count = 0;
  if (!competitionMap || Object.keys(competitionMap).length === 0) return 0;

  const point = turf.point([lon, lat]);

  storeData.forEach(store => {
    const comp = competitionMap[store.TIENDA_ID];
    if (!comp || !store.LATITUD_NUM || !store.LONGITUD_NUM) return;

    const compPoint = turf.point([store.LONGITUD_NUM, store.LATITUD_NUM]);
    const distance = turf.distance(point, compPoint, { units: 'meters' });

    if (distance <= radiusMeters) count++;
  });

  return count;
}

function plotCoordinateFromClick(lat, lon) {
  console.log("🧠 Sending site context to Python", [lat, lon]);
  if (isNaN(lat) || isNaN(lon)) return;

  // Marker logic
  if (manualMarker) {
    manualMarker.setLatLng([lat, lon]);
  } else {
    manualMarker = L.marker([lat, lon], {
      icon: L.icon({
        iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      })
    }).addTo(map).bindPopup("Manual Location");
  }

  map.panTo([lat, lon]);

  const coordPoint = turf.point([lon, lat]);
  let socioMatch = null, popTrafficMatch = null, municipioMatch = null;

  // Match socio layer
  if (socioData) {
    for (let f of socioData.features) {
      try {
        const poly = turf.polygon(f.geometry.coordinates);
        if (turf.booleanPointInPolygon(coordPoint, poly)) {
          socioMatch = f.properties;
          break;
        }
      } catch (err) {
        console.warn("⚠️ Skipping bad socio polygon", err.message);
      }
    }
  }

  // Match population/traffic
  if (popTrafficData) {
    for (let f of popTrafficData.features) {
      try {
        const poly = turf.polygon(f.geometry.coordinates);
        if (turf.booleanPointInPolygon(coordPoint, poly)) {
          popTrafficMatch = f.properties;
          break;
        }
      } catch (err) {
        console.warn("⚠️ Skipping bad traffic polygon", err.message);
      }
    }
  }

  // Match income layer
  if (municipalIncomeLayer) {
    for (let f of municipalIncomeLayer.toGeoJSON().features) {
      try {
        const poly = turf.polygon(f.geometry.coordinates);
        if (turf.booleanPointInPolygon(coordPoint, poly)) {
          municipioMatch = f.properties;
          break;
        }
      } catch (err) {
        console.warn("⚠️ Skipping bad income polygon", err.message);
      }
    }
  }

  // 📍 Build popup
  let popupContent = `<b>Lat:</b> ${lat}<br><b>Lon:</b> ${lon}<br>`;
  if (socioMatch && infoFilters.socioLayer) {
    popupContent += `<b>Region:</b> ${socioMatch.region}<br>`;
    if (infoFilters.NIVELSOCIOECONOMICO_DES)
      popupContent += `<b>Socio Level:</b> ${socioMatch.socioeconomic_level}<br>`;
  }
  if (popTrafficMatch && infoFilters.popTrafficLayer) {
    popupContent += `<b>Population:</b> ${popTrafficMatch.population_density}/km²<br>`;
    popupContent += `<b>Traffic:</b> ${popTrafficMatch.traffic_density} veh/hr<br>`;
  }
  if (municipioMatch && infoFilters.municipalIncomeLayer) {
    popupContent += `<b>Municipio:</b> ${municipioMatch.name}<br>`;
    popupContent += `<b>Ingreso mensual:</b> $${municipioMatch.ingreso_mensual?.toLocaleString() || 'N/D'}<br>`;
    popupContent += `<b>Seguridad:</b> ${municipioMatch.nivel_seguridad || 'N/D'}<br>`;
  }

  manualMarker.bindPopup(popupContent).openPopup();

  // ✅ Safely calculate nearest competitor
  const nearestComp = getNearestCompetitor(lat, lon);

  // ✅ Safe placeholder for POI
  const nearestPOI = { nombre: "Sin datos" };

  // 📦 Build feature object to send to Flask
  const siteContext = {
    NIVELSOCIOECONOMICO_DES: socioMatch?.socioeconomic_level || "Desconocido",
    ENTORNO_DES: socioMatch?.region || "Desconocido",
    COMPETENCIA_MAS_CERCANO: nearestComp?.nombre || "Sin datos",
    SEGMENTO_MAESTRO_DESC: "CONVENCIONAL",
    LID_UBICACION_TIENDA: "REGION 1",
    POI_MAS_CERCANO: nearestPOI?.nombre || "Sin datos",
    RAILWAY_STATION_MAS_CERCANO: "Sin datos",
    BUILDING_MAS_CERCANO: "Sin datos",
    WATER_MAS_CERCANO: "Sin datos",
    ELEVATION_MAS_CERCANO: "Sin datos",
    Municipio: municipioMatch?.name || "Desconocido",
    Nivel_Inseguridad: municipioMatch?.nivel_seguridad || "Desconocido",
    Cerca_Hospital: "CERCANO",
    Cerca_Universidad: "LEJANO",
    Cerca_Gobierno: "MEDIANO",
    Zona_Escolar_Cercana: "Primaria",
    DISTANCIA_COMPETENCIA_M_CAT: "MEDIANO",
    DISTANCIA_POI_M_CAT: "CERCANO",
    DISTANCIA_RAILWAY_STATION_M_CAT: "LEJANO",
    DISTANCIA_PUBLIC_TRANSPORT_M_CAT: "MEDIANO",
    DISTANCIA_BUILDING_M_CAT: "LEJANO",
    DISTANCIA_MILESTONE_M_CAT: "LEJANO",
    DISTANCIA_WATER_M_CAT: "LEJANO",
    DISTANCIA_ELEVATION_M_CAT: "LEJANO",
    DISTANCIA_CROSSING_M_CAT: "LEJANO",
    DISTANCIA_POWER_LINE_M_CAT: "LEJANO",
    DISTANCIA_DRAINAGE_M_CAT: "LEJANO",
    DISTANCIA_PARKING_M_CAT: "LEJANO"
  };

  console.log("📦 Sending this to Python:", siteContext);

  fetch("http://127.0.0.1:5000/evaluate-site", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(siteContext)
})
    .then(res => res.json())
    .then(result => {
  const reasons = result.reasons?.join(', ') || "No explanation given";
  alert(`📍 Should you open an OXXO here?\n✅ ${result.recommendation}\n\n📊 Score: ${result.score}\n💡 Why: ${reasons}`);
})
    .catch(err => {
      console.error("❌ Error talking to Python backend:", err);
    });
}

console.log("📦 Sending this to Python:", siteContext);


function toggleManualFilters() {
  const manualBox = document.getElementById("manual-filters");
  const infoBox = document.getElementById("info-box");
  const arrow = document.getElementById("manual-arrow");

  isManualExpanded = !isManualExpanded;
  manualBox.classList.toggle("expanded", isManualExpanded);
  arrow.textContent = isManualExpanded ? "▼" : "▶";

  adjustInfoBoxPosition();
}

function toggleInfoBox() {
  const infoBox = document.getElementById("info-box");
  const arrow = document.getElementById("info-arrow");

  isInfoExpanded = !isInfoExpanded;
  infoBox.classList.toggle("expanded", isInfoExpanded);
  arrow.textContent = isInfoExpanded ? "▼" : "▶";
}

function adjustInfoBoxPosition() {
  const infoBox = document.getElementById("info-box");
  infoBox.style.marginTop = isManualExpanded ? "8px" : "0px";
}

let municipioChart = null;

function renderChart(data) {
  const ctx = document.getElementById("municipioChart").getContext("2d");

  const labels = data.map(entry => entry.mes);
  const values = data.map(entry => entry.valor);

  if (municipioChart) {
    municipioChart.destroy();
  }

  municipioChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Índice de seguridad (1–100)',
        data: values,
        fill: false,
        borderColor: '#ed1c24',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}



