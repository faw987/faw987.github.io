const dropzone = document.getElementById('dropzone');
const resultsTable = document.getElementById('results');
const tbody = resultsTable.querySelector('tbody');

// Nominatim geocoding (OpenStreetMap)
async function geocodeLocation(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location + ', USA')}&limit=1&addressdetails=0`;
    const res = await fetch(url, {headers: {'User-Agent': 'NWS Weather App'}});
    const data = await res.json();
    if (!data || !data[0]) return null;
    return { lat: data[0].lat, lon: data[0].lon };
}

// Get NWS hourly forecast grid endpoint
async function getNwsGridEndpoint(lat, lon) {
    const url = `https://api.weather.gov/points/${lat},${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("NWS grid lookup failed");
    const data = await res.json();
    return data.properties.forecastHourly;
}

// Get NWS hourly forecast for this gridpoint
async function fetchNwsHourlyForecast(hourlyUrl) {
    const res = await fetch(hourlyUrl);
    if (!res.ok) throw new Error("NWS hourly forecast fetch failed");
    const data = await res.json();
    return data.properties.periods;
}

// Main analyze: get today's highest temp hour, temp, precip
function analyzeNwsHourlyForecast(periods) {
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = now.getMonth();
    const localDate = now.getDate();

    // Only entries for today (local time)
    const todayData = periods.filter(item => {
        const t = new Date(item.startTime);
        return (
            t.getFullYear() === localYear &&
            t.getMonth() === localMonth &&
            t.getDate() === localDate
        );
    });

    console.log('DEBUG: Found', todayData.length, 'NWS hourly entries for today.');

    if (!todayData.length) throw new Error("No forecast for today");
    // Find highest temp (NWS gives F, not C!)
    let max = todayData[0];
    for (const item of todayData) {
        if (item.temperature > max.temperature) max = item;
    }
    const t = new Date(max.startTime);
    const hour = t.getHours().toString().padStart(2, "0") + ":00";
    const tempF = max.temperature;
    // Precipitation: NWS has probabilityOfPrecipitation.value (percent), but not always precip amount
    const precipIn = (max.probabilityOfPrecipitation && max.probabilityOfPrecipitation.value != null)
        ? max.probabilityOfPrecipitation.value + '%'
        : '--';
    return { hour, tempF, precipIn };
}

// UI
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
        row.insertCell().textContent = location;
        row.insertCell().textContent = 'Loading...';
        row.insertCell().textContent = '';
        row.insertCell().textContent = '';
        console.log(`DEBUG: Processing location: "${location}"`);

        try {
            const geo = await geocodeLocation(location);
            console.log('DEBUG: Geocode result:', geo);
            if (!geo) throw new Error("Location not found");
            const gridUrl = await getNwsGridEndpoint(geo.lat, geo.lon);
            console.log('DEBUG: NWS grid endpoint:', gridUrl);
            const periods = await fetchNwsHourlyForecast(gridUrl);
            console.log('DEBUG: NWS hourly periods:', periods);
            const { hour, tempF, precipIn } = analyzeNwsHourlyForecast(periods);

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