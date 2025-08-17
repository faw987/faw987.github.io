



const API_KEY = '30c53af60391aaa9a3bfd3c6a3ecb723'; // <-- Add your real key!

const dropzone = document.getElementById('dropzone');
const resultsTable = document.getElementById('results');
const tbody = resultsTable.querySelector('tbody');

dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});
dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    handleFile(file);
});

async function handleFile(file) {
    dropzone.textContent = "Loading…";
    const text = await file.text();
    const locations = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    tbody.innerHTML = '';
    resultsTable.style.display = 'table';

    for (const location of locations) {
        const row = tbody.insertRow();
        row.insertCell().textContent = location;  // Cell 0: Location
        row.insertCell().textContent = 'Loading...'; // Cell 1: Hour (will be replaced)
        row.insertCell().textContent = '';           // Cell 2: Temp High (will be replaced)
        row.insertCell().textContent = '';           // Cell 3: Precip at High (will be replaced)
        console.log(`DEBUG: Processing location: "${location}"`);

        try {
            const geo = await geocodeLocation(location);
            console.log('DEBUG: Geocode result:', geo);
            if (!geo) throw new Error("Location not found");
            const forecast = await fetchForecast(geo.lat, geo.lon);
            console.log('DEBUG: Forecast fetched:', forecast);
            const { hour, tempF, precipIn } = analyzeForecast(forecast);

            console.log("DEBUG: Will update row:", {hour, tempF, precipIn});
            row.cells[1].textContent = hour;
            row.cells[2].textContent = tempF;
            row.cells[3].textContent = precipIn;
        } catch (e) {
            console.error("DEBUG: Error in city row", e);
            row.cells[1].textContent = row.cells[2].textContent = row.cells[3].textContent = "N/A";
        }
    }
    dropzone.textContent = "Drag & drop your locations text file here";
}

async function geocodeLocation(location) {
    // Add ,US for better targeting
    let q = location.match(/,.*US/i) ? location : location + ',US';
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data[0]) return null;
    return { lat: data[0].lat, lon: data[0].lon };
}

async function fetchForecast(lat, lon) {
    // 5 day / 3 hour forecast
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.list) throw new Error("No forecast data");
    return data;
}

function analyzeForecast(forecast) {
    const tzOffset = forecast.city.timezone; // in seconds
    const nowUTC = new Date();
    const nowLocal = new Date(nowUTC.getTime() + tzOffset * 1000);
    const localYear = nowLocal.getFullYear();
    const localMonth = nowLocal.getMonth();
    const localDate = nowLocal.getDate();

    console.log('DEBUG: Forecast city timezone offset (s):', tzOffset);
    console.log('DEBUG: Now (UTC):', nowUTC.toISOString());
    console.log('DEBUG: Now (local):', nowLocal.toISOString());
    console.log('DEBUG: Local today:', localYear, localMonth + 1, localDate);

    // Log all dt_txt entries with their local conversion
    forecast.list.forEach(item => {
        const forecastUTC = new Date(item.dt * 1000);
        const forecastLocal = new Date(forecastUTC.getTime() + tzOffset * 1000);
        console.log(
            `DEBUG: Forecast entry: dt_txt=${item.dt_txt}, UTC=${forecastUTC.toISOString()}, Local=${forecastLocal.toISOString()}`
        );
    });

    // Find today's entries (in local time)
    const todayData = forecast.list.filter(item => {
        const forecastUTC = new Date(item.dt * 1000);
        const forecastLocal = new Date(forecastUTC.getTime() + tzOffset * 1000);
        return (
            forecastLocal.getFullYear() === localYear &&
            forecastLocal.getMonth() === localMonth &&
            forecastLocal.getDate() === localDate
        );
    });

    console.log('DEBUG: # of forecast entries for today (local):', todayData.length);

    if (!todayData.length) {
        console.warn("No forecast data for today's local date!");
        throw new Error("No forecast for today");
    }

    todayData.forEach(item => {
        const forecastUTC = new Date(item.dt * 1000);
        const forecastLocal = new Date(forecastUTC.getTime() + tzOffset * 1000);
        console.log(
            `DEBUG: Today entry: Local=${forecastLocal.toISOString()}, Temp=${item.main.temp}`
        );
    });

    // Find highest temp
    let max = todayData[0];
    for (const item of todayData) {
        if (item.main.temp > max.main.temp) max = item;
    }
    const maxUTC = new Date(max.dt * 1000);
    const maxLocal = new Date(maxUTC.getTime() + tzOffset * 1000);
    const hour = maxLocal.getHours().toString().padStart(2, "0") + ":00";
    const tempF = kelvinToF(max.main.temp);
    const precipIn = mmToIn((max.rain?.['3h'] || 0) + (max.snow?.['3h'] || 0));
    console.log(`DEBUG: Max temp ${tempF}F at ${hour}, precip: ${precipIn}"`);
    return { hour, tempF, precipIn };
}