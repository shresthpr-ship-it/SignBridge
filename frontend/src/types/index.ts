export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface LandmarkPoint3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface HandDetection {
  handedness: 'Left' | 'Right' | string;
  confidence: number;
  landmarks: LandmarkPoint3D[];
}

export interface PoseDetection {
  confidence?: number;
  landmarks: LandmarkPoint3D[];
}

export interface FaceDetection {
  confidence?: number;
  landmarks: LandmarkPoint3D[];
}

export interface FrameLandmarks {
  frame_index: number;
  timestamp_ms: number;
  detection_status: 'detected' | 'partial_detection' | 'no_landmarks_detected';
  hands: HandDetection[];
  pose?: PoseDetection | null;
  face?: FaceDetection | null;
  missing_elements: string[];
}

export interface ExtractionResult {
  sample_id: string;
  media_type: 'image' | 'video';
  target_language: string;
  sign_label?: string | null;
  filename: string;
  file_url?: string | null;
  total_frames: number;
  processed_frames: number;
  frames_with_detections: number;
  missing_detections: number;
  detection_rate_pct: number;
  processing_time_ms: number;
  creation_timestamp: string;
  engine: string;
  frames: FrameLandmarks[];
}

export interface SignClass {
  id: string;
  name: string;
  category: string;
  description: string;
  sample_count: number;
  created_at?: string;
}

export interface SignSample {
  id: string;
  label: string;
  split: 'train' | 'val' | 'test';
  landmarks: LandmarkPoint[];
  created_at: string;
  device_info?: string;
  notes?: string;
  review_status?: 'pending_review' | 'approved' | 'rejected';
  quality_score?: number;
}

export interface PredictionAlternative {
  label: string;
  confidence: number;
}

export interface RecognitionResult {
  label: string;
  confidence: number;
  alternatives: PredictionAlternative[];
  latency_ms: number;
  hand_detected: boolean;
}

export interface DatasetStats {
  total_samples: number;
  unique_labels: number;
  total_classes?: number;
  pending_review: number;
  approved_samples: number;
  rejected_samples: number;
  split_distribution: {
    train: number;
    val: number;
    test: number;
  };
  class_distribution: Record<string, number>;
  avg_samples_per_class: number;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  category: string;
}

export interface MediaRecord {
  id: string;
  media_type: 'image' | 'video';
  sign_language: string;
  sign_label: string;
  description?: string;
  signer_id: string;
  consent_confirmed: boolean;
  filename: string;
  file_url: string;
  file_size_bytes: number;
  split: 'train' | 'val' | 'test';
  created_at: string;
}

export interface SystemInfo {
  status: string;
  version: string;
  backend_engine: string;
  mediapipe_available: boolean;
  samples_count: number;
  classes_count: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
}

export type ActiveTab =
  | 'overview'
  | 'recognition'
  | 'studio'
  | 'video'
  | 'dataset'
  | 'labels'
  | 'augmentation'
  | 'review'
  | 'export'
  | 'training'
  | 'settings';

export interface ModelStatus {
  is_model_configured: boolean;
  has_prototype_matcher: boolean;
  model_name: string;
  tier: 'trained_sklearn_mlp' | 'pretrained_sequence_model' | 'isolated_sign_prototype' | 'landmark_detection_only';
  capabilities: string[];
  limitations: string[];
  temporal_smoothing_window: number;
  sklearn_model_loaded?: boolean;
  classes?: string[];
}

export interface Language {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface QualityIssue {
  sample_id: string;
  label: string;
  issues: string[];
  review_status: string;
  created_at: string;
  notes: string;
  is_augmented: boolean;
  quality_score: number;
}

export interface TrainingStatus {
  can_train: boolean;
  total_samples: number;
  valid_samples: number;
  total_classes: number;
  viable_classes: Record<string, number>;
  insufficient_classes: Record<string, number>;
  minimum_samples_per_class: number;
  minimum_classes: number;
  training_pipeline: string;
  requirements_met: boolean;
  trained_model_exists: boolean;
  message: string;
}

export interface TrainingResult {
  status: string;
  model_path: string;
  label_map_path: string;
  classes: string[];
  num_classes: number;
  train_samples: number;
  test_samples: number;
  train_accuracy: number;
  test_accuracy: number;
  trained_at: string;
  architecture: string;
  input_features: number;
  note: string;
}

export interface ExportResult {
  export_id: string;
  format: string;
  sample_count: number;
  filters_applied: Record<string, any>;
  download_url: string;
  created_at: string;
  status: string;
}

export interface TeachGestureResponse {
  status: string;
  label: string;
  language: string;
  samples_added: number;
  model_retrained: boolean;
  train_accuracy?: number | null;
  test_accuracy?: number | null;
  classes: string[];
  message: string;
}

export interface LiveFrameRecognitionResponse {
  landmark_detection_status: 'detected' | 'partial_detection' | 'no_landmarks_detected';
  hand_detected: boolean;
  landmarks: LandmarkPoint3D[];
  hands: HandDetection[];
  pose?: PoseDetection | null;
  face?: FaceDetection | null;
  missing_elements: string[];
  model_status: ModelStatus;
  predicted_sign: string | null;
  confidence_score: number | null;
  prediction_state: 'stable' | 'provisional' | 'unknown' | 'no_hand' | 'model_unavailable';
  stability_score: number;
  recognition_message: string;
  alternatives: PredictionAlternative[];
  latency_ms: number;
  timestamp: string;
  continuous_state?: ContinuousSessionState;
}

export interface RecognitionHistoryRecord {
  sign: string;
  confidence: number | null;
  state: 'stable' | 'provisional';
  stability_score?: number;
  latency_ms: number;
  time: string;
  handedness?: string | null;
}



export interface SignToken {
  id: string;
  sign: string;
  confidence: number;
  timestamp: number;
  duration_ms: number;
  motion_energy: number;
}

export interface GeneratedSentence {
  raw_sequence: string[];
  gloss_display: string;
  english_sentence: string;
  hindi_sentence: string;
  hindi_phonetic: string;
  is_complete: boolean;
  confidence_avg: number;
  grammar_pattern: string;
}

export interface ContinuousSessionState {
  session_id: string;
  is_active: boolean;
  motion_state: 'signing' | 'transition' | 'idle' | string;
  motion_energy: number;
  current_frame_sign: string | null;
  current_frame_confidence: number | null;
  stable_candidate: string | null;
  stable_candidate_frames: number;
  active_sequence: SignToken[];
  raw_gloss_sequence: string[];
  generated_sentence: GeneratedSentence | null;
  total_tokens_recognized: number;
  session_duration_s: number;
  last_commit_time_ago_s: number;
}
