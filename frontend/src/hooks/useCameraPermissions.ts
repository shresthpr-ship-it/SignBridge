import { useState, useEffect, useCallback } from 'react';

export type CameraPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'insecure-context';

export interface CameraPermissionDetails {
  state: CameraPermissionState;
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  devices: MediaDeviceInfo[];
  errorMessage: string | null;
  requestPermission: (facingMode?: 'user' | 'environment') => Promise<boolean>;
  switchToHttps: () => void;
}

export function useCameraPermissions(): CameraPermissionDetails {
  const [state, setState] = useState<CameraPermissionState>('prompt');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSecure = typeof window !== 'undefined' && (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'https:'
  );

  const hasMediaDevices = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

  // Check initial permission status if the Permissions API is available
  useEffect(() => {
    if (!isSecure && !window.isSecureContext) {
      setState('insecure-context');
      setErrorMessage(
        'Camera access requires a Secure Context (HTTPS or localhost). Remote devices accessing via plain HTTP cannot access camera devices.'
      );
      return;
    }

    if (!hasMediaDevices) {
      setState('unsupported');
      setErrorMessage('MediaDevices camera API is not supported in this browser.');
      return;
    }

    // Try Permissions API (Chrome/Edge/Firefox)
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((permissionStatus) => {
          setState(permissionStatus.state as CameraPermissionState);
          permissionStatus.onchange = () => {
            setState(permissionStatus.state as CameraPermissionState);
          };
        })
        .catch(() => {
          // Permissions API query not supported for camera on Safari / iOS; remains 'prompt'
        });
    }

    // Enumerate devices if permission might already be granted
    if (navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((deviceList) => {
          const videoInputs = deviceList.filter((d) => d.kind === 'videoinput');
          setDevices(videoInputs);
          if (videoInputs.some((d) => d.label && d.label.length > 0)) {
            setState('granted');
          }
        })
        .catch(() => {});
    }
  }, [isSecure, hasMediaDevices]);

  // Explicitly prompt the user for permission
  const requestPermission = useCallback(
    async (facingMode: 'user' | 'environment' = 'user'): Promise<boolean> => {
      setErrorMessage(null);

      if (!isSecure) {
        setState('insecure-context');
        setErrorMessage(
          'Your browser blocks camera requests on unencrypted HTTP across network devices. Use HTTPS (e.g. https://' +
            window.location.host +
            ') to enable camera access.'
        );
        return false;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState('unsupported');
        setErrorMessage('Camera API is not supported by your browser.');
        return false;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        // Release the temporary test stream immediately
        stream.getTracks().forEach((track) => track.stop());

        setState('granted');
        setErrorMessage(null);

        // Re-enumerate to get full device labels
        if (navigator.mediaDevices.enumerateDevices) {
          const freshDevices = await navigator.mediaDevices.enumerateDevices();
          setDevices(freshDevices.filter((d) => d.kind === 'videoinput'));
        }

        return true;
      } catch (err: any) {
        console.warn('Camera permission request denied or failed:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setState('denied');
          setErrorMessage(
            'Camera permission was denied. Tap the lock/info icon in your browser address bar to allow camera access.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setState('unsupported');
          setErrorMessage('No camera hardware found on this device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setErrorMessage('Camera is currently in use by another tab or app.');
        } else {
          setErrorMessage(err.message || 'Failed to request camera permission.');
        }
        return false;
      }
    },
    [isSecure]
  );

  const switchToHttps = useCallback(() => {
    if (window.location.protocol !== 'https:') {
      window.location.protocol = 'https:';
    }
  }, []);

  return {
    state,
    isSecureContext: isSecure,
    hasMediaDevices,
    devices,
    errorMessage,
    requestPermission,
    switchToHttps,
  };
}
