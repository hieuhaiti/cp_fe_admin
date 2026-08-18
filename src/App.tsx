import { lazy, Suspense, useEffect } from 'react'
import LoadingOverlay from '@/components/common/LoadingOverlay'
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { MainLayout } from './layout/mainLayout'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { useAuthStore } from './stores/common/useAuthStore'
import { tokenManager } from './lib/tokenManager'
import { onSessionExpired } from './lib/sessionEvents'
import { ToastContainer } from 'react-toastify'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const NotFoundPage = lazy(() => import('@/pages/Errors/404NotFoundPage'))
const BadRequestPage = lazy(() => import('@/pages/Errors/400BadRequestPage'))
const UnauthorizedPage = lazy(() => import('@/pages/Errors/401UnauthorizedPage'))
const ForbiddenPage = lazy(() => import('@/pages/Errors/403ForbiddenPage'))
const InternalServerErrorPage = lazy(() => import('@/pages/Errors/500InternalServerErrorPage'))
const ServiceUnavailablePage = lazy(() => import('@/pages/Errors/503ServiceUnavailablePage'))

const LoginPage = lazy(() => import('@/pages/Login'))
const UserPage = lazy(() => import('@/pages/User'))
const NewsPage = lazy(() => import('@/pages/News'))
const NewsCommentsPage = lazy(() => import('@/pages/NewsComments'))
const MapLayerPage = lazy(() => import('@/pages/MapLayers'))
const MapLayerApisPage = lazy(() => import('@/pages/MapLayerApis'))
const MapLayerApiPublicPage = lazy(() => import('@/pages/MapLayerApis/MapLayerApiPublicPage'))
const ImportGeoJsonPage = lazy(() => import('@/pages/MapLayers/ImportGeoJson'))
const MapImagePage = lazy(() => import('@/pages/MapImage'))
const DocumentsPage = lazy(() => import('@/pages/Documents'))
const FeedbackPage = lazy(() => import('@/pages/Feedback'))
const ProfilePage = lazy(() => import('@/pages/Profile'))
const ChangePasswordPage = lazy(() => import('@/pages/ChangePassword'))

// New modules aligned to Postman
const DashboardPage = lazy(() => import('@/pages/Dashboard'))
const FloodPage = lazy(() => import('@/pages/Flood'))
const ForestClassificationPage = lazy(() => import('@/pages/ForestClassification'))
const KttvScenariosPage = lazy(() => import('@/pages/KttvScenarios'))
// const NotificationSendPage = lazy(() => import('@/pages/NotificationSend'))
const LandingPage = lazy(() => import('@/pages/Landing'))

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initialize = useAuthStore((s) => s.initialize)
  const expireSession = useAuthStore((s) => s.expireSession)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(
    () =>
      onSessionExpired(() => {
        expireSession()
        queryClient.clear()
        toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', {
          toastId: 'session-expired',
        })
        navigate('/login', { replace: true })
      }),
    [expireSession, navigate, queryClient]
  )

  return (
    <>
      <Suspense fallback={<LoadingOverlay />} key={location.pathname}>
        <Routes location={location}>
          <Route
            path="/login"
            element={tokenManager.getAccessToken() ? <Navigate to="/" replace /> : <LoginPage />}
          />

          <Route path="/400" element={<BadRequestPage />} />
          <Route path="/401" element={<UnauthorizedPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/500" element={<InternalServerErrorPage />} />
          <Route path="/503" element={<ServiceUnavailablePage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Users */}
              <Route
                element={<ProtectedRoute permission={{ resource: 'users', action: 'read' }} />}
              >
                <Route path="/users" element={<UserPage />} />
              </Route>

              {/* Content */}
              <Route element={<ProtectedRoute permission={{ resource: 'news', action: 'read' }} />}>
                <Route path="/news" element={<NewsPage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute permission={{ resource: 'comments', action: 'approve' }} />
                }
              >
                <Route path="/news-comments" element={<NewsCommentsPage />} />
              </Route>

              {/* GIS */}
              <Route
                element={<ProtectedRoute permission={{ resource: 'map_layers', action: 'read' }} />}
              >
                <Route path="/map-layers" element={<MapLayerPage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute permission={{ resource: 'map_layers', action: 'create' }} />
                }
              >
                <Route path="/map-layers/import-geojson" element={<ImportGeoJsonPage />} />
              </Route>
              <Route
                element={<ProtectedRoute permission={{ resource: 'map_apis', action: 'read' }} />}
              >
                <Route path="/map-apis/*" element={<MapLayerApisPage />} />
              </Route>
              <Route path="/public/map-apis" element={<MapLayerApiPublicPage />} />
              <Route path="/map-layer-apis/*" element={<Navigate to="/map-apis" replace />} />
              <Route
                path="/public/map-layer-apis"
                element={<Navigate to="/public/map-apis" replace />}
              />
              <Route
                element={<ProtectedRoute permission={{ resource: 'pdf_maps', action: 'read' }} />}
              >
                <Route path="/map-images" element={<MapImagePage />} />
              </Route>
              <Route
                element={<ProtectedRoute permission={{ resource: 'documents', action: 'read' }} />}
              >
                <Route path="/documents" element={<DocumentsPage />} />
              </Route>

              {/* Phân loại đối tượng / ngập lụt - thủy văn */}
              <Route
                element={
                  <ProtectedRoute
                    permission={{ resource: 'forest_classification', action: 'read' }}
                  />
                }
              >
                <Route path="/forest-classification" element={<ForestClassificationPage />} />
              </Route>
              <Route
                element={<ProtectedRoute permission={{ resource: 'flood', action: 'read' }} />}
              >
                <Route path="/flood" element={<FloodPage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute permission={{ resource: 'kttv_scenarios', action: 'read' }} />
                }
              >
                <Route path="/kttv-scenarios" element={<KttvScenariosPage />} />
              </Route>

              {/* Vận hành */}
              <Route
                element={<ProtectedRoute permission={{ resource: 'feedback', action: 'read' }} />}
              >
                <Route path="/feedbacks" element={<FeedbackPage />} />
              </Route>
              {/* <Route element={<ProtectedRoute permission={{ resource: 'notifications', action: 'send' }} />}>
                <Route path="/notifications/send" element={<NotificationSendPage />} />
              </Route> */}

              {/* Redirects for legacy paths */}

              {/* Personal pages */}
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <ToastContainer position="top-right" className="z-9999" autoClose={3000} />
    </>
  )
}

export default App
