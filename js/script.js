(function () {
  "use strict";

  /* ============ CONFIG ============ */
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const ARCHIVE_URL  = 'https://archive-api.open-meteo.com/v1/archive';
  const GEOCODE_URL  = 'https://geocoding-api.open-meteo.com/v1/search';
  const REVERSE_URL  = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
  const RAIN_THRESHOLD = 0.1; // mm, umbral para considerar que "llovió"
  const FALLBACK = { lat: -34.6037, lon: -58.3816, name: 'Buenos Aires, Argentina' };

  /* ============ DOM REFS ============ */
  const els = {
    searchForm:   document.getElementById('searchForm'),
    searchInput:  document.getElementById('searchInput'),
    suggestions:  document.getElementById('suggestions'),
    locateBtn:    document.getElementById('locateBtn'),
    errorBanner:  document.getElementById('errorBanner'),
    atmosphere:   document.getElementById('atmosphere'),

    locationName: document.getElementById('locationName'),
    weatherIcon:  document.getElementById('weatherIcon'),
    temperature:  document.getElementById('temperature'),
    conditionText:document.getElementById('conditionText'),
    feelsLike:    document.getElementById('feelsLike'),
    humidity:     document.getElementById('humidity'),
    wind:         document.getElementById('wind'),
    precipNow:    document.getElementById('precipNow'),

    runningScore: document.getElementById('runningScore'),
    runningLabel: document.getElementById('runningLabel'),
    runningDetail:document.getElementById('runningDetail'),
    cyclingScore: document.getElementById('cyclingScore'),
    cyclingLabel: document.getElementById('cyclingLabel'),
    cyclingDetail:document.getElementById('cyclingDetail'),

    lastRain:     document.getElementById('lastRain'),
    nextRain:     document.getElementById('nextRain'),
    hourlyScroll: document.getElementById('hourlyScroll'),
  };

  /* ============ WEATHER CODE MAPS ============ */
  const DESCRIPTIONS = {
    0: 'Cielo despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna intensa',
    56: 'Llovizna helada ligera', 57: 'Llovizna helada intensa',
    61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
    66: 'Lluvia helada ligera', 67: 'Lluvia helada intensa',
    71: 'Nevada ligera', 73: 'Nevada moderada', 75: 'Nevada intensa', 77: 'Granizo de nieve',
    80: 'Lluvias aisladas ligeras', 81: 'Lluvias aisladas moderadas', 82: 'Lluvias aisladas intensas',
    85: 'Nevadas aisladas ligeras', 86: 'Nevadas aisladas intensas',
    95: 'Tormenta eléctrica', 96: 'Tormenta con granizo ligero', 99: 'Tormenta con granizo intenso'
  };

  function weatherDescription(code) {
    return DESCRIPTIONS[code] || 'Condición desconocida';
  }

  function weatherIcon(code, isDay) {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if (code === 1 || code === 2) return isDay ? '🌤️' : '🌙';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if ([51,53,55,56,57].includes(code)) return '🌦️';
    if ([61,63,65,66,67,80,81,82].includes(code)) return '🌧️';
    if ([71,73,75,77,85,86].includes(code)) return '❄️';
    if ([95,96,99].includes(code)) return '⛈️';
    return '🌡️';
  }

  function moodFromCode(code, isDay) {
    if ([95,96,99].includes(code)) return 'storm';
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'rain';
    if ([71,73,75,77,85,86].includes(code)) return 'snow';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 2) return isDay ? 'cloudy-day' : 'cloudy-night';
    return isDay ? 'clear-day' : 'clear-night';
  }

  /* ============ ATMOSPHERE (visual layer) ============ */
  function makeEl(tag, cls) {
    const e = document.createElement(tag);
    e.className = cls;
    return e;
  }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function addClouds(container, n, opacity) {
    for (let i = 0; i < n; i++) {
      const c = makeEl('div', 'cloud');
      const w = rand(100, 250);
      c.style.width = w + 'px';
      c.style.height = (w * 0.5) + 'px';
      c.style.top = rand(5, 45) + '%';
      c.style.opacity = opacity;
      c.style.animationDuration = rand(60, 130) + 's';
      c.style.animationDelay = -rand(0, 100) + 's';
      container.appendChild(c);
    }
  }
  function addStars(container, n) {
    for (let i = 0; i < n; i++) {
      const s = makeEl('div', 'star');
      s.style.left = rand(0, 100) + '%';
      s.style.top = rand(0, 60) + '%';
      s.style.animationDelay = rand(0, 3) + 's';
      container.appendChild(s);
    }
  }
  function addRain(container, n) {
    for (let i = 0; i < n; i++) {
      const r = makeEl('div', 'raindrop');
      r.style.left = rand(0, 100) + '%';
      r.style.height = rand(40, 90) + 'px';
      r.style.animationDuration = rand(0.4, 1.1) + 's';
      r.style.animationDelay = -rand(0, 2) + 's';
      container.appendChild(r);
    }
  }
  function addSnow(container, n) {
    for (let i = 0; i < n; i++) {
      const s = makeEl('div', 'snowflake');
      const size = rand(3, 8);
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.left = rand(0, 100) + '%';
      s.style.animationDuration = rand(6, 14) + 's';
      s.style.animationDelay = -rand(0, 14) + 's';
      container.appendChild(s);
    }
  }
  function addFog(container, n) {
    for (let i = 0; i < n; i++) {
      const f = makeEl('div', 'fogband');
      f.style.top = (8 + i * 18) + '%';
      f.style.height = rand(30, 60) + 'px';
      f.style.animationDuration = rand(20, 45) + 's';
      container.appendChild(f);
    }
  }

  function buildAtmosphere(mood) {
    const c = els.atmosphere;
    c.innerHTML = '';
    switch (mood) {
      case 'clear-day':
        c.appendChild(makeEl('div', 'sun'));
        addClouds(c, 2, 0.35);
        break;
      case 'clear-night':
        addStars(c, 35);
        break;
      case 'cloudy-day':
        addClouds(c, 6, 0.7);
        break;
      case 'cloudy-night':
        addStars(c, 16);
        addClouds(c, 5, 0.55);
        break;
      case 'rain':
        addRain(c, 45);
        addClouds(c, 4, 0.8);
        break;
      case 'storm':
        addRain(c, 55);
        addClouds(c, 5, 0.9);
        c.appendChild(makeEl('div', 'flash'));
        break;
      case 'snow':
        addSnow(c, 35);
        addClouds(c, 3, 0.5);
        break;
      case 'fog':
        addFog(c, 5);
        break;
    }
  }

  /* ============ TIME HELPERS (hora local de la ubicación) ============ */
  function locationNowParts(utcOffsetSeconds) {
    const shifted = new Date(Date.now() + utcOffsetSeconds * 1000);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours()
    };
  }
  function hourKey(p) {
    return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T${String(p.hour).padStart(2,'0')}`;
  }
  function hourIsDay(timeStr) {
    const h = parseInt(timeStr.slice(11, 13), 10);
    return h >= 6 && h < 19;
  }
  function timeOfDay(timeStr) {
    return timeStr.slice(11, 13) + ':00 hs';
  }

  /* ============ ACTIVITY SCORING ============ */
  function clampScore(n) {
    return Math.max(1, Math.min(10, Math.round(n)));
  }

  function runningScore(temp, precip, precipProb, wind, humidity) {
    let score = 10;
    if (temp < 5) score -= (5 - temp) * 0.4 + 1.5;
    else if (temp < 10) score -= (10 - temp) * 0.25;
    else if (temp > 22) score -= (temp - 22) * 0.3;
    if (temp > 30) score -= (temp - 30) * 0.3;

    if (precip >= RAIN_THRESHOLD) score -= Math.min(precip * 3, 5);
    else if (precipProb > 50) score -= ((precipProb - 50) / 100) * 2.5;

    if (wind > 20) score -= (wind - 20) * 0.12;
    if (humidity > 75) score -= (humidity - 75) * 0.06;

    return clampScore(score);
  }

  function cyclingScore(temp, precip, precipProb, wind, gust, humidity) {
    let score = 10;
    if (temp < 8) score -= (8 - temp) * 0.35 + 1;
    else if (temp < 13) score -= (13 - temp) * 0.2;
    else if (temp > 26) score -= (temp - 26) * 0.3;
    if (temp > 32) score -= (temp - 32) * 0.4;

    if (precip >= RAIN_THRESHOLD) score -= Math.min(precip * 3.5, 6);
    else if (precipProb > 40) score -= ((precipProb - 40) / 100) * 2.5;

    if (wind > 15) score -= (wind - 15) * 0.18;
    if (gust > 40) score -= Math.min((gust - 40) * 0.1, 2);
    if (humidity > 80) score -= (humidity - 80) * 0.05;

    return clampScore(score);
  }

  function scoreLabel(score) {
    if (score >= 9) return 'Ideal';
    if (score >= 7) return 'Muy bueno';
    if (score >= 5) return 'Aceptable';
    if (score >= 3) return 'Poco recomendable';
    return 'No recomendado';
  }
  function scoreClass(score) {
    if (score >= 7) return 'score-good';
    if (score >= 4) return 'score-mid';
    return 'score-low';
  }

  function runningDetail(temp, precip, precipProb, wind, humidity, score) {
    if (score >= 9) return 'Condiciones ideales para salir a correr.';
    const reasons = [];
    if (temp < 5) reasons.push('hace mucho frío');
    else if (temp < 10) reasons.push('está fresco');
    else if (temp > 28) reasons.push('hace mucho calor');
    else if (temp > 22) reasons.push('está caluroso');
    if (precip >= RAIN_THRESHOLD) reasons.push('está lloviendo');
    else if (precipProb > 50) reasons.push('hay probabilidad de lluvia');
    if (wind > 25) reasons.push('hay viento fuerte');
    if (humidity > 80) reasons.push('la humedad es alta');
    if (!reasons.length) return 'Buenas condiciones para correr.';
    return 'Tené en cuenta que ' + reasons.join(' y ') + '.';
  }

  function cyclingDetail(temp, precip, precipProb, wind, gust, humidity, score) {
    if (score >= 9) return 'Condiciones ideales para salir a pedalear.';
    const reasons = [];
    if (temp < 8) reasons.push('hace frío');
    else if (temp > 32) reasons.push('hace mucho calor');
    else if (temp > 26) reasons.push('está caluroso');
    if (precip >= RAIN_THRESHOLD) reasons.push('está lloviendo y el piso puede estar resbaladizo');
    else if (precipProb > 40) reasons.push('podría llover');
    if (wind > 20) reasons.push('el viento puede complicar el pedaleo');
    if (gust > 45) reasons.push('hay rachas fuertes');
    if (!reasons.length) return 'Buenas condiciones para andar en bici.';
    return 'Tené en cuenta que ' + reasons.join(' y ') + '.';
  }

  function setScoreUI(scoreEl, labelEl, detailEl, score, detailText) {
    scoreEl.textContent = score;
    scoreEl.className = 'score ' + scoreClass(score);
    labelEl.textContent = scoreLabel(score);
    detailEl.textContent = detailText;
  }

  /* ============ RAIN ANALYSIS ============ */
  function formatRelativePast(hoursAgo) {
    if (hoursAgo <= 0) return 'En la última hora';
    if (hoursAgo === 1) return 'Hace 1 hora';
    if (hoursAgo < 24) return `Hace ${hoursAgo} horas`;
    const days = Math.floor(hoursAgo / 24);
    if (days === 1) return 'Ayer';
    return `Hace ${days} días`;
  }
  function formatRelativeFuture(hoursAhead, timeStr) {
    if (hoursAhead <= 0) return 'En la próxima hora';
    if (hoursAhead === 1) return 'En 1 hora';
    if (hoursAhead < 24) return `En ${hoursAhead} horas`;
    const days = Math.floor(hoursAhead / 24);
    if (days === 1) return `Mañana, ${timeOfDay(timeStr)}`;
    return `En ${days} días, ${timeOfDay(timeStr)}`;
  }

  function analyzeRain(hourly, idx) {
    let lastRain = 'Sin lluvias en los últimos días';
    let nextRain = 'No se prevé lluvia próximamente';

    const isRainingNow = hourly.precipitation[idx] >= RAIN_THRESHOLD;

    if (isRainingNow) {
      lastRain = 'Está lloviendo ahora';
    } else {
      for (let i = idx - 1; i >= 0; i--) {
        if (hourly.precipitation[i] >= RAIN_THRESHOLD) {
          lastRain = formatRelativePast(idx - i);
          break;
        }
      }
    }

    const searchStart = isRainingNow ? idx + 1 : idx;
    for (let i = searchStart; i < hourly.time.length; i++) {
      const prob = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
      if (hourly.precipitation[i] >= RAIN_THRESHOLD || prob >= 60) {
        nextRain = formatRelativeFuture(i - idx, hourly.time[i]);
        break;
      }
    }

    return { lastRain, nextRain };
  }

  /* ============ HOURLY FORECAST UI ============ */
  function buildHourly(hourly, idx) {
    const container = els.hourlyScroll;
    container.innerHTML = '';
    const end = Math.min(idx + 13, hourly.time.length);
    for (let i = idx; i < end; i++) {
      const item = document.createElement('div');
      item.className = 'hour-item';
      const label = i === idx ? 'Ahora' : hourly.time[i].slice(11, 13) + 'h';
      const icon = weatherIcon(hourly.weather_code[i], hourIsDay(hourly.time[i]));
      const temp = Math.round(hourly.temperature_2m[i]);
      const prob = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;

      const time = document.createElement('div');
      time.className = 'h-time';
      time.textContent = label;

      const ic = document.createElement('div');
      ic.className = 'h-icon';
      ic.textContent = icon;

      const t = document.createElement('div');
      t.className = 'h-temp';
      t.textContent = temp + '°';

      const r = document.createElement('div');
      r.className = 'h-rain';
      r.textContent = prob > 0 ? prob + '%' : '';

      item.append(time, ic, t, r);
      container.appendChild(item);
    }
  }

  /* ============ MAIN RENDER ============ */
  function render(data, name) {
    hideError();
    const cur = data.current;
    const hourly = data.hourly;
    const offset = data.utc_offset_seconds;
    const idx = (() => {
      const key = hourKey(locationNowParts(offset));
      const i = hourly.time.findIndex(t => t.slice(0, 13) === key);
      return i === -1 ? 0 : i;
    })();

    const isDay = cur.is_day === 1;

    els.locationName.textContent = name;
    els.temperature.textContent = Math.round(cur.temperature_2m) + '°';
    els.weatherIcon.textContent = weatherIcon(cur.weather_code, isDay);
    els.conditionText.textContent = weatherDescription(cur.weather_code);
    els.feelsLike.textContent = `Sensación ${Math.round(cur.apparent_temperature)}°`;
    els.humidity.textContent = `Humedad ${cur.relative_humidity_2m}%`;
    els.wind.textContent = `Viento ${Math.round(cur.wind_speed_10m)} km/h`;

    if (cur.precipitation >= RAIN_THRESHOLD) {
      els.precipNow.textContent = `Precipitación ${cur.precipitation} mm`;
      els.precipNow.classList.remove('hidden');
    } else {
      els.precipNow.classList.add('hidden');
    }

    const mood = moodFromCode(cur.weather_code, isDay);
    document.body.setAttribute('data-weather', mood);
    buildAtmosphere(mood);

    const precipProb = hourly.precipitation_probability ? hourly.precipitation_probability[idx] : 0;

    const run = runningScore(cur.temperature_2m, cur.precipitation, precipProb, cur.wind_speed_10m, cur.relative_humidity_2m);
    const cyc = cyclingScore(cur.temperature_2m, cur.precipitation, precipProb, cur.wind_speed_10m, cur.wind_gusts_10m, cur.relative_humidity_2m);

    setScoreUI(els.runningScore, els.runningLabel, els.runningDetail, run,
      runningDetail(cur.temperature_2m, cur.precipitation, precipProb, cur.wind_speed_10m, cur.relative_humidity_2m, run));
    setScoreUI(els.cyclingScore, els.cyclingLabel, els.cyclingDetail, cyc,
      cyclingDetail(cur.temperature_2m, cur.precipitation, precipProb, cur.wind_speed_10m, cur.wind_gusts_10m, cur.relative_humidity_2m, cyc));

    const rain = analyzeRain(hourly, idx);
    els.lastRain.textContent = rain.lastRain;
    els.nextRain.textContent = rain.nextRain;

    buildHourly(hourly, idx);
  }

  /* ============ DATA FETCHING ============ */
  async function loadWeather(lat, lon, name) {
    els.locationName.textContent = 'Cargando...';
    try {
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
        hourly: 'temperature_2m,precipitation,precipitation_probability,weather_code',
        timezone: 'auto',
        past_days: '3',
        forecast_days: '5'
      });
      const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
      if (!res.ok) throw new Error('weather');
      const data = await res.json();
      render(data, name);
    } catch (err) {
      showError('No se pudo obtener el clima. Probá de nuevo en un momento.');
    }
  }

  async function reverseGeocode(lat, lon) {
    try {
      const res = await fetch(`${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=es`);
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || 'Tu ubicación';
      return data.countryName ? `${city}, ${data.countryName}` : city;
    } catch {
      return 'Tu ubicación';
    }
  }

  function loadCurrentLocation() {
    els.locationName.textContent = 'Buscando tu ubicación...';
    if (!navigator.geolocation) {
      loadWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.name);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const name = await reverseGeocode(latitude, longitude);
        loadWeather(latitude, longitude, name);
      },
      () => {
        loadWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.name);
      },
      { timeout: 8000 }
    );
  }

  /* ============ SEARCH ============ */
  function hideSuggestions() {
    els.suggestions.innerHTML = '';
    els.suggestions.classList.add('hidden');
  }

  function renderSuggestions(results) {
    if (!results.length) { hideSuggestions(); return; }
    const ul = document.createElement('ul');
    results.forEach((r) => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      const parts = [r.name];
      if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
      parts.push(r.country);
      li.textContent = parts.join(', ');
      const select = () => {
        hideSuggestions();
        els.searchInput.value = '';
        loadWeather(r.latitude, r.longitude, `${r.name}, ${r.country}`);
      };
      li.addEventListener('click', select);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(); });
      ul.appendChild(li);
    });
    els.suggestions.innerHTML = '';
    els.suggestions.appendChild(ul);
    els.suggestions.classList.remove('hidden');
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  async function onSearchInput() {
    const q = els.searchInput.value.trim();
    if (q.length < 2) { hideSuggestions(); return; }
    try {
      const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=5&language=es&format=json`);
      const data = await res.json();
      renderSuggestions(data.results || []);
    } catch {
      hideSuggestions();
    }
  }

  async function onSearchSubmit(e) {
    e.preventDefault();
    const q = els.searchInput.value.trim();
    if (!q) return;
    try {
      const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=1&language=es&format=json`);
      const data = await res.json();
      if (!data.results || !data.results.length) {
        showError('No se encontró esa ciudad. Probá con otro nombre.');
        return;
      }
      const r = data.results[0];
      hideSuggestions();
      els.searchInput.value = '';
      loadWeather(r.latitude, r.longitude, `${r.name}, ${r.country}`);
    } catch {
      showError('Error al buscar la ciudad. Probá de nuevo.');
    }
  }

  /* ============ ERROR HELPERS ============ */
  function showError(msg) {
    els.errorBanner.textContent = msg;
    els.errorBanner.classList.remove('hidden');
  }
  function hideError() {
    els.errorBanner.classList.add('hidden');
  }

  /* ============ INIT ============ */
  els.searchForm.addEventListener('submit', onSearchSubmit);
  els.searchInput.addEventListener('input', debounce(onSearchInput, 350));
  els.locateBtn.addEventListener('click', loadCurrentLocation);
  document.addEventListener('click', (e) => {
    if (!els.suggestions.contains(e.target) && e.target !== els.searchInput) hideSuggestions();
  });

  buildAtmosphere('clear-day');
  loadCurrentLocation();
})();
