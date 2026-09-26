import type { RcpOptionId, ScenarioTypeId } from './constants'

export type { ScenarioTypeId, RcpOptionId }

export interface ScenarioDraftItem {
  id: string | number
  code: string
  nameVi: string
  type: ScenarioTypeId
  frequency?: string
  rcp?: RcpOptionId
  minRainfall: number | null
  maxRainfall: number | null
  minTide: number | null
  maxTide: number | null
  layerCode: string
  layerName?: string
  description?: string | null
  isActive: boolean
  isDraft?: boolean
  createdAt?: string
  rain1h?: number
  rain3h?: number
  rain6h?: number
  rain12h?: number
  rain24h?: number
}

export interface ScenarioGroupRow {
  groupKey: string
  title: string
  frequency?: string
  rainfallDisplay: string
  tideDisplay: string
  hienTrang: ScenarioDraftItem | null
  caiTao: ScenarioDraftItem | null
  quyHoachRcp45: ScenarioDraftItem | null
  quyHoachRcp85: ScenarioDraftItem | null
}

export interface TypeSimulationMatch {
  type: ScenarioTypeId
  typeLabel: string
  rcp?: RcpOptionId
  rcpLabel?: string
  status: 'matched' | 'unconfigured' | 'no_rain' | 'no_flood'
  scenario: ScenarioDraftItem | null
  layerCode?: string
  layerName?: string
  differenceNote?: string
}

export interface ThreeTypeSimulationOutcome {
  inputRainfall: number
  inputTide: number | null
  selectedDuration: string
  hienTrang: TypeSimulationMatch
  caiTao: TypeSimulationMatch
  quyHoachRcp45: TypeSimulationMatch
  quyHoachRcp85: TypeSimulationMatch
}

export interface ScenarioGroupFormData {
  groupName: string
  frequency: string
  tideLevel: string
  minRainfall: string
  maxRainfall: string
  rain1h: string
  rain3h: string
  rain6h: string
  rain12h: string
  rain24h: string
  // Sub-forms for 3 types
  hienTrang: {
    code: string
    nameVi: string
    layerCode: string
    isActive: boolean
    description: string
  }
  caiTao: {
    code: string
    nameVi: string
    layerCode: string
    isActive: boolean
    description: string
  }
  quyHoachRcp45: {
    code: string
    nameVi: string
    layerCode: string
    isActive: boolean
    description: string
  }
  quyHoachRcp85: {
    code: string
    nameVi: string
    layerCode: string
    isActive: boolean
    description: string
  }
}

export type ScenarioSourceType = 'all' | 'db_only' | 'draft_matrix'
