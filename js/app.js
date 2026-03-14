let currentWeatherData = null;
let currentCoords = "20.2961,85.8245"; // Default starting location (Bhubaneswar/Khurda)

document.addEventListener('DOMContentLoaded', () => {
    const langSelector = document.getElementById('language-selector');
    const searchInput = document.getElementById('location-search');
    const searchResults = document.getElementById('search-results');
    
    // 1. Initial Load
    fetchWeather(currentCoords);

    // 2. Language Change Listener
    langSelector.addEventListener('change', (e) => updateLanguage(e.target.value));

    // 3. Live Search Logic
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout); // Wait for the user to stop typing
        const query = e.target.value.trim();
        
        if (query.length < 3) {
            searchResults.classList.add('hidden'); // Hide if less than 3 letters
            return;
        }

        // Wait 500ms after typing stops before searching (saves network data)
        searchTimeout = setTimeout(() => fetchLocations(query), 500);
    });

    // 4. Fetch Locations from Open-Meteo Geocoding API
    async function fetchLocations(query) {
        // Search globally, get top 10 results
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=10&language=en&format=json`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.results) {
                // Filter the results so it ONLY shows locations in India
                const indiaResults = data.results.filter(location => location.country === "India");
                displaySearchResults(indiaResults);
            } else {
                searchResults.classList.add('hidden');
            }
        } catch (error) {
            console.error("Location search failed", error);
        }
    }

    // 5. Display the Search Results in the dropdown
    function displaySearchResults(results) {
        searchResults.innerHTML = ''; // Clear old results
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="p-3 text-sm text-gray-500">No locations found in India.</div>';
            searchResults.classList.remove('hidden');
            return;
        }

        results.forEach(loc => {
            const div = document.createElement('div');
            // Show Village Name, State (admin1 in the API)
            div.className = "p-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 text-sm font-medium";
            div.innerText = `${loc.name}, ${loc.admin1 || 'India'}`; 
            
            // When the farmer clicks a result:
            div.onclick = () => {
                searchInput.value = `${loc.name}, ${loc.admin1 || ''}`; // Fill the input box
                searchResults.classList.add('hidden'); // Hide the dropdown
                
                // Fetch the weather for this exact spot!
                currentCoords = `${loc.latitude},${loc.longitude}`;
                fetchWeather(currentCoords);
            };
            
            searchResults.appendChild(div);
        });
        
        searchResults.classList.remove('hidden');
    }

    // 6. SMS Button Logic
    const sendBtn = document.getElementById('send-sms-btn');
    const phoneInput = document.getElementById('farmer-phone');
    const toast = document.getElementById('sms-toast');
    const toastNumber = document.getElementById('toast-number');

    sendBtn.addEventListener('click', () => {
        const phone = phoneInput.value.trim();
        if(phone.length !== 10 || isNaN(phone)) {
            alert("Please enter a valid 10-digit mobile number.");
            return;
        }

        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        setTimeout(() => {
            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            phoneInput.value = ''; 
            toastNumber.innerText = `Sent advisory to +91 ${phone}`;
            toast.classList.remove('translate-y-20', 'opacity-0');
            setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3000);
        }, 800);
    });
});

// --- WEATHER FETCHING & UI LOGIC (Remains exactly the same) ---

async function fetchWeather(coords) {
    const [lat, lon] = coords.split(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,wind_speed_10m&timezone=auto`;

    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('weather-content').classList.add('hidden');
    document.getElementById('alert-box').classList.add('hidden');

    try {
        const response = await fetch(url);
        const data = await response.json();
        currentWeatherData = data.current;
        updateUI(currentWeatherData);
    } catch (error) {
        alert("Unable to connect to weather service.");
    }
}

function updateUI(weather) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('weather-content').classList.remove('hidden');
    document.getElementById('temperature').innerText = `${Math.round(weather.temperature_2m)}°C`;
    document.getElementById('rain-val').innerText = `${weather.rain} mm`;
    document.getElementById('wind-val').innerText = `${weather.wind_speed_10m} km/h`;

    const icon = document.getElementById('weather-icon');
    if (weather.rain > 0) {
        icon.className = "fa-solid fa-cloud-rain text-5xl text-blue-600";
    } else if (weather.wind_speed_10m > 15) {
        icon.className = "fa-solid fa-wind text-5xl text-teal-400";
    } else {
        icon.className = "fa-solid fa-sun text-5xl text-yellow-500";
    }

    updateLanguage(document.getElementById('language-selector').value);
}

function updateLanguage(langCode) {
    const t = translations[langCode];

    document.getElementById('app-title').innerHTML = `<i class="fa-solid fa-seedling mr-2"></i>${t.appTitle}`;
    document.getElementById('select-label').innerText = "Search your village or city:"; 
    document.getElementById('current-weather-title').innerText = t.currentConditions;
    document.getElementById('rain-label').innerText = t.rainLabel;
    document.getElementById('wind-label').innerText = t.windLabel;
    document.getElementById('sms-heading').innerText = t.smsHeading;
    document.getElementById('sms-help').innerText = t.smsHelp;

    if (currentWeatherData) {
        const alertBox = document.getElementById('alert-box');
        const alertTitle = document.getElementById('alert-title');
        const alertMsg = document.getElementById('alert-message');
        const alertIcon = document.getElementById('alert-icon');
        
        alertBox.className = "mt-6 p-4 rounded-xl border"; // Reset classes

        if (currentWeatherData.rain > 2) {
            alertBox.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
            alertIcon.className = "fa-solid fa-cloud-showers-heavy text-2xl mt-1 text-red-600";
            alertTitle.innerText = t.alertRainTitle;
            alertMsg.innerText = t.alertRainMsg;
        } else if (currentWeatherData.wind_speed_10m > 20) {
            alertBox.classList.add('bg-yellow-50', 'border-yellow-200', 'text-yellow-800');
            alertIcon.className = "fa-solid fa-wind text-2xl mt-1 text-yellow-600";
            alertTitle.innerText = t.alertWindTitle;
            alertMsg.innerText = t.alertWindMsg;
        } else {
            alertBox.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
            alertIcon.className = "fa-solid fa-check-circle text-2xl mt-1 text-green-600";
            alertTitle.innerText = t.alertSafeTitle;
            alertMsg.innerText = t.alertSafeMsg;
        }
    }
}