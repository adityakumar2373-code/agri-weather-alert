let currentWeatherData = null;
let currentDailyData = null; 
let currentHourlyData = null; 
let currentMinutelyData = null; 
let currentCoords = null; 
let currentVillageName = ""; 
let weatherChartInstance = null; 

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
        if (currentWeatherData && currentDailyData) {
            updateUI(currentWeatherData, currentDailyData, currentHourlyData, currentMinutelyData); 
            renderSunAndUV(currentDailyData, currentHourlyData); 
            renderHourlySlider(currentHourlyData); 
        }
        triggerAIIfReady(); 
    });

    cropSelector.addEventListener('change', triggerAIIfReady);

    document.getElementById('weather-content').classList.add('hidden');
    document.getElementById('forecast-section').classList.add('hidden'); 
    
    const smsSec = document.getElementById('sms-section');
    if(smsSec) smsSec.classList.add('hidden'); 
    const sunUvSec = document.getElementById('sun-uv-section');
    if(sunUvSec) sunUvSec.classList.add('hidden');
    
    loader.classList.remove('hidden');
    loader.innerHTML = `
        <div class="py-6 transition-all duration-500">
            <i class="fa-solid fa-map-location-dot text-5xl mb-4 text-emerald-300 drop-shadow-sm"></i>
            <p class="text-sm text-gray-500 font-medium px-4">Search for your village or tap the GPS icon to get started.</p>
        </div>
    `;

    const now = new Date();
    document.getElementById('live-time').innerText = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const closeModalBtn = document.getElementById('close-modal-btn');
    const detailsModalOverlay = document.getElementById('details-modal-overlay');
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeDetailsModal);
    if(detailsModalOverlay) {
        detailsModalOverlay.addEventListener('click', (e) => {
            if (e.target === detailsModalOverlay) closeDetailsModal();
        });
    }
});

gpsBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        searchInput.value = "Detecting satellite location...";
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                currentCoords = `${lat},${lon}`;
                
                try {
                    const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
                    const geoResponse = await fetch(geoUrl);
                    const geoData = await geoResponse.json();
                    
                    const placeName = geoData.locality || geoData.city || geoData.principalSubdivision || "Current Location";
                    currentVillageName = placeName;
                } catch (error) {
                    console.error("Reverse geocoding failed", error);
                    currentVillageName = "Current Location"; 
                }

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
    // 🌟 FIX: Apply proper background to the outer dropdown container so it respects glass mode
    searchResults.className = "absolute w-full mt-2 rounded-xl shadow-xl max-h-56 overflow-y-auto z-50 text-sm glass-panel"; 
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="p-3 text-sm text-gray-500 dark:text-gray-400">No locations found.</div>';
        searchResults.classList.remove('hidden');
        return;
    }
    results.forEach(loc => {
        const div = document.createElement('div');
        // 🌟 FIX: Hover and text color gracefully adapt to dark mode (white text on dark glass)
        div.className = "p-3 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer border-b border-gray-200/30 text-sm font-medium transition-colors flex items-center gap-3 text-gray-800 dark:text-gray-200";
        div.innerHTML = `<i class="fa-solid fa-location-dot text-emerald-500"></i> ${loc.name}, ${loc.admin1 || 'India'}`; 
        
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

function getCurrentHourlyIndex(hourlyTimeArray) {
    if (!hourlyTimeArray || hourlyTimeArray.length === 0) return 0;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localTimeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
    const idx = hourlyTimeArray.indexOf(localTimeStr);
    return idx !== -1 ? idx : now.getHours(); 
}

function getCurrentMinutelyIndex(minutelyTimeArray) {
    if (!minutelyTimeArray || minutelyTimeArray.length === 0) return 0;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const mins = Math.floor(now.getMinutes() / 15) * 15;
    const localTimeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(mins)}`;
    const idx = minutelyTimeArray.indexOf(localTimeStr);
    return idx !== -1 ? idx : 0; 
}

async function fetchWeather(coords) {
    if (!coords) return;
    const [lat, lon] = coords.split(',');
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,wind_speed_10m,relative_humidity_2m,weather_code,is_day&minutely_15=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,is_day&hourly=temperature_2m,apparent_temperature,precipitation,weather_code,is_day,precipitation_probability,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=10`;

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
    
    const smsSec = document.getElementById('sms-section');
    if(smsSec) smsSec.classList.add('hidden'); 
    const sunUvSec = document.getElementById('sun-uv-section');
    if(sunUvSec) sunUvSec.classList.add('hidden');

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) throw new Error("API Data Error: " + data.reason);
        
        currentWeatherData = data.current;
        currentDailyData = data.daily;
        currentHourlyData = data.hourly; 
        currentMinutelyData = data.minutely_15; 
        
        updateUI(currentWeatherData, currentDailyData, currentHourlyData, currentMinutelyData); 
        renderAppleForecastList(currentDailyData); 
        renderSunAndUV(currentDailyData, currentHourlyData); 
        renderHourlySlider(currentHourlyData); 
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
        console.error("Fetch Crash Prevented:", error);
        loader.innerHTML = `<div class="text-red-500 py-6 font-bold"><i class="fa-solid fa-triangle-exclamation text-3xl mb-3"></i><br>Network Error. Please try again.</div>`;
    }
}

