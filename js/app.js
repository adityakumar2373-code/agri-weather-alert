let currentWeatherData = null;
let currentDailyData = null; 
let currentCoords = null; 
let currentVillageName = ""; 

// DOM Elements
const searchInput = document.getElementById('location-search');
const searchResults = document.getElementById('search-results');
const cropSelector = document.getElementById('crop-selector');
const tempDisplay = document.getElementById('temperature');
const rainDisplay = document.getElementById('rain-val');
const windDisplay = document.getElementById('wind-val');
const alertBox = document.getElementById('alert-box');
const alertMessage = document.getElementById('alert-message');
const weatherIcon = document.getElementById('weather-icon');
const loader = document.getElementById('loader');
const weatherContent = document.getElementById('weather-content');
const gpsBtn = document.getElementById('gps-btn');
const readAloudBtn = document.getElementById('read-aloud-btn');

document.addEventListener('DOMContentLoaded', () => {
    const langSelector = document.getElementById('language-selector');
    langSelector.addEventListener('change', (e) => {
        updateLanguage(e.target.value);
        // Force UI redraw on language change
        if (currentWeatherData && currentDailyData) {
            updateUI(currentWeatherData, currentDailyData); 
        }
        triggerAIIfReady(); 
    });

    cropSelector.addEventListener('change', triggerAIIfReady);

    document.getElementById('weather-content').classList.add('hidden');
    document.getElementById('forecast-section').classList.add('hidden'); 
    document.getElementById('sms-section').classList.add('hidden'); 
    
    loader.classList.remove('hidden');
    loader.innerHTML = `
        <div class="py-6 transition-all duration-500">
            <i class="fa-solid fa-map-location-dot text-5xl mb-4 text-emerald-300 drop-shadow-sm"></i>
            <p class="text-sm text-gray-500 font-medium px-4">Search for your village or tap the GPS icon to get started.</p>
        </div>
    `;

    const now = new Date();
    document.getElementById('live-time').innerText = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
});

gpsBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        searchInput.value = "Detecting satellite location...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                currentCoords = `${lat},${lon}`;
                currentVillageName = "Current Location";
                searchInput.value = currentVillageName;
                fetchWeather(currentCoords);
            },
            (error) => {
                alert("Please allow location access to use the GPS feature.");
                searchInput.value = "";
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
    }
});

