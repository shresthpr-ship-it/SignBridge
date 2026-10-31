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
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatusIndicator } from '../ui/StatusIndicator';
import { api } from '../../services/api';
import {
  LiveFrameRecognitionResponse,
  ModelStatus,
  RecognitionHistoryRecord,
} from '../../types';
import { drawFullFrameLandmarks } from '../../utils/handRenderer';

export const RecognitionView: React.FC = () => {
  // Camera & Stream states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Recognition loop states
  const [isRecognitionRunning, setIsRecognitionRunning] = useState<boolean>(true);
  const [processingFps, setProcessingFps] = useState<number>(5);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [showPoseLayer, setShowPoseLayer] = useState<boolean>(true);
  const [showFaceLayer, setShowFaceLayer] = useState<boolean>(false);

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
        throw new Error('MediaDevices API is not available in this browser environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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
        msg = 'Camera access was denied. Please allow camera permissions in your browser address bar.';
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

  // Live frame capture and evaluation tick
  const captureAndEvaluateFrame = useCallback(async () => {
    if (!isCameraActive || !isRecognitionRunning || isEvaluatingRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused || video.ended) return;

    isEvaluatingRef.current = true;

    try {
      // Offscreen canvas to capture current video frame
      const offscreen = document.createElement('canvas');
      offscreen.width = 480;
      offscreen.height = 360;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);

      // Convert to compact JPEG Blob
      const blob: Blob | null = await new Promise((resolve) =>
        offscreen.toBlob(resolve, 'image/jpeg', 0.8)
      );

      if (!blob) return;

      // Send to backend pipeline
      const res = await api.recognizeLiveFrame(blob, 3);
      setLiveResult(res);

      if (res.model_status) {
        setModelStatus(res.model_status);
      }

      // Add to history if recognition is active and valid
      if (res.predicted_sign && res.prediction_state !== 'unknown') {
        setHistory((prev) => [
          {
            sign: res.predicted_sign!,
            confidence: res.confidence_score,
            state: res.prediction_state as 'stable' | 'provisional',
            stability_score: res.stability_score,
            latency_ms: res.latency_ms,
            time: new Date().toLocaleTimeString(),
            handedness: res.hands?.[0]?.handedness || null,
          },
          ...prev.slice(0, 19),
        ]);
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
  }, [isCameraActive, isRecognitionRunning]);

  // Periodic interval loop
  useEffect(() => {
    if (!isCameraActive || !isRecognitionRunning) return;
    const intervalMs = Math.round(1000 / processingFps);
    const intervalId = setInterval(captureAndEvaluateFrame, intervalMs);
    return () => clearInterval(intervalId);
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

                  {/* Right Controls: Device Selection */}
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

                  {/* Rate Limiter to avoid overload */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span>Frame Sampling Rate:</span>
                    <select
                      value={processingFps}
                      onChange={(e) => setProcessingFps(Number(e.target.value))}
                      className="text-xs rounded border border-slate-300 bg-white px-1.5 py-0.5 text-slate-800 font-mono"
                    >
                      <option value={3}>3 FPS (Low CPU)</option>
                      <option value={5}>5 FPS (Balanced)</option>
                      <option value={8}>8 FPS (Fast)</option>
                      <option value={10}>10 FPS (High Rate)</option>
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
              <button
                type="button"
                onClick={handleResetSession}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                title="Reset temporal smoothing window"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            }
          >
            <div className="p-4 bg-slate-900 rounded-md border border-slate-800 text-center space-y-3">
              {/* Primary Sign / State Wordmark */}
              {liveResult && liveResult.predicted_sign && liveResult.prediction_state !== 'unknown' ? (
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                    Recognized Sign / Phrase
                  </span>
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {liveResult.predicted_sign}
                  </div>

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
                  {liveResult.alternatives.map((alt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50 border border-slate-200"
                    >
                      <span className="font-mono text-slate-800 font-medium">
                        #{idx + 1} {alt.label}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {alt.confidence.toFixed(1)}% match
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  No alternative candidate scores available for this frame.
                </p>
              )}
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
    </div>
  );
};
