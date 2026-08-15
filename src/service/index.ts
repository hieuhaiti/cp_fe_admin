export { default as apiClient } from './common/apiClient'
export * from './common/useApi'

// Auth + core
export { default as authService } from './authService'
export { default as storageService } from './storageService'
export { default as userService } from './userService'
export { default as notificationService } from './notificationService'

// Content
export { default as newsService } from './newsService'
export { default as newsCommentService } from './newsCommentService'
export { default as citizenFeedbackService } from './citizenFeedbackService'
// Alias matching Postman naming
export { default as feedbackService } from './citizenFeedbackService'

// Map + GIS
export { default as mapImageService } from './mapImageService'
// Alias matching Postman naming
export { default as pdfMapService } from './mapImageService'
export { default as mapLayerService } from './mapLayerService'
export { default as mapLayerApiService } from './mapLayerApiService'
// Alias matching Postman naming
export { default as mapApiService } from './mapLayerApiService'

// GEE / satellite / weather / flood
// Weather and field-measurement modules remain available for legacy compatibility,
// but they are no longer exposed in the admin navigation or routes.
export { default as weatherService } from './weatherService'
export { default as remoteSensingService } from './remoteSensingService'
export { default as floodService } from './floodService'
export { default as satelliteService } from './satelliteService'
export { default as forestClassificationService } from './forestClassificationService'
export { default as fieldMeasurementService } from './fieldMeasurementService'
export { default as kttvScenarioService } from './kttvScenarioService'

// Statistics
export { default as statisticsService } from './statisticsService'
export { default as statsService } from './statisticsService'

// Legacy / kept as-is (not in Postman)
