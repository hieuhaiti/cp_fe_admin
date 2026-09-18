import { describe, expect, it } from 'vitest'
import {
  formatRainfallRange,
  inferScenarioType,
  scenarioFromDb,
  simulateThreeTypesFromList,
} from './helpers'
import type { FloodScenario } from '@/service/kttvScenarioService'
import type { ScenarioDraftItem } from './types'

describe('KTTV Scenario Helpers', () => {
  it('converts FloodScenario from DB/API to ScenarioDraftItem', () => {
    const raw: FloodScenario = {
      id: 1,
      code: 'scenario_ht_2020',
      name_vi: 'Kịch bản hiện trạng ngập 2020',
      type: 'hien_trang',
      rcp: null,
      min_rainfall: '50',
      max_rainfall: '100',
      min_tide: '0.8',
      max_tide: '1.2',
      layer_code: 'cp_sau_ngap_2020',
      description: 'Mô tả',
      is_active: true,
      layer: {
        id: '1',
        code: 'cp_sau_ngap_2020',
        nameVi: 'Lớp sau ngập 2020',
        category: 'flood',
        categoryName: 'Ngập lụt',
        geometryType: 'RASTER',
        storageKind: 'geotiff_minio',
        geoserverLayer: 'campha:cp_sau_ngap_2020',
      },
    }

    const converted = scenarioFromDb(raw)
    expect(converted.id).toBe(1)
    expect(converted.code).toBe('scenario_ht_2020')
    expect(converted.type).toBe('hien_trang')
    expect(converted.minRainfall).toBe(50)
    expect(converted.maxRainfall).toBe(100)
    expect(converted.layerName).toBe('Lớp sau ngập 2020')
  })

  it('infers scenario type from explicit fields or falls back to text', () => {
    // Explicit properties take precedence
    expect(
      inferScenarioType({
        type: 'quy_hoach',
        rcp: 'rcp85',
        name_vi: 'Kịch bản cải tạo...',
      })
    ).toEqual({
      type: 'quy_hoach',
      rcp: 'rcp85',
    })

    expect(inferScenarioType({ name_vi: 'Kịch bản ngập hiện trạng 2026' })).toEqual({
      type: 'hien_trang',
    })
    expect(inferScenarioType({ name_vi: 'Kịch bản cải tạo thoát nước khu vực' })).toEqual({
      type: 'cai_tao',
    })
    expect(inferScenarioType({ name_vi: 'Kịch bản quy hoạch 2050 theo kịch bản RCP 8.5' })).toEqual({
      type: 'quy_hoach',
      rcp: 'rcp85',
    })
    expect(inferScenarioType({ name_vi: 'Kịch bản quy hoạch 2050 RCP 4.5' })).toEqual({
      type: 'quy_hoach',
      rcp: 'rcp45',
    })
    expect(inferScenarioType({ name_vi: 'Kịch bản ngập chung chung' })).toEqual({
      type: null,
    })
  })

  it('simulates 3 types matching from real scenario list', () => {
    const sampleItems: ScenarioDraftItem[] = [
      {
        id: 1,
        code: 'HT_01',
        nameVi: 'Hiện trạng mức 100mm',
        type: 'hien_trang',
        minRainfall: 50,
        maxRainfall: 150,
        minTide: null,
        maxTide: null,
        layerCode: 'ly_ht_01',
        isActive: true,
      },
      {
        id: 2,
        code: 'CT_01',
        nameVi: 'Cải tạo mức 100mm',
        type: 'cai_tao',
        minRainfall: 50,
        maxRainfall: 150,
        minTide: null,
        maxTide: null,
        layerCode: 'ly_ct_01',
        isActive: true,
      },
      {
        id: 3,
        code: 'QH_RCP45_01',
        nameVi: 'Quy hoạch RCP 4.5',
        type: 'quy_hoach',
        rcp: 'rcp45',
        minRainfall: 50,
        maxRainfall: 150,
        minTide: null,
        maxTide: null,
        layerCode: 'ly_qh45_01',
        isActive: true,
      },
    ]

    const result = simulateThreeTypesFromList(sampleItems, 100, 0.837, '1h')
    expect(result.inputRainfall).toBe(100)
    expect(result.hienTrang.status).toBe('matched')
    expect(result.hienTrang.scenario?.code).toBe('HT_01')

    expect(result.caiTao.status).toBe('matched')
    expect(result.caiTao.scenario?.code).toBe('CT_01')

    expect(result.quyHoachRcp45.status).toBe('matched')
    expect(result.quyHoachRcp45.scenario?.code).toBe('QH_RCP45_01')

    expect(result.quyHoachRcp85.status).toBe('unconfigured')
  })

  it('formats rainfall ranges properly', () => {
    expect(formatRainfallRange(50, 100)).toBe('50 – 100 mm')
    expect(formatRainfallRange(150, null)).toBe('≥ 150 mm')
    expect(formatRainfallRange(null, 50)).toBe('≤ 50 mm')
    expect(formatRainfallRange(null, null)).toBe('Không giới hạn')
  })
})
