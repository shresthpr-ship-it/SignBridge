import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Play,
  Square,
  AlertCircle,
  Layers,
  Activity,
  Clock,
  Info,
  HelpCircle,
  RotateCcw,
  GraduationCap,
  Sparkles,
  CheckCircle,
  SwitchCamera,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusIndicator } from '../ui/StatusIndicator';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  LiveFrameRecognitionResponse,
  ModelStatus,
  RecognitionHistoryRecord,
} from '../../types';
import { drawFullFrameLandmarks } from '../../utils/handRenderer';
import { useCameraPermissions } from '../../hooks/useCameraPermissions';
import { CameraPermissionGuardian } from '../camera/CameraPermissionGuardian';
import { SpeechService, SpeechAudioMode } from '../../utils/speech';
import { getISLTranslation, ISL_TRANSLATIONS, ISLTranslation } from '../../utils/islDictionary';

export const RecognitionView: React.FC = () => {
  const { selectedLanguage, addToast, refreshData } = useApp();

  // Camera & Stream states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Permission Guardian for cross-device support (HTTPS & Permissions API)
  const cameraPermission = useCameraPermissions();

  // Interactive Teaching / Retraining States
  const [teachLabel, setTeachLabel] = useState<string>('Eat');
  const [teachLanguage, setTeachLanguage] = useState<string>(selectedLanguage || 'ISL');
  const [isTeaching, setIsTeaching] = useState<boolean>(false);
  const [teachSuccessMsg, setTeachSuccessMsg] = useState<string | null>(null);

  // Sync with global language selector
  useEffect(() => {
    if (selectedLanguage) {
      setTeachLanguage(selectedLanguage);
    }
  }, [selectedLanguage]);

  // Recognition loop states
  const [isRecognitionRunning, setIsRecognitionRunning] = useState<boolean>(true);
  const [processingFps, setProcessingFps] = useState<number>(12);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [showPoseLayer, setShowPoseLayer] = useState<boolean>(false);
  const [showFaceLayer, setShowFaceLayer] = useState<boolean>(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const [speechMode, setSpeechMode] = useState<SpeechAudioMode>('hindi');

  // Model & Recognition results
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [liveResult, setLiveResult] = useState<LiveFrameRecognitionResponse | null>(null);
  const [history, setHistory] = useState<RecognitionHistoryRecord[]>([]);

  // Diagnostics
  const [fpsMetric, setFpsMetric] = useState<number>(0);
  const fpsCounterRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());

  // References
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isEvaluatingRef = useRef<boolean>(false);

  // Load Model Status & History on mount
  useEffect(() => {
    api.getRecognitionModelStatus().then(setModelStatus).catch(() => {});
    api.getPredictionHistory().then(setHistory).catch(() => {});
  }, []);

  // Enumerate video devices
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

  // Clean up camera on unmount or navigation
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    setIsRequestingCamera(true);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!cameraPermission.isSecureContext) {
          throw new Error('Insecure HTTP context. Mobile & remote devices block camera on plain HTTP. Please switch to HTTPS.');
        }
        throw new Error('MediaDevices API is not available in this browser environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
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
      console.error('Camera initialization failed:', err);
      let msg = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera access was denied. Please tap the lock/info icon in your browser address bar to allow camera access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No video capture hardware / webcam found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently locked by another application or background process.';
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
    } finally {
      setIsRequestingCamera(false);
    }
  };

  // Toggle front/rear camera (useful on phones/tablets)
  const handleToggleFacingMode = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (isCameraActive) {
      stopCamera();
      setTimeout(() => startCamera(), 150);
    }
  };

  // High-performance live frame capture and evaluation tick
  const captureAndEvaluateFrame = useCallback(async () => {
    if (!isCameraActive || !isRecognitionRunning || isEvaluatingRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused || video.ended) return;

    isEvaluatingRef.current = true;

    try {
      // Re-use single persistent offscreen canvas for zero GC allocation lag
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
        offscreenCanvasRef.current.width = 320;
        offscreenCanvasRef.current.height = 240;
      }
      const offscreen = offscreenCanvasRef.current;
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.drawImage(video, 0, 0, 320, 240);

      // Convert to lightweight JPEG Blob (fast network transfer)
      const blob: Blob | null = await new Promise((resolve) =>
        offscreen.toBlob(resolve, 'image/jpeg', 0.55)
      );

      if (!blob) return;

      // Send to backend high-speed pipeline (pose and face only when enabled)
      const res = await api.recognizeLiveFrame(blob, 3, showPoseLayer, showFaceLayer);
      setLiveResult(res);

      if (res.model_status) {
        setModelStatus(res.model_status);
      }

      // Add to history and pronounce with Speech Synthesis if recognition is active and valid
      if (res.predicted_sign && res.prediction_state !== 'unknown') {
        const signText = res.predicted_sign;

        // Auto-Speak if enabled and confirmed (pronounces English + Hindi based on speechMode)
        if (autoSpeak && (res.prediction_state === 'stable' || (res.confidence_score || 0) >= 88)) {
          SpeechService.speakSign(signText, speechMode, false);
        }

        setHistory((prev) => {
          if (prev.length > 0 && prev[0].sign === signText) {
            return prev;
          }
          return [
            {
              sign: signText,
              confidence: res.confidence_score,
              state: res.prediction_state as 'stable' | 'provisional',
              stability_score: res.stability_score,
              latency_ms: res.latency_ms,
              time: new Date().toLocaleTimeString(),
              handedness: res.hands?.[0]?.handedness || null,
            },
            ...prev.slice(0, 19),
          ];
        });
      }

      // Update FPS calculation
      fpsCounterRef.current += 1;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setFpsMetric(Math.round((fpsCounterRef.current * 1000) / (now - lastFpsTimeRef.current)));
        fpsCounterRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    } catch (err) {
      console.warn('Live recognition frame error:', err);
    } finally {
      isEvaluatingRef.current = false;
    }
  }, [isCameraActive, isRecognitionRunning, showPoseLayer, showFaceLayer, autoSpeak, speechMode]);

  // Non-blocking adaptive loop (waits for frame completion to eliminate lag & queue build-up)
  useEffect(() => {
    if (!isCameraActive || !isRecognitionRunning) return;
    let isMounted = true;
    let timerId: any = null;

    const loop = async () => {
      if (!isMounted) return;
      await captureAndEvaluateFrame();
      if (!isMounted) return;
      const intervalMs = Math.max(30, Math.round(1000 / processingFps));
      timerId = setTimeout(loop, intervalMs);
    };

    loop();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isCameraActive, isRecognitionRunning, processingFps, captureAndEvaluateFrame]);

  // Render canvas overlay on top of video feed
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!showOverlay || !liveResult) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Build mock FrameLandmarks structure for renderer
    const frameData = {
      frame_index: 0,
      timestamp_ms: 0,
      detection_status: liveResult.landmark_detection_status,
      hands: liveResult.hands || [],
      pose: liveResult.pose || null,
      face: liveResult.face || null,
      missing_elements: liveResult.missing_elements || [],
    };

    drawFullFrameLandmarks(ctx, frameData, canvas.width, canvas.height, {
      showHands: true,
      showPose: showPoseLayer,
      showFace: showFaceLayer,
    });
  }, [liveResult, showOverlay, showPoseLayer, showFaceLayer]);

  // Interactive Teaching Action: Learn the gesture from current webcam frame
  const handleTeachGesture = async (customLabel?: string) => {
    const labelToTeach = (customLabel || teachLabel).trim();
    if (!labelToTeach) {
      addToast({
        type: 'warning',
        title: 'Sign Label Required',
        message: 'Please specify or select a sign label name (e.g. "Okay").',
      });
      return;
    }

    if (!videoRef.current || !isCameraActive) {
      addToast({
        type: 'warning',
        title: 'Camera Offline',
        message: 'Please start the camera and display your hand gesture to teach.',
      });
      return;
    }

    setIsTeaching(true);
    setTeachSuccessMsg(null);

    try {
      const video = videoRef.current;
      const offscreen = document.createElement('canvas');
      offscreen.width = video.videoWidth || 640;
      offscreen.height = video.videoHeight || 480;
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('Canvas rendering context not available');

      ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);

      const blob: Blob | null = await new Promise((resolve) =>
        offscreen.toBlob(resolve, 'image/jpeg', 0.9)
      );

      if (!blob) throw new Error('Failed to encode camera frame');

      const res = await api.teachFromFrame(blob, labelToTeach, teachLanguage);

      const msg = `Learned "${labelToTeach}" (${teachLanguage})! Model retrained with ${res.samples_added} new samples.`;
      setTeachSuccessMsg(msg);
      addToast({
        type: 'success',
        title: 'Gesture Taught Successfully',
        message: `Model updated with "${labelToTeach}". You can now hold up your hand to see it recognized!`,
      });

      // Update model status
      const updatedModelStatus = await api.getRecognitionModelStatus();
      setModelStatus(updatedModelStatus);
      await refreshData();
    } catch (err: any) {
      console.error('Teach gesture error:', err);
      addToast({
        type: 'error',
        title: 'Teaching Failed',
        message: err.message || 'Could not extract hand landmarks. Ensure hand is clearly in view.',
      });
    } finally {
      setIsTeaching(false);
    }
  };

  // Reset session
  const handleResetSession = async () => {
    try {
      await api.resetRecognitionSession();
      setHistory([]);
      setLiveResult(null);
    } catch (err) {
      console.warn('Failed to reset session:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Status Header */}
      <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Live Video & Sign Recognition Studio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time webcam stream capturing 3D movement landmarks and evaluating sign recognition models.
          </p>
        </div>

        {/* Global Pipeline Tier Pill */}
        <div className="flex items-center gap-2">
          <Badge variant="indigo" size="sm">
            Landmark Detection: Active
          </Badge>
          <Badge variant={modelStatus?.is_model_configured ? 'green' : 'slate'} size="sm">
            {modelStatus?.is_model_configured ? 'Pretrained Model: Active' : 'Model: Prototype Centroid Matcher'}
          </Badge>
        </div>
      </div>

      {/* Camera Permission & Network Security Guardian */}
      <CameraPermissionGuardian
        permission={cameraPermission}
        onPermissionGranted={startCamera}
      />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Live Camera Feed & Stream Controls (7 cols)       */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            compact
            title="Live Camera Feed & Landmark Topology"
            actions={
              <StatusIndicator
                status={
                  isCameraActive
                    ? isRecognitionRunning
                      ? 'processing'
                      : 'idle'
                    : 'idle'
                }
                label={
                  isCameraActive
                    ? isRecognitionRunning
                      ? `Inference Active (~${fpsMetric} FPS)`
                      : 'Camera On (Inference Paused)'
                    : 'Camera Off'
                }
                pulse={isCameraActive && isRecognitionRunning}
              />
            }
          >
            <div className="space-y-3">
              {/* Camera Viewport with Stacked Video and Overlay Canvas */}
              <div className="relative w-full aspect-4/3 bg-slate-950 rounded-md overflow-hidden border border-slate-800 flex items-center justify-center">
                {/* Subtle Grid */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />

                {/* Real-time HTML5 Video from Webcam */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${
                    !isCameraActive ? 'hidden' : 'block'
                  }`}
                />

                {/* Canvas Overlay for MediaPipe Landmarks */}
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none transform -scale-x-100 ${
                    !isCameraActive ? 'hidden' : 'block'
                  }`}
                />

                {/* Standby / Off State */}
                {!isCameraActive && (
                  <div className="relative z-20 text-center p-6 space-y-3 max-w-sm">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Camera Feed Inactive</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Click &ldquo;Start Camera&rdquo; below to stream your webcam into the computer vision pipeline.
                      </p>
                    </div>
                    <Button
                      onClick={startCamera}
                      disabled={isRequestingCamera}
                      size="sm"
                      leftIcon={<Camera className="w-3.5 h-3.5" />}
                      className="mx-auto"
                    >
                      {isRequestingCamera ? 'Requesting Permission...' : 'Start Camera'}
                    </Button>
                  </div>
                )}

                {/* Camera In-Viewport Badges */}
                {isCameraActive && (
                  <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-900/85 border border-slate-700 text-[10px] font-mono text-slate-300">
                      Live Video Stream
                    </span>
                    {liveResult && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          liveResult.hand_detected
                            ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                            : 'bg-slate-900/85 border-slate-700 text-slate-400'
                        }`}
                      >
                        {liveResult.hand_detected
                          ? `Hand Detected (${liveResult.hands?.[0]?.handedness || 'Active'})`
                          : 'No Hand in View'}
                      </span>
                    )}
                  </div>
                )}

                {/* Processing Latency Badge */}
                {isCameraActive && liveResult && (
                  <div className="absolute top-3 right-3 z-20">
                    <span className="px-2 py-0.5 rounded bg-slate-900/85 border border-slate-700 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {liveResult.latency_ms.toFixed(0)} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block">Camera Access Error</strong>
                    <span>{cameraError}</span>
                  </div>
                </div>
              )}

              {/* Stream & Inference Controls Bar */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Left Controls: Start/Stop Camera & Start/Stop Recognition */}
                  <div className="flex items-center gap-2">
                    {!isCameraActive ? (
                      <Button
                        onClick={startCamera}
                        disabled={isRequestingCamera}
                        size="sm"
                        leftIcon={<Camera className="w-3.5 h-3.5" />}
                      >
                        {isRequestingCamera ? 'Connecting...' : 'Start Camera'}
                      </Button>
                    ) : (
                      <Button
                        onClick={stopCamera}
                        variant="outline"
                        size="sm"
                        className="text-rose-700 border-rose-200 hover:bg-rose-50"
                        leftIcon={<Square className="w-3.5 h-3.5 text-rose-600" />}
                      >
                        Stop Camera
                      </Button>
                    )}

                    {isCameraActive && (
                      <Button
                        variant={isRecognitionRunning ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => setIsRecognitionRunning(!isRecognitionRunning)}
                        leftIcon={
                          isRecognitionRunning ? (
                            <Square className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        {isRecognitionRunning ? 'Pause Recognition' : 'Resume Recognition'}
                      </Button>
                    )}
                  </div>

                  {/* Right Controls: Device Selection & Mobile Camera Flip */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleFacingMode}
                      title={`Switch to ${facingMode === 'user' ? 'rear' : 'front'} camera`}
                      leftIcon={<SwitchCamera className="w-3.5 h-3.5" />}
                    >
                      <span className="capitalize text-xs">{facingMode} Camera</span>
                    </Button>

                    {videoDevices.length > 1 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[11px] text-slate-500 font-medium">Device:</span>
                        <select
                          value={selectedDeviceId}
                          onChange={(e) => {
                            setSelectedDeviceId(e.target.value);
                            if (isCameraActive) {
                              setTimeout(startCamera, 50);
                            }
                          }}
                          className="text-xs rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
                        >
                          {videoDevices.map((d, i) => (
                            <option key={d.deviceId || i} value={d.deviceId}>
                              {d.label || `Camera ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-controls: Overlay Toggles & FPS Limiter */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Landmark Overlay Toggles */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Overlay:
                    </span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={showOverlay}
                        onChange={(e) => setShowOverlay(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                      />
                      Hands
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={showPoseLayer}
                        onChange={(e) => setShowPoseLayer(e.target.checked)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-0"
                      />
                      Pose
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={showFaceLayer}
                        onChange={(e) => setShowFaceLayer(e.target.checked)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-0"
                      />
                      Face
                    </label>
                  </div>

                  {/* Rate Limiter for smoothness & CPU balance */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span>Frame Sampling Rate:</span>
                    <select
                      value={processingFps}
                      onChange={(e) => setProcessingFps(Number(e.target.value))}
                      className="text-xs rounded border border-slate-300 bg-white px-1.5 py-0.5 text-slate-800 font-mono"
                    >
                      <option value={8}>8 FPS (Lightweight)</option>
                      <option value={12}>12 FPS (Balanced Realtime)</option>
                      <option value={15}>15 FPS (Smooth 60Hz)</option>
                      <option value={20}>20 FPS (Ultra-Responsive)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Transparent Architectural Limitation Callout */}
          <Card compact>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Distinction: Landmark Detection vs. Translation</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                The visual skeleton represents <strong>3D landmark detection</strong> via MediaPipe Tasks. True sign-language translation requires temporal movement sequencing across frames, facial non-manual markers, spatial grammar, and a trained sequence model. Isolated prototype matching provides baseline static recognition; continuous translation requires a dedicated sequence model.
              </p>
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Sign Recognition & Model Evaluation (5 cols)    */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 space-y-4">
          {/* Current Recognized Sign Display */}
          <Card
            compact
            title="Recognition Output"
            actions={
              <div className="flex items-center gap-1.5">
                {/* Speech Audio Mode (Bilingual English + Hindi, Hindi, or English) */}
                <select
                  value={speechMode}
                  onChange={(e) => setSpeechMode(e.target.value as SpeechAudioMode)}
                  className="text-[10px] font-semibold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none cursor-pointer"
                  title="Speech Audio Language (ISL Mode)"
                >
                  <option value="hindi">Audio: ISL / Hindi (Namaste, Khaana...)</option>
                  <option value="bilingual">Audio: Bilingual (Hello + Namaste)</option>
                  <option value="english">Audio: English Only (Hello, Eat...)</option>
                </select>

                {/* Auto-Speech Toggle */}
                <button
                  type="button"
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 transition-colors ${
                    autoSpeak
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-slate-100 border-slate-300 text-slate-500'
                  }`}
                  title={autoSpeak ? 'Auto-Speech is Enabled' : 'Auto-Speech is Muted'}
                >
                  {autoSpeak ? <Volume2 className="w-3 h-3 text-indigo-600" /> : <VolumeX className="w-3 h-3" />}
                  <span>Auto-Speak</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetSession}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  title="Reset temporal smoothing window"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            }
          >
            <div className="p-4 bg-slate-900 rounded-md border border-slate-800 text-center space-y-3">
              {/* Primary Sign / State Wordmark */}
              {liveResult && liveResult.predicted_sign && liveResult.prediction_state !== 'unknown' ? (
                (() => {
                  const isl = getISLTranslation(liveResult.predicted_sign);

                  return (
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                        Recognized Sign / Phrase
                      </span>

                      <div className="flex items-center justify-center gap-3">
                        <div className="text-3xl font-extrabold text-white tracking-tight">
                          {liveResult.predicted_sign}
                        </div>

                        {/* Pronounce / Speak Button in ISL / Hindi or English */}
                        <button
                          type="button"
                          onClick={() => SpeechService.speakSign(liveResult.predicted_sign!, speechMode, true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-indigo-900/60 transition-all cursor-pointer"
                          title={`Pronounce sign in ${speechMode === 'bilingual' ? 'English & Hindi' : speechMode === 'hindi' ? 'ISL / Hindi' : 'English'}`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>
                            {speechMode === 'hindi' && isl ? `Speak "${isl.spokenPhonetic}"` : speechMode === 'bilingual' ? 'Speak (EN + HI)' : 'Speak'}
                          </span>
                        </button>
                      </div>

                      {isl && (
                        <div className="text-xs font-medium text-amber-300/90 mt-1">
                          ISL: <span className="font-bold text-amber-200">"{isl.spokenPhonetic}"</span> ({isl.hindi})
                        </div>
                      )}

                      {/* Stability & Confidence Badge */}
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                            liveResult.prediction_state === 'stable'
                              ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                              : 'bg-amber-950 border-amber-700 text-amber-400'
                          }`}
                        >
                          {liveResult.prediction_state === 'stable' ? 'Stable Detection' : 'Provisional (Stabilizing)'}
                        </span>

                        {liveResult.confidence_score !== null && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                            {liveResult.confidence_score.toFixed(1)}% model match
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="py-2">
                  <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">
                    {!isCameraActive
                      ? 'Camera Feed Offline'
                      : !liveResult?.hand_detected
                      ? 'No Hand Detected in Camera Frame'
                      : 'Unknown / Ambiguous Sign Posture'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    {!isCameraActive
                      ? 'Start the camera on the left panel to begin streaming.'
                      : !liveResult?.hand_detected
                      ? 'Position your hand clearly within the camera boundary.'
                      : liveResult?.recognition_message || 'Movement/posture is below confident recognition threshold.'}
                  </p>
                </div>
              )}
            </div>

            {/* Candidates & Explanatory Reasoning */}
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 block">
                Model Evaluation & Candidates
              </span>

              {liveResult && liveResult.alternatives && liveResult.alternatives.length > 0 ? (
                <div className="space-y-1">
                  {liveResult.alternatives.map((alt, idx) => {
                    const altIsl = getISLTranslation(alt.label);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50 border border-slate-200"
                      >
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          <span className="text-slate-400 font-mono">#{idx + 1}</span>
                          <span>{alt.label}</span>
                          {altIsl && (
                            <span className="text-[11px] text-slate-500 font-normal">
                              ({altIsl.hindi})
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {alt.confidence.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  No alternative candidate scores available for this frame.
                </p>
              )}
            </div>
          </Card>

          {/* Interactive Teach & Instant Retraining Card */}
          <Card
            compact
            title="Teach This Sign / Correct Gesture"
            className="border-indigo-200 bg-indigo-50/20"
          >
            <div className="space-y-3 text-xs">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                If the model translates a gesture incorrectly (or you want to teach a new gesture like <strong>"Okay"</strong>), show the gesture to the camera, type or select its name below, and click <strong>Teach & Update Model</strong>.
              </p>

              {/* Hand Detection Readiness Status */}
              <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                <span className="text-[11px] text-slate-600 font-medium">Hand Sensor Status:</span>
                <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                  liveResult?.hand_detected ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    liveResult?.hand_detected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`} />
                  {liveResult?.hand_detected ? 'Hand In View (21 landmarks ready)' : 'Show Hand to Camera'}
                </span>
              </div>

              {/* Quick Preset Gesture Chips */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  त्वरित संकेत चुनें (Quick Select Sign):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Eat', display: 'खाना (Eat)' },
                    { label: 'Drink', display: 'पीना (Drink)' },
                    { label: 'What', display: 'क्या (What)' },
                    { label: 'Where', display: 'कहाँ (Where)' },
                    { label: 'Why', display: 'क्यों (Why)' },
                    { label: 'Who', display: 'कौन (Who)' },
                    { label: 'Which', display: 'कौनसा (Which)' },
                    { label: 'Say', display: 'बोलना (Say)' },
                    { label: 'Okay', display: 'ठीक है (Okay)' },
                    { label: 'Hello', display: 'नमस्ते (Hello)' },
                    { label: 'Thank You', display: 'धन्यवाद (Thanks)' },
                    { label: 'Yes', display: 'हाँ (Yes)' },
                    { label: 'No', display: 'नहीं (No)' },
                    { label: 'Peace', display: 'शांति (Peace)' },
                    { label: 'Help', display: 'मदद (Help)' },
                    { label: 'I Love You', display: 'प्यार (Love)' },
                    { label: 'Fist', display: 'मुट्ठी (Fist)' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTeachLabel(preset.label)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                        teachLabel.toLowerCase() === preset.label.toLowerCase()
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {preset.display}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Sign Name & Language Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Sign Label Name:
                  </label>
                  <input
                    type="text"
                    value={teachLabel}
                    onChange={(e) => setTeachLabel(e.target.value)}
                    placeholder="e.g. Okay, Thumbs Up"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Language:
                  </label>
                  <select
                    value={teachLanguage}
                    onChange={(e) => setTeachLanguage(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ASL">ASL</option>
                    <option value="ISL">ISL (Indian)</option>
                    <option value="BSL">BSL (British)</option>
                    <option value="AUSLAN">AUSLAN</option>
                    <option value="LSF">LSF (French)</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
              </div>

              {/* Success Banner if retrained */}
              {teachSuccessMsg && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[11px] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{teachSuccessMsg}</span>
                </div>
              )}

              {/* Action Button: Teach & Retrain */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTeachGesture()}
                disabled={isTeaching || !isCameraActive || !liveResult?.hand_detected}
                className="w-full"
                leftIcon={
                  isTeaching ? (
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GraduationCap className="w-3.5 h-3.5" />
                  )
                }
              >
                {isTeaching
                  ? 'Capturing & Retraining Model (<1s)...'
                  : `Teach "${teachLabel}" & Update Model`}
              </Button>
            </div>
          </Card>

          {/* Model Availability Status Card */}
          <Card compact title="Model Configuration Status">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Active Inference Engine:</span>
                <span className="font-mono text-slate-800 font-semibold truncate max-w-[200px]">
                  {modelStatus?.model_name || 'Loading status...'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pipeline Tier:</span>
                <Badge
                  variant={
                    modelStatus?.tier === 'pretrained_sequence_model'
                      ? 'green'
                      : modelStatus?.tier === 'isolated_sign_prototype'
                      ? 'indigo'
                      : 'slate'
                  }
                  size="sm"
                >
                  {modelStatus?.tier === 'pretrained_sequence_model'
                    ? 'Sequence Model'
                    : modelStatus?.tier === 'isolated_sign_prototype'
                    ? 'Isolated Sign Prototype'
                    : 'Landmark Detection Only'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pretrained Sequence Model:</span>
                <span className="font-semibold text-amber-700">
                  {modelStatus?.is_model_configured ? 'Configured' : 'Not Loaded / Optional'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Temporal Window Smoothing:</span>
                <span className="font-mono text-slate-700">
                  {modelStatus?.temporal_smoothing_window || 5} frames
                </span>
              </div>

              <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 mt-2">
                <span className="font-medium text-slate-800 block mb-0.5">Integration Contract:</span>
                Third-party models (ONNX/TFLite/PyTorch) can be mounted into <code className="font-mono text-indigo-600">backend/app/models_cv</code>. Until a full sequence model is loaded, the studio honestly reports prototype match scores without inventing translations.
              </div>
            </div>
          </Card>

          {/* Recent Recognition History */}
          <Card
            compact
            title="Recognition History"
            actions={
              history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-[11px] text-slate-400 hover:text-slate-700"
                >
                  Clear
                </button>
              )
            }
          >
            {history.length > 0 ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => SpeechService.speakSign(item.sign, speechMode, true)}
                        className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title={`Pronounce "${item.sign}" out loud`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-semibold text-slate-900">{item.sign}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                          item.state === 'stable'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.state}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                      {item.confidence !== null && <span>{item.confidence.toFixed(0)}%</span>}
                      <span>{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No signs recognized yet. Start the camera and perform a calibrated sign.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PRE-INSTALLED SIGNS VOCABULARY: INDIAN SIGN LANGUAGE (ISL)   */}
      {/* ============================================================ */}
      <Card
        compact
        title="भारतीय सांकेतिक भाषा शब्दकोश (Indian Sign Language - ISL Corpus)"
        actions={
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800 border border-orange-200">
              🇮🇳 ISL / हिन्दी
            </span>
            <Badge variant="green" size="sm">
              20 संकेत सक्रिय
            </Badge>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Pre-calibrated for <strong>Indian Sign Language (ISL)</strong>. Perform any sign below in front of the camera, and SignBridge will recognize it in real-time and pronounce the authentic ISL word (e.g. <em>Namaste</em>, <em>Khaana</em>, <em>Paani</em>, <em>Theek Hai</em>).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.values(ISL_TRANSLATIONS).map((item: ISLTranslation) => (
              <div
                key={item.english}
                className="p-3 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:shadow-xs transition-all space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{item.icon}</span>
                      <span>{item.english}</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {item.category}
                    </span>
                  </div>

                  <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                    ISL: <span className="font-bold text-amber-900">"{item.spokenPhonetic}"</span> <span className="font-normal text-slate-400">({item.hindi})</span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                    {item.islDescription}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => SpeechService.speakSign(item.english, 'hindi', true)}
                    className="flex-1 py-1 rounded bg-orange-50 hover:bg-orange-100 text-orange-800 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title={`Pronounce "${item.spokenPhonetic}" out loud`}
                  >
                    <Volume2 className="w-3.5 h-3.5 text-orange-600" />
                    <span>Say "{item.spokenPhonetic}"</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeachLabel(item.english)}
                    className="py-1 px-2.5 rounded border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-slate-900 text-[11px] font-medium cursor-pointer"
                    title={`Select "${item.english}" for teaching / retraining`}
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
