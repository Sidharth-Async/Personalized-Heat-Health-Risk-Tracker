const API_KEY = '59e7b667568347f192481049251905'; // WeatherAPI key

async function fetchWeather(locationOrCoords) {
    const isCoords = typeof locationOrCoords === 'object' && locationOrCoords !== null;
    const query = isCoords
        ? `${locationOrCoords.lat},${locationOrCoords.lon}`
        : encodeURIComponent(locationOrCoords);

    const url = `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${query}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Weather API request failed: ${errorData.error.message || response.statusText}`);
        }
        const data = await response.json();
        return data.current;
    } catch (error) {
        console.error('Error fetching weather:', error);
        return null;
    }
}

async function reverseGeocode(lat, lon) {
    const OPENCAGE_API_KEY = 'f0b9cdba10d247efa83ef7b8880449ba';
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_API_KEY}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Reverse geocoding failed: ${response.statusText}`);
        }
        const data = await response.json();
        const components = data.results?.[0]?.components || {};
        return components.city || components.town || components.village || components.state || components.country || '';
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('risk-form');
    const submitBtn = form.querySelector('.submit-btn');
    const locationInput = document.getElementById('location');

    let resultBox = document.getElementById('risk-result');
    if (!resultBox) {
        resultBox = document.createElement('div');
        resultBox.id = 'risk-result';
        resultBox.className = 'risk-box';
        document.querySelector('.container').appendChild(resultBox);
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            const city = await reverseGeocode(coords.lat, coords.lon);
            if (city) {
                locationInput.value = city;
                locationInput.dataset.coords = JSON.stringify(coords);
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation(); // Prevent multiple submissions
        console.log("✅ Form submit intercepted successfully.");

        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking Risk...';
        submitBtn.style.cursor = 'not-allowed';
        resultBox.innerHTML = 'Loading weather data...';
        resultBox.style.display = 'block';
        resultBox.style.background = 'linear-gradient(135deg, #56ccf2, #2f80ed)';
        resultBox.style.color = '#fff';

        const age = Number(document.getElementById('age').value);
        const conditions = Array.from(document.querySelectorAll('input[name="conditions"]:checked')).map(el => el.value);
        const location = locationInput.value.trim();
        const coords = locationInput.dataset.coords ? JSON.parse(locationInput.dataset.coords) : null;

        if (isNaN(age) || age < 0 || (!location && !coords)) {
            resultBox.innerHTML = '❌ Please provide valid inputs.';
            resultBox.style.background = '#ff4d4d';
            resetSubmitBtn();
            return;
        }

        const weather = await fetchWeather(coords || location);
        if (!weather) {
            resultBox.innerHTML = '❌ Failed to fetch weather data.';
            resultBox.style.background = '#ff4d4d';
            resetSubmitBtn();
            return;
        }

        // Risk logic
        const temp = weather.temp_c;
        const humidity = weather.humidity;

        let points = 0;
        if (age < 5) points += 2;
        else if (age > 65) points += 3;
        else if (age >= 55) points += 1;

        points += conditions.length;

        if (temp >= 40) points += 4;
        else if (temp >= 35) points += 3;
        else if (temp >= 30) points += 2;
        else if (temp >= 25) points += 1;

        if (humidity >= 85) points += 2;
        else if (humidity >= 70) points += 1;
        else if (humidity >= 50) points += 0.5;

        let riskLevel = '', bgColor = '', emoji = '', advice = '';
        if (points >= 7) {
            riskLevel = 'Very High';
            bgColor = '#cc0000';
            emoji = '🚨';
            advice = 'Avoid all outdoor activity. Immediate action needed!';
        } else if (points >= 5) {
            riskLevel = 'High';
            bgColor = '#ff4d4d';
            emoji = '⚠️';
            advice = 'Limit time outdoors and stay hydrated.';
        } else if (points >= 3) {
            riskLevel = 'Moderate';
            bgColor = '#ffcc00';
            emoji = '🟡';
            advice = 'Stay cautious and drink plenty of water.';
        } else {
            riskLevel = 'Low';
            bgColor = '#4caf50';
            emoji = '✅';
            advice = 'Minimal risk. Continue basic precautions.';
        }

        resultBox.innerHTML = `
            <p>${emoji} Heat health risk: <strong>${riskLevel}</strong></p>
            <p><strong>Temp:</strong> ${temp}°C | <strong>Humidity:</strong> ${humidity}%</p>
            <p><strong>Advice:</strong> ${advice}</p>
        `;
        resultBox.style.background = bgColor;

        // Save to backend (MySQL)
        const userData = {
            age,
            conditions,
            location: location || 'Geolocation',
            coordinates: coords,
            temperature: temp,
            humidity,
            risk: riskLevel,
            points,
            timestamp: new Date().toISOString()
        };

        try {
            const res = await fetch('http://localhost:3000/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (!res.ok) throw new Error(`Server responded with status ${res.status}`);

            const responseData = await res.json();
            console.log("✅ Data saved:", responseData);
        } catch (err) {
            console.error("❌ Error saving user data:", err);
            alert("Failed to save data to server.");
        }

        resetSubmitBtn();
    });

    function resetSubmitBtn() {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Check Risk';
        submitBtn.style.cursor = 'pointer';
    }
});
