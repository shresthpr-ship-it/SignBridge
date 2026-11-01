import React, { useRef, useEffect } from 'react';
import { LandmarkPoint } from '../../types';
import { HAND_CONNECTIONS } from '../../utils/handRenderer';

interface LandmarkPoseVisualizerProps {
  landmarks?: LandmarkPoint[] | null;
  signName: string;
  width?: number;
  height?: number;
  className?: string;
  showLabels?: boolean;
}

// Finger joint color mapping
const FINGER_COLORS = {
  wrist: '#3b82f6',     // Blue
  thumb: '#f59e0b',     // Amber
  index: '#10b981',     // Emerald
  middle: '#06b6d4',    // Cyan
  ring: '#818cf8',      // Indigo
  pinky: '#c084fc',     // Purple
};

function getJointColor(index: number): string {
  if (index === 0) return FINGER_COLORS.wrist;
  if (index >= 1 && index <= 4) return FINGER_COLORS.thumb;
  if (index >= 5 && index <= 8) return FINGER_COLORS.index;
  if (index >= 9 && index <= 12) return FINGER_COLORS.middle;
  if (index >= 13 && index <= 16) return FINGER_COLORS.ring;
  return FINGER_COLORS.pinky;
}

export const LandmarkPoseVisualizer: React.FC<LandmarkPoseVisualizerProps> = ({
  landmarks,
  signName,
  width = 240,
  height = 180,
  className = '',
  showLabels = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset & clear with sleek dark aesthetic
    ctx.clearRect(0, 0, width, height);

    // Dark high-tech background
    const bgGrad = ctx.createRadialGradient(
      width / 2, height / 2, 10,
      width / 2, height / 2, Math.max(width, height) / 1.1
    );
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle coordinate grid
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    const step = 20;
    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!landmarks || landmarks.length < 21) {
      // Fallback message
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Landmark Model Initializing...', width / 2, height / 2);
      return;
    }

    // 1. Calculate Bounding Box to auto-scale & center landmarks cleanly
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const p of landmarks) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const spanX = Math.max(0.001, maxX - minX);
    const spanY = Math.max(0.001, maxY - minY);

    // Leave 22% padding around edges
    const pad = 24;
    const usableW = width - pad * 2;
    const usableH = height - pad * 2;
    const scale = Math.min(usableW / spanX, usableH / spanY);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const transformPoint = (p: LandmarkPoint) => ({
      x: width / 2 + (p.x - midX) * scale,
      y: height / 2 + (p.y - midY) * scale,
    });

    const pts = landmarks.map(transformPoint);

    // 2. Stylized Hand Contour Silhouette (Outer polygon glow)
    ctx.save();
    ctx.beginPath();
    // Contour: Wrist (0) -> Thumb (1,2,3,4) -> Index (8) -> Middle (12) -> Ring (16) -> Pinky (20,19,18,17) -> Wrist (0)
    const contourIndices = [0, 1, 2, 3, 4, 8, 12, 16, 20, 19, 18, 17, 0];
    if (pts[0]) {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const idx of contourIndices) {
        if (pts[idx]) ctx.lineTo(pts[idx].x, pts[idx].y);
      }
      ctx.closePath();
      const polyGrad = ctx.createLinearGradient(0, 0, 0, height);
      polyGrad.addColorStop(0, 'rgba(99, 102, 241, 0.16)');
      polyGrad.addColorStop(1, 'rgba(56, 189, 248, 0.08)');
      ctx.fillStyle = polyGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Draw Bone Connections
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [s, e] of HAND_CONNECTIONS) {
      const p1 = pts[s];
      const p2 = pts[e];
      if (!p1 || !p2) continue;

      // Glow pass
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Sharp core bone
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#c7d2fe';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // 4. Draw Joint Keypoints with Color Coding
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const color = getJointColor(i);
      const isTip = [4, 8, 12, 16, 20].includes(i);
      const isWrist = i === 0;

      // Outer glow circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, isWrist ? 6.5 : isTip ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = isTip || isWrist ? 8 : 4;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner white center
      ctx.beginPath();
      ctx.arc(p.x, p.y, isWrist ? 3.5 : isTip ? 2.5 : 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // 5. Fingertip Labels (T, I, M, R, P, W)
    if (showLabels) {
      const tipLabels: [number, string][] = [
        [0, 'W'],
        [4, 'T'],
        [8, 'I'],
        [12, 'M'],
        [16, 'R'],
        [20, 'P'],
      ];

      ctx.font = 'bold 9px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const [idx, letter] of tipLabels) {
        const p = pts[idx];
        if (!p) continue;

        // Position pill slightly outward
        const offsetY = idx === 0 ? 12 : -11;
        const pillX = p.x;
        const pillY = p.y + offsetY;

        // Pill background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.arc(pillX, pillY, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = getJointColor(idx);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Letter
        ctx.fillStyle = '#ffffff';
        ctx.fillText(letter, pillX, pillY);
      }
    }

    // Badge showing "21-Point AI Landmark Topology"
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('21-PT AI TOPOLOGY', 8, height - 8);

    ctx.textAlign = 'right';
    ctx.fillText('ISL CANONICAL', width - 8, height - 8);
  }, [landmarks, width, height, showLabels, signName]);

  return (
    <div className={`relative rounded-md overflow-hidden border border-slate-800 shadow-inner bg-slate-950 ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-auto block select-none pointer-events-none"
      />
      {/* Legend pill strip */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700/60 text-[9px] font-mono text-slate-300 backdrop-blur-xs">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          T
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          I
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          M
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          R
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          P
        </span>
      </div>
    </div>
  );
};
