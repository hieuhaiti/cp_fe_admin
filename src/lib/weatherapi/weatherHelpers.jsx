import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Cloud,
    CloudRain,
    CloudDrizzle,
    CloudSnow,
    CloudLightning,
    Sun,
    Moon,
    CloudFog,
    CloudSun,
    CloudMoon,
    Snowflake,
    Wind,
    AlertTriangle,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import icFaceGreen from '@/assets/icons/aqi-icon/ic-face-green.svg';
import icFaceOrange from '@/assets/icons/aqi-icon/ic-face-orange.svg';
import icFacePurple from '@/assets/icons/aqi-icon/ic-face-purple.svg';
import icFaceRed from '@/assets/icons/aqi-icon/ic-face-red.svg';
import icFaceYellow from '@/assets/icons/aqi-icon/ic-face-yellow.svg';

/**
 * Map WeatherAPI condition codes to icons
 * Based on weather_conditions.xml
 */
const WEATHER_ICON_MAP = {
    // Clear
    1000: {
        day: Sun,
        night: Moon,
        color: 'text-yellow-400',
        nightColor: 'text-blue-300',
    },

    // Partly cloudy
    1003: {
        day: CloudSun,
        night: CloudMoon,
        color: 'text-yellow-400',
        nightColor: 'text-blue-300',
    },

    // Cloudy
    1006: { day: Cloud, night: Cloud, color: 'text-slate-400' },

    // Overcast
    1009: { day: Cloud, night: Cloud, color: 'text-slate-500' },

    // Mist
    1030: { day: CloudFog, night: CloudFog, color: 'text-gray-400' },

    // Patchy rain possible
    1063: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-400' },

    // Patchy snow possible
    1066: { day: CloudSnow, night: CloudSnow, color: 'text-sky-300' },

    // Patchy sleet possible
    1069: { day: CloudSnow, night: CloudSnow, color: 'text-slate-400' },

    // Patchy freezing drizzle possible
    1072: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-300' },

    // Thundery outbreaks possible
    1087: {
        day: CloudLightning,
        night: CloudLightning,
        color: 'text-yellow-500',
    },

    // Blowing snow
    1114: { day: Wind, night: Wind, color: 'text-sky-400' },

    // Blizzard
    1117: { day: Snowflake, night: Snowflake, color: 'text-sky-200' },

    // Fog
    1135: { day: CloudFog, night: CloudFog, color: 'text-gray-400' },

    // Freezing fog
    1147: { day: CloudFog, night: CloudFog, color: 'text-gray-500' },

    // Light drizzle
    1150: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-400' },
    1153: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-400' },

    // Freezing drizzle
    1168: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-300' },
    1171: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-500' },

    // Light rain
    1180: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-500' },
    1183: { day: CloudDrizzle, night: CloudDrizzle, color: 'text-blue-500' },

    // Moderate rain
    1186: { day: CloudRain, night: CloudRain, color: 'text-blue-500' },
    1189: { day: CloudRain, night: CloudRain, color: 'text-blue-600' },

    // Heavy rain
    1192: { day: CloudRain, night: CloudRain, color: 'text-blue-600' },
    1195: { day: CloudRain, night: CloudRain, color: 'text-blue-700' },

    // Freezing rain
    1198: { day: CloudRain, night: CloudRain, color: 'text-blue-400' },
    1201: { day: CloudRain, night: CloudRain, color: 'text-blue-600' },

    // Sleet
    1204: { day: CloudSnow, night: CloudSnow, color: 'text-slate-400' },
    1207: { day: CloudSnow, night: CloudSnow, color: 'text-slate-500' },

    // Snow
    1210: { day: CloudSnow, night: CloudSnow, color: 'text-sky-300' },
    1213: { day: CloudSnow, night: CloudSnow, color: 'text-sky-300' },
    1216: { day: CloudSnow, night: CloudSnow, color: 'text-sky-400' },
    1219: { day: CloudSnow, night: CloudSnow, color: 'text-sky-400' },
    1222: { day: CloudSnow, night: CloudSnow, color: 'text-sky-500' },
    1225: { day: CloudSnow, night: CloudSnow, color: 'text-sky-500' },

    // Ice pellets
    1237: { day: Snowflake, night: Snowflake, color: 'text-slate-400' },

    // Rain shower
    1240: { day: CloudRain, night: CloudRain, color: 'text-blue-500' },
    1243: { day: CloudRain, night: CloudRain, color: 'text-blue-600' },
    1246: { day: CloudRain, night: CloudRain, color: 'text-blue-700' },

    // Sleet showers
    1249: { day: CloudSnow, night: CloudSnow, color: 'text-slate-400' },
    1252: { day: CloudSnow, night: CloudSnow, color: 'text-slate-500' },

    // Snow showers
    1255: { day: CloudSnow, night: CloudSnow, color: 'text-sky-400' },
    1258: { day: CloudSnow, night: CloudSnow, color: 'text-sky-500' },

    // Ice pellet showers
    1261: { day: Snowflake, night: Snowflake, color: 'text-slate-400' },
    1264: { day: Snowflake, night: Snowflake, color: 'text-slate-500' },

    // Thunderstorm
    1273: {
        day: CloudLightning,
        night: CloudLightning,
        color: 'text-yellow-500',
    },
    1276: {
        day: CloudLightning,
        night: CloudLightning,
        color: 'text-yellow-600',
    },
    1279: {
        day: CloudLightning,
        night: CloudLightning,
        color: 'text-yellow-500',
    },
    1282: {
        day: CloudLightning,
        night: CloudLightning,
        color: 'text-yellow-600',
    },
};

