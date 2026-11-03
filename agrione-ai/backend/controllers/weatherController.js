exports.getWeather = async (req, res) => {
  try {
    const { location } = req.query;
    const apiKey = process.env.WEATHER_API_KEY;

    if (apiKey && location) {
      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`
        );

        if (response.ok) {
          const data = await response.json();
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
            source: 'OpenWeatherMap',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (apiError) {
        return res.status(502).json({
          success: false,
          message: 'Live weather request failed. Please check the WEATHER_API_KEY and location details.',
        });
      }
    }

    return res.status(503).json({
      success: false,
      message: 'Weather data is not currently available because the live weather API is not configured.',
      instructions: 'Add WEATHER_API_KEY to the backend .env file to enable live weather integration.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Weather fetch failed.' });
  }
};
