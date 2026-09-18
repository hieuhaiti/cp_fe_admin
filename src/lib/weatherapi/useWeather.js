import { useQuery } from '@tanstack/react-query';
import {
    fetchWeather,
    fetchForecast,
    fetchAlerts,
    extractAQI,
    extractAlerts,
} from './helpper.js';
import { defaultLatLong } from '@/utils/constants.jsx';

/**
 * Hook để lấy thông tin thời tiết hiện tại + AQI
 * WeatherAPI trả về cả current weather và AQI trong 1 call
 */
export function useWeather(
    lat = defaultLatLong.lat,
    lon = defaultLatLong.lng,
    lang = 'vi'
) {
    return useQuery({
        queryKey: ['weatherapi', 'current', lat, lon, lang],
        queryFn: () => fetchWeather(lat, lon, lang),
        staleTime: 5 * 60 * 1000, // 5 phút
        refetchInterval: 10 * 60 * 1000, // Auto refetch mỗi 10 phút
        retry: 3,
        select: data => ({
            location: data.location,
            current: data.current,
            aqi: extractAQI(data),
        }),
    });
}

/**
 * Hook để lấy dự báo 3 ngày (giới hạn free plan)
 */
export function useForecast(
    lat = defaultLatLong.lat,
    lon = defaultLatLong.lng,
    days = 3,
    lang = 'vi'
) {
    return useQuery({
        queryKey: ['weatherapi', 'forecast', lat, lon, days, lang],
        queryFn: () => fetchForecast(lat, lon, days, lang),
        staleTime: 30 * 60 * 1000, // 30 phút
        refetchInterval: 2 * 60 * 60 * 1000, // Auto refetch mỗi 2 giờ
        retry: 3,
    });
}

/**
 * Hook để lấy weather alerts
 * Sử dụng mock data vì free plan có giới hạn
 */
export function useWeatherAlerts(
    lat = defaultLatLong.lat,
    lon = defaultLatLong.lng,
    lang = 'vi'
) {
    return useQuery({
        queryKey: ['weatherapi', 'alerts', lat, lon, lang],
        queryFn: async () => {
            const data = await fetchAlerts(lat, lon, lang);
            return extractAlerts(data);
        },
        staleTime: 15 * 60 * 1000, // 15 phút
        refetchInterval: 30 * 60 * 1000, // Auto refetch mỗi 30 phút
        retry: 2,
    });
}

/**
 * Hook để lấy cả weather + forecast cùng lúc
 * Weather đã bao gồm AQI nên không cần call riêng
 */
export function useWeatherAndForecast(
    lat = defaultLatLong.lat,
    lon = defaultLatLong.lng,
    lang = 'vi'
) {
    const weather = useWeather(lat, lon, lang);
    const forecast = useForecast(lat, lon, 3, lang);

    return {
        weather,
        forecast,
        isLoading: weather.isLoading || forecast.isLoading,
        isError: weather.isError || forecast.isError,
        error: weather.error || forecast.error,
    };
}

/**
 * Hook để lấy tất cả: weather + forecast + alerts
 */
export function useWeatherComplete(
    lat = defaultLatLong.lat,
    lon = defaultLatLong.lng,
    lang = 'vi'
) {
    const weather = useWeather(lat, lon, lang);
    const forecast = useForecast(lat, lon, 3, lang);
    const alerts = useWeatherAlerts(lat, lon, lang);

    return {
        weather,
        forecast,
        alerts,
        isLoading: weather.isLoading || forecast.isLoading || alerts.isLoading,
        isError: weather.isError || forecast.isError || alerts.isError,
        error: weather.error || forecast.error || alerts.error,
    };
}