readAloudBtn.addEventListener('click', () => {
    const alertMsg = document.getElementById('alert-message').innerText;
    const currentLang = document.getElementById('language-selector').value; 
    
    if (!alertMsg) return;

    window.speechSynthesis.cancel(); 
    const speech = new SpeechSynthesisUtterance(alertMsg);
    
    const voiceMap = {
        'en': 'en-IN', 'hi': 'hi-IN', 'bn': 'bn-IN', 
        'te': 'te-IN', 'mr': 'mr-IN', 'ta': 'ta-IN',
        'gu': 'gu-IN', 'kn': 'kn-IN', 'or': 'or-IN',
        'ml': 'ml-IN', 'pa': 'pa-IN', 'as': 'as-IN',
        'ur': 'ur-IN', 'bho': 'hi-IN' 
    };

    const targetLangCode = voiceMap[currentLang] || 'en-IN';
    const voices = window.speechSynthesis.getVoices();
    const hasVoice = voices.some(voice => voice.lang.includes(targetLangCode.split('-')[0]));

    if (!hasVoice && currentLang !== 'en' && currentLang !== 'hi') {
        alert(`⚠️ Text-to-Speech for this language is not installed on this device. Falling back to Hindi.`);
        speech.lang = 'hi-IN'; 
    } else {
        speech.lang = targetLangCode;
    }
    
    speech.rate = 0.9;     
    window.speechSynthesis.speak(speech);
});

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
        div.className = "p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 text-sm font-medium transition-colors text-gray-700 flex items-center gap-3";
        div.innerHTML = `<i class="fa-solid fa-location-dot text-emerald-400"></i> ${loc.name}, ${loc.admin1 || 'India'}`; 
        
        div.onclick = () => {
            searchInput.value = `${loc.name}, ${loc.admin1 || ''}`;
            searchResults.classList.add('hidden'); 
            currentCoords = `${loc.latitude},${loc.longitude}`;
            currentVillageName = loc.name; 
            fetchWeather(currentCoords);
        };
        searchResults.appendChild(div);
    });
    searchResults.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

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
        const response = await fetch('https://weather-backend-mocha.vercel.app/send-sms', {
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

// 🌟 UPGRADED API URL: Includes 'forecast_days=10' and daily 'weather_code'
async function fetchWeather(coords) {
    if (!coords) return;
    const [lat, lon] = coords.split(',');
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,wind_speed_10m,relative_humidity_2m,precipitation_probability,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=10`;

    loader.innerHTML = `
        <div class="flex flex-col items-center justify-center py-4">
            <div class="relative flex justify-center items-center mb-5">
                <div class="absolute animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-emerald-400 opacity-80"></div>
                <div class="absolute animate-ping rounded-full h-10 w-10 bg-emerald-200 opacity-60"></div>
                <i class="fa-solid fa-leaf text-emerald-600 text-xl z-10"></i>
            </div>
            <p class="text-sm text-gray-500 animate-pulse font-medium tracking-wide">Fetching live field data...</p>
        </div>
    `;
    loader.classList.remove('hidden');
    
    document.getElementById('weather-content').classList.add('hidden');
    document.getElementById('alert-box').classList.add('hidden');
    document.getElementById('forecast-section').classList.add('hidden');
    document.getElementById('sms-section').classList.add('hidden');

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        currentWeatherData = data.current;
        currentDailyData = data.daily;
        
        updateUI(currentWeatherData, currentDailyData); 
        renderAppleForecastList(data.daily); // 🌟 NEW 10-DAY CALL
        triggerAIIfReady(); 
        
        const weatherScrollTarget = document.getElementById('weather-scroll-target');
        if (weatherScrollTarget && window.innerWidth < 1024) {
            setTimeout(() => {
                weatherScrollTarget.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100); 
        }
        
    } catch (error) {
        alert("Unable to fetch weather. Check your internet.");
        loader.classList.add('hidden');
    }
}

function triggerAIIfReady() {
    if (currentWeatherData && cropSelector.value) {
        fetchAIAdvisory(
            currentWeatherData.temperature_2m, 
            currentWeatherData.rain, 
            currentWeatherData.wind_speed_10m
        );

        if (window.innerWidth >= 1024) { 
            const leftColumn = document.getElementById('sms-section').parentElement;
            const forecastSection = document.getElementById('forecast-section');
            const doctorSection = document.getElementById('doctor-section');
            
            if (leftColumn && forecastSection && doctorSection) {
                leftColumn.appendChild(forecastSection);
                leftColumn.appendChild(doctorSection);
                
                if (currentDailyData) {
                    renderAppleForecastList(currentDailyData); // 🌟 NEW 10-DAY CALL
                }
            }
        }

        const weatherScrollTarget = document.getElementById('weather-scroll-target');
        if (weatherScrollTarget && window.innerWidth < 1024) {
            setTimeout(() => {
                weatherScrollTarget.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100);
        }
    }
}

async function fetchAIAdvisory(temp, rain, wind) {
    const crop = cropSelector.value;
    const langSelect = document.getElementById('language-selector');
    const langName = langSelect.options[langSelect.selectedIndex].text; 

    const alertTitle = document.getElementById('alert-title');
    const alertMsg = document.getElementById('alert-message');
    const alertIcon = document.getElementById('alert-icon');
    const audioIcon = document.getElementById('audio-icon');

    alertBox.className = "mt-6 p-4 rounded-2xl flex items-start gap-3 shadow-[0_4px_20px_rgb(168,85,247,0.15)] transition-all duration-300 bg-purple-50 border border-purple-200 text-purple-900";
    alertIcon.className = "fa-solid fa-sparkles text-lg text-purple-500 animate-pulse";
    audioIcon.className = "fa-solid fa-volume-high text-purple-500";
    alertTitle.innerText = "AI Agronomist Analyzing...";
    alertMsg.innerText = `Generating custom advisory for ${crop}...`;
    alertBox.classList.remove('hidden');

    try {
        const response = await fetch('https://weather-backend-mocha.vercel.app/generate-advisory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: currentVillageName,
                crop: crop,
                temp: temp,
                rain: rain,
                wind: wind,
                language: langName
            })
        });

        const data = await response.json();

        if (data.success) {
            alertIcon.classList.remove('animate-pulse');
            alertTitle.innerHTML = `<i class="fa-solid fa-robot mr-1 opacity-70"></i> Smart Advisory: ${crop}`;
            alertMsg.innerText = data.advisory;
        } else {
            alertMsg.innerText = "AI analysis failed. Please try again.";
        }
    } catch (error) {
        alertMsg.innerText = "Could not connect to Gemini AI backend.";
    }
}

// 🌟 NEW: Helper function to get exact FontAwesome icon for 10-day list
function getForecastIcon(wmoCode) {
    if ([95, 96, 99].includes(wmoCode)) return 'fa-solid fa-cloud-bolt text-indigo-400';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(wmoCode)) return 'fa-solid fa-cloud-showers-heavy text-blue-400';
    if ([3, 45, 48].includes(wmoCode)) return 'fa-solid fa-cloud text-slate-400';
    if ([1, 2].includes(wmoCode)) return 'fa-solid fa-cloud-sun text-slate-300';
    return 'fa-solid fa-sun text-yellow-400';
}

// 🌟 NEW: Core function to render the Apple-style 10-Day list
function renderAppleForecastList(dailyData) {
    const listContainer = document.getElementById('forecast-list');
    if (!listContainer || !dailyData) return;

    listContainer.innerHTML = '';

    // Find absolute min and max of the 10 days to set the bar scale correctly
    const globalMin = Math.min(...dailyData.temperature_2m_min);
    const globalMax = Math.max(...dailyData.temperature_2m_max);
    const globalRange = globalMax - globalMin;

    for (let i = 0; i < dailyData.time.length; i++) {
        const dateString = dailyData.time[i];
        const dateObj = new Date(dateString);
        
        // Label "Today" for the first row, otherwise use short weekday (e.g., "Tue")
        const dayName = i === 0 ? "Today" : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Grab correct icon logic
        const wmoCode = dailyData.weather_code ? dailyData.weather_code[i] : 0;
        const iconClass = getForecastIcon(wmoCode);
        
        const dayMin = dailyData.temperature_2m_min[i];
        const dayMax = dailyData.temperature_2m_max[i];
        
        // Calculate the exact width and position for the dynamic gradient bar
        const leftPercent = ((dayMin - globalMin) / globalRange) * 100;
        const widthPercent = ((dayMax - dayMin) / globalRange) * 100;

        // Build the Apple-style HTML Row
        const rowHTML = `
            <div class="flex items-center justify-between py-2.5 sm:py-3 border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30 transition-colors rounded-lg px-2 -mx-2">
                <div class="w-12 sm:w-14 text-sm sm:text-base font-bold text-slate-200">${dayName}</div>
                <div class="w-8 sm:w-10 text-center text-lg sm:text-xl"><i class="${iconClass}"></i></div>
                <div class="w-10 sm:w-12 text-right text-sm sm:text-base font-bold text-slate-400 opacity-80">${Math.round(dayMin)}°</div>
                
                <div class="flex-1 mx-3 sm:mx-5 h-1.5 bg-slate-700/50 rounded-full relative overflow-hidden shadow-inner">
                    <div class="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-orange-500 shadow-sm" 
                         style="left: ${leftPercent}%; width: ${widthPercent}%;">
                    </div>
                </div>
                
                <div class="w-10 sm:w-12 text-left text-sm sm:text-base font-bold text-slate-100">${Math.round(dayMax)}°</div>
            </div>
        `;
        
        listContainer.insertAdjacentHTML('beforeend', rowHTML);
    }
}

function applyAppleWeather(condition) {
    let bgLayer = document.getElementById('apple-weather-bg');
    if(!bgLayer) {
        bgLayer = document.createElement('div');
        bgLayer.id = 'apple-weather-bg';
        bgLayer.className = 'weather-bg';
        const card = document.getElementById('weather-content');
        card.insertBefore(bgLayer, card.firstChild);
    }
    
    bgLayer.innerHTML = ''; 
    bgLayer.className = 'weather-bg'; 

    if (condition === 'rain' || condition === 'storm') {
        bgLayer.style.background = 'linear-gradient(180deg, #5A6B7C 0%, #2F3C4D 100%)';
        for(let i=0; i<60; i++) {
            let drop = document.createElement('div');
            drop.className = 'apple-drop';
            drop.style.left = `${Math.random() * 150 - 20}%`;
            drop.style.animationDuration = `${Math.random() * 0.3 + 0.4}s`;
            drop.style.animationDelay = `-${Math.random() * 2}s`;
            bgLayer.appendChild(drop);
        }
        if(condition === 'storm'){
             let flash = document.createElement('div');
             flash.className = 'flash';
             bgLayer.appendChild(flash);
        }
    } else if (condition === 'cloudy' || condition === 'cloudy-night') {
        bgLayer.style.background = condition === 'cloudy-night' 
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, #64748b 0%, #334155 100%)';
            
        for(let i=0; i<6; i++) {
            let cloud = document.createElement('div');
            cloud.className = 'apple-cloud';
            cloud.style.width = `${Math.random() * 300 + 150}px`;
            cloud.style.height = `${Math.random() * 80 + 50}px`;
            cloud.style.top = i % 2 === 0 ? `${Math.random() * 20}%` : `${Math.random() * 20 + 70}%`;
            cloud.style.animationDuration = `${Math.random() * 40 + 30}s`;
            cloud.style.animationDelay = `-${Math.random() * 20}s`;
            bgLayer.appendChild(cloud);
        }
    } else if (condition === 'night') {
        bgLayer.style.background = 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)';
        let moon = document.createElement('div');
        moon.className = 'apple-moon';
        bgLayer.appendChild(moon);
    } else {
        bgLayer.style.background = 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)';
        let sun = document.createElement('div');
        sun.className = 'apple-sun';
        bgLayer.appendChild(sun);
    }
}

// 🌟 STRICT WMO LOGIC (NO GUESSING)
function updateUI(weather, daily) {
    loader.classList.add('hidden');
    const weatherCard = document.getElementById('weather-content');
    weatherCard.classList.remove('hidden');
    document.getElementById('forecast-section').classList.remove('hidden');
    document.getElementById('sms-section').classList.remove('hidden');
    
    if (document.getElementById('location-name-text')) {
        document.getElementById('location-name-text').innerText = currentVillageName;
    }

    document.getElementById('temperature').innerText = `${Math.round(weather.temperature_2m)}°`;
    document.getElementById('rain-val').innerText = `${weather.rain} mm`;
    document.getElementById('wind-val').innerText = `${weather.wind_speed_10m} km/h`;
    
    if(document.getElementById('humidity-val')) document.getElementById('humidity-val').innerText = `${weather.relative_humidity_2m} %`;
    if(document.getElementById('precip-prob-val')) document.getElementById('precip-prob-val').innerText = `${weather.precipitation_probability || 0} %`;

    const hiloElement = document.getElementById('weather-hilo');
    if (hiloElement && daily && daily.temperature_2m_max && daily.temperature_2m_min) {
        hiloElement.innerText = `H:${Math.round(daily.temperature_2m_max[0])}° L:${Math.round(daily.temperature_2m_min[0])}°`;
    }

    const icon = document.getElementById('weather-icon');
    const conditionText = document.getElementById('weather-condition');
    
    const langCode = document.getElementById('language-selector').value;
    const t = translations[langCode] || translations['en'];
    
    const isNight = weather.is_day !== undefined ? weather.is_day === 0 : (new Date().getHours() < 6 || new Date().getHours() >= 18);
    const wmoCode = weather.weather_code !== undefined ? weather.weather_code : 0;

    let activeCondition = 'clear';
    let condString = t.condMostlySunny || 'Mostly Sunny';
    let iconClass = 'fa-solid fa-sun';

    if ([95, 96, 99].includes(wmoCode)) {
        activeCondition = 'storm';
        condString = t.condThunderstorms || 'Thunderstorms';
        iconClass = 'fa-solid fa-cloud-bolt';
    } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(wmoCode)) {
        activeCondition = 'rain';
        condString = t.condRainShowers || 'Rain / Showers';
        iconClass = 'fa-solid fa-cloud-showers-heavy';
    } else if ([3, 45, 48].includes(wmoCode)) { 
        activeCondition = isNight ? 'cloudy-night' : 'cloudy';
        condString = t.condMostlyCloudy || 'Mostly Cloudy';
        iconClass = 'fa-solid fa-cloud';
    } else if ([1, 2].includes(wmoCode)) {
        activeCondition = isNight ? 'night' : 'clear';
        condString = t.condPartlyCloudy || 'Partly Cloudy';
        iconClass = isNight ? 'fa-solid fa-cloud-moon' : 'fa-solid fa-cloud-sun';
    } else {
        activeCondition = isNight ? 'night' : 'clear';
        condString = isNight ? (t.condClearNight || 'Clear Night') : (t.condMostlySunny || 'Mostly Sunny');
        iconClass = isNight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }

    if(icon) icon.className = `${iconClass} text-6xl drop-shadow-md text-white`;
    if(conditionText) conditionText.innerText = condString;

    weatherCard.classList.add('apple-active');
    applyAppleWeather(activeCondition);

    updateLanguage(langCode);

    if (currentWeatherData && !cropSelector.value) {
        const alertBox = document.getElementById('alert-box');
        const alertTitle = document.getElementById('alert-title');
        const alertMsg = document.getElementById('alert-message');
        const alertIcon = document.getElementById('alert-icon');
        const audioIcon = document.getElementById('audio-icon');
        
        alertBox.className = "mt-6 p-4 rounded-2xl flex items-start gap-3 shadow-sm transition-all duration-300"; 
        audioIcon.className = "fa-solid fa-volume-high text-emerald-500";
        alertBox.classList.remove('hidden');

        const isRainingWMO = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(wmoCode);

        if (isRainingWMO || currentWeatherData.rain > 0.2) {
            alertBox.classList.add('bg-red-50', 'border', 'border-red-100', 'text-red-900');
            alertIcon.className = "fa-solid fa-cloud-showers-heavy text-lg text-red-500";
            alertTitle.innerText = t.alertRainTitle || "Rain Alert";
            alertMsg.innerText = t.alertRainMsg || "Rain detected. Avoid sensitive field work and ensure proper drainage.";
        } else if (currentWeatherData.wind_speed_10m > 20) { 
            alertBox.classList.add('bg-amber-50', 'border', 'border-amber-100', 'text-amber-900');
            alertIcon.className = "fa-solid fa-wind text-lg text-amber-500";
            alertTitle.innerText = t.alertWindTitle || "High Wind Warning";
            alertMsg.innerText = t.alertWindMsg || "Strong winds detected. Secure equipment and avoid spraying pesticides.";
        } else {
            alertBox.classList.add('bg-emerald-50', 'border', 'border-emerald-100', 'text-emerald-900');
            alertIcon.className = "fa-solid fa-check text-lg text-emerald-500";
            alertTitle.innerText = t.alertSafeTitle || "Conditions Safe";
            alertMsg.innerText = t.alertSafeMsg || "Weather is optimal for standard agricultural activities.";
        }
    }
}

function updateLanguage(langCode) {
    const t = translations[langCode] || translations['en']; 

    if (langCode === 'en') {
        document.getElementById('app-title').innerHTML = 'Kisan Alert <span class="text-emerald-500">Pro</span>';
    } else {
        let translatedTitle = t.appTitle || 'Kisan Alert <span class="text-emerald-500">Pro</span>';
        translatedTitle = translatedTitle.replace(/<i class="fa-solid fa-leaf[^>]*><\/i>/g, '').trim();
        document.getElementById('app-title').innerHTML = translatedTitle;
    }

    document.getElementById('current-weather-title').innerHTML = `<i class="fa-solid fa-tower-observation text-emerald-500 shrink-0"></i> ${t.currentConditions || "Live Conditions"}`;
    
    if(document.getElementById('humidity-label')) document.getElementById('humidity-label').innerText = t.humidityLabel || "Humidity";
    if(document.getElementById('rain-label')) document.getElementById('rain-label').innerText = t.rainLabel || "Rain Vol.";
    if(document.getElementById('wind-label')) document.getElementById('wind-label').innerText = t.windLabel || "Wind";

    if(document.getElementById('ui-ask-ai-title')) document.getElementById('ui-ask-ai-title').innerText = t.askAiTitle || "Ask AI Agronomist";
    if(document.getElementById('ai-search-input')) document.getElementById('ai-search-input').placeholder = t.askPlaceholder || "Type or speak...";
    if(document.getElementById('ai-search-btn')) document.getElementById('ai-search-btn').innerText = t.askBtn || "Ask";
    
    if(document.getElementById('ui-pill-fertilizer')) document.getElementById('ui-pill-fertilizer').innerHTML = `<i class="fa-solid fa-flask text-purple-400"></i> ${t.pillFertilizer || "Fertilizer"}`;
    if(document.getElementById('ui-pill-pest')) document.getElementById('ui-pill-pest').innerHTML = `<i class="fa-solid fa-bug text-purple-400"></i> ${t.pillPest || "Pest Control"}`;
    if(document.getElementById('ui-pill-irrigation')) document.getElementById('ui-pill-irrigation').innerHTML = `<i class="fa-solid fa-droplet text-purple-400"></i> ${t.pillIrrigation || "Irrigation"}`;

    if(document.getElementById('ui-setup-title')) document.getElementById('ui-setup-title').innerHTML = `<i class="fa-solid fa-map-location-dot"></i> ${t.setupTitle || "Setup Parameters"}`;
    if(document.getElementById('location-search')) document.getElementById('location-search').placeholder = t.searchVillagePlaceholder || "Search village...";
    if(document.getElementById('crop-selector')) document.getElementById('crop-selector').placeholder = t.searchCropPlaceholder || "Search crop...";
    
    if(document.getElementById('ui-forecast-title')) document.getElementById('ui-forecast-title').innerHTML = `<i class="fa-regular fa-calendar text-slate-400"></i> ${t.forecastTitle || "10-Day Forecast"}`;

    if(document.getElementById('ui-doc-title')) document.getElementById('ui-doc-title').innerHTML = `<i class="fa-solid fa-camera text-emerald-400 shrink-0"></i> ${t.docTitle || "AI Plant Doctor"}`;
    if(document.getElementById('ui-doc-badge')) document.getElementById('ui-doc-badge').innerText = t.docBadge || "Computer Vision";
    if(document.getElementById('ui-doc-desc')) document.getElementById('ui-doc-desc').innerText = t.docDesc || "Snap a photo of a diseased leaf. Our AI will instantly identify the issue and recommend a cure.";
    if(document.getElementById('ui-doc-btn')) document.getElementById('ui-doc-btn').innerHTML = `<i class="fa-solid fa-camera text-lg"></i> ${t.docBtn || "Scan Leaf Now"}`;
    if(document.getElementById('ui-realtime-badge')) document.getElementById('ui-realtime-badge').innerText = t.realtimeBadge || "Real-Time";
    if(document.getElementById('ui-read-aloud')) document.getElementById('ui-read-aloud').innerText = t.readAloudBtn || "Read Aloud";

    document.getElementById('sms-heading').innerText = t.smsHeading || "Automated Alerts";
    document.getElementById('sms-help').innerText = t.smsHelp || "Receive this advisory via SMS directly to your phone.";

    if(document.getElementById('ui-helplines-title')) document.getElementById('ui-helplines-title').innerHTML = `<i class="fa-solid fa-phone-volume"></i> ${t.helplinesTitle || "Important Helplines"}`;
    if(document.getElementById('ui-helpline-1-name')) document.getElementById('ui-helpline-1-name').innerText = t.kisanCallCenter || "Kisan Call Center";
    if(document.getElementById('ui-helpline-1-desc')) document.getElementById('ui-helpline-1-desc').innerText = `1551 • ${t.kccDesc || "Available 6AM - 10PM"}`;
    if(document.getElementById('ui-helpline-2-name')) document.getElementById('ui-helpline-2-name').innerText = t.agriEmergency || "Agri Emergency";
    if(document.getElementById('ui-helpline-2-desc')) document.getElementById('ui-helpline-2-desc').innerText = `108 • ${t.aeDesc || "24/7 Toll-Free"}`;
}
function updateLiveTime() {
    const timeDisplay = document.getElementById('live-time');
    if (!timeDisplay) return;
    const now = new Date();
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const dateString = now.toLocaleDateString('en-US', dateOptions);
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const timeString = now.toLocaleTimeString('en-US', timeOptions);
    timeDisplay.innerHTML = `<i class="fa-regular fa-clock mr-1 text-emerald-400"></i> ${dateString} • ${timeString}`;
}

setInterval(updateLiveTime, 1000);
updateLiveTime();

// 🌟 TEMPORARY FIX: Unregister broken Service Worker until we build it properly
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}

const aiSearchBtn = document.getElementById('ai-search-btn');
const aiSearchInput = document.getElementById('ai-search-input');
const aiResultBox = document.getElementById('ai-search-result-box');
const aiResultText = document.getElementById('ai-search-result');

if(aiSearchBtn) {
    aiSearchBtn.addEventListener('click', async () => {
        const rawQuestion = aiSearchInput.value.trim();
        if (!rawQuestion) return;

        const langSelect = document.getElementById('language-selector');
        const langCode = langSelect.value;
        const langName = langSelect.options[langSelect.selectedIndex].text;
        
        const finalQuestion = langCode !== 'en' ? `${rawQuestion} (Please answer strictly in ${langName})` : rawQuestion;

        aiSearchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        aiSearchBtn.disabled = true;
        aiResultBox.classList.remove('hidden');
        aiResultText.innerHTML = '<span class="animate-pulse text-purple-600">Connecting to AI Agronomist...</span>';

        try {
            const response = await fetch('https://weather-backend-mocha.vercel.app/ai-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: finalQuestion })
            });

            let fullText = "";
            const contentType = response.headers.get("content-type");

            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();
                if (data.success) fullText = data.answer;
                else throw new Error(data.error);
            } else {
                fullText = await response.text(); 
            }

            aiResultText.innerHTML = '<i class="fa-solid fa-sparkles text-purple-500 mr-1"></i> ';
            let i = 0;
            const typingSpeed = 15; 

            function typeWriter() {
                if (i < fullText.length) {
                    if (fullText.charAt(i) === '\n') {
                        aiResultText.innerHTML += '<br>';
                    } else {
                        aiResultText.insertAdjacentText('beforeend', fullText.charAt(i));
                    }
                    i++;
                    setTimeout(typeWriter, typingSpeed);
                } else {
                    const currentLangCode = document.getElementById('language-selector').value;
                    const t = typeof translations !== 'undefined' ? translations[currentLangCode] || translations['en'] : { askBtn: 'Ask' };
                    aiSearchBtn.innerText = t.askBtn || 'Ask';
                    aiSearchBtn.disabled = false;
                }
            }

            typeWriter(); 

        } catch (error) {
            console.error(error);
            aiResultText.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-red-500 mr-1"></i> Sorry, the AI could not answer right now. Please try again.`;
            
            const currentLangCode = document.getElementById('language-selector').value;
            const t = typeof translations !== 'undefined' ? translations[currentLangCode] || translations['en'] : { askBtn: 'Ask' };
            aiSearchBtn.innerText = t.askBtn || 'Ask';
            aiSearchBtn.disabled = false;
        }
    });

    aiSearchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') aiSearchBtn.click();
    });
}

