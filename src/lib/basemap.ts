/**
 * Basemap style helpers for admin MapLibre GL components.
 *
 * Admin uses `maplibre-gl` (not `mapbox-gl` like client), so we can't feed
 * a `mapbox://styles/...` URI directly into `style:`. Instead we translate
 * the Mapbox style URI into a Mapbox **raster tiles** endpoint that any
 * tile-based renderer (MapLibre, Leaflet, OpenLayers) can consume.
 *
 * Style env is expected as `mapbox://styles/{username}/{styleId}` — matching
 * the values in client `.env` and `VITE_MAPBOX_STYLE_Street` in admin `.env`.
 * If the env is missing or malformed, we fall back to OSM raster tiles so
 * the map still boots (rather than throwing during style parse).
 */

import type { StyleSpecification } from 'maplibre-gl'

const MAPBOX_STYLE_RE = /^mapbox:\/\/styles\/([^/]+)\/([^/?]+)/i
const MAPBOX_TILES_URL = (username: string, styleId: string, token: string) =>
  `https://api.mapbox.com/styles/v1/${username}/${styleId}/tiles/512/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(token)}`

const OSM_FALLBACK_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const BASEMAP_SOURCE_ID = 'basemap'
const BASEMAP_LAYER_ID = 'basemap-layer'

export interface BasemapStyle {
  source: 'mapbox' | 'osm-fallback'
  spec: StyleSpecification
  sourceId: string
  layerId: string
}

/**
 * Parse a `mapbox://styles/{username}/{styleId}` URI (or a bare
 * `username/styleId` value) into its components. Returns null when the value
 * doesn't match either shape.
 */
export function parseMapboxStyleUri(value: string | undefined | null): {
  username: string
  styleId: string
} | null {
  if (!value) return null
  const raw = String(value).trim()
  const uriMatch = raw.match(MAPBOX_STYLE_RE)
  if (uriMatch) {
    return { username: uriMatch[1], styleId: uriMatch[2] }
  }
  // Fallback: accept bare `username/styleId` for ops flexibility.
  const bare = raw.split('/').filter(Boolean)
  if (bare.length === 2) {
    return { username: bare[0], styleId: bare[1] }
  }
  return null
}

/**
 * Build a MapLibre style spec whose only source is a raster basemap.
 *
 * Priority:
 *   1. `VITE_MAPBOX_STYLE_Street` + `VITE_MAPBOX_TOKEN` present → Mapbox tiles.
 *   2. Either missing → OSM tiles. Callers can inspect `source` to warn.
 *
 * Callers use `sourceId` / `layerId` when adding overlay layers on top, so
 * they can insert *below* other layers or replace this basemap later.
 */
export function buildBasemapStyle(): BasemapStyle {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const styleUri = import.meta.env.VITE_MAPBOX_STYLE_Street as string | undefined
  const parsed = parseMapboxStyleUri(styleUri)

  if (parsed && token) {
    return {
      source: 'mapbox',
      sourceId: BASEMAP_SOURCE_ID,
      layerId: BASEMAP_LAYER_ID,
      spec: {
        version: 8,
        sources: {
          [BASEMAP_SOURCE_ID]: {
            type: 'raster',
            tiles: [MAPBOX_TILES_URL(parsed.username, parsed.styleId, token)],
            tileSize: 512,
            attribution:
              '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> © <a href="https://www.openstreetmap.org/about/" target="_blank" rel="noopener">OpenStreetMap</a>',
          },
        },
        layers: [{ id: BASEMAP_LAYER_ID, type: 'raster', source: BASEMAP_SOURCE_ID }],
      },
    }
  }

  return {
    source: 'osm-fallback',
    sourceId: BASEMAP_SOURCE_ID,
    layerId: BASEMAP_LAYER_ID,
    spec: {
      version: 8,
      sources: {
        [BASEMAP_SOURCE_ID]: {
          type: 'raster',
          tiles: [OSM_FALLBACK_TILES],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: BASEMAP_LAYER_ID, type: 'raster', source: BASEMAP_SOURCE_ID }],
    },
  }
}
