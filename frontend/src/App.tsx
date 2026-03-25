import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { RequireAuth } from './RequireAuth';
import { RequireLicense } from './RequireLicense';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateNotification } from './components/UpdateNotification';
import { ToastHost } from './components/ui/ToastHost';
import { Skeleton } from './components/ui/Skeleton';
import { useToasts } from './lib/toast';
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

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <Skeleton className="h-4 w-32 mx-auto" radius="xl" />
        <Skeleton className="h-3 w-24 mx-auto mt-2" radius="xl" />
      </div>
    </div>
  );
}

function AppInner() {
  const [showSplash, setShowSplash] = useState(true);
  const [showUpdate, setShowUpdate] = useState(false);
  const { items, closeToast } = useToasts();
  const cleanup = createCleanup();

  const splashDoneRef = useRef(false);
  const splashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (splashTimerRef.current) {
        window.clearTimeout(splashTimerRef.current);
        splashTimerRef.current = null;
      }
    };
  }, []);

  const handleSplashComplete = () => {
    if (splashDoneRef.current) return;
    splashDoneRef.current = true;

    // Small delay keeps the transition smooth without risking incorrect hook usage.
    splashTimerRef.current = window.setTimeout(() => {
      setShowSplash(false);
      cleanup.execute();
      setShowUpdate(true);
    }, 100);
  };

  return (
    <>
      <ToastHost items={items} onClose={closeToast} />
      {showSplash && <SplashScreen onComplete={handleSplashComplete} duration={3000} />}
      {!showSplash && (
        <>
          {showUpdate && <UpdateNotification onClose={() => setShowUpdate(false)} />}
          <HashRouter>
            <Routes>
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
                element={
                  <RequireLicense>
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  </RequireLicense>
                }
              >
                <Route
                  index
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <DashboardPage />
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
                  path="*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
              </Route>
            </Routes>
          </HashRouter>
        </>
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
