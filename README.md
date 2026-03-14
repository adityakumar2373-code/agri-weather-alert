# 🌾 Village-Level Micro Weather Alert System

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![Open-Meteo API](https://img.shields.io/badge/Open--Meteo-Free_API-blue?style=for-the-badge)

A lightweight, mobile-first web application designed to provide farmers with highly localized, village-level weather forecasts and critical agricultural alerts in their native regional languages.

## 🎯 Project Overview
Access to accurate, hyper-local weather data is critical for agricultural success. This project aims to bridge the information gap by providing a simple, easy-to-use interface for farmers to check current weather conditions and receive actionable farming advisories based on real-time data.

## ✨ Key Features
* **📍 Micro-Level Accuracy:** Fetches real-time weather data using exact latitude and longitude coordinates.
* **🌐 Multilingual Support:** Seamlessly switch between English, Hindi, and Odia to ensure accessibility for local farmers.
* **🚜 Smart Agri-Alerts:** Automatically generates actionable farming advice (e.g., advising against pesticide spraying during high winds or heavy rain).
* **📱 Mobile-First UI:** Built with Tailwind CSS to ensure a smooth, app-like experience on low-end smartphones.
* **💬 SMS Alert System (UI Mockup):** Features a sleek registration interface to simulate sending automated weather advisories directly to a farmer's mobile phone.

## 🛠️ Tech Stack
* **Frontend:** HTML5, Vanilla JavaScript (ES6+)
* **Styling:** Tailwind CSS (via CDN)
* **Icons:** FontAwesome
* **Weather Data:** [Open-Meteo API](https://open-meteo.com/) (No API Key required)

## 📂 Folder Structure
\`\`\`text
agri-weather-alert/
│
├── index.html           # Main user interface
├── README.md            # Project documentation
└── js/
    ├── app.js           # Core weather fetching and UI logic
    └── translations.js  # Language dictionaries for regional support
\`\`\`

## 🚀 Getting Started (Local Development)

This project requires zero build tools or package installations. 

1. **Clone the repository:**
   \`\`\`bash
   git clone https://github.com/yourusername/agri-weather-alert.git
   \`\`\`
2. **Open the project:**
   Navigate to the project folder and simply open `index.html` in any modern web browser.

## 🌍 Live Deployment (GitHub Pages)

This project is ready to be hosted for free via GitHub Pages.
1. Upload this repository to your GitHub account.
2. Go to your repository **Settings** > **Pages**.
3. Under **Build and deployment**, select `Deploy from a branch`.
4. Choose the `main` branch and click **Save**.
5. Your app will be live at `https://[your-username].github.io/agri-weather-alert` in a few minutes!

## 🔮 Future Enhancements
* Integrate a real SMS Gateway (e.g., Twilio, MSG91) via a Node.js/Python backend.
* Add a 7-day weather forecast chart using Chart.js.
* Expand the village database and add more regional languages.
* Implement a Progressive Web App (PWA) wrapper for offline access.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/agri-weather-alert/issues).

---
*Built to empower farmers with data.* 🌱