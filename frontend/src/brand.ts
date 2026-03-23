// Use relative paths (./brand-mark.png) instead of absolute (/brand-mark.png).
// In Electron's file:// context, absolute paths like /brand-mark.png resolve to
// the filesystem root (e.g. C:\brand-mark.png) instead of the app's dist folder,
// which is why logos were invisible in the packaged build.
export const BRAND_LOGO_SRC = './brand-mark.png' as const;
export const BRAND_LOGO_FALLBACK_SRC = './LVR34.png' as const;
export const BRAND_WORDMARK_SRC = './LVR34_0.png' as const;
