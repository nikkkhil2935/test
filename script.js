document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // !!! IMPORTANT: Replace YOUR_BACKEND_IP with your actual Render backend URL
    const BACKEND_URL_STATUS = 'https://my-coldchain-backend.onrender.com/api/status'; // Example Render URL
    const BACKEND_URL_ALERTS = 'https://my-coldchain-backend.onrender.com/api/alerts'; // Example Render URL
    // --- Other configurations ---
    const UPDATE_INTERVAL_MS = 10000; // Update status/KPIs every 10 seconds
    const ALERT_UPDATE_INTERVAL_MS = 60000; // Update alert log every 60 seconds
    const INITIAL_RSL_DAYS = 20;      // Product's starting shelf life in days
    const MAX_CHART_POINTS = 24;      // Max data points to show on the live charts
    const MAP_INITIAL_COORDS = [19.42, 72.82]; // Initial map center (Near Vasai)
    const MAP_INITIAL_ZOOM = 10;
    // --- ---

    // --- DOM Elements ---
    const statusIndicator = document.getElementById('statusIndicator');
    const tempValue = document.getElementById('tempValue');
    const humValue = document.getElementById('humValue');
    const rslValue = document.getElementById('rslValue');
    const rslBar = document.getElementById('rslBar');
    const initialRslDisplay = document.getElementById('initialRsl');
    const kpiJourneyTime = document.getElementById('kpiJourneyTime'); // Correct variable name
    const kpiAvgTemp = document.getElementById('kpiAvgTemp');
    const kpiMinTemp = document.getElementById('kpiMinTemp');
    const kpiMaxTemp = document.getElementById('kpiMaxTemp');
    const kpiTimeIn = document.getElementById('kpiTimeIn');
    const kpiTimeOut = document.getElementById('kpiTimeOut');
    const latValueText = document.getElementById('latValueText');
    const lngValueText = document.getElementById('lngValueText');
    const lastUpdateFull = document.getElementById('lastUpdateFull');
    const tempChartCanvas = document.getElementById('tempChart');
    const rslChartCanvas = document.getElementById('rslChart');
    const mapContainer = document.getElementById('map');
    const alertLogBody = document.getElementById('alertLogBody');
    // --- ---

    // --- Chart.js State ---
    let tempChart, rslChart;
    const liveChartLabels = [];
    const liveTempData = [];
    const liveRslData = [];
    // --- ---

    // --- Leaflet Map State ---
    let map;
    let marker;
    // --- ---

    // --- Initialization Functions ---
    function initializeCharts() {
        if (tempChartCanvas) {
            const ctxTemp = tempChartCanvas.getContext('2d');
            tempChart = new Chart(ctxTemp, {
                type: 'line',
                data: {
                    labels: liveChartLabels,
                    datasets: [{
                        label: 'Temperature (°C)', data: liveTempData,
                        borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.1, fill: true, pointRadius: 2, pointHoverRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { maxTicksLimit: 10, font: { size: 9 } } },
                        y: { beginAtZero: false, title: { display: true, text: 'Temp (°C)', font: { size: 10 } }, ticks: { font: { size: 9 } } }
                    },
                    plugins: { legend: { display: false } }, animation: false
                }
            });
            console.log("Temperature Chart initialized.");
        } else { console.error("Temp Chart canvas not found!"); }

        if (rslChartCanvas) {
            const ctxRsl = rslChartCanvas.getContext('2d');
            rslChart = new Chart(ctxRsl, {
                type: 'line',
                data: {
                    labels: liveChartLabels, // Use the same time labels
                    datasets: [{
                        label: 'Predicted RSL (Days)', data: liveRslData,
                        borderColor: 'rgb(46, 204, 113)', backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        tension: 0.1, fill: true, pointRadius: 2, pointHoverRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { ticks: { maxTicksLimit: 10, font: { size: 9 } } },
                        y: { beginAtZero: false, title: { display: true, text: 'RSL (Days)', font: { size: 10 } }, ticks: { font: { size: 9 } } }
                    },
                    plugins: { legend: { display: false } }, animation: false
                }
            });
             console.log("RSL Chart initialized.");
        } else { console.error("RSL Chart canvas not found!"); }
    }

    function initializeMap() {
         if (!mapContainer) { console.error("Map container 'map' not found."); return; }
         if (typeof L === 'undefined') { console.error("Leaflet library (L) not found."); mapContainer.innerHTML = "Map library failed to load."; return; }
         try {
             map = L.map(mapContainer).setView(MAP_INITIAL_COORDS, MAP_INITIAL_ZOOM);
             L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
             console.log("Leaflet map initialized.");
         } catch (e) { console.error("Error initializing Leaflet map:", e); mapContainer.innerHTML = "Error loading map."; map = null; }
    }
    // --- ---

    // --- Update Functions ---
    function updateLiveCharts(newTimeLabel, newTempValue, newRslValue) {
        if (!tempChart || !rslChart) return;

        liveChartLabels.push(newTimeLabel);
        liveTempData.push(newTempValue); // Chart.js handles nulls gracefully
        liveRslData.push(newRslValue);   // Chart.js handles nulls gracefully

        while (liveChartLabels.length > MAX_CHART_POINTS) {
            liveChartLabels.shift();
            liveTempData.shift();
            liveRslData.shift();
        }

        tempChart.update('none'); // Update without animation
        rslChart.update('none');  // Update without animation
    }

    function updateRslDisplay(currentRsl, initialRsl) {
         rslValue.textContent = (currentRsl !== null && currentRsl !== undefined) ? currentRsl.toFixed(2) : '--';
         initialRslDisplay.textContent = initialRsl;
         let percentage = 100;
         if (currentRsl !== null && currentRsl !== undefined && initialRsl > 0) {
             percentage = Math.max(0, Math.min(100, (currentRsl / initialRsl) * 100));
         }
         rslBar.style.width = `${percentage}%`;
         rslBar.className = 'rsl-bar';
         if (percentage < 30) rslBar.classList.add('low');
         else if (percentage < 60) rslBar.classList.add('medium');
    }

    function updateMapMarker(lat, lng) {
         if (!map) return;
         latValueText.textContent = (lat !== null && lat !== undefined && !isNaN(lat)) ? lat.toFixed(4) : '--';
         lngValueText.textContent = (lng !== null && lng !== undefined && !isNaN(lng)) ? lng.toFixed(4) : '--';
         if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
             if(marker) marker.setOpacity(0.5);
             // console.log("Skipping map marker update due to invalid/null coordinates."); // Reduce noise
             return;
         }
         const newLatLng = L.latLng(lat, lng);
         if (!marker) {
             marker = L.marker(newLatLng, { title: "Container" }).addTo(map);
             marker.bindPopup(`<b>Container CON-101</b>`).openPopup();
             map.setView(newLatLng, 15);
         } else {
             marker.setLatLng(newLatLng);
             marker.setPopupContent(`<b>Container CON-101</b><br>Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
             if (!map.getBounds().contains(newLatLng)) map.panTo(newLatLng);
             marker.setOpacity(1.0);
         }
    }

    function updateAlertLogTable(alerts) {
        if (!alertLogBody) return;
        alertLogBody.innerHTML = '';
        if (!alerts || alerts.length === 0) {
            alertLogBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #7f8c8d;">No alerts recorded yet.</td></tr>';
            return;
        }
        alerts.forEach(alert => {
            const row = alertLogBody.insertRow();
            const startTime = alert.start_time ? new Date(alert.start_time).toLocaleString() : 'N/A';
            const endTime = alert.end_time ? new Date(alert.end_time).toLocaleString() : 'Ongoing';
            const peakNadir = (alert.peak_value !== null && !isNaN(alert.peak_value)) ? `${parseFloat(alert.peak_value).toFixed(1)} &deg;C` : '--';
            const type = alert.type || 'N/A';
            if (!alert.end_time) { row.style.backgroundColor = "#fffbe6"; row.style.fontWeight = "bold"; }
            row.insertCell().textContent = startTime;
            row.insertCell().textContent = endTime;
            row.insertCell().textContent = type;
            row.insertCell().innerHTML = peakNadir;
        });
    }

    // --- Helper function to safely format numbers ---
    // *** Ensures it handles null AND undefined ***
    function safeToFixed(value, digits = 1) {
        if (value === null || typeof value === 'undefined' || isNaN(parseFloat(value))) {
            return '--'; // Return placeholder if invalid
        }
        return parseFloat(value).toFixed(digits);
    }


    // --- Main Data Fetching and UI Update Logic ---
    async function fetchAndUpdateStatus() {
        const now = new Date();
        const currentTimeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'});
        const fullTimestamp = now.toLocaleString();

        let data = {};

        try {
            const response = await fetch(BACKEND_URL_STATUS);
            if (!response.ok) throw new Error(`Status fetch error! ${response.status}`);
            data = await response.json(); // Assign fetched data HERE

            // --- Update Status ---
            let statusText = (data.status || 'UNKNOWN').toUpperCase();
            statusIndicator.textContent = statusText;
            statusIndicator.className = 'status-indicator';
            if (statusText === 'NORMAL') statusIndicator.classList.add('status-normal');
            else if (statusText === 'ALERT') statusIndicator.classList.add('status-alert');
            else statusIndicator.classList.add('status-unknown');

            // --- Update Basic Data & Timestamp ---
            tempValue.textContent = safeToFixed(data.temperature, 1);
            humValue.textContent = safeToFixed(data.humidity, 1);
            lastUpdateFull.textContent = `Last update: ${fullTimestamp}`;

            // --- Update RSL ---
            updateRslDisplay(data.predicted_rsl_days, INITIAL_RSL_DAYS);

            // --- Update KPIs ---
            // Use safeToFixed for ALL potential numbers from the backend
            kpiJourneyTime.textContent = safeToFixed(data.journey_time_hours, 1);
            kpiAvgTemp.textContent = safeToFixed(data.avg_temp, 1); // Check safeToFixed again
            kpiMinTemp.textContent = safeToFixed(data.min_temp, 1);
            kpiMaxTemp.textContent = safeToFixed(data.max_temp, 1);
            kpiTimeIn.textContent = safeToFixed(data.time_in_range_hrs, 1);
            kpiTimeOut.textContent = safeToFixed(data.time_out_range_hrs, 1);

            // --- Update Live Charts ---
            updateLiveCharts(currentTimeLabel, data.temperature, data.predicted_rsl_days);

            // --- Update Map ---
            updateMapMarker(data.lat, data.lng);


        } catch (error) {
            console.error("Failed to fetch/update status:", error); // Log the actual error
            statusIndicator.textContent = 'ERROR';
            statusIndicator.className = 'status-indicator status-error';
            lastUpdateFull.textContent = `Status update failed at ${fullTimestamp}`;
             // Clear potentially stale data
            tempValue.textContent = '--'; humValue.textContent = '--'; rslValue.textContent = '--';
            latValueText.textContent = '--'; lngValueText.textContent = '--';
            // Clear KPIs
            // *** CORRECTED VARIABLE NAME IN CATCH BLOCK ***
            kpiJourneyTime.textContent = '--'; // Use the correct const name defined above
            // *** END CORRECTION ***
            kpiAvgTemp.textContent = '--'; kpiMinTemp.textContent = '--';
            kpiMaxTemp.textContent = '--'; kpiTimeIn.textContent = '--'; kpiTimeOut.textContent = '--';
            updateRslDisplay(null, INITIAL_RSL_DAYS);
             if(marker) marker.setOpacity(0.5); // Fade map marker
        }
    }

    // --- Fetch Alert Log Data ---
    async function fetchAndUpdateAlerts() {
         try {
             const response = await fetch(BACKEND_URL_ALERTS);
             if (!response.ok) throw new Error(`Alert fetch error! ${response.status}`);
             const alerts = await response.json();
             updateAlertLogTable(alerts);
         } catch(error) {
              console.error("Failed to fetch alerts:", error);
              if (alertLogBody) alertLogBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--accent-color);">Error loading alerts.</td></tr>';
         }
    }


    // --- Initialization ---
    console.log("Initializing Dashboard...");
    initializeCharts();
    initializeMap();
    fetchAndUpdateStatus(); // Initial fetch for status/KPIs
    fetchAndUpdateAlerts(); // Initial fetch for alerts
    setInterval(fetchAndUpdateStatus, UPDATE_INTERVAL_MS); // Auto-refresh status/KPIs
    setInterval(fetchAndUpdateAlerts, ALERT_UPDATE_INTERVAL_MS); // Refresh alerts less often
    console.log("Dashboard Initialized. Auto-updating status every", UPDATE_INTERVAL_MS / 1000, "s.");
    // --- ---
});