const micBtn = document.getElementById('mic-btn');

if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true; 
    recognition.interimResults = true; 

    let isListening = false;
    let silenceTimer; 

    micBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }

        const langCode = document.getElementById('language-selector').value;
        const voiceMap = {
            'en': 'en-IN', 'hi': 'hi-IN', 'bn': 'bn-IN', 
            'te': 'te-IN', 'mr': 'mr-IN', 'ta': 'ta-IN',
            'gu': 'gu-IN', 'kn': 'kn-IN', 'or': 'or-IN',
            'ml': 'ml-IN', 'pa': 'pa-IN', 'as': 'as-IN',
            'ur': 'ur-IN', 'bho': 'hi-IN' 
        };
        recognition.lang = voiceMap[langCode] || 'en-IN';

        recognition.start();
    });

    recognition.onstart = function() {
        isListening = true;
        micBtn.innerHTML = '<i class="fa-solid fa-microphone-lines text-red-500 animate-pulse"></i>';
        aiSearchInput.placeholder = "Listening... (Take your time)";
        aiSearchInput.value = "";
        clearTimeout(silenceTimer); 
    };

    recognition.onresult = function(event) {
        let fullText = "";
        
        for (let i = 0; i < event.results.length; ++i) {
            fullText += event.results[i][0].transcript;
        }
        
        aiSearchInput.value = fullText;

        clearTimeout(silenceTimer); 
        
        silenceTimer = setTimeout(() => {
            recognition.stop(); 
            if (aiSearchInput.value.trim() !== "") {
                if (aiSearchBtn) aiSearchBtn.click(); 
            }
        }, 4000); 
    };

    recognition.onerror = function(event) {
        console.error("Mic error:", event.error);
        recognition.stop();
    };

    recognition.onend = function() {
        isListening = false;
        clearTimeout(silenceTimer); 
        micBtn.innerHTML = '<i class="fa-solid fa-microphone text-purple-500"></i>';
        aiSearchInput.placeholder = "Type or speak your question...";
    };
} else if (micBtn) {
    micBtn.addEventListener('click', () => {
        alert("Sorry, Voice Search is not supported in this browser.");
    });
}

