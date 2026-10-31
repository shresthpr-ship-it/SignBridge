import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Play,
  Pause,
  RotateCcw,
  Square,
  AlertCircle,
  Sparkles,
  Volume2,
  Copy,
  Edit3,
  Film,
  RefreshCw,
  ArrowRight,
  History,
  Check,
  SwitchCamera,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  SentenceModeState,
  SentenceModeProcessingResult,
  ModelStatus,
} from '../../types';
import { useCameraPermissions } from '../../hooks/useCameraPermissions';
import { CameraPermissionGuardian } from '../camera/CameraPermissionGuardian';
import { SpeechAudioMode } from '../../utils/speech';

export const SentenceModeView: React.FC = () => {
  const { selectedLanguage, addToast } = useApp();

  // State Machine
  const [modeState, setModeState] = useState<SentenceModeState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Camera & Video Media Streams
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // MediaRecorder states
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  // Recording Timer
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Processing & Model Results
  const [processingResult, setProcessingResult] = useState<SentenceModeProcessingResult | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [targetLang, setTargetLang] = useState<string>(selectedLanguage || 'ISL');

  // Text Editing Area
  const [originalModelText, setOriginalModelText] = useState<string>('');
  const [editedText, setEditedText] = useState<string>('');
  const [hindiTranslation, setHindiTranslation] = useState<string>('');
  const [hindiPhonetic, setHindiPhonetic] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Text to Speech States
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [speechLangMode, setSpeechLangMode] = useState<SpeechAudioMode>('hindi');

  // History & Previous Recordings
  const [historySessions, setHistorySessions] = useState<SentenceModeProcessingResult[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Cross-device camera permission
  const cameraPermission = useCameraPermissions();

  // Enumerate cameras & voices on mount
  useEffect(() => {
    api.getSentenceModeStatus()
      .then((res) => {
        if (res.model_status) setModelStatus(res.model_status);
      })
      .catch(() => {});

    api.getSentenceModeHistory()
      .then(setHistorySessions)
      .catch(() => {});

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }).catch(() => {});
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices() || [];
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoiceName) {
          const pref = voices.find(
            (v) => v.lang.toLowerCase().startsWith('hi') || v.lang.toLowerCase() === 'en-in'
          ) || voices[0];
          setSelectedVoiceName(pref.name);
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Cleanup URLs and media tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [recordedVideoUrl]);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  }, []);

  // Start Camera
  const startCamera = async () => {
    setErrorMessage(null);
    setModeState('camera_initializing');
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API is not supported in this browser.');
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }

      setModeState('camera_ready');
    } catch (err: any) {
      console.error('Camera initialization error:', err);
      setErrorMessage(err.message || 'Could not access camera. Please check permissions.');
      setModeState('error');
    }
  };

  // Start Recording
  const startRecording = () => {
    if (!streamRef.current) {
      addToast({ type: 'error', message: 'Camera feed is not active. Please start camera first.' });
      return;
    }

    recordedChunksRef.current = [];
    setErrorMessage(null);

    // Pick supported MIME type
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    let selectedMime = '';
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) {
        selectedMime = m;
        break;
      }
    }

    try {
      const recorder = new MediaRecorder(
        streamRef.current,
        selectedMime ? { mimeType: selectedMime } : undefined
      );

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(recordedChunksRef.current, {
          type: selectedMime || 'video/webm',
        });
        setRecordedBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setRecordedVideoUrl(url);
        setModeState('recorded');
      };

      recorder.start(200); // 200ms slice
      mediaRecorderRef.current = recorder;
      setModeState('recording');
      setElapsedSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Recording start failure:', err);
      setErrorMessage(err.message || 'Browser failed to initialize MediaRecorder.');
      setModeState('error');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setModeState('recording_finalizing');
      mediaRecorderRef.current.stop();
    }
  };

  // Retake Recording
  const retakeRecording = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    setRecordedBlob(null);
    setProcessingResult(null);
    setOriginalModelText('');
    setEditedText('');
    setHindiTranslation('');
    setHindiPhonetic('');
    setErrorMessage(null);
    if (streamRef.current) {
      setModeState('camera_ready');
    } else {
      startCamera();
    }
  };

  // Generate Sentence Action (Uploads video and translates)
  const handleGenerateSentence = async () => {
    if (!recordedBlob) {
      addToast({ type: 'error', message: 'No recorded video available. Please record first.' });
      return;
    }

    setModeState('processing');
    setErrorMessage(null);

    try {
      const res = await api.translateRecordedSentence(recordedBlob, targetLang);
      setProcessingResult(res);

      if (res.status === 'success' && res.generated_sentence) {
        setOriginalModelText(res.generated_sentence.english_sentence);
        setEditedText(res.generated_sentence.english_sentence);
        setHindiTranslation(res.generated_sentence.hindi_sentence);
        setHindiPhonetic(res.generated_sentence.hindi_phonetic);
        setModeState('result_ready');
        addToast({
          type: 'success',
          title: 'Sentence Generated',
          message: `Translated ${res.raw_gloss_sequence.length} signs into fluent sentence!`,
        });
      } else if (res.status === 'success' && res.raw_gloss_sequence.length > 0) {
        const glossStr = res.raw_gloss_sequence.join(' ');
        setOriginalModelText(glossStr);
        setEditedText(glossStr);
        setModeState('result_ready');
        addToast({
          type: 'info',
          title: 'Glosses Recognized',
          message: 'Sign sequence detected; review and edit text below.',
        });
      } else {
        setOriginalModelText('');
        setEditedText('');
        setModeState('result_ready');
        addToast({
          type: 'warning',
          title: 'Recognition Note',
          message: res.message,
        });
      }

      // Refresh history
      api.getSentenceModeHistory().then(setHistorySessions).catch(() => {});
    } catch (err: any) {
      console.error('Translation error:', err);
      setErrorMessage(err.message || 'Failed to process recorded video.');
      setModeState('error');
      addToast({
        type: 'error',
        title: 'Processing Failed',
        message: err.message || 'Server error processing video recording.',
      });
    }
  };

  // Text-To-Speech Controls
  const handleListen = () => {
    const textToSpeak = editedText.trim();
    if (!textToSpeak) {
      addToast({ type: 'warning', message: 'Text area is empty. Nothing to speak.' });
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      addToast({ type: 'error', message: 'Web Speech API is not supported in this browser.' });
      return;
    }

    window.speechSynthesis.cancel();

    // Determine voice & text based on speech mode
    let targetText = textToSpeak;
    if (speechLangMode === 'hindi' && hindiTranslation) {
      // If Hindi mode selected and Hindi translation exists
      const hasHindiVoice = availableVoices.some((v) => v.lang.toLowerCase().startsWith('hi'));
      targetText = hasHindiVoice ? hindiTranslation : (hindiPhonetic || textToSpeak);
    }

    const utterance = new SpeechSynthesisUtterance(targetText);
    utterance.rate = speechRate;

    const matchedVoice = availableVoices.find((v) => v.name === selectedVoiceName);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.warn('TTS playback error:', e);
      setIsSpeaking(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const handleStopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const handleCopyText = () => {
    if (!editedText) return;
    navigator.clipboard.writeText(editedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addToast({ type: 'success', message: 'Text copied to clipboard!' });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Title & Mode Header */}
      <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-600" />
            Sentence Mode (Record-Then-Translate)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record a complete sign-language sentence first, inspect the video, submit for full sequence translation, edit text, and listen via text-to-speech.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="indigo" size="sm">
            Mode: Record First
          </Badge>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700">
            <span className="text-[10px] text-slate-400 font-medium">Lang:</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="text-xs font-semibold bg-transparent border-0 focus:outline-none cursor-pointer"
            >
              <option value="ISL">ISL (Indian)</option>
              <option value="ASL">ASL (American)</option>
              <option value="BSL">BSL (British)</option>
            </select>
          </div>
          <Badge variant="slate" size="sm">
            Model: {modelStatus?.model_name ? 'Trained MLP' : 'SignBridge Engine'}
          </Badge>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1 font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>History ({historySessions.length})</span>
          </button>
        </div>
      </div>

      {/* Camera Permission Guardian */}
      <CameraPermissionGuardian
        permission={cameraPermission}
        onPermissionGranted={startCamera}
      />

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Camera & Recorded Video Preview (7 cols)         */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            compact
            title={
              modeState === 'recorded' || modeState === 'result_ready'
                ? 'Recorded Video Review'
                : 'Camera Stream'
            }
            actions={
              <div className="flex items-center gap-2">
                {videoDevices.length > 1 && modeState === 'camera_ready' && (
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="text-[10px] font-semibold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
                    >
                      {videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
                        startCamera();
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                      title="Switch Front/Back Camera"
                    >
                      <SwitchCamera className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                    modeState === 'recording'
                      ? 'bg-rose-100 border-rose-300 text-rose-800 animate-pulse'
                      : modeState === 'recorded' || modeState === 'result_ready'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : modeState === 'camera_ready'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      modeState === 'recording'
                        ? 'bg-rose-600'
                        : modeState === 'camera_ready'
                        ? 'bg-emerald-600'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>
                    {modeState === 'recording'
                      ? `REC ${formatTimer(elapsedSeconds)}`
                      : modeState === 'recorded'
                      ? 'Clip Ready'
                      : modeState === 'processing'
                      ? 'Processing...'
                      : modeState === 'camera_ready'
                      ? 'Ready'
                      : 'Idle'}
                  </span>
                </span>
              </div>
            }
          >
            {/* Viewport Box */}
            <div className="relative aspect-4/3 w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* Active Recording or Camera Preview */}
              {modeState !== 'recorded' && modeState !== 'result_ready' && modeState !== 'processing' ? (
                <>
                  <video
                    ref={videoPreviewRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />
                  {modeState === 'idle' && (
                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 text-center p-6 z-10">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Camera is Inactive</h4>
                        <p className="text-xs text-slate-400 max-w-xs mt-1">
                          Click Start Camera to initialize your webcam for sentence recording.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={startCamera}
                        leftIcon={<Play className="w-3.5 h-3.5" />}
                      >
                        Start Camera
                      </Button>
                    </div>
                  )}

                  {/* Recording Live Indicator */}
                  {modeState === 'recording' && (
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-rose-600/90 backdrop-blur-xs text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      <span>Recording: {formatTimer(elapsedSeconds)}</span>
                    </div>
                  )}
                </>
              ) : (
                /* Recorded Video Playback Review */
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  {recordedVideoUrl && (
                    <video
                      src={recordedVideoUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  )}
                  {modeState === 'processing' && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30 text-center p-6">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                      <h4 className="text-sm font-bold text-white tracking-wide">
                        Analyzing Temporal Sign Landmarks...
                      </h4>
                      <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                        Extracting chronological 3D hand trajectories and decoding movement sequence via SignBridge linguistic translator.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Video Controls Bar */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {modeState === 'idle' || modeState === 'camera_initializing' ? (
                  <Button
                    size="sm"
                    onClick={startCamera}
                    disabled={modeState === 'camera_initializing'}
                    leftIcon={<Camera className="w-3.5 h-3.5" />}
                  >
                    {modeState === 'camera_initializing' ? 'Connecting...' : 'Start Camera'}
                  </Button>
                ) : modeState === 'camera_ready' ? (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={startRecording}
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                      leftIcon={<div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    >
                      Start Recording
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={stopCamera}
                      className="text-slate-600"
                    >
                      Stop Camera
                    </Button>
                  </>
                ) : modeState === 'recording' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={stopRecording}
                    className="bg-slate-900 hover:bg-black text-white"
                    leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
                  >
                    Stop Recording ({formatTimer(elapsedSeconds)})
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={retakeRecording}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Retake Recording
                    </Button>
                  </>
                )}
              </div>

              {/* Right Side: Primary Generate Sentence Action */}
              {(modeState === 'recorded' || modeState === 'result_ready' || modeState === 'processing') && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleGenerateSentence}
                  disabled={modeState === 'processing'}
                  className="bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-md shadow-indigo-900/40"
                  leftIcon={
                    modeState === 'processing' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {modeState === 'processing'
                    ? 'Processing Video...'
                    : processingResult
                    ? 'Regenerate Sentence'
                    : 'Generate Sentence'}
                </Button>
              )}
            </div>

            {/* Error Message if Any */}
            {errorMessage && (
              <div className="mt-3 p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong>Error:</strong> {errorMessage}
                </div>
              </div>
            )}
          </Card>

          {/* Workflow Guidance Card */}
          <Card compact>
            <div className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sentence Mode Workflow Steps</span>
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-slate-500 text-[11px]">
                <li><strong>Start Camera:</strong> Position your hands clearly in the camera view.</li>
                <li><strong>Start Recording:</strong> Perform the continuous sign language sentence naturally.</li>
                <li><strong>Stop Recording:</strong> Review the captured video clip in the player.</li>
                <li><strong>Generate Sentence:</strong> Submit the clip for complete chronological sequence recognition.</li>
                <li><strong>Review & Edit:</strong> Review generated text, modify if necessary, and use Text-To-Speech to listen.</li>
              </ol>
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Generated Sentence, Edit & TTS (5 cols)         */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 space-y-4">
          {/* Generated Text & Editing Card */}
          <Card
            compact
            title="Generated Sentence"
            actions={
              processingResult && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                    processingResult.recognition_task === 'sentence_translation'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : processingResult.recognition_task === 'gloss_sequence'
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-amber-50 border-amber-300 text-amber-800'
                  }`}
                >
                  {processingResult.recognition_task === 'sentence_translation'
                    ? 'Sentence Translation'
                    : processingResult.recognition_task === 'gloss_sequence'
                    ? 'Sign Sequence (Glosses)'
                    : 'Recognition Unavailable'}
                </span>
              )
            }
          >
            <div className="space-y-4">
              {/* Output State Display */}
              {processingResult ? (
                <>
                  {/* Original Model Prediction Box */}
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                      Original Model Output ({processingResult.target_language})
                    </span>
                    <div className="text-sm font-semibold text-slate-900 leading-snug">
                      {originalModelText ? (
                        <span>“{originalModelText}”</span>
                      ) : (
                        <span className="text-slate-400 font-normal italic">
                          No text returned ({processingResult.message})
                        </span>
                      )}
                    </div>

                    {hindiTranslation && (
                      <div className="text-xs font-medium text-amber-700 mt-1">
                        Hindi: “{hindiTranslation}”
                      </div>
                    )}
                  </div>

                  {/* Raw Gloss Tokens Sequence */}
                  {processingResult.raw_gloss_sequence && processingResult.raw_gloss_sequence.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Recognized Sign Sequence (Raw Tokens)
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {processingResult.raw_gloss_sequence.map((g, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-mono font-bold"
                          >
                            {g.toUpperCase()}
                            {idx < processingResult.raw_gloss_sequence.length - 1 && (
                              <ArrowRight className="w-2.5 h-2.5 text-indigo-400" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing Diagnostics */}
                  <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-1.5">
                    <span>
                      {processingResult.processed_frames} frames • {processingResult.duration_seconds}s video
                    </span>
                    <span>
                      Latency: {processingResult.processing_time_ms}ms
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <Film className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">
                    No sentence generated yet.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Record your signing message using the camera on the left, then click <strong>Generate Sentence</strong>.
                  </p>
                </div>
              )}

              {/* Editable Text Area for Final Output */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Editable Final Text</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {originalModelText && (
                      <button
                        type="button"
                        onClick={() => setEditedText(originalModelText)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
                        title="Reset to original prediction"
                      >
                        Reset to Original
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditedText('')}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-medium"
                      title="Clear textarea"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  placeholder="The generated sentence will appear here. You can freely edit or refine before speaking."
                  className="w-full text-xs p-2.5 rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Characters: {editedText.length}</span>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    disabled={!editedText}
                    className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium disabled:opacity-40 cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>
              </div>

              {/* Text-To-Speech Section */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-indigo-600" />
                    <span>Text-to-Speech Playback</span>
                  </span>

                  <select
                    value={speechLangMode}
                    onChange={(e) => setSpeechLangMode(e.target.value as SpeechAudioMode)}
                    className="text-[10px] font-semibold bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
                  >
                    <option value="english">Audio: English</option>
                    <option value="hindi">Audio: Hindi / ISL</option>
                    <option value="bilingual">Audio: Bilingual</option>
                  </select>
                </div>

                {/* Speech Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleListen}
                    disabled={!editedText.trim() || isSpeaking && !isPaused}
                    className="bg-indigo-600 hover:bg-indigo-500 font-semibold"
                    leftIcon={<Volume2 className="w-3.5 h-3.5" />}
                  >
                    Listen
                  </Button>

                  {isSpeaking && !isPaused && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePause}
                      leftIcon={<Pause className="w-3.5 h-3.5" />}
                    >
                      Pause
                    </Button>
                  )}

                  {isPaused && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleResume}
                      leftIcon={<Play className="w-3.5 h-3.5" />}
                    >
                      Resume
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStopSpeech}
                    disabled={!isSpeaking && !isPaused}
                    className="text-slate-600"
                    leftIcon={<Square className="w-3.5 h-3.5" />}
                  >
                    Stop
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleListen}
                    disabled={!editedText.trim()}
                    className="text-slate-600"
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Replay
                  </Button>
                </div>

                {/* Voice & Speed Configuration Accordion */}
                <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <label className="text-slate-500 font-medium block mb-0.5">Voice Engine:</label>
                    <select
                      value={selectedVoiceName}
                      onChange={(e) => setSelectedVoiceName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-700 truncate"
                    >
                      {availableVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-500 font-medium mb-0.5">
                      <span>Rate:</span>
                      <span>{speechRate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="1.3"
                      step="0.1"
                      value={speechRate}
                      onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Previous Sentence Sessions Drawer / Card */}
          {showHistory && (
            <Card compact title="Previous Sentence Recordings">
              {historySessions.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {historySessions.map((session, idx) => (
                    <div
                      key={session.session_id || idx}
                      className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs space-y-1 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span>{session.generated_sentence?.english_sentence || session.raw_gloss_sequence.join(' ') || 'Session'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(session.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>{session.raw_gloss_sequence.length} signs • {session.duration_seconds}s</span>
                        <button
                          type="button"
                          onClick={() => {
                            setProcessingResult(session);
                            if (session.generated_sentence) {
                              setOriginalModelText(session.generated_sentence.english_sentence);
                              setEditedText(session.generated_sentence.english_sentence);
                              setHindiTranslation(session.generated_sentence.hindi_sentence);
                              setHindiPhonetic(session.generated_sentence.hindi_phonetic);
                            }
                            if (session.video_url) {
                              setRecordedVideoUrl(session.video_url);
                              setModeState('result_ready');
                            }
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">No previous recorded sessions found.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
