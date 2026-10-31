import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Video,
  Disc,
  Play,
  Square,
  RotateCcw,
  Upload,
  AlertCircle,
  Shield,
  Info,
  SwitchCamera,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { StatusIndicator } from '../ui/StatusIndicator';
import { api } from '../../services/api';

export const StudioView: React.FC = () => {
  const { classes, addClass, addToast, refreshData } = useApp();

  // Mode: Still Image or Video Recording
  const [captureMode, setCaptureMode] = useState<'image' | 'video'>('image');

  // Camera stream and lifecycle state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Captured still image state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);

  // Video recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);

  // Metadata attributes
  const [signLanguage, setSignLanguage] = useState<string>('ASL');
  const [signLabel, setSignLabel] = useState<string>('Hello');
  const [description, setDescription] = useState<string>('');
  const [signerId, setSignerId] = useState<string>(() => `signer_${Math.random().toString(36).substring(2, 6)}`);
  const [split, setSplit] = useState<'train' | 'val' | 'test'>('train');
  const [consentConfirmed, setConsentConfirmed] = useState<boolean>(true);

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // New sign class modal
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassCategory, setNewClassCategory] = useState<string>('General');

  // Query available video devices
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setVideoDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        })
        .catch(() => {});
    }
  }, [selectedDeviceId]);

  // Clean up camera streams on unmount or navigation
  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraTracks();
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [stopCameraTracks, recordedVideoUrl]);

  // Start Camera handler
  const startCamera = async () => {
    setCameraError(null);
    setIsRequestingCamera(true);

    // Stop existing stream if any
    stopCameraTracks();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API is not supported in this browser environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('[Capture Studio] Camera permission error:', err);
      let message = 'Unable to access webcam. Please check your browser camera permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please allow camera access in your browser settings to capture media.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'No video capture device was detected on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Camera hardware is currently in use by another application.';
      }
      setCameraError(message);
      setIsCameraActive(false);
    } finally {
      setIsRequestingCamera(false);
    }
  };

  // Toggle front/rear facing mode
  const handleToggleFacingMode = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (isCameraActive) {
      setTimeout(() => startCamera(), 100);
    }
  };

  // Switch camera device
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isCameraActive) {
      setTimeout(() => startCamera(), 100);
    }
  };

  // Still Image Capture
  const handleCaptureImage = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);

    canvas.toBlob((blob) => {
      if (blob) setCapturedImageBlob(blob);
    }, 'image/png');
  };

  // Retake still image
  const handleRetakeImage = () => {
    setCapturedImage(null);
    setCapturedImageBlob(null);
  };

  // Video Recording Controls
  const handleStartRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    try {
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? { mimeType: 'video/webm;codecs=vp9' }
        : MediaRecorder.isTypeSupported('video/webm')
        ? { mimeType: 'video/webm' }
        : undefined;

      const recorder = new MediaRecorder(streamRef.current, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setRecordedVideoBlob(blob);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err: any) {
      setCameraError('MediaRecorder failed to initialize in this browser environment.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleDiscardVideo = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setRecordedVideoBlob(null);
    setRecordingDuration(0);
  };

  // Duration timer during recording
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate anonymous signer ID
  const handleGenerateSignerId = () => {
    setSignerId(`signer_${Math.random().toString(36).substring(2, 6)}`);
  };

  // Save captured media to backend
  const handleSaveMedia = async () => {
    if (!consentConfirmed) {
      addToast({
        type: 'warning',
        title: 'Consent Required',
        message: 'Please confirm participant consent before saving this sample to the corpus.',
      });
      return;
    }

    if (!signLabel.trim()) {
      addToast({
        type: 'warning',
        title: 'Label Required',
        message: 'Please select or provide a sign gesture label.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();

      if (captureMode === 'image') {
        if (!capturedImageBlob) throw new Error('No captured image frame available to save.');
        formData.append('file', capturedImageBlob, `${signLabel.toLowerCase()}_still.png`);
        formData.append('media_type', 'image');
      } else {
        if (!recordedVideoBlob) throw new Error('No recorded video available to save.');
        formData.append('file', recordedVideoBlob, `${signLabel.toLowerCase()}_clip.webm`);
        formData.append('media_type', 'video');
      }

      formData.append('sign_language', signLanguage);
      formData.append('sign_label', signLabel);
      formData.append('description', description);
      formData.append('signer_id', signerId);
      formData.append('consent_confirmed', 'true');
      formData.append('split', split);

      const record = await api.uploadMedia(formData);

      addToast({
        type: 'success',
        title: 'Sample Saved to Corpus',
        message: `Successfully stored ${captureMode} for "${record.sign_label}" (${Math.round(record.file_size_bytes / 1024)} KB).`,
      });

      // Clear preview
      if (captureMode === 'image') {
        setCapturedImage(null);
        setCapturedImageBlob(null);
      } else {
        if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
        setRecordedVideoBlob(null);
      }

      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Failed to save media to backend storage',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Create new class inline
  const handleCreateNewClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    const created = await addClass(newClassName, newClassCategory);
    if (created) {
      setSignLabel(created.name);
      setIsNewClassModalOpen(false);
      setNewClassName('');
    }
  };

  const hasPreview = captureMode === 'image' ? Boolean(capturedImage) : Boolean(recordedVideoUrl);

  return (
    <div className="space-y-6">
      {/* Scientific Purpose Notice */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-800">
            Sign Language Data Acquisition & Corpus Collection
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500">
            This module captures still-frame images and video sequences for research corpus construction.
            Camera capture alone records visual media and joint topology; it does not perform sign-language translation.
          </p>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewport / Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            compact
            header={
              <div className="flex items-center justify-between w-full">
                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isRecording) {
                        setCaptureMode('image');
                        handleRetakeImage();
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition-colors ${
                      captureMode === 'image'
                        ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isRecording) {
                        setCaptureMode('video');
                        handleDiscardVideo();
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium transition-colors ${
                      captureMode === 'video'
                        ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Record Video</span>
                  </button>
                </div>

                {/* Camera Hardware Controls */}
                <div className="flex items-center gap-2">
                  {videoDevices.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleFacingMode}
                      disabled={hasPreview}
                      title={`Switch to ${facingMode === 'user' ? 'rear' : 'front'} camera`}
                      leftIcon={<SwitchCamera className="w-3.5 h-3.5" />}
                    >
                      <span className="hidden sm:inline capitalize">{facingMode}</span>
                    </Button>
                  )}

                  {!hasPreview && (
                    <Button
                      variant={isCameraActive ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={isCameraActive ? stopCameraTracks : startCamera}
                      isLoading={isRequestingCamera}
                      leftIcon={<Camera className="w-3.5 h-3.5" />}
                    >
                      {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                    </Button>
                  )}
                </div>
              </div>
            }
          >
            {/* Viewport Box */}
            <div className="relative w-full aspect-4/3 bg-slate-950 rounded-md overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* State 1: Image Captured Preview */}
              {captureMode === 'image' && capturedImage && (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  <img
                    src={capturedImage}
                    alt="Captured sign language frame"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 text-white text-[11px] font-mono px-2 py-0.5 rounded">
                    STILL FRAME PREVIEW
                  </div>
                </div>
              )}

              {/* State 2: Video Recorded Preview */}
              {captureMode === 'video' && recordedVideoUrl && (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  <video
                    src={recordedVideoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 text-white text-[11px] font-mono px-2 py-0.5 rounded">
                    RECORDED VIDEO PREVIEW ({formatDuration(recordingDuration)})
                  </div>
                </div>
              )}

              {/* State 3: Live Video Stream */}
              {!hasPreview && (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transform ${
                      facingMode === 'user' ? '-scale-x-100' : ''
                    } ${isCameraActive ? 'block' : 'hidden'}`}
                  />

                  {/* Calibration Alignment Crosshair */}
                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-56 border border-dashed border-indigo-400/40 rounded-lg flex items-center justify-center">
                        <span className="text-[10px] font-mono text-indigo-300/60 uppercase">
                          Position Hand in Frame
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Camera Not Active or Error Placeholder */}
                  {!isCameraActive && !isRequestingCamera && (
                    <div className="text-center p-6 text-slate-400 space-y-2">
                      <Camera className="w-10 h-10 mx-auto text-slate-600 mb-1" />
                      <div className="text-xs font-medium text-slate-300">Camera Feed Inactive</div>
                      <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                        Camera access requires explicit permission. Click Start Camera to initialize the live preview.
                      </p>
                      <Button variant="primary" size="sm" onClick={startCamera} className="mt-2">
                        Start Camera
                      </Button>
                    </div>
                  )}

                  {/* Live Status Overlay */}
                  {isCameraActive && (
                    <div className="absolute bottom-3 left-3 z-10">
                      <StatusIndicator
                        status={isRecording ? 'recording' : 'operational'}
                        label={
                          isRecording
                            ? `Recording: ${formatDuration(recordingDuration)}`
                            : 'Live Preview Active'
                        }
                        pulse={isRecording}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Camera Error Message */}
            {cameraError && (
              <div className="mt-3 p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Camera Access Issue</span>
                  <span className="text-[11px] text-rose-700">{cameraError}</span>
                </div>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              {/* If preview exists (either still or recorded video) */}
              {hasPreview ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={captureMode === 'image' ? handleRetakeImage : handleDiscardVideo}
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    {captureMode === 'image' ? 'Retake Frame' : 'Discard & Re-record'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveMedia}
                    isLoading={isSaving}
                    disabled={!consentConfirmed}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                  >
                    Save to Research Corpus
                  </Button>
                </div>
              ) : (
                /* Live Feed Controls */
                <div className="flex items-center gap-2">
                  {captureMode === 'image' ? (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleCaptureImage}
                      disabled={!isCameraActive}
                      leftIcon={<Disc className="w-4 h-4 text-white" />}
                    >
                      Capture Still Frame
                    </Button>
                  ) : (
                    <>
                      {!isRecording ? (
                        <Button
                          variant="primary"
                          size="md"
                          onClick={handleStartRecording}
                          disabled={!isCameraActive}
                          leftIcon={<Play className="w-3.5 h-3.5 text-white" />}
                        >
                          Start Recording
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="md"
                          onClick={handleStopRecording}
                          leftIcon={<Square className="w-3.5 h-3.5 text-white" />}
                        >
                          Stop Recording ({formatDuration(recordingDuration)})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Hardware Device Selector */}
              {videoDevices.length > 1 && !hasPreview && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Device:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="rounded border border-slate-300 text-xs px-2 py-1 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 max-w-[180px] truncate"
                  >
                    {videoDevices.map((d, idx) => (
                      <option key={d.deviceId || idx} value={d.deviceId}>
                        {d.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Card>

          {/* Privacy & Destination Disclosure */}
          <Card compact>
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-slate-800 block">Privacy & Data Governance Notice</span>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Camera streams are processed entirely on your machine. When you explicitly save a capture,
                  the media is uploaded directly to your self-hosted SignBridge dataset storage on{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">
                    http://127.0.0.1:8000/media/
                  </code>
                  . Captured recordings are never transmitted to third-party cloud services or external APIs.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Metadata & Annotation Attributes (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="Corpus Metadata & Attributes" subtitle="Required fields before saving sample">
            <div className="space-y-4 text-xs">
              {/* Target Sign Language */}
              <Select
                label="Target Sign Language System"
                value={signLanguage}
                onChange={(e) => setSignLanguage(e.target.value)}
                options={[
                  { value: 'ASL', label: 'ASL — American Sign Language' },
                  { value: 'BSL', label: 'BSL — British Sign Language' },
                  { value: 'ISL', label: 'ISL — Indian Sign Language' },
                  { value: 'Auslan', label: 'Auslan — Australian Sign Language' },
                  { value: 'LSF', label: 'LSF — French Sign Language' },
                  { value: 'General', label: 'General / Universal Gesture' },
                ]}
              />

              {/* Sign Label */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Sign Gesture Label</label>
                  <button
                    type="button"
                    onClick={() => setIsNewClassModalOpen(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    New Label
                  </button>
                </div>
                <select
                  value={signLabel}
                  onChange={(e) => setSignLabel(e.target.value)}
                  className="w-full rounded-md border border-slate-300 text-sm px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name} ({cls.sample_count} current)
                    </option>
                  ))}
                </select>
              </div>

              {/* Dataset Partition */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Dataset Partition</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md border border-slate-200 text-xs">
                  {(['train', 'val', 'test'] as const).map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setSplit(sp)}
                      className={`py-1 rounded font-medium transition-colors uppercase text-[11px] ${
                        split === sp
                          ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {sp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anonymous Signer Identifier */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Anonymous Signer ID</label>
                  <button
                    type="button"
                    onClick={handleGenerateSignerId}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 font-mono flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </button>
                </div>
                <Input
                  value={signerId}
                  onChange={(e) => setSignerId(e.target.value)}
                  placeholder="e.g. signer_01"
                  helperText="Privacy-preserving anonymous identifier. Never enter real names or personal data."
                />
              </div>

              {/* Optional Description */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Execution Cue & Description (Optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-slate-300 text-xs p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="e.g., Dominant right hand, single fluid motion from chin"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Consent Confirmation */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(e) => setConsentConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-[11px] text-slate-700 leading-relaxed">
                    <strong className="block text-slate-900 font-semibold">Consent Confirmation</strong>
                    I confirm participant consent for this sign language media to be cataloged in the
                    SignBridge research corpus.
                  </div>
                </label>
              </div>

              {/* Save Button (repeated on right for accessibility) */}
              {hasPreview && (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={handleSaveMedia}
                  isLoading={isSaving}
                  disabled={!consentConfirmed}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  Save {captureMode === 'image' ? 'Still Image' : 'Video Clip'} to Corpus
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* New Sign Class Modal */}
      <Modal
        isOpen={isNewClassModalOpen}
        onClose={() => setIsNewClassModalOpen(false)}
        title="Register Sign Gesture Label"
        subtitle="Add a new vocabulary category to the corpus"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsNewClassModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateNewClass}>
              Register Class
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateNewClass} className="space-y-3">
          <Input
            label="Sign Label Name"
            placeholder="e.g., Thank You, Help, Family"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            required
            autoFocus
          />

          <Select
            label="Category"
            value={newClassCategory}
            onChange={(e) => setNewClassCategory(e.target.value)}
            options={[
              { value: 'Greetings', label: 'Greetings' },
              { value: 'Responses', label: 'Responses' },
              { value: 'Conversational', label: 'Conversational' },
              { value: 'Emergency', label: 'Emergency' },
              { value: 'Alphabet', label: 'Alphabet / Spelling' },
              { value: 'General', label: 'General' },
            ]}
          />
        </form>
      </Modal>
    </div>
  );
};
