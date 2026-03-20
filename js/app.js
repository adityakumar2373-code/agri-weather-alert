let currentWeatherData = null;
let currentCoords = null; 
let currentVillageName = ""; 
let weatherChart = null; 

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
        'en': 'en-IN', 'hi': 'hi-IN', 'or': 'or-IN',
        'bn': 'bn-IN', 'mr': 'mr-IN', 'te': 'te-IN', 
        'ta': 'ta-IN', 'ml': 'ml-IN', 'bho': 'hi-IN' 
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

async function fetchWeather(coords) {
    if (!coords) return;
    const [lat, lon] = coords.split(',');
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,rain,wind_speed_10m&daily=temperature_2m_max&timezone=auto`;

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
        updateUI(currentWeatherData);
        drawChart(data.daily);
        triggerAIIfReady(); 
        
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

function drawChart(dailyData) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    const dayLabels = dailyData.time.map(dateString => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    if (weatherChart) weatherChart.destroy();

    weatherChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dayLabels,
            datasets: [{
                label: 'Max Temp (°C)', data: dailyData.temperature_2m_max,
                borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3, pointBackgroundColor: '#ffffff',
                pointBorderColor: '#10b981', pointBorderWidth: 2,
                pointRadius: 4, fill: true, tension: 0.4 
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return c.raw + '°C'; } } } },
            scales: { x: { grid: { display: false }, ticks: { font: { family: "'Outfit', sans-serif" } } }, y: { display: false } }
        }
    });
}

function updateUI(weather) {
    loader.classList.add('hidden');
    document.getElementById('weather-content').classList.remove('hidden');
    document.getElementById('forecast-section').classList.remove('hidden');
    document.getElementById('sms-section').classList.remove('hidden');
    
    document.getElementById('temperature').innerText = `${Math.round(weather.temperature_2m)}°`;
    document.getElementById('rain-val').innerText = `${weather.rain} mm`;
    document.getElementById('wind-val').innerText = `${weather.wind_speed_10m} km/h`;

    const icon = document.getElementById('weather-icon');
    if (weather.rain > 0) {
        icon.className = "fa-solid fa-cloud-rain text-6xl text-blue-500 drop-shadow-md";
    } else if (weather.wind_speed_10m > 15) { 
        icon.className = "fa-solid fa-wind text-6xl text-teal-400 drop-shadow-md";
    } else {
        icon.className = "fa-solid fa-sun text-6xl text-amber-400 drop-shadow-md";
    }

    updateLanguage(document.getElementById('language-selector').value);
}

function updateLanguage(langCode) {
    const t = translations[langCode];

    document.getElementById('app-title').innerHTML = `<i class="fa-solid fa-leaf text-emerald-500 mr-2"></i>${t.appTitle || "AgriAlert"}`;
    document.getElementById('current-weather-title').innerText = t.currentConditions || "Live Conditions";
    document.getElementById('rain-label').innerText = t.rainLabel;
    document.getElementById('wind-label').innerText = t.windLabel;
    document.getElementById('sms-heading').innerText = t.smsHeading || "Automated Alerts";
    document.getElementById('sms-help').innerText = t.smsHelp || "Receive this advisory via SMS directly to your phone.";

    if (currentWeatherData && !cropSelector.value) {
        const alertBox = document.getElementById('alert-box');
        const alertTitle = document.getElementById('alert-title');
        const alertMsg = document.getElementById('alert-message');
        const alertIcon = document.getElementById('alert-icon');
        const audioIcon = document.getElementById('audio-icon');
        
        alertBox.className = "mt-6 p-4 rounded-2xl flex items-start gap-3 shadow-sm transition-all duration-300"; 
        audioIcon.className = "fa-solid fa-volume-high text-emerald-500";
        alertBox.classList.remove('hidden');

        if (currentWeatherData.rain > 2) {
            alertBox.classList.add('bg-red-50', 'border', 'border-red-100', 'text-red-900');
            alertIcon.className = "fa-solid fa-cloud-showers-heavy text-lg text-red-500";
            alertTitle.innerText = t.alertRainTitle;
            alertMsg.innerText = t.alertRainMsg;
        } else if (currentWeatherData.wind_speed_10m > 20) { 
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

// ==========================================
// PWA SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('PWA Registered successfully!'))
            .catch(err => console.log('PWA Registration Failed:', err));
    });
}

// ==========================================
// MULTILINGUAL AI SEARCH LOGIC (NEW)
// ==========================================
const aiSearchBtn = document.getElementById('ai-search-btn');
const aiSearchInput = document.getElementById('ai-search-input');
const aiResultBox = document.getElementById('ai-search-result-box');
const aiResultText = document.getElementById('ai-search-result');

if(aiSearchBtn) {
    aiSearchBtn.addEventListener('click', async () => {
        const question = aiSearchInput.value.trim();
        if (!question) return;

        // Show loading state
        aiSearchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        aiSearchBtn.disabled = true;
        aiResultBox.classList.remove('hidden');
        aiResultText.innerHTML = '<span class="animate-pulse">The AI is thinking...</span>';

        try {
            const response = await fetch('https://weather-backend-mocha.vercel.app/ai-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            const data = await response.json();

            if (data.success) {
                // Formatting the response nicely
                aiResultText.innerHTML = `<i class="fa-solid fa-check-circle text-emerald-500 mr-1"></i> ${data.answer}`;
            } else {
                throw new Error(data.error || "Failed to get answer");
            }
        } catch (error) {
            console.error(error);
            aiResultText.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-red-500 mr-1"></i> Sorry, the AI could not answer right now. Please try again.`;
        } finally {
            // Restore button state
            aiSearchBtn.innerHTML = 'Ask';
            aiSearchBtn.disabled = false;
        }
    });

    // Allow pressing "Enter" to search
    aiSearchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            aiSearchBtn.click();
        }
    });
}


// ==========================================
// AI PLANT DOCTOR LOGIC
// ==========================================
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
            // SPEED OPTIMIZATION: Compress the image in the browser before sending
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Shrink to a web-friendly size
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Convert to compressed JPEG (70% quality)
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
        docDiagnosis.innerText = "Could not connect to the AI server. Is the backend running?";
    }
}
