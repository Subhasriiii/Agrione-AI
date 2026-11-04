class WeatherApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fetchOpenWeather = async (endpoint, location, apiKey) => {
  let response;
  try {
    const url = new URL(`https://api.openweathermap.org/data/2.5/${endpoint}`);
    url.searchParams.set('q', location);
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'metric');
    response = await fetch(url);
  } catch (error) {
    throw new WeatherApiError(502, 'Unable to reach the live weather service.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new WeatherApiError(404, 'The requested location was not found.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new WeatherApiError(502, 'The live weather service rejected its configured API key.');
    }
    if (response.status === 429) {
      throw new WeatherApiError(503, 'The live weather service is temporarily rate-limited.');
    }
    throw new WeatherApiError(502, 'The live weather service returned an error.');
  }

  try {
    return await response.json();
  } catch (error) {
    throw new WeatherApiError(502, 'The live weather service returned an invalid response.');
  }
};

const getDayKey = (timestamp, timezoneOffset) => {
  const localTime = new Date((timestamp + timezoneOffset) * 1000);
  return localTime.toISOString().slice(0, 10);
};

const getDayLabel = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en', {
    weekday: 'long',
    timeZone: 'UTC',
  });
};

const aggregateForecast = (forecastData) => {
  if (!Array.isArray(forecastData.list) || forecastData.list.length === 0) {
    throw new WeatherApiError(502, 'The live weather service returned no forecast data.');
  }

  const timezoneOffset = Number(forecastData.city?.timezone) || 0;
  const days = new Map();

  forecastData.list.forEach((entry) => {
    if (!Number.isFinite(entry.dt) || !entry.main || !Number.isFinite(entry.main.temp)) return;

    const date = getDayKey(entry.dt, timezoneOffset);
    if (!days.has(date)) {
      days.set(date, {
        date,
        tempMin: Number.POSITIVE_INFINITY,
        tempMax: Number.NEGATIVE_INFINITY,
        rainProb: null,
        conditions: new Map(),
      });
    }

    const day = days.get(date);
    const tempMin = Number.isFinite(entry.main.temp_min) ? entry.main.temp_min : entry.main.temp;
    const tempMax = Number.isFinite(entry.main.temp_max) ? entry.main.temp_max : entry.main.temp;
    day.tempMin = Math.min(day.tempMin, tempMin);
    day.tempMax = Math.max(day.tempMax, tempMax);
    if (Number.isFinite(entry.pop)) {
      const rainProbability = Math.round(Math.max(0, Math.min(1, entry.pop)) * 100);
      day.rainProb = day.rainProb === null
        ? rainProbability
        : Math.max(day.rainProb, rainProbability);
    }

    const condition = entry.weather?.[0];
    if (condition?.description) {
      const current = day.conditions.get(condition.description) || { count: 0, icon: condition.icon || '' };
      current.count += 1;
      day.conditions.set(condition.description, current);
    }
  });

  const validDays = [...days.values()].filter((day) =>
    Number.isFinite(day.tempMin) && Number.isFinite(day.tempMax)
  );
  if (validDays.length === 0) {
    throw new WeatherApiError(502, 'The live weather service returned no usable forecast data.');
  }

  return validDays.slice(0, 5).map((day) => {
    const mostCommonCondition = [...day.conditions.entries()]
      .sort((a, b) => b[1].count - a[1].count)[0];

    return {
      date: day.date,
      day: getDayLabel(day.date),
      tempMin: Math.round(day.tempMin * 10) / 10,
      tempMax: Math.round(day.tempMax * 10) / 10,
      rainProb: day.rainProb,
      condition: mostCommonCondition?.[0] || 'Condition unavailable',
      icon: mostCommonCondition?.[1].icon || '',
    };
  });
};

exports.getWeather = async (req, res) => {
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
  if (!location) {
    return res.status(400).json({ success: false, message: 'A location is required.' });
  }

  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(503).json({
      success: false,
      message: 'Live weather is not configured. Add WEATHER_API_KEY to the backend environment.',
    });
  }

  try {
    const currentWeatherPromise = fetchOpenWeather('weather', location, apiKey);
    const forecastPromise = fetchOpenWeather('forecast', location, apiKey);
    const [currentResult, forecastResult] = await Promise.allSettled([
      currentWeatherPromise,
      forecastPromise,
    ]);

    if (currentResult.status === 'rejected') throw currentResult.reason;

    const data = currentResult.value;
    if (!data.main || !data.wind || !Array.isArray(data.weather)) {
      throw new WeatherApiError(502, 'The live weather service returned incomplete current conditions.');
    }

    let forecast = [];
    let forecastError;
    if (forecastResult.status === 'fulfilled') {
      try {
        forecast = aggregateForecast(forecastResult.value);
      } catch (error) {
        forecastError = error.message || 'The five-day forecast is temporarily unavailable.';
      }
    } else {
      forecastError = forecastResult.reason.message || 'The five-day forecast is temporarily unavailable.';
    }

    return res.json({
      success: true,
      isLive: true,
      weather: {
        location: data.name,
        temperature: data.main.temp,
        humidity: data.main.humidity,
        description: data.weather[0]?.description || 'N/A',
        icon: data.weather[0]?.icon || '',
        windSpeed: data.wind.speed,
        rainfall: data.rain?.['1h'] || 0,
        feelsLike: data.main.feels_like,
        pressure: data.main.pressure,
      },
      forecast,
      ...(forecastError ? { forecastError } : {}),
      source: 'OpenWeatherMap',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error instanceof WeatherApiError ? error.status : 502;
    const message = error instanceof WeatherApiError
      ? error.message
      : 'Live weather request failed.';
    return res.status(status).json({ success: false, message });
  }
};
