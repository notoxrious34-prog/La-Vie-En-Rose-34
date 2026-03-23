import { type PropsWithChildren, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Skeleton } from './components/ui/Skeleton';

type LicenseStatus = {
  status: 'licensed' | 'unlicensed' | 'invalid' | 'expired';
  activated: boolean;
  reason?: string;
};

export function RequireLicense({ children }: PropsWithChildren) {
  const location = useLocation();
  const [state, setState] = useState<{ loading: boolean; ok: boolean; reason?: string }>({
    loading: true,
    ok: false,
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!window.electronAPI?.license) {
          if (mounted) setState({ loading: false, ok: true });
          return;
        }

        const res = (await window.electronAPI.license.status()) as unknown as LicenseStatus;
        const ok = res.status === 'licensed' && res.activated;
        if (mounted) setState({ loading: false, ok, reason: res.reason });
      } catch {
        // If IPC fails (e.g. Electron IPC not ready yet), allow access with a warning
        // This prevents a false block during startup race conditions
        if (mounted) setState({ loading: false, ok: true, reason: 'ipc_error_grace' });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[color:color-mix(in_srgb,var(--brand-gunmetal)_72%,transparent)] backdrop-blur-md">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
          <Skeleton className="h-3 w-40" radius="xl" />
        </div>
      </div>
    );
  }

  if (!state.ok) {
    return <Navigate to="/activate" replace state={{ from: location, reason: state.reason }} />;
  }

  return <>{children}</>;
}
