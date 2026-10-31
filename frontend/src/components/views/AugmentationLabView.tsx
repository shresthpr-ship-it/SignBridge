import React, { useState, useRef, useEffect } from 'react';
import { Shuffle, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LandmarkPoint } from '../../types';
import { drawHandSkeleton, getSimulatedHandLandmarks } from '../../utils/handRenderer';

export const AugmentationLabView: React.FC = () => {
  const { classes, augmentDataAction } = useApp();

  const [selectedClass, setSelectedClass] = useState<string>('Hello');
  const [augType, setAugType] = useState<'jitter' | 'scale' | 'mirror'>('jitter');
  const [count, setCount] = useState<number>(4);
  const [isAugmenting, setIsAugmenting] = useState<boolean>(false);
  const [augmentedPreview, setAugmentedPreview] = useState<LandmarkPoint[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compute live preview of transformation
  useEffect(() => {
    const basePts = getSimulatedHandLandmarks(
      selectedClass === 'Yes' ? 'yes' : selectedClass === 'Peace' ? 'peace' : 'hello'
    );

    const transformed: LandmarkPoint[] = basePts.map((pt) => {
      let x = pt.x;
      let y = pt.y;
      let z = pt.z || 0.0;

      if (augType === 'jitter') {
        x += (Math.random() - 0.5) * 0.03;
        y += (Math.random() - 0.5) * 0.03;
      } else if (augType === 'scale') {
        const factor = 0.93;
        x = 0.5 + (x - 0.5) * factor;
        y = 0.5 + (y - 0.5) * factor;
      } else if (augType === 'mirror') {
        x = 1.0 - x;
      }

      return { x: +x.toFixed(4), y: +y.toFixed(4), z: +z.toFixed(4) };
    });

    setAugmentedPreview(transformed);
  }, [selectedClass, augType]);

  // Render canvas
  useEffect(() => {
    if (!canvasRef.current || augmentedPreview.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base ghost skeleton in light slate
    const basePts = getSimulatedHandLandmarks(
      selectedClass === 'Yes' ? 'yes' : selectedClass === 'Peace' ? 'peace' : 'hello'
    );
    drawHandSkeleton(ctx, basePts, canvas.width, canvas.height, {
      lineColor: '#cbd5e1',
      jointColor: '#94a3b8',
      wristColor: '#64748b',
      lineWidth: 1.5,
      jointRadius: 2.5,
    });

    // Draw augmented skeleton in indigo
    drawHandSkeleton(ctx, augmentedPreview, canvas.width, canvas.height, {
      lineColor: '#4f46e5',
      jointColor: '#818cf8',
      wristColor: '#312e81',
      lineWidth: 2.5,
      jointRadius: 3.5,
    });
  }, [augmentedPreview, selectedClass]);

  const handleApply = async () => {
    setIsAugmenting(true);
    await augmentDataAction(selectedClass, augType, count);
    setIsAugmenting(false);
  };

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">
          Augmentation & Synthetic Synthesis Lab
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate geometrically invariant training sequences through controlled translation
          perturbations, scale variations, and bilateral hand reflection.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Canvas Comparison (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card compact title="Synthetic Deformation Preview">
            <div className="relative w-full aspect-4/3 bg-slate-950 rounded-md overflow-hidden border border-slate-800 flex items-center justify-center">
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="relative z-10 w-full h-full object-contain"
              />

              {/* Legend overlay */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-3 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-1 bg-slate-400 rounded inline-block" />
                  <span>Base Anchor</span>
                </div>
                <div className="flex items-center gap-1.5 text-indigo-400">
                  <span className="w-2.5 h-1 bg-indigo-500 rounded inline-block" />
                  <span className="font-semibold">Transformed</span>
                </div>
              </div>

              <div className="absolute bottom-3 left-3 z-20 text-[10px] font-mono text-slate-400">
                Transform: <span className="text-white uppercase font-semibold">{augType}</span>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <p>
                Synthesizing landmark variations directly in normalized 63-dimensional space prevents
                pixel-level overfitting while maintaining anatomical limb-length constraints.
              </p>
            </div>
          </Card>
        </div>

        {/* Right: Controls & Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="Augmentation Parameters">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Gesture Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full rounded-md border border-slate-300 text-sm px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name} ({cls.sample_count} current)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Transformation Algorithm
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'jitter', label: 'Joint Jitter', desc: 'Gaussian noise' },
                    { id: 'scale', label: 'Scale Invariance', desc: 'Distance delta' },
                    { id: 'mirror', label: 'Reflection', desc: 'Left/Right mirror' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setAugType(t.id as any)}
                      className={`p-2.5 rounded border text-left transition-all ${
                        augType === t.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-xs leading-tight">{t.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span className="font-medium">Batch Generation Quantity:</span>
                  <span className="font-mono font-semibold text-indigo-600">{count} samples</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleApply}
                isLoading={isAugmenting}
                leftIcon={<Shuffle className="w-4 h-4" />}
              >
                Synthesize & Ingest to Corpus
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
