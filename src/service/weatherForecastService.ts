import apiClient from './common/apiClient'
import { serviceAdminFloodWeatherForecastPath } from '@/constant/serviceConstant'
import type { ApiResponse } from '@/types/api'

export interface HourlyRainForecast {
  time: string
  timeEpoch: number
  hour: string
  tempC: number
  feelsLikeC: number
  humidity: number
  precipMm: number
  chanceOfRain: number
  condition: {
    text: string
    icon: string
    code: number
  }
  windKph: number
  windDir: string
  uv: number
}

export interface DayForecastSummary {
  maxTempC: number | null
  minTempC: number | null
  avgTempC: number | null
  totalPrecipMm: number
  dailyChanceOfRain: number
  condition: {
    text: string
    icon: string
    code: number
  }
}

export interface RainForecast24h {
  location: {
    name: string
    region: string
    country: string
    lat: number
    lon: number
    localtime: string | null
  }
  forecastDate: string
  daySummary: DayForecastSummary
  hours: HourlyRainForecast[]
  source: string
  fetchedAt: string
  metadata?: Record<string, any>
}

export default {
  /** GET /api/v1/admin/flood/weather/forecast — Lấy dữ liệu dự báo 24h từ cache server */
  getForecast: (): Promise<ApiResponse<RainForecast24h>> =>
    apiClient.get<RainForecast24h>(serviceAdminFloodWeatherForecastPath),

  /** POST /api/v1/admin/flood/weather/forecast/refresh — Gọi WeatherAPI làm mới dữ liệu dự báo 24h */
  refreshForecast: (): Promise<ApiResponse<RainForecast24h>> =>
    apiClient.post<RainForecast24h>(`${serviceAdminFloodWeatherForecastPath}/refresh`),
}
