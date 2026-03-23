import { Suspense, lazy, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { RequireAuth } from './RequireAuth';
import { RequireLicense } from './RequireLicense';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastHost } from './components/ui/ToastHost';
import { Skeleton } from './components/ui/Skeleton';
import { useToasts } from './lib/toast';
import { useDebounce } from './lib/uiOptimization';
import { preloadCriticalImages } from './lib/assetOptimization';
import { createCleanup } from './lib/cleanup';

// Preload critical images
preloadCriticalImages();

const LoginPage = lazy(() => import('./pages/Login').then((m) => ({ default: m.LoginPage })));
const POSPage = lazy(() => import('./pages/POS').then((m) => ({ default: m.POSPage })));
const SalesHistoryPage = lazy(() => import('./pages/SalesHistory'));
const DashboardPage = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const InventoryPage = lazy(() => import('./pages/Inventory').then((m) => ({ default: m.InventoryPage })));
const CustomersPage = lazy(() => import('./pages/Customers').then((m) => ({ default: m.CustomersPage })));
const SuppliersPage = lazy(() => import('./pages/Suppliers').then((m) => ({ default: m.SuppliersPage })));
const RepairsPage = lazy(() => import('./pages/Repairs').then((m) => ({ default: m.RepairsPage })));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PublicOrderStatusPage = lazy(() =>
  import('./pages/PublicOrderStatus').then((m) => ({ default: m.PublicOrderStatusPage }))
);
const OrderTrackingPage = lazy(() => import('./pages/OrderTracking').then((m) => ({ default: m.OrderTrackingPage })));
const ActivationPage = lazy(() => import('./pages/Activation').then((m) => ({ default: m.ActivationPage })));

const PageLoader = () => (
  <div
    className="flex h-screen w-full items-center justify-center"
    style={{
      background:
        'radial-gradient(900px 650px at 15% 20%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%), radial-gradient(800px 600px at 85% 75%, color-mix(in srgb, var(--color-secondary-500) 10%, transparent), transparent 65%), var(--surface-0)',
    }}
  >
    <div className="flex flex-col items-center gap-5">
      <Skeleton className="h-20 w-20 rounded-full" radius="3xl" />
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-3 w-44" radius="xl" />
        <Skeleton className="h-3 w-28" radius="xl" />
      </div>
    </div>
  </div>
);

function AppInner() {
  const [showSplash, setShowSplash] = useState(true);
  const { items, closeToast } = useToasts();
  const cleanup = createCleanup();

  // Debounced splash hide to prevent flickering
  const debouncedHideSplash = useDebounce(() => {
    setShowSplash(false);
    cleanup.execute(); // Cleanup when app is ready
  }, 100);

  return (
    <>
      <ToastHost items={items} onClose={closeToast} />
      {showSplash && <SplashScreen onComplete={debouncedHideSplash} duration={3000} />}
      {!showSplash && (
        <HashRouter>
          <Routes>
            <Route
              path="/activate"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ActivationPage />
                </Suspense>
              }
            />
            <Route
              path="/login"
              element={
                <Suspense fallback={<PageLoader />}>
                  <LoginPage />
                </Suspense>
              }
            />
            <Route
              path="/public/orders/:orderNumber"
              element={
                <Suspense fallback={<PageLoader />}>
                  <PublicOrderStatusPage />
                </Suspense>
              }
            />
            <Route
              path="/track/:orderNumber"
              element={
                <Suspense fallback={<PageLoader />}>
                  <OrderTrackingPage />
                </Suspense>
              }
            />
            <Route
              path="/"
              element={
                <RequireLicense>
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                </RequireLicense>
              }
            >
              <Route
                path="/pos"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <POSPage />
                  </Suspense>
                }
              />
              <Route
                path="/sales"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <SalesHistoryPage />
                  </Suspense>
                }
              />
              <Route
                path="/inventory"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <InventoryPage />
                  </Suspense>
                }
              />
              <Route
                path="/customers"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <CustomersPage />
                  </Suspense>
                }
              />
              <Route
                path="/suppliers"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <SuppliersPage />
                  </Suspense>
                }
              />
              <Route
                path="/repairs"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <RepairsPage />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <SettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route
                path="*"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <POSPage />
                  </Suspense>
                }
              />
            </Route>
          </Routes>
        </HashRouter>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
