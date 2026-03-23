import type { PropsWithChildren } from 'react';
import { useAuth } from './store/auth';
import { lazy, Suspense } from 'react';
import { Skeleton } from './components/ui/Skeleton';

const LoginPage = lazy(() => import('./pages/Login').then(m => ({ default: m.LoginPage })));

function LoginLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[color:color-mix(in_srgb,var(--brand-gunmetal)_72%,transparent)] backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-28" radius="xl" />
      </div>
    </div>
  );
}

export function RequireAuth({ children }: PropsWithChildren) {
  const token = useAuth((s) => s.token);
  if (!token) {
    return (
      <Suspense fallback={<LoginLoader />}>
        <LoginPage />
      </Suspense>
    );
  }
  return <>{children}</>;
}
