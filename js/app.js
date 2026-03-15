let currentWeatherData = null;
let currentCoords = "20.2961,85.8245"; // Default (Bhubaneswar)
let currentVillageName = "Bhubaneswar"; 
let weatherChart = null; 

document.addEventListener('DOMContentLoaded', () => {
    const langSelector = document.getElementById('language-selector');
    const searchInput = document.getElementById('location-search');
    const searchResults = document.getElementById('search-results');
    
    // Fetch initial weather on load
    fetchWeather(currentCoords);
    langSelector.addEventListener('change', (e) => updateLanguage(e.target.value));

    // Live Search with typing delay (debounce)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout); 
        const query = e.target.value.trim();
        if (query.length < 3) {
            searchResults.classList.add('hidden'); 
            return;
        }
        searchTimeout = setTimeout(() => fetchLocations(query), 500);
    });

    async function fetchLocations(query) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=10&language=en&format=json`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.results) {
                const indiaResults = data.results.filter(loc => loc.country === "India");
                displaySearchResults(indiaResults);
            } else {
                searchResults.classList.add('hidden');
            }
        } catch (error) {
            console.error("Search failed", error);
        }
    }

    function displaySearchResults(results) {
        searchResults.innerHTML = ''; 
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="p-3 text-sm text-gray-500">No locations found.</div>';
            searchResults.classList.remove('hidden');
            return;
        }
        results.forEach(loc => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 text-sm font-medium transition-colors text-gray-700";
            div.innerText = `${loc.name}, ${loc.admin1 || 'India'}`; 
            
            div.onclick = () => {
                searchInput.value = `${loc.name}, ${loc.admin1 || ''}`;
                searchResults.classList.add('hidden'); 
                currentCoords = `${loc.latitude},${loc.longitude}`;
                currentVillageName = loc.name; // Remember the exact village name for the SMS
                fetchWeather(currentCoords);
            };
            searchResults.appendChild(div);
        });
        searchResults.classList.remove('hidden');
    }

    // Hide search results if clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });

    // --- REAL BACKEND CONNECTION FOR SMS ---
    const sendBtn = document.getElementById('send-sms-btn');
    const phoneInput = document.getElementById('farmer-phone');
    const toast = document.getElementById('sms-toast');
    const toastNumber = document.getElementById('toast-number');

    sendBtn.addEventListener('click', async () => {
        const phone = phoneInput.value.trim();
        
        if(phone.length !== 10 || isNaN(phone)) {
            alert("Please enter a valid 10-digit mobile number.");
            return;
        }

        const currentAlertMsg = document.getElementById('alert-message').innerText;
        const finalMessage = `Kisan Alert (${currentVillageName}): ${currentAlertMsg}`;

        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        
        try {
            // Send request to your local Node.js server
            const response = await fetch('http://localhost:3000/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phone, message: finalMessage })
            });

            const result = await response.json();

            if (result.success) {
                sendBtn.innerHTML = '<i class="fa-solid fa-check"></i>'; 
                phoneInput.value = ''; 
                toastNumber.innerText = `Sent to +91 ${phone}`;
                toast.classList.remove('translate-y-24', 'opacity-0');
                
                setTimeout(() => { 
                    toast.classList.add('translate-y-24', 'opacity-0'); 
                    sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
                }, 3000);
            } else {
                alert("Server error: " + result.error);
                sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            }
        } catch (error) {
            console.error(error);
            alert("Could not connect! Is your backend terminal running?");
            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
        }
    });
});

// --- WEATHER FETCHING ---
async function fetchWeather(coords) {
    const [lat, lon] = coords.split(',');
    
    // Fetching current conditions AND 7-day daily max temperatures
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,wind_speed_10m&daily=temperature_2m_max&timezone=auto`;

    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('weather-content').classList.add('hidden');
    document.getElementById('alert-box').classList.add('hidden');

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        currentWeatherData = data.current;
        updateUI(currentWeatherData);
        
        // Draw the 7-day forecast chart using the daily data
        drawChart(data.daily);
        
    } catch (error) {
        alert("Unable to fetch weather. Check your internet.");
    }
}

