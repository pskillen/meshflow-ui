import { Suspense, lazy } from 'react';
import { TracerouteHistory } from '@/pages/traceroutes/TracerouteHistory';
import { TraceroutesLanding } from '@/pages/traceroutes/TraceroutesLanding';
import { TracerouteHeatmapPage } from '@/pages/traceroutes/TracerouteHeatmapPage';
import { TracerouteTopologyPage } from '@/pages/traceroutes/TracerouteTopologyPage';
import { FeederCoveragePage } from '@/pages/traceroutes/FeederCoveragePage';
import { ConstellationCoveragePage } from '@/pages/traceroutes/ConstellationCoveragePage';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { ConfigProvider } from '@/providers/ConfigProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { WebSocketProvider } from '@/providers/WebSocketProvider';

import { NodesList } from '@/pages/nodes/NodesList';
import { MeshInfrastructure } from '@/pages/nodes/MeshInfrastructure';
import { Weather } from '@/pages/Weather';
import { NodeMap } from '@/pages/map/NodeMap';
import { MessageHistory } from '@/pages/messages/MessageHistory';
import { Dashboard } from '@/pages/Dashboard';
import { NodeDetails } from '@/pages/nodes/NodeDetails';
import { ClaimNode } from '@/pages/nodes/ClaimNode';
import { NodeSettings } from '@/pages/user/NodeSettings';
import { SettingsPage } from '@/pages/user/SettingsPage';
import { ApiKeysPage } from '@/pages/user/ApiKeysPage';
import { MyNodes } from '@/pages/nodes/MyNodes';
import { LoginPage } from '@/pages/auth/LoginPage';
import { OAuthCallback } from '@/pages/auth/OAuthCallback';
import { UserPage } from '@/pages/user/UserPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layouts/AppLayout';
import MonitorNodes from '@/pages/nodes/monitor';
import DxMonitoringPage from '@/pages/nodes/DxMonitoringPage';
import { MeshCoreNodesList } from '@/pages/meshcore/MeshCoreNodesList';
import { MeshCoreMessages } from '@/pages/meshcore/MeshCoreMessages';
import { MeshCoreDashboard } from '@/pages/meshcore/MeshCoreDashboard';
import { MeshtasticDashboard } from '@/pages/meshtastic/MeshtasticDashboard';

const ManagedNodesStatus = lazy(() => import('@/pages/nodes/ManagedNodesStatus'));
const MeshCoreManagedNodesStatus = lazy(() =>
  import('@/pages/nodes/ManagedNodesStatus').then((m) => ({ default: m.MeshCoreManagedNodesStatus }))
);
const InfrastructureExport = lazy(() =>
  import('@/pages/nodes/InfrastructureExport').then((m) => ({ default: m.InfrastructureExport }))
);

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigProvider>
        <Router>
          <AuthProvider>
            <WebSocketProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<OAuthCallback />} />

                {/* Public observatory (guest or authenticated) — meshflow-ui #298 */}
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/nodes" element={<NodesList />} />
                  <Route path="/nodes/:id" element={<NodeDetails />} />
                  <Route path="/map" element={<NodeMap />} />
                  <Route path="/messages" element={<MessageHistory />} />
                  <Route path="/meshtastic/dashboard" element={<MeshtasticDashboard />} />
                  <Route path="/meshcore/dashboard" element={<MeshCoreDashboard />} />
                  <Route path="/meshcore/nodes" element={<MeshCoreNodesList />} />
                  <Route path="/meshcore/messages" element={<MeshCoreMessages />} />
                  <Route path="/meshcore/map" element={<Navigate to="/meshcore/nodes" replace />} />
                  <Route path="/traceroutes/history" element={<TracerouteHistory />} />
                  <Route path="/traceroutes" element={<TraceroutesLanding />} />
                  <Route path="/traceroutes/heatmap" element={<Navigate to="/traceroutes/map/heat" replace />} />
                  <Route
                    path="/traceroutes/topology"
                    element={<Navigate to="/traceroutes/map/topology/heat" replace />}
                  />
                  <Route path="/traceroutes/map/heat" element={<TracerouteHeatmapPage edgeMetric="packets" />} />
                  <Route path="/traceroutes/map/snr" element={<TracerouteHeatmapPage edgeMetric="snr" />} />
                  <Route
                    path="/traceroutes/map/topology/heat"
                    element={<TracerouteTopologyPage edgeMetric="packets" />}
                  />
                  <Route path="/traceroutes/map/topology/snr" element={<TracerouteTopologyPage edgeMetric="snr" />} />
                  <Route path="/traceroutes/map/coverage" element={<FeederCoveragePage />} />
                  <Route
                    path="/traceroutes/map/coverage/constellation/:constellationId"
                    element={<ConstellationCoveragePage />}
                  />
                  <Route path="/traceroutes/map/coverage/constellation" element={<ConstellationCoveragePage />} />
                  <Route path="/weather" element={<Weather />} />
                </Route>

                {/* Authenticated-only */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/nodes/infrastructure" element={<MeshInfrastructure />} />
                  <Route
                    path="/nodes/infrastructure/export"
                    element={
                      <Suspense fallback={<div>Loading...</div>}>
                        <InfrastructureExport />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/nodes/managed-nodes"
                    element={
                      <Suspense fallback={<div>Loading managed nodes...</div>}>
                        <ManagedNodesStatus />
                      </Suspense>
                    }
                  />
                  <Route path="/nodes/my-nodes" element={<MyNodes />} />
                  <Route path="/nodes/monitor" element={<MonitorNodes />} />
                  <Route path="/nodes/dx-monitoring" element={<DxMonitoringPage />} />
                  <Route path="/nodes/:id/claim" element={<ClaimNode />} />
                  <Route
                    path="/meshcore/managed-nodes"
                    element={
                      <Suspense fallback={<div>Loading managed nodes...</div>}>
                        <MeshCoreManagedNodesStatus />
                      </Suspense>
                    }
                  />
                  <Route path="/user/nodes" element={<NodeSettings />} />
                  <Route path="/user/settings" element={<SettingsPage />} />
                  <Route path="/user/api-keys" element={<ApiKeysPage />} />
                  <Route path="/user" element={<UserPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </WebSocketProvider>
          </AuthProvider>
        </Router>
      </ConfigProvider>
    </Suspense>
  );
}

export default App;
