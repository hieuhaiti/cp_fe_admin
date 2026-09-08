export type AdminPageMountStatus = 'mounted' | 'unmounted' | 'empty'
export type AdminFormMode = 'create' | 'edit' | 'action' | 'read-only' | 'none'

export interface AdminOperationContract {
  id: string
  mode: AdminFormMode
  service: string | null
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null
  path: string | null
  serverRoute: string | null
  validator: string | null
  permission?: `${string}:${string}`
  unresolved?: string
}

export interface AdminPageContract {
  page: string
  routes: readonly string[]
  mountStatus: AdminPageMountStatus
  sourceFiles: readonly string[]
  testFiles: readonly string[]
  formModes: readonly AdminFormMode[]
  routePermission?: `${string}:${string}`
  operations: readonly AdminOperationContract[]
}

const op = (
  id: string,
  mode: AdminFormMode,
  service: string | null,
  method: AdminOperationContract['method'],
  path: string | null,
  serverRoute: string | null,
  validator: string | null,
  permission?: `${string}:${string}`,
  unresolved?: string
): AdminOperationContract => ({ id, mode, service, method, path, serverRoute, validator, permission, unresolved })

export const adminPageContracts: readonly AdminPageContract[] = [
  { page: 'Login', routes: ['/login'], mountStatus: 'mounted', sourceFiles: ['Login.tsx'], testFiles: ['Login.test.tsx'], formModes: ['action'], operations: [op('login', 'action', 'authService.login', 'POST', '/auth/login', 'auth.routes.js', 'loginSchema')] },
  { page: 'Landing', routes: ['/'], mountStatus: 'mounted', sourceFiles: ['Landing/index.tsx'], testFiles: ['Landing/index.test.tsx'], formModes: ['read-only'], operations: [] },
  { page: 'Dashboard', routes: ['/dashboard'], mountStatus: 'mounted', sourceFiles: ['Dashboard/index.tsx'], testFiles: ['Dashboard/index.test.tsx'], formModes: ['read-only'], operations: [op('dashboard-overview', 'read-only', 'adminDashboardService.getOverview', 'GET', '/admin/dashboard/overview', 'admin-dashboard.routes.js', null)] },
  { page: 'User', routes: ['/users'], mountStatus: 'mounted', sourceFiles: ['User/index.tsx', 'User/UserDetailDialog.tsx', 'User/UserFormDialog.tsx'], testFiles: ['User/UserFormDialog.test.tsx', 'User/index.test.tsx'], formModes: ['create', 'edit'], routePermission: 'users:read', operations: [
    op('user-create', 'create', 'userService.create', 'POST', '/admin/users', 'user.routes.js', 'createUserSchema', 'users:create'),
    op('user-role', 'edit', 'userService.updateRole', 'PATCH', '/admin/users/:id/role', 'user.routes.js', 'updateRoleSchema', 'users:change_role'),
    op('user-active', 'edit', 'userService.setActive', 'PATCH', '/admin/users/:id/active', 'user.routes.js', 'setActiveSchema', 'users:change_status'),
    op('user-reset-password', 'edit', 'userService.resetPassword', 'POST', '/admin/users/:id/reset-password', 'user.routes.js', 'resetPasswordAdminSchema', 'users:reset_password'),
    op('user-delete', 'action', 'userService.delete', 'DELETE', '/admin/users/:id', 'user.routes.js', 'userIdParamsSchema', 'users:delete'),
  ] },
  { page: 'News', routes: ['/news'], mountStatus: 'mounted', sourceFiles: ['News/index.tsx', 'News/NewsDetailDialog.tsx', 'News/NewsFormDialog.tsx'], testFiles: ['News/NewsFormDialog.test.tsx', 'News/index.test.tsx'], formModes: ['create', 'edit'], routePermission: 'news:read', operations: [
    op('news-create', 'create', 'newsService.create', 'POST', '/admin/cms/news', 'cms.routes.js', 'newsCreateSchema'),
    op('news-update', 'edit', 'newsService.update', 'PATCH', '/admin/cms/news/:id', 'cms.routes.js', 'newsUpdateSchema'),
    op('news-delete', 'action', 'newsService.delete', 'DELETE', '/admin/cms/news/:id', 'cms.routes.js', 'deleteQuerySchema'),
  ] },
  { page: 'NewsComments', routes: ['/news-comments'], mountStatus: 'mounted', sourceFiles: ['NewsComments/index.tsx', 'NewsComments/NewsCommentDetailDialog.tsx'], testFiles: ['NewsComments/index.test.tsx'], formModes: ['edit'], routePermission: 'news:update', operations: [op('comment-moderate', 'edit', 'newsCommentService.moderate', 'PATCH', '/admin/cms/news/comments/:commentId', 'cms.routes.js', 'commentModerateSchema', 'news:update')] },
  { page: 'MapLayers', routes: ['/map-layers', '/map-layers/import-geojson'], mountStatus: 'mounted', sourceFiles: ['MapLayers/index.tsx', 'MapLayers/MapLayerDetailDialog.tsx', 'MapLayers/MapLayerFormDialog.tsx', 'MapLayers/GeoTiffUploadDialog.tsx', 'MapLayers/ImportGeoJson.tsx'], testFiles: ['MapLayers/MapLayerFormDialog.test.tsx', 'MapLayers/GeoTiffUploadDialog.test.tsx', 'MapLayers/ImportGeoJson.test.tsx', 'MapLayers/index.test.tsx'], formModes: ['create', 'edit', 'action'], routePermission: 'layers:read', operations: [
    op('layer-create', 'create', 'mapLayerService.create', 'POST', '/admin/layers', null, null, 'layers:create', 'No matching JSON create route; import routes are canonical.'),
    op('layer-update', 'edit', 'mapLayerService.update', 'PATCH', '/admin/layers/:layerId', 'layer.routes.js', 'layerUpdateSchema', 'layers:update'),
    op('layer-delete', 'action', 'mapLayerService.delete', 'DELETE', '/admin/layers/:layerId', 'layer.routes.js', 'deleteLayerSchema', 'layers:delete'),
    op('geotiff-create', 'create', 'remoteSensingService.create', 'POST', '/admin/remote-sensing/images', 'remote-sensing.routes.js', 'createSchema'),
    op('geotiff-publish', 'action', 'remoteSensingService.publish', 'POST', '/admin/remote-sensing/images/:id/publish', 'remote-sensing.routes.js', 'publishSchema'),
    op('geojson-import', 'create', 'mapLayerService.importGeoJson', 'POST', '/admin/layers/import-geojson', null, null, 'layers:create', 'Compatibility stub; Server endpoint unresolved.'),
  ] },
  { page: 'TimeSeries', routes: ['/map-layers/time-series'], mountStatus: 'mounted', sourceFiles: ['TimeSeries/index.tsx', 'TimeSeries/TimeSeriesDetailDialog.tsx', 'TimeSeries/TimeSeriesCreateDialog.tsx', 'TimeSeries/TimeSeriesEditDialog.tsx', 'TimeSeries/TimeSeriesDeleteDialog.tsx'], testFiles: ['TimeSeries/TimeSeriesPage.test.tsx'], formModes: ['create', 'edit', 'action', 'read-only'], routePermission: 'raster:read', operations: [
    op('time-series-list', 'read-only', 'mapLayerService.getTimeSeriesCatalog', 'GET', '/web-map/time-series-layers', 'web-map.routes.js', null, 'raster:read'),
    op('time-series-detail', 'read-only', 'mapLayerService.getTimeSeriesCatalog', 'GET', '/web-map/time-series-layers', 'web-map.routes.js', null, 'raster:read'),
    op('time-series-create-image', 'create', 'remoteSensingService.createImage', 'POST', '/admin/remote-sensing/images', 'remote-sensing.routes.js', 'createSchema', 'raster:create'),
    op('time-series-publish', 'action', 'remoteSensingService.publishCollection', 'POST', '/admin/remote-sensing/collections/:coverageKey/publish', 'remote-sensing.routes.js', 'publishSchema', 'raster:create'),
    op('time-series-update-layer', 'edit', 'mapLayerService.update', 'PATCH', '/admin/layers/:layerId', 'layer.routes.js', 'layerUpdateSchema', 'layers:update'),
    op('time-series-delete-layer', 'action', 'mapLayerService.delete', 'DELETE', '/admin/layers/:layerId', 'layer.routes.js', 'deleteLayerSchema', 'layers:delete'),
  ] },
  { page: 'MapLayerApis', routes: ['/map-apis/*', '/map-layer-apis/*', '/public/map-apis', '/public/map-layer-apis'], mountStatus: 'mounted', sourceFiles: ['MapLayerApis/index.tsx', 'MapLayerApis/MapLayerApiDetailDialog.tsx', 'MapLayerApis/MapLayerApiFormDialog.tsx', 'MapLayerApis/MapLayerApiListPage.tsx', 'MapLayerApis/MapLayerApiPublicPage.tsx'], testFiles: ['MapLayerApis/MapLayerApiFormDialog.test.tsx', 'MapLayerApis/MapLayerApiListPage.test.tsx', 'MapLayerApis/MapLayerApiPublicPage.test.tsx'], formModes: ['create', 'edit', 'read-only'], routePermission: 'api_registry:read', operations: [
    op('map-api-create', 'create', 'mapLayerApiService.create', 'POST', '/admin/api-registry', 'api-registry.routes.js', 'registryBody', 'api_registry:create'),
    op('map-api-update', 'edit', 'mapLayerApiService.update', 'PUT', '/admin/api-registry/:registryId', 'api-registry.routes.js', 'registryUpdate', 'api_registry:create'),
    op('map-api-delete', 'action', 'mapLayerApiService.delete', 'DELETE', '/admin/api-registry/:registryId', 'api-registry.routes.js', 'deleteQuery', 'api_registry:create'),
    op('map-api-key-issue', 'action', 'mapLayerApiService.regenerate', 'POST', '/admin/api-registry/:registryId/keys', 'api-registry.routes.js', 'keyBody', 'api_registry:share'),
  ] },
  { page: 'MapImage', routes: ['/map-images'], mountStatus: 'mounted', sourceFiles: ['MapImage/index.tsx', 'MapImage/MapImageDetailDialog.tsx', 'MapImage/MapImageFormDialog.tsx'], testFiles: ['MapImage/MapImageFormDialog.test.tsx', 'MapImage/index.test.tsx'], formModes: ['create', 'edit'], routePermission: 'pdf_maps:read', operations: [op('pdf-map-create', 'create', 'mapImageService.create', 'POST', '/admin/cms/pdf-maps', 'cms.routes.js', 'pdfMapCreateSchema'), op('pdf-map-update', 'edit', 'mapImageService.update', 'PATCH', '/admin/cms/pdf-maps/:id', 'cms.routes.js', 'pdfMapUpdateSchema'), op('pdf-map-delete', 'action', 'mapImageService.delete', 'DELETE', '/admin/cms/pdf-maps/:id', 'cms.routes.js', 'deleteQuerySchema')] },
  { page: 'Documents', routes: ['/documents'], mountStatus: 'mounted', sourceFiles: ['Documents/index.tsx', 'Documents/DocumentDetailDialog.tsx', 'Documents/DocumentFormDialog.tsx'], testFiles: ['Documents/DocumentFormDialog.test.tsx', 'Documents/index.test.tsx'], formModes: ['create', 'edit'], routePermission: 'documents:read', operations: [op('document-create', 'create', 'documentService.create', 'POST', '/admin/cms/documents', 'cms.routes.js', 'documentCreateSchema'), op('document-update', 'edit', 'documentService.update', 'PATCH', '/admin/cms/documents/:id', 'cms.routes.js', 'documentUpdateSchema'), op('document-delete', 'action', 'documentService.delete', 'DELETE', '/admin/cms/documents/:id', 'cms.routes.js', 'deleteQuerySchema')] },
  { page: 'ForestClassification', routes: ['/forest-classification'], mountStatus: 'mounted', sourceFiles: ['ForestClassification/index.tsx', 'ForestClassification/ForestGroundTruthCard.tsx'], testFiles: ['ForestClassification/index.test.tsx'], formModes: ['action'], routePermission: 'forest_classification:read', operations: [op('forest-run', 'action', 'forestClassificationService.refresh', 'POST', '/forest-classification/refresh', 'forest-classification.routes.js', null, 'forest_classification:manage'), op('forest-publish', 'action', 'forestClassificationService.publishSnapshotRaster', 'POST', '/forest-classification/snapshots/:id/publish-raster', 'forest-classification.routes.js', null, 'map_layers:ingest_raster')] },
  { page: 'Flood', routes: ['/flood'], mountStatus: 'mounted', sourceFiles: ['Flood/index.tsx'], testFiles: ['Flood/index.test.tsx'], formModes: ['create', 'edit', 'action'], routePermission: 'flood:read', operations: [op('flood-run-create', 'create', 'floodService.submit', 'POST', '/admin/flood/runs', 'flood.routes.js', 'submitSchema', 'flood:run'), op('flood-legend-update', 'edit', 'floodService.updateLegend', 'PUT', '/admin/flood/legends/:code', 'flood.routes.js', 'updateLegendSchema', 'flood:publish'), op('flood-trend-config-update', 'edit', 'floodService.putTrendConfig', 'PUT', '/admin/flood/trend/config', 'flood.routes.js', null, 'flood:run')] },
  { page: 'KttvScenarios', routes: ['/kttv-scenarios'], mountStatus: 'mounted', sourceFiles: ['KttvScenarios/index.tsx', 'KttvScenarios/KttvInputForm.tsx', 'KttvScenarios/KttvScenarioFormDialog.tsx'], testFiles: ['KttvScenarios/KttvScenarioFormDialog.test.tsx', 'KttvScenarios/KttvInputForm.test.tsx', 'KttvScenarios/index.test.tsx'], formModes: ['create', 'edit', 'action'], routePermission: 'flood:read', operations: [op('scenario-create', 'create', 'kttvScenarioService.create', 'POST', '/admin/flood/scenarios', 'flood.routes.js', 'createScenarioSchema', 'flood:run'), op('scenario-update', 'edit', 'kttvScenarioService.update', 'PUT', '/admin/flood/scenarios/:id', 'flood.routes.js', 'updateScenarioSchema', 'flood:run'), op('scenario-delete', 'action', 'kttvScenarioService.delete', 'DELETE', '/admin/flood/scenarios/:id', 'flood.routes.js', 'idParamsSchema', 'flood:run')] },
  { page: 'Feedback', routes: ['/feedbacks'], mountStatus: 'mounted', sourceFiles: ['Feedback/index.tsx', 'Feedback/FeedbackDetailDialog.tsx', 'Feedback/FeedbackMap.tsx', 'Feedback/FeedbackUpdateDialog.tsx'], testFiles: ['Feedback/FeedbackUpdateDialog.test.tsx', 'Feedback/index.test.tsx'], formModes: ['edit'], routePermission: 'field_report:read', operations: [op('feedback-review', 'edit', 'citizenFeedbackService.updateStatus', 'PATCH', '/admin/field-reports/:id/review', 'field-report.routes.js', 'reviewSchema', 'field_report:approve')] },
  { page: 'Profile', routes: ['/profile'], mountStatus: 'mounted', sourceFiles: ['Profile/index.tsx'], testFiles: ['Profile/index.test.tsx'], formModes: ['edit'], operations: [op('profile-update', 'edit', 'authService.updateProfile', 'PATCH', '/auth/me', 'auth.routes.js', 'updateProfileSchema')] },
  { page: 'ChangePassword', routes: ['/change-password'], mountStatus: 'mounted', sourceFiles: ['ChangePassword/index.tsx'], testFiles: ['ChangePassword/index.test.tsx'], formModes: ['edit'], operations: [op('change-password', 'edit', 'authService.changePassword', 'POST', '/auth/change-password', 'auth.routes.js', 'changePasswordSchema')] },
  { page: 'Errors', routes: ['/400', '/401', '/403', '/500', '/503', '*'], mountStatus: 'mounted', sourceFiles: ['Errors/400BadRequestPage.tsx', 'Errors/401UnauthorizedPage.tsx', 'Errors/403ForbiddenPage.tsx', 'Errors/404NotFoundPage.tsx', 'Errors/500InternalServerErrorPage.tsx', 'Errors/503ServiceUnavailablePage.tsx'], testFiles: ['Errors/error-pages.test.tsx'], formModes: ['none'], operations: [] },
  { page: 'FieldMeasurements', routes: [], mountStatus: 'unmounted', sourceFiles: ['FieldMeasurements/index.tsx'], testFiles: ['FieldMeasurements/index.test.tsx'], formModes: ['action'], operations: [
    op('field-measurement-verify', 'action', 'fieldMeasurementService.verify', 'PATCH', '/field-measurements/:id/verify', null, null, 'field_measurements:verify', 'No matching Server route in this workspace.'),
    op('field-measurement-reject', 'action', 'fieldMeasurementService.reject', 'PATCH', '/field-measurements/:id/reject', null, null, 'field_measurements:verify', 'No matching Server route in this workspace.'),
    op('field-measurement-export', 'action', 'fieldMeasurementService.exportGeoJson', 'GET', '/field-measurements/export', null, null, undefined, 'No matching Server route in this workspace.'),
  ] },
  { page: 'MonitoredAreas', routes: [], mountStatus: 'unmounted', sourceFiles: ['MonitoredAreas/index.tsx'], testFiles: ['MonitoredAreas/index.test.tsx'], formModes: ['create'], operations: [op('monitored-area-create', 'create', 'fieldMeasurementService.createArea', 'POST', '/monitored-areas', null, null, 'field_measurements:create', 'Admin service endpoint has no matching Server route in this workspace.')] },
  { page: 'NotificationSend', routes: [], mountStatus: 'unmounted', sourceFiles: ['NotificationSend/index.tsx'], testFiles: ['NotificationSend/index.test.tsx'], formModes: ['action'], operations: [op('notification-send', 'action', 'notificationService.send', 'POST', '/notifications/send', 'notification.routes.js', null, 'notifications:send')] },
  { page: 'FireRisk', routes: [], mountStatus: 'empty', sourceFiles: [], testFiles: [], formModes: ['none'], operations: [] },
  { page: 'LayerSeries', routes: [], mountStatus: 'empty', sourceFiles: [], testFiles: [], formModes: ['none'], operations: [] },
] as const satisfies readonly AdminPageContract[]

export const adminOperationContracts = adminPageContracts.flatMap((page) =>
  page.operations.map((item) => ({ page: page.page, ...item }))
)