// --- 7-DAY FORECAST CHART ---
function drawChart(dailyData) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    // Convert full dates into short days (e.g., "Mon", "Tue")
    const dayLabels = dailyData.time.map(dateString => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    // Destroy the old chart if it exists so we can draw a fresh one
    if (weatherChart) {
        weatherChart.destroy();
    }

    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dayLabels,
            datasets: [{
                label: 'Max Temp (°C)',
                data: dailyData.temperature_2m_max,
                borderColor: '#10b981', // Emerald green
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#10b981',
                pointBorderWidth: 2,
                pointRadius: 4,
                fill: true,
                tension: 0.4 // Makes the line smooth and curvy
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) { return context.raw + '°C'; }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: "'Outfit', sans-serif" } } },
                y: { display: false } // Hide side numbers to keep the UI clean
            }
        }
    });
}

// --- UPDATE UI & SMART ALERTS ---
function updateUI(weather) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('weather-content').classList.remove('hidden');
    
    document.getElementById('temperature').innerText = `${Math.round(weather.temperature_2m)}°`;
    document.getElementById('rain-val').innerText = `${weather.rain} mm`;
    document.getElementById('wind-val').innerText = `${weather.wind_speed_10m} km/h`;

    const icon = document.getElementById('weather-icon');
    if (weather.rain > 0) {
        icon.className = "fa-solid fa-cloud-rain text-6xl text-blue-500 drop-shadow-md";
    } else if (weather.wind_speed_10m > 15) { // Threshold set to 15 for testing
        icon.className = "fa-solid fa-wind text-6xl text-teal-400 drop-shadow-md";
    } else {
        icon.className = "fa-solid fa-sun text-6xl text-amber-400 drop-shadow-md";
    }

    updateLanguage(document.getElementById('language-selector').value);
}

function updateLanguage(langCode) {
    const t = translations[langCode];

    document.getElementById('app-title').innerHTML = `<i class="fa-solid fa-leaf text-emerald-500 mr-2"></i>${t.appTitle || "AgriAlert"}`;
    document.getElementById('select-label').innerText = t.selectLabel || "Location"; 
    document.getElementById('current-weather-title').innerText = t.currentConditions || "Live Conditions";
    document.getElementById('rain-label').innerText = t.rainLabel;
    document.getElementById('wind-label').innerText = t.windLabel;
    document.getElementById('sms-heading').innerText = t.smsHeading || "Automated Alerts";
    document.getElementById('sms-help').innerText = t.smsHelp || "Receive this advisory via SMS directly to your phone.";

    if (currentWeatherData) {
        const alertBox = document.getElementById('alert-box');
        const alertTitle = document.getElementById('alert-title');
        const alertMsg = document.getElementById('alert-message');
        const alertIcon = document.getElementById('alert-icon');
        
        alertBox.className = "mt-6 p-4 rounded-2xl flex items-start gap-3 shadow-sm transition-all duration-300"; 

        // SMART ALERT LOGIC
        if (currentWeatherData.rain > 2) {
            alertBox.classList.add('bg-red-50', 'border', 'border-red-100', 'text-red-900');
            alertIcon.className = "fa-solid fa-cloud-showers-heavy text-lg text-red-500";
            alertTitle.innerText = t.alertRainTitle;
            alertMsg.innerText = t.alertRainMsg;
            
        } else if (currentWeatherData.wind_speed_10m > 20) { // Testing at 15 km/h
            alertBox.classList.add('bg-amber-50', 'border', 'border-amber-100', 'text-amber-900');
            alertIcon.className = "fa-solid fa-wind text-lg text-amber-500";
            alertTitle.innerText = t.alertWindTitle;
            alertMsg.innerText = t.alertWindMsg;
            
        } else {
            alertBox.classList.add('bg-emerald-50', 'border', 'border-emerald-100', 'text-emerald-900');
            alertIcon.className = "fa-solid fa-check text-lg text-emerald-500";
            alertTitle.innerText = t.alertSafeTitle;
            alertMsg.innerText = t.alertSafeMsg;
        }
    }
}

// --- 🕒 LIVE CLOCK FUNCTION ---
function updateLiveTime() {
    const timeDisplay = document.getElementById('live-time');
    if (!timeDisplay) return;

    const now = new Date();
    
    // Format the date (e.g., "Sun, Oct 15")
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const dateString = now.toLocaleDateString('en-US', dateOptions);
    
    // Format the time (e.g., "02:30 PM")
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const timeString = now.toLocaleTimeString('en-US', timeOptions);

    // Combine them with a clock icon
    timeDisplay.innerHTML = `<i class="fa-regular fa-clock mr-1 text-emerald-400"></i> ${dateString} • ${timeString}`;
}

// Start the clock and update it every 1 second (1000 milliseconds)
setInterval(updateLiveTime, 1000);
updateLiveTime(); // Call it immediately