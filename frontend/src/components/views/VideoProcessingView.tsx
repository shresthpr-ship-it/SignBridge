import React, { useState, useRef, useEffect } from 'react';
import {
  FileVideo,
  Image as ImageIcon,
  UploadCloud,
  AlertCircle,
  Cpu,
  Layers,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Info,
  RefreshCw,
  FolderInput,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { api } from '../../services/api';
import { ExtractionResult, FrameLandmarks } from '../../types';
import { drawFullFrameLandmarks } from '../../utils/handRenderer';

export const VideoProcessingView: React.FC = () => {
  const { recordSample, addToast } = useApp();

  // Mode: 'video' | 'image'
  const [pipelineMode, setPipelineMode] = useState<'video' | 'image'>('video');

  // Input states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('ASL');
  const [signLabel, setSignLabel] = useState<string>('');
  const [maxFrames, setMaxFrames] = useState<number>(45);
  const [sampleFps, setSampleFps] = useState<number>(6);

  // Processing states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);

  // Visualization states
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [layerHands, setLayerHands] = useState<boolean>(true);
  const [layerPose, setLayerPose] = useState<boolean>(true);
  const [layerFace, setLayerFace] = useState<boolean>(true);
  const [showJsonRaw, setShowJsonRaw] = useState<boolean>(false);
  const [isPromoting, setIsPromoting] = useState<boolean>(false);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Clean up object URLs on change or unmount
  useEffect(() => {
    return () => {
      if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
    };
  }, [mediaPreviewUrl]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingError(null);
    setExtractionResult(null);

    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(file.name);

    if (pipelineMode === 'video' && !isVideo) {
      setProcessingError(`Selected file is not an accepted video format. Supported: MP4, WebM, MOV, AVI, MKV.`);
      return;
    }
    if (pipelineMode === 'image' && !isImage) {
      setProcessingError(`Selected file is not an accepted image format. Supported: PNG, JPG, JPEG, WEBP, BMP.`);
      return;
    }

    // Size limit check
    const maxSizeBytes = pipelineMode === 'video' ? 60 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setProcessingError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${
          pipelineMode === 'video' ? '60 MB' : '15 MB'
        }.`
      );
      return;
    }

    if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }

    const localUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setMediaPreviewUrl(localUrl);
  };

  // Switch mode
  const handleModeSwitch = (mode: 'video' | 'image') => {
    if (pipelineMode === mode) return;
    setPipelineMode(mode);
    setSelectedFile(null);
    if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }
    setMediaPreviewUrl(null);
    setExtractionResult(null);
    setProcessingError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute extraction on the backend
  const handleRunPipeline = async () => {
    if (!selectedFile) {
      setProcessingError('Please select a media file to process.');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('target_language', targetLanguage);
    if (signLabel.trim()) {
      formData.append('sign_label', signLabel.trim().toUpperCase());
    }

    try {
      let result: ExtractionResult;
      if (pipelineMode === 'video') {
        formData.append('max_frames', maxFrames.toString());
        formData.append('sample_fps', sampleFps.toString());
        result = await api.extractVideoLandmarks(formData);
      } else {
        result = await api.extractImageLandmarks(formData);
      }

      setExtractionResult(result);
      setActiveFrameIndex(0);
      addToast({
        type: 'success',
        title: 'Extraction Complete',
        message: `Extracted ${result.processed_frames} frame(s) with ${result.frames_with_detections} detection(s) (${result.detection_rate_pct}% success rate).`,
      });
    } catch (err: any) {
      const msg = err.message || 'Vision pipeline processing failed.';
      setProcessingError(msg);
      addToast({
        type: 'error',
        title: 'Pipeline Processing Error',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Current active frame
  const activeFrame: FrameLandmarks | null =
    extractionResult && extractionResult.frames && extractionResult.frames[activeFrameIndex]
      ? extractionResult.frames[activeFrameIndex]
      : null;

  // Render canvas overlay when active frame changes or layers toggle
  useEffect(() => {
    if (!canvasRef.current || !activeFrame) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawFullFrameLandmarks(ctx, activeFrame, canvas.width, canvas.height, {
      showHands: layerHands,
      showPose: layerPose,
      showFace: layerFace,
    });
  }, [activeFrame, layerHands, layerPose, layerFace]);

  // Synchronize video playback time with active frame
  useEffect(() => {
    if (videoRef.current && activeFrame) {
      const sec = activeFrame.timestamp_ms / 1000.0;
      if (Math.abs(videoRef.current.currentTime - sec) > 0.1) {
        videoRef.current.currentTime = sec;
      }
    }
  }, [activeFrameIndex, activeFrame]);

  // Download raw JSON
  const handleDownloadJson = () => {
    if (!extractionResult) return;
    const jsonStr = JSON.stringify(extractionResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extractionResult.sample_id}_landmarks.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Promote keyframe to Review Queue / Dataset
  const handlePromoteToReview = async () => {
    if (!activeFrame || !activeFrame.hands || activeFrame.hands.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Hand Landmarks Detected',
        message: 'Current frame contains no detected hand landmarks to promote to dataset.',
      });
      return;
    }

    setIsPromoting(true);
    try {
      const primaryHand = activeFrame.hands[0];
      const normalized21 = primaryHand.landmarks.map((pt) => ({
        x: pt.x,
        y: pt.y,
        z: pt.z,
      }));

      const noteText = `Promoted from ${extractionResult?.media_type.toUpperCase()} pipeline (${extractionResult?.sample_id}, frame #${activeFrame.frame_index})`;
      await recordSample(
        normalized21,
        noteText,
        'pending_review'
      );

      addToast({
        type: 'success',
        title: 'Sample Ingested',
        message: `Keyframe #${activeFrame.frame_index} recorded into Review Queue.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Promotion Failed',
        message: err.message || 'Failed to submit frame to dataset.',
      });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" />
            Computer Vision Pipeline & Decomposition
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real MediaPipe Tasks engine extracting 3D hand, upper pose, and facial landmarks with strict ground-truth integrity.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => handleModeSwitch('video')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              pipelineMode === 'video'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileVideo className="w-3.5 h-3.5" />
            Video Sequence
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('image')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              pipelineMode === 'image'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Still Image
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Media & Parameters (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card compact title={pipelineMode === 'video' ? 'Upload Video Sequence' : 'Upload Still Image'}>
            <div className="space-y-4">
              {/* Dropzone / File Picker */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-md p-5 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? 'border-indigo-300 bg-indigo-50/20'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={
                    pipelineMode === 'video'
                      ? 'video/mp4,video/webm,video/quicktime,video/x-msvideo'
                      : 'image/png,image/jpeg,image/webp,image/bmp'
                  }
                  onChange={handleFileChange}
                />
                <UploadCloud className="w-7 h-7 mx-auto text-slate-400 mb-2" />
                {selectedFile ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-900 truncate max-w-[220px] mx-auto">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to process
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-slate-700">
                      Click to choose {pipelineMode === 'video' ? 'a video file' : 'an image'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {pipelineMode === 'video'
                        ? 'MP4, WebM, MOV, AVI up to 60 MB'
                        : 'PNG, JPG, WEBP up to 15 MB'}
                    </p>
                  </div>
                )}
              </div>

              {/* Parameters */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Sign System
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="ASL">ASL (American)</option>
                      <option value="BSL">BSL (British)</option>
                      <option value="ISL">ISL (International)</option>
                      <option value="LSF">LSF (French)</option>
                      <option value="DGS">DGS (German)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Sign Label (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HELLO, THANK_YOU"
                      value={signLabel}
                      onChange={(e) => setSignLabel(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {pipelineMode === 'video' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                        <span>Max Frames</span>
                        <span className="font-mono text-slate-500">{maxFrames}</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={maxFrames}
                        onChange={(e) => setMaxFrames(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                        <span>Sampling FPS</span>
                        <span className="font-mono text-slate-500">{sampleFps} fps</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={15}
                        step={1}
                        value={sampleFps}
                        onChange={(e) => setSampleFps(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={handleRunPipeline}
                  disabled={!selectedFile || isProcessing}
                  className="w-full justify-center"
                  leftIcon={
                    isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Cpu className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {isProcessing
                    ? pipelineMode === 'video'
                      ? 'Decomposing Frames & Extracting...'
                      : 'Running MediaPipe Detection...'
                    : pipelineMode === 'video'
                    ? 'Extract Video Landmark Sequence'
                    : 'Extract Image Landmarks'}
                </Button>
              </div>

              {/* Error Notice */}
              {processingError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{processingError}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Engine Integrity Guarantee Note */}
          <Card compact>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>MediaPipe Ground-Truth Pipeline</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Landmarks are extracted directly by MediaPipe Tasks (Hand, Pose, and Face anchors). Detections return exact normalized coordinates with confidence metrics. When landmarks are not in frame, missing elements are reported truthfully without synthetic simulation.
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column: Visualization & Results Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {extractionResult ? (
            <>
              {/* Media & Landmark Overlay Canvas */}
              <Card
                compact
                title={`Visual Landmark Overlay • ${extractionResult.media_type.toUpperCase()} (${extractionResult.sample_id})`}
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadJson}
                    leftIcon={<Download className="w-3 h-3" />}
                    className="text-[11px] h-7 px-2"
                  >
                    JSON Export
                  </Button>
                }
              >
                <div className="space-y-3">
                  {/* Viewport with Stacked Media & Canvas */}
                  <div className="relative w-full aspect-16/10 bg-slate-950 rounded-md overflow-hidden border border-slate-800 flex items-center justify-center">
                    {/* Background Subtle Research Grid */}
                    <div
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                      }}
                    />

                    {/* Original Media (Image or Video) */}
                    {mediaPreviewUrl && (
                      pipelineMode === 'video' ? (
                        <video
                          ref={videoRef}
                          src={mediaPreviewUrl}
                          className="absolute inset-0 w-full h-full object-contain opacity-75"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          ref={imgRef}
                          src={mediaPreviewUrl}
                          alt="Uploaded Frame"
                          className="absolute inset-0 w-full h-full object-contain opacity-75"
                        />
                      )
                    )}

                    {/* Canvas Landmark Overlay */}
                    <canvas
                      ref={canvasRef}
                      width={640}
                      height={400}
                      className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
                    />

                    {/* Floating Info Badges */}
                    <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-slate-900/85 border border-slate-700 text-[10px] font-mono text-slate-300">
                        {extractionResult.target_language}
                        {extractionResult.sign_label && ` • ${extractionResult.sign_label}`}
                      </span>

                      {activeFrame && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            activeFrame.detection_status === 'detected'
                              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                              : activeFrame.detection_status === 'partial_detection'
                              ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                              : 'bg-rose-950/80 border-rose-700 text-rose-300'
                          }`}
                        >
                          Status: {activeFrame.detection_status}
                        </span>
                      )}
                    </div>

                    {/* Floating Frame Index Badge for Video */}
                    {pipelineMode === 'video' && activeFrame && (
                      <div className="absolute top-3 right-3 z-20">
                        <span className="px-2 py-0.5 rounded bg-slate-900/85 border border-slate-700 text-[10px] font-mono text-slate-300">
                          Frame {activeFrameIndex + 1} / {extractionResult.processed_frames} ({activeFrame.timestamp_ms.toFixed(0)} ms)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Layer Toggles & Frame Controls */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-100">
                    {/* Layer Toggles */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        Layers:
                      </span>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={layerHands}
                          onChange={(e) => setLayerHands(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                        />
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-600" />
                        Hands (21 pts)
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={layerPose}
                          onChange={(e) => setLayerPose(e.target.checked)}
                          className="rounded border-slate-300 text-sky-600 focus:ring-0"
                        />
                        <span className="inline-block w-2 h-2 rounded-full bg-sky-500" />
                        Pose (Upper body)
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={layerFace}
                          onChange={(e) => setLayerFace(e.target.checked)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-0"
                        />
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                        Face (NMMs)
                      </label>
                    </div>

                    {/* Quick Promote Action */}
                    {activeFrame && activeFrame.hands.length > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handlePromoteToReview}
                        disabled={isPromoting}
                        leftIcon={<FolderInput className="w-3 h-3 text-indigo-600" />}
                        className="text-[11px] h-7"
                      >
                        {isPromoting ? 'Promoting...' : 'Promote Frame to Review'}
                      </Button>
                    )}
                  </div>

                  {/* Video Timeline Scrubber */}
                  {pipelineMode === 'video' && extractionResult.frames.length > 1 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveFrameIndex((prev) => Math.max(0, prev - 1))}
                            disabled={activeFrameIndex === 0}
                            className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono">
                            Frame #{activeFrameIndex + 1} of {extractionResult.processed_frames}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveFrameIndex((prev) =>
                                Math.min(extractionResult.processed_frames - 1, prev + 1)
                              )
                            }
                            disabled={activeFrameIndex >= extractionResult.processed_frames - 1}
                            className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="font-mono text-slate-500">
                          Timestamp: {activeFrame ? (activeFrame.timestamp_ms / 1000).toFixed(2) : 0}s
                        </span>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, extractionResult.processed_frames - 1)}
                        value={activeFrameIndex}
                        onChange={(e) => setActiveFrameIndex(Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </Card>

              {/* Extraction Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card compact>
                  <p className="text-[11px] font-medium text-slate-500">Processed Frames</p>
                  <p className="text-lg font-semibold text-slate-900 mt-0.5">
                    {extractionResult.processed_frames}
                    <span className="text-xs text-slate-400 font-normal ml-1">
                      / {extractionResult.total_frames} total
                    </span>
                  </p>
                </Card>

                <Card compact>
                  <p className="text-[11px] font-medium text-slate-500">Successful Detections</p>
                  <p className="text-lg font-semibold text-emerald-600 mt-0.5">
                    {extractionResult.frames_with_detections}
                    <span className="text-xs text-slate-400 font-normal ml-1">
                      ({extractionResult.detection_rate_pct}%)
                    </span>
                  </p>
                </Card>

                <Card compact>
                  <p className="text-[11px] font-medium text-slate-500">Missing Detections</p>
                  <p className="text-lg font-semibold text-slate-800 mt-0.5">
                    {extractionResult.missing_detections}
                  </p>
                </Card>

                <Card compact>
                  <p className="text-[11px] font-medium text-slate-500">Processing Latency</p>
                  <p className="text-lg font-semibold text-slate-900 mt-0.5">
                    {extractionResult.processing_time_ms.toFixed(0)}
                    <span className="text-xs text-slate-400 font-normal ml-1">ms</span>
                  </p>
                </Card>
              </div>

              {/* Current Frame Breakdown & Missing Elements */}
              {activeFrame && (
                <Card
                  compact
                  title={`Active Frame #${activeFrame.frame_index + 1} Ground-Truth Audit`}
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Hands Audit */}
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50/50">
                        <span className="font-semibold text-slate-800 block mb-1">
                          Hands Detected ({activeFrame.hands.length})
                        </span>
                        {activeFrame.hands.length > 0 ? (
                          <ul className="space-y-1">
                            {activeFrame.hands.map((h, i) => (
                              <li key={i} className="flex items-center justify-between text-[11px]">
                                <span className="font-mono text-slate-700">
                                  {h.handedness} Hand (21 pts)
                                </span>
                                <Badge variant="indigo" size="sm">
                                  {(h.confidence * 100).toFixed(0)}% conf
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No hand landmarks in frame.</p>
                        )}
                      </div>

                      {/* Pose Audit */}
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50/50">
                        <span className="font-semibold text-slate-800 block mb-1">Pose Keypoints</span>
                        {activeFrame.pose ? (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-slate-700">
                              33 3D Keypoints
                            </span>
                            <Badge variant="indigo" size="sm">
                              {activeFrame.pose.confidence
                                ? `${(activeFrame.pose.confidence * 100).toFixed(0)}% conf`
                                : 'Detected'}
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No pose detected.</p>
                        )}
                      </div>

                      {/* Face Audit */}
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50/50">
                        <span className="font-semibold text-slate-800 block mb-1">Facial Anchors (NMM)</span>
                        {activeFrame.face ? (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-slate-700">
                              {activeFrame.face.landmarks.length} Salient Markers
                            </span>
                            <Badge variant="indigo" size="sm">
                              Active
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No facial anchors detected.</p>
                        )}
                      </div>
                    </div>

                    {/* Explicit Missing Elements Display */}
                    {activeFrame.missing_elements && activeFrame.missing_elements.length > 0 && (
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-slate-800">
                            Explicit Missing Elements in this frame:
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {activeFrame.missing_elements.map((elem, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-200/80 text-[10px] font-mono text-slate-700"
                              >
                                {elem}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Raw Structured JSON Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowJsonRaw(!showJsonRaw)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showJsonRaw ? 'Hide Structured JSON Payload' : 'Inspect Structured JSON Payload'}
                </button>

                {showJsonRaw && (
                  <div className="mt-2 p-3 bg-slate-900 rounded-md border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-72">
                    <pre>{JSON.stringify(extractionResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <Card compact>
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <FileVideo className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">No Media Processed Yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Select a sign-language video clip or still image on the left panel and click &ldquo;Extract Landmarks&rdquo; to execute the MediaPipe computer-vision pipeline.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
