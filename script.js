document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // !!! IMPORTANT: Replace YOUR_BACKEND_IP with the actual IP address or hostname
// Example: Replace 'my-coldchain-backend' with the name you chose
const BACKEND_URL_STATUS = 'https://my-coldchain-backend.onrender.com/api/status';
const BACKEND_URL_ALERTS = 'https://my-coldchain-backend.onrender.com/api/alerts';
    // No need to fetch history separately if using live chart updates
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
    const kpiJourneyTime = document.getElementById('kpiJourneyTime');
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
         latValueText.textContent = (lat !== null && lat !== undefined) ? lat.toFixed(4) : '--';
         lngValueText.textContent = (lng !== null && lng !== undefined) ? lng.toFixed(4) : '--';
         if (lat === null || lng === null) {
            // If coords are null, maybe fade the marker slightly?
             if(marker) marker.setOpacity(0.6);
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
             marker.setOpacity(1.0); // Ensure marker is fully visible
         }
    }

    function updateAlertLogTable(alerts) {
        if (!alertLogBody) return;
        alertLogBody.innerHTML = ''; // Clear existing rows

        if (!alerts || alerts.length === 0) {
            alertLogBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #7f8c8d;">No alerts recorded yet.</td></tr>';
            return;
        }

        alerts.forEach(alert => {
            const row = alertLogBody.insertRow();
            const startTime = alert.start_time ? new Date(alert.start_time).toLocaleString() : 'N/A';
            const endTime = alert.end_time ? new Date(alert.end_time).toLocaleString() : 'Ongoing';
            const peakNadir = alert.peak_value !== null ? `${alert.peak_value.toFixed(1)} &deg;C` : '--';
            const type = alert.type || 'N/A';

            // Apply different style for ongoing alerts
            if (!alert.end_time) {
                row.style.backgroundColor = "#fffbe6"; // Light yellow background
                row.style.fontWeight = "bold";
            }

            row.insertCell().textContent = startTime;
            row.insertCell().textContent = endTime;
            row.insertCell().textContent = type;
            row.insertCell().innerHTML = peakNadir; // Use innerHTML for degree symbol
        });
    }

    // --- Main Data Fetching and UI Update Logic ---
    async function fetchAndUpdateStatus() {
        const now = new Date();
        const currentTimeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit'});
        const fullTimestamp = now.toLocaleString();

        let data = {}; // Define data with broader scope

        try {
            const response = await fetch(BACKEND_URL_STATUS);
            if (!response.ok) throw new Error(`Status fetch error! ${response.status}`);
            data = await response.json(); // Assign fetched data

            // --- Update Status ---
            let statusText = (data.status || 'UNKNOWN').toUpperCase();
            statusIndicator.textContent = statusText;
            statusIndicator.className = 'status-indicator';
            if (statusText === 'NORMAL') statusIndicator.classList.add('status-normal');
            else if (statusText === 'ALERT') statusIndicator.classList.add('status-alert');
            else statusIndicator.classList.add('status-unknown'); // Default/Unknown/Connecting

            // --- Update Basic Data & Timestamp ---
            tempValue.textContent = data.temperature !== null ? data.temperature.toFixed(1) : '--';
            humValue.textContent = data.humidity !== null ? data.humidity.toFixed(1) : '--';
            lastUpdateFull.textContent = `Last update: ${fullTimestamp}`;

            // --- Update RSL ---
            updateRslDisplay(data.predicted_rsl_days, INITIAL_RSL_DAYS);

            // --- Update KPIs ---
            kpiJourneyTime.textContent = data.journey_time_hours !== null ? data.journey_time_hours.toFixed(1) : '--'; // <-- CORRECT VARIABLE NAME
            kpiAvgTemp.textContent = data.avg_temp !== null ? data.avg_temp.toFixed(1) : '--';
            kpiMinTemp.textContent = data.min_temp !== null ? data.min_temp.toFixed(1) : '--';
            kpiMaxTemp.textContent = data.max_temp !== null ? data.max_temp.toFixed(1) : '--';
            kpiTimeIn.textContent = data.time_in_range_hrs !== null ? data.time_in_range_hrs.toFixed(1) : '--';
            kpiTimeOut.textContent = data.time_out_range_hrs !== null ? data.time_out_range_hrs.toFixed(1) : '--';

            // --- Update Live Charts ---
            // Only update charts if valid data received, otherwise they keep last point
            updateLiveCharts(currentTimeLabel, data.temperature, data.predicted_rsl_days);

            // --- Update Map ---
            updateMapMarker(data.lat, data.lng);


        } catch (error) {
            console.error("Failed to fetch/update status:", error);
            statusIndicator.textContent = 'ERROR';
            statusIndicator.className = 'status-indicator status-error';
            lastUpdateFull.textContent = `Status update failed at ${fullTimestamp}`;
             // Clear only values that depend directly on the fetch
            tempValue.textContent = '--'; humValue.textContent = '--'; rslValue.textContent = '--';
            latValueText.textContent = '--'; lngValueText.textContent = '--';
            // KPIs might become stale, indicate this or clear them
            journeyTime.textContent = '--'; kpiAvgTemp.textContent = '--'; kpiMinTemp.textContent = '--';
             // Keep max temp as it's a running max
            // maxTemp.textContent = '--';
            kpiTimeIn.textContent = '--'; kpiTimeOut.textContent = '--';
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