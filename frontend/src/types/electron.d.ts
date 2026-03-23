export {};

declare global {
  interface ElectronAPI {
    // App info
    getAppPath: () => Promise<string>;
    getBackendUrl: () => Promise<string>;
    getDbPath: () => Promise<string>;
    platform: NodeJS.Platform;
    print: {
      receipt: () => Promise<void>;
    };
    window: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      toggleFullscreen: () => void;
      isFullscreen: () => Promise<boolean>;
      onFullscreenChanged: (callback: (payload: boolean) => void) => () => void;
    };
    versions: {
      node: string;
      electron: string;
      chrome: string;
    };
    
    // License
    license: {
      validate: () => Promise<{ valid: boolean; info?: any; error?: string }>;
      info: () => Promise<any>;
      activate: (key: string, days: number) => Promise<{ success: boolean; error?: string }>;
      deactivate: () => Promise<void>;
      generate: () => Promise<{ key: string; days: number }>;
      status: () => Promise<{ valid: boolean; daysLeft?: number; trial?: boolean }>;
      trial: () => Promise<{ success: boolean; days: number }>;
    };
    
    // Backup
    backup: {
      create: () => Promise<{ success: boolean; filename?: string; error?: string }>;
      list: () => Promise<string[]>;
      restore: (filename: string) => Promise<{ success: boolean; error?: string }>;
      delete: (filename: string) => Promise<{ success: boolean; error?: string }>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      getPath: () => Promise<string>;
    };
    
    // Update
    update: {
      check: () => Promise<{
        updateAvailable: boolean;
        currentVersion: string;
        latestVersion: string;
        releaseNotes?: string;
        downloadUrl?: string;
        releaseDate?: string | null;
        mandatory?: boolean;
        error?: string;
      }>;
      getVersion: () => Promise<string>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      download: (url: string) => Promise<void>;
      install: (path: string) => Promise<void>;
      quitAndInstall: () => void;
      onStatus: (callback: (payload: any) => void) => () => void;
      requestStatus: () => void;
      downloadUpdate: () => void;
    }
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
