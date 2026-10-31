import { LandmarkPoint, LandmarkPoint3D, FrameLandmarks } from '../types';

export const HAND_CONNECTIONS: [number, number][] = [
  // Palm base
  [0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [0, 17],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
];

// Upper body pose skeleton connections for signing space
export const POSE_UPPER_CONNECTIONS: [number, number][] = [
  // Shoulders & Torso
  [11, 12], // left shoulder to right shoulder
  [11, 23], // left shoulder to left hip
  [12, 24], // right shoulder to right hip
  [23, 24], // left hip to right hip
  // Left arm
  [11, 13], // left shoulder to left elbow
  [13, 15], // left elbow to left wrist
  // Right arm
  [12, 14], // right shoulder to right elbow
  [14, 16], // right elbow to right wrist
  // Neck / Head
  [9, 10],   // mouth left to mouth right
  [11, 0],   // left shoulder to nose
  [12, 0],   // right shoulder to nose
];

export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: (LandmarkPoint | LandmarkPoint3D)[],
  width: number,
  height: number,
  options?: {
    lineColor?: string;
    jointColor?: string;
    wristColor?: string;
    lineWidth?: number;
    jointRadius?: number;
    label?: string;
  }
) {
  if (!landmarks || landmarks.length < 21) return;

  const lineColor = options?.lineColor || '#6366f1';
  const jointColor = options?.jointColor || '#818cf8';
  const wristColor = options?.wristColor || '#4338ca';
  const lineWidth = options?.lineWidth || 2;
  const jointRadius = options?.jointRadius || 3.5;

  ctx.save();

  // Draw connections (bones)
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const p1 = landmarks[startIdx];
    const p2 = landmarks[endIdx];
    if (!p1 || !p2) continue;

    const x1 = p1.x * width;
    const y1 = p1.y * height;
    const x2 = p2.x * width;
    const y2 = p2.y * height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw keypoint joints
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    const x = p.x * width;
    const y = p.y * height;

    ctx.beginPath();
    ctx.arc(x, y, i === 0 ? jointRadius + 1.5 : jointRadius, 0, 2 * Math.PI);
    ctx.fillStyle = i === 0 ? wristColor : jointColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Optional Hand label (Left / Right)
  if (options?.label && landmarks[0]) {
    const wristX = landmarks[0].x * width;
    const wristY = landmarks[0].y * height;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(options.label, wristX - 14, wristY + 16);
  }

  ctx.restore();
}