function triggerAIIfReady() {
    if (currentWeatherData && cropSelector.value) {
        let t = currentWeatherData.temperature_2m;
        let r = currentWeatherData.rain;
        let w = currentWeatherData.wind_speed_10m;
        
        if (currentMinutelyData && currentMinutelyData.time) {
            const mIdx = getCurrentMinutelyIndex(currentMinutelyData.time);
            t = currentMinutelyData.temperature_2m[mIdx] ?? t;
            r = currentMinutelyData.precipitation[mIdx] ?? r;
            w = currentMinutelyData.wind_speed_10m[mIdx] ?? w;
        }

        fetchAIAdvisory(t, r, w);

        if (window.innerWidth >= 1024) { 
            const leftColumn = document.getElementById('sms-section')?.parentElement;
            const forecastSection = document.getElementById('forecast-section');
            const doctorSection = document.getElementById('doctor-section');
            
            if (leftColumn && forecastSection && doctorSection) {
                leftColumn.appendChild(forecastSection);
                leftColumn.appendChild(doctorSection);
                
                if (currentDailyData) {
                    renderAppleForecastList(currentDailyData); 
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

    alertBox.className = "glass-panel mt-6 p-4 rounded-2xl flex items-start gap-3 shadow-[0_4px_20px_rgb(168,85,247,0.15)] transition-all duration-300 border-emerald-100 text-emerald-900"; 
    alertIcon.className = "fa-solid fa-sparkles text-lg text-purple-500 animate-pulse";
    audioIcon.className = "fa-solid fa-volume-high text-purple-500";
    alertTitle.innerText = "AI Agronomist Analyzing...";
    alertMsg.innerText = `Generating custom advisory for ${crop}...`;
    alertBox.classList.remove('hidden');

    try {
        const response = await fetch('https://weather-backend-mocha.vercel.app/generate-advisory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location: currentVillageName, crop: crop, temp: temp, rain: rain, wind: wind, language: langName })
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

function getForecastIcon(wmoCode, isDay = 1) {
    if ([95, 96, 99].includes(wmoCode)) return 'fa-solid fa-cloud-bolt text-indigo-400';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(wmoCode)) return 'fa-solid fa-cloud-showers-heavy text-blue-400';
    if ([3, 45, 48].includes(wmoCode)) return isDay ? 'fa-solid fa-cloud text-slate-400' : 'fa-solid fa-cloud-moon text-slate-400';
    if ([1, 2].includes(wmoCode)) return isDay ? 'fa-solid fa-cloud-sun text-slate-300' : 'fa-solid fa-cloud-moon text-slate-300';
    return isDay ? 'fa-solid fa-sun text-yellow-400' : 'fa-solid fa-moon text-slate-200';
}

function renderAppleForecastList(dailyData) {
    const listContainer = document.getElementById('forecast-list');
    if (!listContainer || !dailyData || !dailyData.temperature_2m_min) return;

    listContainer.innerHTML = '';

    const globalMin = Math.min(...dailyData.temperature_2m_min);
    const globalMax = Math.max(...dailyData.temperature_2m_max);
    const globalRange = globalMax - globalMin;

    const todayAnchor = new Date(); 

    for (let i = 0; i < dailyData.time.length; i++) {
        
        let dayName = "Today";
        if (i > 0) {
            const futureDate = new Date(todayAnchor);
            futureDate.setDate(todayAnchor.getDate() + i);
            dayName = futureDate.toLocaleDateString('en-US', { weekday: 'short' });
        }
        
        const wmoCode = dailyData.weather_code ? dailyData.weather_code[i] : 0;
        const iconClass = getForecastIcon(wmoCode); 
        
        const dayMin = dailyData.temperature_2m_min[i];
        const dayMax = dailyData.temperature_2m_max[i];
        
        const leftPercent = ((dayMin - globalMin) / globalRange) * 100;
        const widthPercent = ((dayMax - dayMin) / globalRange) * 100;

        const rowHTML = `
            <div onclick="openDetailsModal(${i})" class="cursor-pointer flex items-center justify-between py-2.5 sm:py-3 border-b border-gray-100/20 last:border-0 hover:bg-black/5 transition-colors rounded-lg px-2 -mx-2">
                <div class="w-12 sm:w-14 text-sm sm:text-base font-bold">${dayName}</div>
                <div class="w-8 sm:w-10 text-center text-lg sm:text-xl"><i class="${iconClass}"></i></div>
                <div class="w-10 sm:w-12 text-right text-sm sm:text-base font-bold opacity-70">${Math.round(dayMin)}°</div>
                
                <div class="flex-1 mx-3 sm:mx-5 h-1.5 bg-black/10 rounded-full relative overflow-hidden shadow-inner">
                    <div class="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-orange-500 shadow-sm" 
                         style="left: ${leftPercent}%; width: ${widthPercent}%;">
                    </div>
                </div>
                
                <div class="w-10 sm:w-12 text-left text-sm sm:text-base font-bold">${Math.round(dayMax)}°</div>
            </div>
        `;
        
        listContainer.insertAdjacentHTML('beforeend', rowHTML);
    }
}

function openDetailsModal(dayIndex) {
    if (!currentDailyData || !currentHourlyData) return;

    const targetDate = currentDailyData.time[dayIndex];
    const dateObj = new Date(targetDate);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('modal-date-title').innerText = dateObj.toLocaleDateString('en-US', options);

    const maxTemp = Math.round(currentDailyData.temperature_2m_max[dayIndex]);
    const minTemp = Math.round(currentDailyData.temperature_2m_min[dayIndex]);
    const wmoCode = currentDailyData.weather_code[dayIndex];
    
    document.getElementById('modal-temp-display').innerText = `${maxTemp}°`;
    document.getElementById('modal-summary').innerText = `H:${maxTemp}° L:${minTemp}°`;
    document.getElementById('modal-icon-display').className = `${getForecastIcon(wmoCode, 1)} text-2xl text-gray-400 mb-2`;

    const targetPrefix = targetDate + "T";
    const startIndex = currentHourlyData.time.findIndex(t => t.startsWith(targetPrefix));
    
    if (startIndex !== -1) {
        const hours = currentHourlyData.time.slice(startIndex, startIndex + 24).map(t => {
            const d = new Date(t);
            return d.toLocaleTimeString('en-US', {hour: 'numeric', hour12: true});
        });
        const actualTemps = currentHourlyData.temperature_2m.slice(startIndex, startIndex + 24).map(Math.round);
        const feelsLikeTemps = currentHourlyData.apparent_temperature.slice(startIndex, startIndex + 24).map(Math.round);
        const precipProbs = currentHourlyData.precipitation_probability.slice(startIndex, startIndex + 24);
        const precipVols = currentHourlyData.precipitation.slice(startIndex, startIndex + 24);

        const maxProb = Math.max(...precipProbs);
        document.getElementById('modal-pop').innerText = `${maxProb}%`;

        const totalRain = precipVols.reduce((a, b) => a + b, 0);
        document.getElementById('modal-rain-total').innerText = `${totalRain.toFixed(1)} mm`;

        renderWeatherChart(hours, actualTemps, feelsLikeTemps);
    }

    const detailsModalOverlay = document.getElementById('details-modal-overlay');
    const detailsModal = document.getElementById('details-modal');
    
    detailsModalOverlay.classList.remove('hidden');
    setTimeout(() => {
        detailsModalOverlay.classList.remove('opacity-0');
        detailsModalOverlay.classList.add('opacity-100');
        detailsModal.classList.remove('translate-y-full');
        detailsModal.classList.add('translate-y-0');
    }, 10);
}

function closeDetailsModal() {
    const detailsModalOverlay = document.getElementById('details-modal-overlay');
    const detailsModal = document.getElementById('details-modal');
    detailsModal.classList.remove('translate-y-0');
    detailsModal.classList.add('translate-y-full');
    detailsModalOverlay.classList.remove('opacity-100');
    detailsModalOverlay.classList.add('opacity-0');
    setTimeout(() => detailsModalOverlay.classList.add('hidden'), 300);
}

function renderWeatherChart(labels, data, feelsData) {
    const canvas = document.getElementById('weatherChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (weatherChartInstance) {
        weatherChartInstance.destroy();
    }

    const minVal = Math.min(...data, ...feelsData) - 3;
    const maxVal = Math.max(...data, ...feelsData) + 3;

    weatherChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature',
                data: data,
                borderColor: '#fbbf24', 
                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                borderWidth: 3,
                fill: true,
                tension: 0.4, 
                pointRadius: 0,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + '°';
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false, drawBorder: false },
                    ticks: { color: '#9ca3af', maxTicksLimit: 6, maxRotation: 0 }
                },
                y: {
                    display: false, 
                    min: minVal,
                    max: maxVal
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    const toggleActual = document.getElementById('toggle-actual');
    const toggleFeels = document.getElementById('toggle-feels');

    toggleActual.className = "flex-1 text-xs font-semibold py-2 rounded-md bg-white/20 shadow-sm transition-colors";
    toggleFeels.className = "flex-1 text-xs font-semibold py-2 rounded-md opacity-70 hover:opacity-100 transition-colors";

    toggleActual.onclick = () => {
        weatherChartInstance.data.datasets[0].data = data;
        weatherChartInstance.data.datasets[0].borderColor = '#fbbf24';
        weatherChartInstance.data.datasets[0].backgroundColor = 'rgba(251, 191, 36, 0.15)';
        weatherChartInstance.update();
        toggleActual.className = "flex-1 text-xs font-semibold py-2 rounded-md bg-white/20 shadow-sm transition-colors";
        toggleFeels.className = "flex-1 text-xs font-semibold py-2 rounded-md opacity-70 hover:opacity-100 transition-colors";
    };

    toggleFeels.onclick = () => {
        weatherChartInstance.data.datasets[0].data = feelsData;
        weatherChartInstance.data.datasets[0].borderColor = '#f87171'; 
        weatherChartInstance.data.datasets[0].backgroundColor = 'rgba(248, 113, 113, 0.15)';
        weatherChartInstance.update();
        toggleFeels.className = "flex-1 text-xs font-semibold py-2 rounded-md bg-white/20 shadow-sm transition-colors";
        toggleActual.className = "flex-1 text-xs font-semibold py-2 rounded-md opacity-70 hover:opacity-100 transition-colors";
    };
}

function renderHourlySlider(hourly) {
    const slider = document.getElementById('hourly-forecast-slider');
    if (!slider || !hourly || !hourly.time) return;

    slider.innerHTML = '';
    const currentIdx = getCurrentHourlyIndex(hourly.time);
    
    for (let i = currentIdx; i < currentIdx + 24 && i < hourly.time.length; i++) {
        const timeStr = hourly.time[i];
        const dateObj = new Date(timeStr);
        
        let timeLabel = "Now";
        if (i !== currentIdx) {
            timeLabel = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        }

        const temp = Math.round(hourly.temperature_2m[i]);
        const wmoCode = hourly.weather_code[i];
        const isDay = hourly.is_day ? hourly.is_day[i] : 1;
        
        const iconClass = getForecastIcon(wmoCode, isDay);
        
        const itemHTML = `
            <div class="flex flex-col items-center justify-between gap-3 min-w-[60px] sm:min-w-[70px] snap-center">
                <span class="text-xs sm:text-sm font-bold whitespace-nowrap">${timeLabel}</span>
                <i class="${iconClass} text-xl sm:text-2xl drop-shadow-sm"></i>
                <span class="text-sm sm:text-base font-extrabold">${temp}°</span>
            </div>
        `;
        slider.insertAdjacentHTML('beforeend', itemHTML);
    }
}

function renderSunAndUV(daily, hourly) {
    const sunUvSection = document.getElementById('sun-uv-section');
    if (!sunUvSection || !daily || !daily.sunrise) return;

    const sunriseStr = daily.sunrise[0];
    const sunsetStr = daily.sunset[0];
    
    let uvLive = 0;
    if (hourly && hourly.uv_index) {
        const idx = getCurrentHourlyIndex(hourly.time);
        uvLive = hourly.uv_index[idx] || 0;
    } else {
        uvLive = daily.uv_index_max[0] || 0;
    }

    const sunriseDate = new Date(sunriseStr);
    const sunsetDate = new Date(sunsetStr);
    const now = new Date();

    document.getElementById('sunrise-time').innerText = sunriseDate.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit'});
    document.getElementById('sunset-time').innerText = sunsetDate.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit'});
    document.getElementById('uv-index-val').innerText = Math.round(uvLive);
    
    const langCode = document.getElementById('language-selector').value;
    const t = typeof translations !== 'undefined' ? (translations[langCode] || translations['en']) : {};

    let uvDesc = t.uvLow || "LOW";
    let uvColor = "text-emerald-500";
    if (uvLive >= 11) { uvDesc = (t.uvExt === "EXT" ? "EXTREME" : t.uvExt) || "EXTREME"; uvColor = "text-purple-600"; }
    else if (uvLive >= 8) { uvDesc = (t.uvVHigh === "V. HIGH" ? "VERY HIGH" : t.uvVHigh) || "VERY HIGH"; uvColor = "text-red-500"; }
    else if (uvLive >= 6) { uvDesc = t.uvHigh || "HIGH"; uvColor = "text-orange-500"; }
    else if (uvLive >= 3) { uvDesc = t.uvMod || "MODERATE"; uvColor = "text-yellow-600"; }

    const uvDescEl = document.getElementById('uv-index-desc');
    if (uvDescEl) {
        uvDescEl.innerText = uvDesc;
        uvDescEl.className = `text-[9px] px-2 py-0.5 rounded-full mt-1 uppercase tracking-widest font-bold ${uvColor} bg-black/5 dark:bg-white/10 transition-colors`;
    }

    let progress = 0;
    if (now > sunsetDate) {
        progress = 1; 
    } else if (now > sunriseDate) {
        const totalDaylightMs = sunsetDate.getTime() - sunriseDate.getTime();
        const elapsedMs = now.getTime() - sunriseDate.getTime();
        progress = elapsedMs / totalDaylightMs;
    }
    
    progress = Math.max(0, Math.min(1, progress));
    const degrees = progress * 180;
    
    setTimeout(() => {
        const arc = document.getElementById('sun-arc-progress');
        if (arc) arc.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
    }, 100);
}

function applyAppleWeather(condition, isNight) {
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

    if (isNight) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }

    if (condition === 'rain' || condition === 'storm') {
        bgLayer.style.background = isNight 
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' 
            : 'linear-gradient(180deg, #5A6B7C 0%, #2F3C4D 100%)';
            
        document.body.style.background = isNight 
            ? 'linear-gradient(180deg, #0f172a 0%, #020617 100%)' 
            : 'linear-gradient(180deg, #94a3b8 0%, #64748b 100%)';
            
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
    } else if (condition === 'windy') {
        bgLayer.style.background = isNight 
            ? 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)' 
            : 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)';
            
        document.body.style.background = isNight 
            ? 'linear-gradient(180deg, #020617 0%, #0f172a 100%)' 
            : 'linear-gradient(180deg, #bae6fd 0%, #7dd3fc 100%)';
            
        for(let i=0; i<6; i++) {
            let cloud = document.createElement('div');
            cloud.className = 'apple-cloud';
            cloud.style.width = `${Math.random() * 300 + 150}px`;
            cloud.style.height = `${Math.random() * 80 + 50}px`;
            cloud.style.top = i % 2 === 0 ? `${Math.random() * 20}%` : `${Math.random() * 20 + 70}%`;
            cloud.style.animationDuration = `${Math.random() * 15 + 10}s`; 
            cloud.style.animationDelay = `-${Math.random() * 10}s`;
            bgLayer.appendChild(cloud);
        }
        
        let celestial = document.createElement('div');
        celestial.className = isNight ? 'apple-moon' : 'apple-sun';
        bgLayer.appendChild(celestial);
        
    } else if (condition === 'cloudy' || condition === 'cloudy-night') {
        bgLayer.style.background = isNight 
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' 
            : 'linear-gradient(180deg, #64748b 0%, #334155 100%)'; 
            
        document.body.style.background = isNight 
            ? 'linear-gradient(180deg, #0f172a 0%, #020617 100%)' 
            : 'linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)';
            
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
    } else if (condition === 'night' || isNight) {
        bgLayer.style.background = 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)';
        document.body.style.background = 'linear-gradient(180deg, #020617 0%, #0f172a 100%)';
        let moon = document.createElement('div');
        moon.className = 'apple-moon';
        bgLayer.appendChild(moon);
    } else {
        bgLayer.style.background = 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)';
        document.body.style.background = 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%)';
        let sun = document.createElement('div');
        sun.className = 'apple-sun';
        bgLayer.appendChild(sun);
    }
}

