import React, { useState, useEffect } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';

interface UpdateNotificationProps {
  onClose?: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onClose }) => {
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('checking');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Request initial status
    if (window.electronAPI?.update?.requestStatus) {
      window.electronAPI.update.requestStatus();
    }

    // Listen for update events
    if (window.electronAPI?.update?.onStatus) {
      const unsubscribe = window.electronAPI.update.onStatus((status: any) => {
        setUpdateStatus(status.state);
        setUpdateInfo(status.info);
        if (status.progress) {
          setProgress(status.progress.percent || 0);
        }
      });

      return unsubscribe;
    }
  }, []);

  const handleDownload = () => {
    if (window.electronAPI?.update?.downloadUpdate) {
      window.electronAPI.update.downloadUpdate();
    }
  };

  const handleRestart = () => {
    if (window.electronAPI?.update?.quitAndInstall) {
      window.electronAPI.update.quitAndInstall();
    }
  };

  const getStatusMessage = () => {
    switch (updateStatus) {
      case 'checking':
        return 'Checking for updates...';
      case 'available':
        return `Update available: v${updateInfo?.version || 'latest'}`;
      case 'downloading':
        return `Downloading update... ${Math.round(progress)}%`;
      case 'downloaded':
        return 'Update ready to install';
      case 'error':
        return 'Update check failed';
      default:
        return 'Checking for updates...';
    }
  };

  const getStatusIcon = () => {
    switch (updateStatus) {
      case 'checking':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'available':
        return <Download className="w-4 h-4" />;
      case 'downloading':
        return <Download className="w-4 h-4 animate-bounce" />;
      case 'downloaded':
        return <RefreshCw className="w-4 h-4 text-green-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  const showActions = updateStatus === 'available' || updateStatus === 'downloaded';
  const showProgress = updateStatus === 'downloading';

  if (updateStatus === 'checking' && !updateInfo) {
    return null; // Don't show while checking initially
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {getStatusIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">
              La Vie En Rose 34
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {getStatusMessage()}
            </p>
            {showProgress && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {(onClose || updateStatus === 'checking') && (
          <button
            onClick={onClose}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {showActions && (
        <div className="mt-3 flex space-x-2">
          {updateStatus === 'available' && (
            <button
              onClick={handleDownload}
              className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Download Update
            </button>
          )}
          {updateStatus === 'downloaded' && (
            <button
              onClick={handleRestart}
              className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 transition-colors"
            >
              Restart to Update
            </button>
          )}
        </div>
      )}
    </div>
  );
};