export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint3D[],
  width: number,
  height: number,
  options?: {
    lineColor?: string;
    jointColor?: string;
    lineWidth?: number;
  }
) {
  if (!landmarks || landmarks.length === 0) return;

  const lineColor = options?.lineColor || 'rgba(56, 189, 248, 0.75)'; // Sky blue
  const jointColor = options?.jointColor || '#0284c7';
  const lineWidth = options?.lineWidth || 1.8;

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  for (const [startIdx, endIdx] of POSE_UPPER_CONNECTIONS) {
    if (startIdx < landmarks.length && endIdx < landmarks.length) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (!p1 || !p2) continue;

      // Filter low visibility keypoints if visibility is reported
      if (p1.visibility !== undefined && p1.visibility !== null && p1.visibility < 0.25) continue;
      if (p2.visibility !== undefined && p2.visibility !== null && p2.visibility < 0.25) continue;

      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }
  }

  // Key joints (shoulders, elbows, wrists)
  const keyJointIndices = [11, 12, 13, 14, 15, 16, 23, 24];
  for (const idx of keyJointIndices) {
    if (idx < landmarks.length) {
      const p = landmarks[idx];
      if (p && (p.visibility === undefined || p.visibility === null || p.visibility >= 0.25)) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 3, 0, 2 * Math.PI);
        ctx.fillStyle = jointColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

export function drawFaceAnchors(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint3D[],
  width: number,
  height: number,
  options?: {
    color?: string;
    radius?: number;
  }
) {
  if (!landmarks || landmarks.length === 0) return;

  const color = options?.color || '#f59e0b'; // Amber
  const radius = options?.radius || 2;

  ctx.save();
  ctx.fillStyle = color;

  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
}

export function drawFullFrameLandmarks(
  ctx: CanvasRenderingContext2D,
  frame: FrameLandmarks,
  width: number,
  height: number,
  toggles: {
    showHands: boolean;
    showPose: boolean;
    showFace: boolean;
  }
) {
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Pose first (background layer)
  if (toggles.showPose && frame.pose && frame.pose.landmarks) {
    drawPoseSkeleton(ctx, frame.pose.landmarks, width, height);
  }

  // 2. Draw Face Non-Manual Markers
  if (toggles.showFace && frame.face && frame.face.landmarks) {
    drawFaceAnchors(ctx, frame.face.landmarks, width, height);
  }

  // 3. Draw Hands (foreground layer)
  if (toggles.showHands && frame.hands) {
    for (const hand of frame.hands) {
      const isLeft = hand.handedness.toLowerCase().includes('left');
      drawHandSkeleton(ctx, hand.landmarks, width, height, {
        lineColor: isLeft ? '#10b981' : '#6366f1', // Left in Emerald, Right in Indigo
        jointColor: isLeft ? '#34d399' : '#818cf8',
        wristColor: isLeft ? '#047857' : '#4338ca',
        lineWidth: 2.2,
        label: `${hand.handedness} (${Math.round(hand.confidence * 100)}%)`,
      });
    }
  }
}

/** Generates canonical test hand landmarks for fallback if needed */
export function getSimulatedHandLandmarks(gesture: 'hello' | 'yes' | 'peace' | 'ily' | 'fist' = 'hello'): LandmarkPoint[] {
  const pts: LandmarkPoint[] = [{ x: 0.5, y: 0.78, z: 0.0 }];

  if (gesture === 'peace') {
    pts.push({ x: 0.44, y: 0.70 }, { x: 0.46, y: 0.65 }, { x: 0.48, y: 0.62 }, { x: 0.50, y: 0.60 });
    pts.push({ x: 0.46, y: 0.55 }, { x: 0.44, y: 0.42 }, { x: 0.42, y: 0.30 }, { x: 0.40, y: 0.20 });
    pts.push({ x: 0.52, y: 0.54 }, { x: 0.54, y: 0.41 }, { x: 0.56, y: 0.29 }, { x: 0.58, y: 0.19 });
    pts.push({ x: 0.55, y: 0.58 }, { x: 0.56, y: 0.64 }, { x: 0.55, y: 0.68 }, { x: 0.53, y: 0.66 });
    pts.push({ x: 0.60, y: 0.62 }, { x: 0.61, y: 0.67 }, { x: 0.59, y: 0.70 }, { x: 0.56, y: 0.68 });
  } else if (gesture === 'yes') {
    pts.push({ x: 0.42, y: 0.68 }, { x: 0.38, y: 0.55 }, { x: 0.36, y: 0.42 }, { x: 0.35, y: 0.30 });
    for (const base_x of [0.48, 0.52, 0.56, 0.60]) {
      pts.push(
        { x: base_x, y: 0.58 },
        { x: base_x + 0.02, y: 0.64 },
        { x: base_x + 0.01, y: 0.68 },
        { x: base_x - 0.01, y: 0.65 }
      );
    }
  } else if (gesture === 'ily') {
    pts.push({ x: 0.40, y: 0.70 }, { x: 0.32, y: 0.62 }, { x: 0.26, y: 0.55 }, { x: 0.20, y: 0.48 });
    pts.push({ x: 0.46, y: 0.55 }, { x: 0.45, y: 0.42 }, { x: 0.44, y: 0.30 }, { x: 0.43, y: 0.20 });
    pts.push({ x: 0.52, y: 0.58 }, { x: 0.53, y: 0.65 }, { x: 0.51, y: 0.69 }, { x: 0.48, y: 0.67 });
    pts.push({ x: 0.56, y: 0.60 }, { x: 0.57, y: 0.66 }, { x: 0.55, y: 0.70 }, { x: 0.52, y: 0.68 });
    pts.push({ x: 0.60, y: 0.62 }, { x: 0.63, y: 0.50 }, { x: 0.65, y: 0.40 }, { x: 0.68, y: 0.30 });
  } else if (gesture === 'fist') {
    pts.push({ x: 0.43, y: 0.70 }, { x: 0.42, y: 0.62 }, { x: 0.44, y: 0.54 }, { x: 0.46, y: 0.50 });
    for (const base_x of [0.48, 0.52, 0.56, 0.60]) {
      pts.push(
        { x: base_x, y: 0.60 },
        { x: base_x + 0.02, y: 0.66 },
        { x: base_x + 0.01, y: 0.70 },
        { x: base_x - 0.01, y: 0.68 }
      );
    }
  } else {
    // hello / open palm
    pts.push({ x: 0.42, y: 0.72 }, { x: 0.35, y: 0.65 }, { x: 0.30, y: 0.58 }, { x: 0.25, y: 0.52 });
    pts.push({ x: 0.45, y: 0.55 }, { x: 0.44, y: 0.42 }, { x: 0.43, y: 0.32 }, { x: 0.42, y: 0.22 });
    pts.push({ x: 0.50, y: 0.54 }, { x: 0.50, y: 0.40 }, { x: 0.50, y: 0.28 }, { x: 0.50, y: 0.18 });
    pts.push({ x: 0.55, y: 0.56 }, { x: 0.56, y: 0.43 }, { x: 0.57, y: 0.33 }, { x: 0.58, y: 0.24 });
    pts.push({ x: 0.60, y: 0.60 }, { x: 0.63, y: 0.50 }, { x: 0.65, y: 0.42 }, { x: 0.67, y: 0.34 });
  }

  return pts;
}
