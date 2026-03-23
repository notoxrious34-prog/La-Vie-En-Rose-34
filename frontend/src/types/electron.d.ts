export {};

declare global {
  interface Window {
    electronAPI?: {
      getAppPath: () => Promise<string>;
      getBackendUrl: () => Promise<string>;
      getDbPath: () => Promise<string>;
      platform: string;
      print: {
        receipt: () => Promise<unknown>;
      };
      window: {
        minimize: () => void;
        toggleMaximize: () => void;
        close: () => void;
        toggleFullscreen: () => void;
        isFullscreen: () => Promise<boolean>;
        onFullscreenChanged: (callback: (payload: { isFullscreen: boolean }) => void) => () => void;
      };
      versions: {
        node: string;
        electron: string;
        chrome: string;
      };
      license: {
        validate: () => Promise<{
          status: 'licensed' | 'unlicensed' | 'invalid' | 'expired';
          activated: boolean;
          key?: string;
          plan?: string;
          expiresAt?: number | null;
          machineId: string;
          offline?: boolean;
          reason?: string;
        }>;
        info: () => Promise<{
          activated: boolean;
          key?: string;
          expiresAt?: number | null;
          daysRemaining?: number | null;
          version?: string;
          reason?: string;
          plan?: string;
          type?: 'lifetime' | 'subscription';
          devicesAllowed?: number;
          deviceCount?: number;
          machineId?: string;
          offline?: boolean;
          activationDate?: number;
          lastOnlineAt?: number;
          offlineGraceDaysRemaining?: number;
          subscriptionGraceDaysRemaining?: number | null;
        }>;
        activate: (key: string, days?: number | null) => Promise<{ success: boolean; error?: string; license?: any; details?: string }>;
        deactivate: () => Promise<{ success: boolean }>;
        generate: () => Promise<string>;
        status: () => Promise<{
          status: 'licensed' | 'unlicensed' | 'invalid' | 'expired';
          activated: boolean;
          key?: string;
          plan?: string;
          type?: 'lifetime' | 'subscription';
          devicesAllowed?: number;
          deviceCount?: number;
          expiresAt?: number | null;
          machineId: string;
          offline?: boolean;
          reason?: string;
          activationDate?: number;
          lastOnlineAt?: number;
          offlineGraceDaysRemaining?: number;
        }>;
        trial: () => Promise<{
          isActive: boolean;
          isTrial: boolean;
          startedAt?: number;
          expiresAt?: number;
          daysRemaining?: number;
          reason?: string;
        }>;
      };
      backup: {
        create: () => Promise<{ success: boolean; backup?: any; error?: string }>;
        list: () => Promise<any[]>;
        restore: (filename: string) => Promise<{ success: boolean; error?: string }>;
        delete: (filename: string) => Promise<{ success: boolean; error?: string }>;
        getSettings: () => Promise<{ autoBackup: boolean; frequency: string; maxBackups: number; lastBackup: number | null }>;
        saveSettings: (settings: any) => Promise<{ success: boolean }>;
        getPath: () => Promise<string>;
      };
      update: {
        check: () => Promise<{
          updateAvailable: boolean;
          currentVersion: string;
          latestVersion: string;
          releaseNotes?: string;
          downloadUrl?: string;
          releaseDate?: string | null;
          signature?: string | null;
          checksum?: string | null;
          deltaUrl?: string | null;
          deltaChecksum?: string | null;
          isDelta?: boolean;
          error?: string;
        }>;
        getVersion: () => Promise<string>;
        getSettings: () => Promise<{
          autoCheck: boolean;
          lastCheck: number | null;
          skipVersion: string | null;
          installMode?: 'onQuit' | 'manual';
        }>;
        saveSettings: (settings: any) => Promise<{ success: boolean }>;
        download: (url: string) => Promise<{ success: boolean; filePath?: string; size?: number; error?: string }>;
        install: (path: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        quitAndInstall: () => Promise<{ success: boolean; error?: string }>;
        onStatus: (callback: (payload: any) => void) => () => void;
      };
    };
  }
}