function updateUI(weather, daily, hourly, minutely) {
    loader.classList.add('hidden');
    const weatherCard = document.getElementById('weather-content');
    weatherCard.classList.remove('hidden');
    document.getElementById('forecast-section').classList.remove('hidden');
    
    const smsSec = document.getElementById('sms-section');
    if(smsSec) smsSec.classList.remove('hidden'); 
    const sunUvSec = document.getElementById('sun-uv-section');
    if(sunUvSec) sunUvSec.classList.remove('hidden');
    
    if (document.getElementById('location-name-text')) {
        document.getElementById('location-name-text').innerText = currentVillageName;
    }

    let tempLive = weather.temperature_2m;
    let rainLive = weather.rain;
    let windLive = weather.wind_speed_10m;
    let humLive = weather.relative_humidity_2m;
    let wmoLive = weather.weather_code !== undefined ? weather.weather_code : 0;
    let isDayLive = weather.is_day !== undefined ? weather.is_day : 1;

    if (minutely && minutely.time) {
        const mIdx = getCurrentMinutelyIndex(minutely.time);
        tempLive = minutely.temperature_2m[mIdx] ?? tempLive;
        rainLive = minutely.precipitation[mIdx] ?? rainLive;
        windLive = minutely.wind_speed_10m[mIdx] ?? windLive;
        humLive = minutely.relative_humidity_2m[mIdx] ?? humLive;
        wmoLive = minutely.weather_code[mIdx] ?? wmoLive;
        isDayLive = minutely.is_day[mIdx] ?? isDayLive;
    }

    document.getElementById('temperature').innerText = `${Math.round(tempLive)}°`;
    document.getElementById('rain-val').innerText = `${rainLive} mm`;
    document.getElementById('wind-val').innerText = `${windLive} km/h`;
    
    if(document.getElementById('humidity-val')) document.getElementById('humidity-val').innerText = `${humLive} %`;
    
    if(document.getElementById('precip-prob-val')) {
        let prob = 0;
        if (hourly && hourly.precipitation_probability) {
            const idx = getCurrentHourlyIndex(hourly.time);
            prob = hourly.precipitation_probability[idx] || 0;
        } else if (daily && daily.precipitation_probability_max) {
            prob = daily.precipitation_probability_max[0] || 0;
        }
        document.getElementById('precip-prob-val').innerText = `${prob} %`;
    }

    const hiloElement = document.getElementById('weather-hilo');
    if (hiloElement && daily && daily.temperature_2m_max && daily.temperature_2m_min) {
        hiloElement.innerText = `H:${Math.round(daily.temperature_2m_max[0])}° L:${Math.round(daily.temperature_2m_min[0])}°`;
    }

    const icon = document.getElementById('weather-icon');
    const conditionText = document.getElementById('weather-condition');
    
    const langCode = document.getElementById('language-selector').value;
    const t = typeof translations !== 'undefined' ? (translations[langCode] || translations['en']) : {};
    
    const isNight = isDayLive === 0;
    let wmoCode = wmoLive;

    if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(wmoCode) && rainLive === 0) {
        wmoCode = windLive > 15 ? 3 : 2; 
    }

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
    } else if (wmoCode === 3 && windLive > 15) {
        activeCondition = 'windy';
        condString = t.condWindy || 'Windy';
        iconClass = 'fa-solid fa-wind';
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

    if(icon) icon.className = `${iconClass} text-6xl sm:text-7xl drop-shadow-md text-white transition-all`;
    if(conditionText) conditionText.innerText = condString;

    weatherCard.classList.add('apple-active');
    
    applyAppleWeather(activeCondition, isNight);

    const forecastCard = document.getElementById('forecast-section');
    if(forecastCard) {
        forecastCard.className = "glass-panel rounded-[2rem] p-5 sm:p-6 w-full overflow-hidden relative transition-colors duration-1000";
    }

    updateLanguage(langCode);

    if (currentWeatherData && !cropSelector.value) {
        const alertBox = document.getElementById('alert-box');
        const alertTitle = document.getElementById('alert-title');
        const alertMsg = document.getElementById('alert-message');
        const alertIcon = document.getElementById('alert-icon');
        const audioIcon = document.getElementById('audio-icon');
        
        alertBox.className = "glass-panel mt-6 p-4 rounded-2xl flex items-start gap-3 transition-all duration-300"; 
        audioIcon.className = "fa-solid fa-volume-high text-emerald-500";
        alertBox.classList.remove('hidden');

        const isRainingWMO = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(wmoCode);

        if (isRainingWMO || rainLive > 0.2) {
            alertIcon.className = "fa-solid fa-cloud-showers-heavy text-lg text-red-500";
            alertTitle.innerText = t.alertRainTitle || "Rain Alert";
            alertMsg.innerText = t.alertRainMsg || "Rain detected. Avoid sensitive field work and ensure proper drainage.";
        } else if (windLive > 20) { 
            alertIcon.className = "fa-solid fa-wind text-lg text-amber-500";
            alertTitle.innerText = t.alertWindTitle || "High Wind Warning";
            alertMsg.innerText = t.alertWindMsg || "Strong winds detected. Secure equipment and avoid spraying pesticides.";
        } else {
            alertIcon.className = "fa-solid fa-check text-lg text-emerald-500";
            alertTitle.innerText = t.alertSafeTitle || "Conditions Safe";
            alertMsg.innerText = t.alertSafeMsg || "Weather is optimal for standard agricultural activities.";
        }
    }
}

function updateLanguage(langCode) {
    const t = typeof translations !== 'undefined' ? (translations[langCode] || translations['en']) : {}; 

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
    
    if(document.getElementById('ui-forecast-title')) document.getElementById('ui-forecast-title').innerHTML = `<i class="fa-regular fa-calendar text-gray-500"></i> ${t.forecastTitle || "10-Day Forecast"}`;

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

    if(document.getElementById('ui-sun-uv-title')) document.getElementById('ui-sun-uv-title').innerHTML = `<i class="fa-solid fa-sun text-amber-500 animate-spin" style="animation-duration: 4s;"></i> ${t.sunUvTitle || "Sun & UV"}`;
    if(document.getElementById('lbl-sunrise')) document.getElementById('lbl-sunrise').innerText = t.lblSunrise || "Sunrise";
    if(document.getElementById('lbl-sunset')) document.getElementById('lbl-sunset').innerText = t.lblSunset || "Sunset";
    if(document.getElementById('lbl-uv')) document.getElementById('lbl-uv').innerText = t.lblUv || "UV Index";
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