/**
 * Lấy icon weather theo code và thời gian (ngày/đêm)
 * Note: Không gọi hook trong function này để tránh vi phạm Rules of Hooks
 */
export function getWeatherIcon(
    code,
    isDay = true,
    conditionText = '',
    className = ''
) {
    const iconData = WEATHER_ICON_MAP[code] || WEATHER_ICON_MAP[1000];
    const IconComponent = isDay ? iconData.day : iconData.night;
    const iconColor = isDay
        ? iconData.color || 'text-yellow-400'
        : iconData.nightColor || iconData.color || 'text-blue-300';

    const mergedClass = `${iconColor} ${className}`.trim();
    const icon = <IconComponent className={mergedClass} />;

    return (
        <Tooltip>
            <TooltipTrigger asChild>{icon}</TooltipTrigger>
            <TooltipContent side="top">
                {conditionText || 'Unknown'}
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * AQI levels theo US EPA Index (1-6)
 * WeatherAPI free plan có us-epa-index
 */
export const AQI_LEVELS = {
    1: {
        labelKey: 'aqi.level_1',
        label_en: 'Good',
        color: 'text-green-600',
        bg: 'bg-green-100',
        icon: icFaceGreen,
    },
    2: {
        labelKey: 'aqi.level_2',
        label_en: 'Moderate',
        color: 'text-yellow-600',
        bg: 'bg-yellow-100',
        icon: icFaceYellow,
    },
    3: {
        labelKey: 'aqi.level_3',
        label_en: 'Unhealthy for Sensitive Groups',
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        icon: icFaceOrange,
    },
    4: {
        labelKey: 'aqi.level_4',
        label_en: 'Unhealthy',
        color: 'text-red-600',
        bg: 'bg-red-100',
        icon: icFaceRed,
    },
    5: {
        labelKey: 'aqi.level_5',
        label_en: 'Very Unhealthy',
        color: 'text-purple-600',
        bg: 'bg-purple-100',
        icon: icFacePurple,
    },
    6: {
        labelKey: 'aqi.level_6',
        label_en: 'Hazardous',
        color: 'text-purple-800',
        bg: 'bg-purple-200',
        icon: icFacePurple,
    },
};

/**
 * Hook lấy thông tin AQI level
 */
export function useAQILevel(aqiIndex) {
    const { t } = useTranslation();
    const level = AQI_LEVELS[aqiIndex] || AQI_LEVELS[3];
    return {
        ...level,
        label: t(level.labelKey),
        desc: t(`aqi.desc_${aqiIndex}`),
    };
}

/**
 * Severity levels cho weather alerts
 */
export const ALERT_SEVERITY = {
    Extreme: { color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle },
    Severe: {
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        icon: AlertTriangle,
    },
    Moderate: {
        color: 'text-yellow-600',
        bg: 'bg-yellow-100',
        icon: AlertTriangle,
    },
    Minor: { color: 'text-blue-600', bg: 'bg-blue-100', icon: AlertTriangle },
};

/**
 * Các hàm format dữ liệu
 */
export function formatTemperature(temp, unit = '°C') {
    return `${Math.round(temp)}${unit}`;
}

export function formatWindSpeed(speed, unit = 'm/s') {
    return `${Math.round(speed)} ${unit}`;
}

export function formatWindSpeedKph(speed) {
    return `${Math.round(speed)} km/h`;
}

export function formatHumidity(humidity) {
    return `${Math.round(humidity)}%`;
}

export function formatPressure(pressure, unit = 'mb') {
    return `${Math.round(pressure)} ${unit}`;
}

export function formatVisibility(visibility, unit = 'km') {
    return `${visibility} ${unit}`;
}

export function formatUV(uv) {
    if (uv <= 2) return { level: 'Thấp', color: 'text-green-600' };
    if (uv <= 5) return { level: 'Trung bình', color: 'text-yellow-600' };
    if (uv <= 7) return { level: 'Cao', color: 'text-orange-600' };
    if (uv <= 10) return { level: 'Rất cao', color: 'text-red-600' };
    return { level: 'Cực cao', color: 'text-purple-600' };
}

/**
 * Format ngày tháng
 */
export function formatDate(dateString, locale = 'vi-VN') {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

export function formatTime(dateString, locale = 'vi-VN') {
    const date = new Date(dateString);
    return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Get wind direction name
 */
export function getWindDirection(degree) {
    const directions = [
        'Bắc',
        'Đông Bắc',
        'Đông',
        'Đông Nam',
        'Nam',
        'Tây Nam',
        'Tây',
        'Tây Bắc',
    ];
    const index =
        Math.round(((degree %= 360) < 0 ? degree + 360 : degree) / 45) % 8;
    return directions[index];
}
