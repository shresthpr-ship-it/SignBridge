import React, { useState } from 'react';
import { CameraPermissionDetails } from '../../hooks/useCameraPermissions';
import { Button } from '../ui/Button';

interface CameraPermissionGuardianProps {
  permission: CameraPermissionDetails;
  onPermissionGranted?: () => void;
  className?: string;
}

export const CameraPermissionGuardian: React.FC<CameraPermissionGuardianProps> = ({
  permission,
  onPermissionGranted,
  className = '',
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  const handleRequestAccess = async () => {
    setIsRequesting(true);
    const success = await permission.requestPermission('user');
    setIsRequesting(false);
    if (success && onPermissionGranted) {
      onPermissionGranted();
    }
  };

  // If already granted, show a subtle green pill or nothing
  if (permission.state === 'granted') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 ${className}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Camera Access Granted ({permission.devices.length || 1} available)</span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      permission.state === 'insecure-context'
        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
        : permission.state === 'denied'
        ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
        : 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200'
    } ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">📷</span>
            <h4 className="font-semibold text-sm tracking-wide">
              {permission.state === 'insecure-context'
                ? 'Device Security Notice: HTTPS Required for Camera'
                : permission.state === 'denied'
                ? 'Camera Access Blocked'
                : 'Camera Permission Required'}
            </h4>
          </div>
          <p className="text-xs opacity-90 max-w-xl">
            {permission.state === 'insecure-context'
              ? 'Mobile browsers (Chrome, Safari, Firefox) restrict camera hardware on remote IP addresses unless HTTPS is used.'
              : permission.state === 'denied'
              ? 'Permission was denied. Please allow camera permissions in your browser address bar and reload.'
              : 'SignBridge needs camera access to capture real-time hand gestures and perform landmark extraction.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {permission.state === 'insecure-context' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={permission.switchToHttps}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium"
            >
              🔒 Switch to Secure HTTPS
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRequestAccess}
              disabled={isRequesting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-900/40"
            >
              {isRequesting ? 'Requesting...' : 'Request Camera Permission'}
            </Button>
          )}

          <button
            type="button"
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="text-xs underline opacity-80 hover:opacity-100 px-2 py-1"
          >
            {showTroubleshooting ? 'Hide Help' : 'Help & Devices'}
          </button>
        </div>
      </div>

      {/* Troubleshooting and Multi-Device Guide */}
      {showTroubleshooting && (
        <div className="mt-4 pt-4 border-t border-white/10 text-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span>📱</span> Android & Mobile Chrome
              </span>
              <p className="text-slate-300">
                1. Open <code className="bg-black/60 px-1 py-0.5 rounded text-indigo-300">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
              </p>
              <p className="text-slate-300">
                2. Enter <code className="bg-black/60 px-1 py-0.5 rounded text-indigo-300">{window.location.origin}</code>
              </p>
              <p className="text-slate-300">
                3. Select <strong>Enabled</strong> and tap <strong>Relaunch</strong>.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span>🍏</span> iPhone & iPad Safari
              </span>
              <p className="text-slate-300">
                1. Safari strictly mandates <strong>HTTPS</strong> for all camera streams.
              </p>
              <p className="text-slate-300">
                2. Tap the <strong>Switch to Secure HTTPS</strong> button above, or open via your HTTPS link.
              </p>
              <p className="text-slate-300">
                3. When prompted, tap <strong>"Allow"</strong> on the Safari pop-up dialog.
              </p>
            </div>
          </div>

          {permission.errorMessage && (
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <strong>Error Details:</strong> {permission.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