const cameraInput = document.getElementById('camera-input');
const docResult = document.getElementById('doctor-result');
const imagePreview = document.getElementById('image-preview');
const docTitle = document.getElementById('doc-title');
const docDiagnosis = document.getElementById('doc-diagnosis');
const docIcon = document.getElementById('doc-icon');

if(cameraInput) {
    cameraInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        docResult.classList.remove('hidden');
        docTitle.innerText = "AI Pathologist Analyzing...";
        docDiagnosis.innerText = "Processing image structure and scanning for pathogens...";
        docIcon.className = "fa-solid fa-microscope text-emerald-500 animate-pulse";
        imagePreview.classList.add('hidden'); 
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                
                imagePreview.src = compressedBase64;
                imagePreview.classList.remove('hidden'); 
                analyzeCropImage(compressedBase64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function analyzeCropImage(base64Data) {
    const langSelect = document.getElementById('language-selector');
    const langName = langSelect.options[langSelect.selectedIndex].text;

    try {
        const response = await fetch('https://weather-backend-mocha.vercel.app/analyze-crop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Data, language: langName }) 
        });

        const data = await response.json();

        if (data.success) {
            docIcon.className = "fa-solid fa-check-circle text-emerald-500";
            docTitle.innerText = "Diagnosis Complete";
            docDiagnosis.innerText = data.diagnosis;
        } else {
            throw new Error(data.error || "Server failed to process image.");
        }
    } catch (error) {
        console.error(error);
        docIcon.className = "fa-solid fa-triangle-exclamation text-red-500";
        docTitle.innerText = "Analysis Failed";
        docDiagnosis.innerText = "Could not connect to the AI server.";
    }
}
