// Electron Optimization Utilities
// Phase 6: Optimize BrowserWindow settings, disable unused features, improve preload

const { app, BrowserWindow } = require('electron');

// Optimized BrowserWindow creation
export function createOptimizedMainWindow(options = {}) {
  const defaultOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // Start hidden for better loading
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false, // Disable for security and performance
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: {
        // Disable unused features for performance
        canvas: false,
        webgl: false,
        webgpu: false,
      },
      preload: undefined, // Will be set separately
    },
    // Performance optimizations
    paintWhenInitiallyHidden: false,
    autoHideMenuBar: true,
    skipTaskbar: false,
  };

  return new BrowserWindow({
    ...defaultOptions,
    ...options,
  });
}

// Disable unused Electron features
export function optimizeElectronApp(): void {
  // Disable unused features for performance
  if (app) {
    // Disable GPU acceleration if not needed
    app.disableHardwareAcceleration();
    
    // Disable unused menu
    app.setAboutPanelOptions({ enabled: false });
    
    // Optimize for battery life
    app.setAppUserModelId('la-vie-en-rose-34');
    
    // Disable unused protocol handlers
    app.setAsDefaultProtocolClient(null);
    
    // Optimize memory usage
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
  }
}

// Memory management
export function setupMemoryManagement(): void {
  // Clean up unused windows
  app.on('window-all-closed', () => {
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
  });

  // Monitor memory usage
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed / 1024 / 1024; // MB
    
    // Log if memory usage is high
    if (heapUsed > 200) { // 200MB threshold
      console.warn(`High memory usage: ${heapUsed.toFixed(2)}MB`);
    }
  }, 30000); // Check every 30 seconds
}

// Optimize preload script
export function getOptimizedPreloadPath(): string {
  const path = require('path');
  return path.join(__dirname, 'preload.js');
}

// Performance monitoring
export function setupPerformanceMonitoring(): void {
  app.on('ready', () => {
    console.log(`Electron app ready in ${Date.now() - app.getLaunchTime()}ms`);
  });

  // Monitor window creation time
  app.on('browser-window-created', (event, window) => {
    const startTime = Date.now();
    
    window.webContents.on('did-finish-load', () => {
      const loadTime = Date.now() - startTime;
      console.log(`Window loaded in ${loadTime}ms`);
      
      if (loadTime > 3000) {
        console.warn(`Slow window load detected: ${loadTime}ms`);
      }
    });
  });
}
