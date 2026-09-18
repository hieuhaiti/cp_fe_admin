const API_KEY = import.meta.env.VITE_WEATHERAPI_API_KEY;
const BASE_URL = import.meta.env.VITE_WEATHERAPI_URL_BASE;

/**
 * Lấy thông tin thời tiết hiện tại + AQI
 * WeatherAPI endpoint: /current.json
 * Bao gồm: current weather + air quality (us-epa-index)
 */
export async function fetchWeather(lat, lon, lang = 'vi') {
  const url = `${BASE_URL}/current.json?key=${API_KEY}&q=${lat},${lon}&aqi=yes&lang=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể lấy dữ liệu thời tiết');
  const data = await res.json();
  return data;
}

/**
 * Extract AQI từ weather response
 * WeatherAPI trả về air_quality với us-epa-index (1-6)
 */
export function extractAQI(weatherData) {
  if (!weatherData?.current?.air_quality) return null;
  const aqi = weatherData.current.air_quality['us-epa-index'];
  return {
    index: aqi,
    pm2_5: weatherData.current.air_quality.pm2_5,
    pm10: weatherData.current.air_quality.pm10,
    co: weatherData.current.air_quality.co,
    no2: weatherData.current.air_quality.no2,
    o3: weatherData.current.air_quality.o3,
    so2: weatherData.current.air_quality.so2,
  };
}

/**
 * Lấy dự báo thời tiết 3 ngày (giới hạn free plan)
 * WeatherAPI endpoint: /forecast.json
 */
export async function fetchForecast(lat, lon, days = 3, lang = 'vi') {
  const url = `${BASE_URL}/forecast.json?key=${API_KEY}&q=${lat},${lon}&days=${days}&aqi=no&alerts=no&lang=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể lấy dữ liệu dự báo thời tiết');
  const data = await res.json();

  // Transform forecast data
  const dailyForecast = data.forecast.forecastday.map((day) => ({
    date: day.date,
    date_epoch: day.date_epoch,
    temp: {
      min: day.day.mintemp_c,
      max: day.day.maxtemp_c,
      avg: day.day.avgtemp_c,
    },
    condition: {
      text: day.day.condition.text,
      code: day.day.condition.code,
      icon: day.day.condition.icon,
    },
    humidity: day.day.avghumidity,
    wind_speed: day.day.maxwind_kph,
    wind_dir: day.day.wind_dir || 'N/A',
    rain_chance: day.day.daily_chance_of_rain,
    snow_chance: day.day.daily_chance_of_snow,
    uv: day.day.uv,
  }));

  return dailyForecast;
}

/**
 * Lấy weather alerts
 * Sử dụng mock data vì WeatherAPI free plan có giới hạn alerts
 * API endpoint: /forecast.json với alerts=yes
 */
export async function fetchAlerts(lat, lon, lang = 'vi') {
  // // Import mock data
  // const { getRandomAlerts } = await import('./mockAlerts.js');

  // // Simulate API delay
  // await new Promise(resolve => setTimeout(resolve, 300));

  // // Return mock alerts in API format
  // return {
  //     alerts: {
  //         alert: getRandomAlerts(2), // Trả về 2 alerts ngẫu nhiên
  //     },
  // };

  // TODO: Uncomment để sử dụng API thực
  const url = `${BASE_URL}/forecast.json?key=${API_KEY}&q=${lat},${lon}&days=1&aqi=no&alerts=yes&lang=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể lấy dữ liệu cảnh báo thời tiết');
  const data = await res.json();
  return data;
}

/**
 * Extract weather alerts từ forecast response
 * WeatherAPI free plan có giới hạn alerts
 * Khớp với cấu trúc API: https://www.weatherapi.com/docs/#apis-alerts
 */
export function extractAlerts(forecastData) {
  if (!forecastData?.alerts?.alert || forecastData.alerts.alert.length === 0)
    return [];

  return forecastData.alerts.alert.map((alert) => ({
    headline: alert.headline,
    msgtype: alert.msgtype || alert.msgType, // API có thể trả về msgtype hoặc msgType
    severity: alert.severity,
    urgency: alert.urgency,
    areas: alert.areas,
    category: alert.category,
    certainty: alert.certainty,
    event: alert.event,
    note: alert.note,
    effective: alert.effective,
    expires: alert.expires,
    desc: alert.desc,
    instruction: alert.instruction,
  }));
}
