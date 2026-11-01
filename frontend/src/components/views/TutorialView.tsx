import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Search,
  ExternalLink,
  Volume2,
  Camera,
  Sparkles,
  HelpCircle,
  AlertCircle,
  Award,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  ISL_TRANSLATIONS,
  ISLTranslation,
  getAllISLCategories,
} from '../../utils/islDictionary';
import { SpeechService } from '../../utils/speech';
import { drawFullFrameLandmarks } from '../../utils/handRenderer';

interface TutorialViewProps {
  isPopout?: boolean;
}

export const TutorialView: React.FC<TutorialViewProps> = ({ isPopout = false }) => {
  const { addToast } = useApp();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedHandedness, setSelectedHandedness] = useState<'All' | 'One-handed' | 'Two-handed'>('All');

  // Interactive Practice State
  const [practiceSign, setPracticeSign] = useState<ISLTranslation | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [detectedSign, setDetectedSign] = useState<string | null>(null);
  const [isSignMastered, setIsSignMastered] = useState<boolean>(false);
  const [masteryHoldMs, setMasteryHoldMs] = useState<number>(0);

  // Video & Canvas Refs for Practice Modal
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isEvaluatingRef = useRef<boolean>(false);
  const holdTimerRef = useRef<number>(0);

  // Categories list
  const categories = useMemo(() => ['All', ...getAllISLCategories()], []);

  // Filtered Sign List
  const filteredSigns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return Object.entries(ISL_TRANSLATIONS).filter(([key, sign]) => {
      // Category Filter
      if (selectedCategory !== 'All' && sign.category !== selectedCategory) {
        return false;
      }
      // Handedness Filter
      if (selectedHandedness !== 'All' && sign.handedness !== selectedHandedness) {
        return false;
      }
      // Text Search Filter (English, Hindi script, Transliteration, or Description)
      if (query) {
        const matchKey = key.includes(query);
        const matchEng = sign.english.toLowerCase().includes(query);
        const matchHindi = sign.hindi.includes(query);
        const matchPhonetic = sign.spokenPhonetic.toLowerCase().includes(query);
        const matchDesc = sign.islDescription.toLowerCase().includes(query);
        return matchKey || matchEng || matchHindi || matchPhonetic || matchDesc;
      }
      return true;
    });
  }, [searchQuery, selectedCategory, selectedHandedness]);

  // Open Popout Window handler
  const handleOpenPopout = () => {
    const popoutUrl = `${window.location.origin}/?window=tutorial`;
    const popup = window.open(
      popoutUrl,
      'ISL_Tutorial_Companion',
      'width=1200,height=840,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );
    if (popup) {
      popup.focus();
      addToast({
        type: 'success',
        title: 'Companion Window Opened',
        message: 'ISL Sign Tutorial opened in a dedicated companion window for side-by-side learning.',
      });
    } else {
      addToast({
        type: 'warning',
        title: 'Popup Blocked',
        message: 'Please allow popups in your browser address bar to open the tutorial window.',
      });
    }
  };

  // Speak pronunciation
  const handlePronounce = (sign: ISLTranslation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    SpeechService.speakSentence(
      sign.english,
      sign.hindi,
      sign.spokenPhonetic,
      'hindi'
    );
  };

  // Practice Modal Camera Controls
  const stopPracticeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setMatchScore(0);
    setDetectedSign(null);
    setIsSignMastered(false);
    setMasteryHoldMs(0);
  }, []);

  const startPracticeCamera = async () => {
    setCameraError(null);
    setIsRequestingCamera(true);
    stopPracticeCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam media devices are not available in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Practice camera error:', err);
      setCameraError(err.message || 'Failed to initialize camera.');
    } finally {
      setIsRequestingCamera(false);
    }
  };

  // Close Practice Modal
  const handleClosePractice = () => {
    stopPracticeCamera();
    setPracticeSign(null);
  };

  // Live evaluation loop in practice modal
  useEffect(() => {
    if (!practiceSign || !isCameraActive) return;
    let isMounted = true;
    let timerId: any = null;

    const evaluate = async () => {
      if (!isMounted || !videoRef.current || isEvaluatingRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2 || video.paused || video.ended) return;

      isEvaluatingRef.current = true;
      try {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
          offscreenCanvasRef.current.width = 320;
          offscreenCanvasRef.current.height = 240;
        }
        const offCtx = offscreenCanvasRef.current.getContext('2d', { willReadFrequently: true });
        if (!offCtx) return;

        offCtx.drawImage(video, 0, 0, 320, 240);
        const blob: Blob | null = await new Promise((res) =>
          offscreenCanvasRef.current!.toBlob(res, 'image/jpeg', 0.5)
        );
        if (!blob) return;

        const res = await api.recognizeLiveFrame(blob, 3, false, false);

        if (isMounted) {
          const currentPredicted = res.predicted_sign || '';
          setDetectedSign(currentPredicted);

          // Compare against target practice sign
          const targetKey = practiceSign.english.toLowerCase();
          const targetHindi = practiceSign.hindi.toLowerCase();
          const predLower = currentPredicted.toLowerCase();

          const isMatch =
            predLower === targetKey ||
            targetKey.includes(predLower) ||
            predLower.includes(targetKey.split(' ')[0]) ||
            predLower === targetHindi;

          if (isMatch && (res.confidence_score || 0) >= 60) {
            const score = Math.min(100, Math.round(res.confidence_score || 85));
            setMatchScore(score);

            // Accumulate hold time
            holdTimerRef.current += 150;
            setMasteryHoldMs(holdTimerRef.current);

            if (holdTimerRef.current >= 1200 && !isSignMastered) {
              setIsSignMastered(true);
              SpeechService.speakSentence('Excellent! Sign mastered!', 'बहुत बढ़िया! आपने सीख लिया!', 'Shaabash!', 'hindi');
            }
          } else {
            setMatchScore(0);
            holdTimerRef.current = Math.max(0, holdTimerRef.current - 100);
            setMasteryHoldMs(holdTimerRef.current);
          }

          // Draw landmarks on overlay canvas
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const frameData = {
                frame_index: 0,
                timestamp_ms: 0,
                detection_status: res.landmark_detection_status,
                hands: res.hands || [],
                missing_elements: res.missing_elements || [],
              };
              drawFullFrameLandmarks(
                ctx,
                frameData as any,
                canvas.width,
                canvas.height,
                {
                  showHands: true,
                  showPose: false,
                  showFace: false,
                }
              );
            }
          }
        }
      } catch (err) {
        console.warn('Practice evaluation tick:', err);
      } finally {
        isEvaluatingRef.current = false;
      }

      if (isMounted) {
        timerId = setTimeout(evaluate, 120);
      }
    };

    evaluate();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [practiceSign, isCameraActive, isSignMastered]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopPracticeCamera();
    };
  }, [stopPracticeCamera]);

  return (
    <div className={`space-y-6 ${isPopout ? 'p-6 bg-slate-100 min-h-screen' : ''}`}>
      {/* Title & Popout Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Indian Sign Language (ISL) Interactive Tutorial
            </h1>
            <Badge variant="indigo" size="sm">
              ISLRTC Grounded
            </Badge>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Official ISL signs, handshape topologies, movement directions, and bilingual spoken translations (English + हिन्दी).
            Click &ldquo;Practice on Camera&rdquo; on any sign to get instant real-time AI recognition feedback.
          </p>
        </div>

        {/* Popout in New Window Button */}
        {!isPopout && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPopout}
              leftIcon={<ExternalLink className="w-3.5 h-3.5 text-indigo-600" />}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-xs"
              title="Open the tutorial in a separate popout window to keep side-by-side with live camera"
            >
              Open in Popout Window
            </Button>
          </div>
        )}
      </div>

      {/* Search and Category Filter Toolbar */}
      <Card compact className="bg-white shadow-xs">
        <div className="space-y-3">
          {/* Top Search Line */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ISL signs by English (e.g. Drink, Help), Hindi (खाना, नमस्ते), or phonetic (paani)..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-md border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Handedness Selector */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
              <span className="text-slate-500 font-medium">Hands:</span>
              <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-slate-50">
                {(['All', 'One-handed', 'Two-handed'] as const).map((hand) => (
                  <button
                    key={hand}
                    type="button"
                    onClick={() => setSelectedHandedness(hand)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all cursor-pointer ${
                      selectedHandedness === hand
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60 font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {hand}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category Tabs Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Signs Counter & Overview Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-800">{filteredSigns.length}</strong> of{' '}
          {Object.keys(ISL_TRANSLATIONS).length} authentic ISL signs
        </span>
        <span className="text-[11px] text-slate-400">
          Indian Sign Language Research and Training Centre (ISLRTC) Standard
        </span>
      </div>

      {/* Grid of ISL Signs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSigns.map(([key, sign]) => (
          <div
            key={key}
            className="group relative rounded-lg border border-slate-200 bg-white p-4 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3"
          >
            {/* Top Card Bar: Category, Handedness & Audio Icon */}
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="indigo" size="sm">
                    {sign.category}
                  </Badge>
                  {sign.handedness && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {sign.handedness}
                    </span>
                  )}
                </div>

                {/* Pronounce TTS Action */}
                <button
                  type="button"
                  onClick={(e) => handlePronounce(sign, e)}
                  title={`Pronounce "${sign.english}" in Hindi and English`}
                  className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Main Heading: Icon + English + Hindi */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                  {sign.icon || '✋'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                    {sign.english}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-semibold text-emerald-700 font-sans">
                      {sign.hindi}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ({sign.spokenPhonetic})
                    </span>
                  </div>
                </div>
              </div>

              {/* ISL Detailed Motion & Handshape Description */}
              <div className="mt-3 p-2.5 rounded bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                <strong className="block text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">
                  How to Sign in ISL:
                </strong>
                <span>{sign.islDescription}</span>
              </div>

              {/* Cultural / Grammatical Tip */}
              {sign.tips && (
                <p className="mt-2 text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/60 p-2 rounded flex items-start gap-1.5 leading-snug">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>ISL Tip:</strong> {sign.tips}
                  </span>
                </p>
              )}
            </div>

            {/* Card Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                className="w-full text-xs"
                leftIcon={<Camera className="w-3.5 h-3.5" />}
                onClick={() => {
                  setPracticeSign(sign);
                  setIsSignMastered(false);
                  setMasteryHoldMs(0);
                  startPracticeCamera();
                }}
              >
                Practice on Camera
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 text-xs"
                leftIcon={<Volume2 className="w-3.5 h-3.5 text-indigo-600" />}
                onClick={(e) => handlePronounce(sign, e)}
                title="Speak bilingual pronunciation"
              >
                Pronounce
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty Search State */}
      {filteredSigns.length === 0 && (
        <div className="p-12 text-center bg-white rounded-lg border border-slate-200 space-y-3">
          <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No ISL signs matched your query</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try searching for common gestures like &ldquo;Namaste&rdquo;, &ldquo;Water&rdquo;, &ldquo;Eat&rdquo;,
            &ldquo;Help&rdquo;, or select a different category filter.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedHandedness('All');
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}

      {/* ============================================================== */}
      {/* PRACTICE ON CAMERA INTERACTIVE MODAL                          */}
      {/* ============================================================== */}
      {practiceSign && (
        <Modal
          isOpen={true}
          onClose={handleClosePractice}
          title={`Practice Sign: ${practiceSign.english} (${practiceSign.hindi})`}
          subtitle={`Follow the ISL instructions below and hold the gesture in front of your camera.`}
          maxWidth="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>ISL Spoken: &ldquo;{practiceSign.spokenPhonetic}&rdquo;</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleClosePractice}>
                  Close Practice
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Volume2 className="w-3.5 h-3.5" />}
                  onClick={() => handlePronounce(practiceSign)}
                >
                  Hear Audio
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Target Sign Guidance Strip */}
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{practiceSign.icon || '✋'}</span>
                <div>
                  <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                    {practiceSign.english} · <span className="text-emerald-700">{practiceSign.hindi}</span>
                  </h4>
                  <p className="text-xs text-indigo-900/90 mt-0.5 leading-snug">
                    {practiceSign.islDescription}
                  </p>
                </div>
              </div>
              <Badge variant="indigo" size="sm" className="shrink-0">
                {practiceSign.handedness || 'Standard ISL'}
              </Badge>
            </div>

            {/* Video Viewport & Skeleton Canvas */}
            <div className="relative w-full aspect-4/3 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* Camera Video Feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  !isCameraActive ? 'hidden' : 'block'
                }`}
              />

              {/* MediaPipe Hand Landmarks Canvas */}
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none transform -scale-x-100 ${
                  !isCameraActive ? 'hidden' : 'block'
                }`}
              />

              {/* Inactive Standby */}
              {!isCameraActive && (
                <div className="text-center p-6 space-y-3 z-20">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-300">Camera is paused or initializing.</p>
                  <Button
                    size="sm"
                    onClick={startPracticeCamera}
                    disabled={isRequestingCamera}
                    leftIcon={<Camera className="w-3.5 h-3.5" />}
                  >
                    {isRequestingCamera ? 'Connecting...' : 'Start Camera'}
                  </Button>
                </div>
              )}

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="absolute inset-x-4 top-4 z-30 p-3 bg-rose-950/90 border border-rose-800 text-rose-200 text-xs rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Live Recognition Evaluation Pill Overlay */}
              {isCameraActive && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-slate-900/85 border border-slate-700 text-xs font-mono text-slate-200">
                    Target: <strong className="text-indigo-400">{practiceSign.english}</strong>
                  </span>
                  {detectedSign && (
                    <span className="px-2.5 py-1 rounded bg-slate-900/85 border border-slate-700 text-xs font-mono text-slate-300">
                      Detected: <strong className="text-amber-400">{detectedSign}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Match Feedback Ribbon & Celebration Banner */}
              {isCameraActive && matchScore > 0 && (
                <div className="absolute bottom-3 inset-x-3 z-20">
                  <div
                    className={`p-3 rounded-lg border backdrop-blur-md transition-all ${
                      isSignMastered
                        ? 'bg-emerald-950/90 border-emerald-600 text-emerald-100 shadow-lg'
                        : 'bg-indigo-950/85 border-indigo-700 text-indigo-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        {isSignMastered ? (
                          <>
                            <Award className="w-4 h-4 text-emerald-400 animate-bounce" />
                            <span>Sign Mastered! Excellent Execution!</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                            <span>Matching Gesture... Hold steadily!</span>
                          </>
                        )}
                      </span>
                      <span className="font-mono text-xs">{matchScore}% Match</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          isSignMastered ? 'bg-emerald-400' : 'bg-indigo-400'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((masteryHoldMs / 1200) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Practice Tips */}
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
              <strong className="text-slate-700 block">Practice Guidelines:</strong>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li>Position your hand 40-70cm from your webcam with good lighting.</li>
                <li>Keep the gesture steady for at least 1.2 seconds until the green mastery bar fills up.</li>
                <li>Verify your finger curled/extended positions match the description above.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
