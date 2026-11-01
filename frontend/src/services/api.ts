import {
  SignClass,
  SignSample,
  DatasetStats,
  SystemInfo,
  RecognitionResult,
  LandmarkPoint,
  ActivityLogItem,
  MediaRecord,
  ExtractionResult,
  ModelStatus,
  LiveFrameRecognitionResponse,
  RecognitionHistoryRecord,
  Language,
  QualityIssue,
  TrainingStatus,
  TrainingResult,
  ExportResult,
  TeachGestureResponse,
  SignToken,
  GeneratedSentence,
  ContinuousSessionState,
  SentenceModeProcessingResult,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
        ...options,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorBody.detail || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.warn(`[API] ${endpoint} request error:`, err.message);
      throw err;
    }
  }

  // System
  async getHealth(): Promise<{ status: string; service: string; version: string }> {
    return this.request('/health');
  }

  async getSystemInfo(): Promise<SystemInfo> {
    return this.request('/system/info');
  }

  // Classes
  async getClasses(): Promise<SignClass[]> {
    return this.request('/dataset/classes');
  }

  async createClass(name: string, category: string = 'General', description: string = ''): Promise<SignClass> {
    return this.request('/dataset/classes', {
      method: 'POST',
      body: JSON.stringify({ name, category, description }),
    });
  }

  // Samples
  async getSamples(label?: string, split?: string, reviewStatus?: string): Promise<SignSample[]> {
    const params = new URLSearchParams();
    if (label) params.append('label', label);
    if (split) params.append('split', split);
    if (reviewStatus) params.append('review_status', reviewStatus);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/dataset/samples${query}`);
  }

  async createSample(data: {
    label: string;
    split: 'train' | 'val' | 'test';
    landmarks: LandmarkPoint[];
    notes?: string;
    device_info?: string;
    review_status?: 'pending_review' | 'approved' | 'rejected';
    quality_score?: number;
  }): Promise<SignSample> {
    return this.request('/dataset/samples', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reviewSample(sampleId: string, status: 'approved' | 'rejected' | 'pending_review', notes?: string): Promise<SignSample> {
    return this.request(`/dataset/samples/${sampleId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes: notes || '' }),
    });
  }

  async augmentDataset(label: string, augmentationType: 'jitter' | 'scale' | 'mirror', count: number = 4): Promise<SignSample[]> {
    return this.request('/dataset/augment', {
      method: 'POST',
      body: JSON.stringify({ label, augmentation_type: augmentationType, count }),
    });
  }

  async getActivityLog(limit: number = 20): Promise<ActivityLogItem[]> {
    return this.request(`/dataset/activity?limit=${limit}`);
  }

  async deleteSample(sampleId: string): Promise<{ status: string; deleted_id: string }> {
    return this.request(`/dataset/samples/${sampleId}`, {
      method: 'DELETE',
    });
  }

  // Media Upload & Governance
  async uploadMedia(formData: FormData): Promise<MediaRecord> {
    const url = `${BASE_URL}/media/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || `Upload failed with status ${response.status}`);
    }
    return await response.json();
  }

  async getMediaRecords(label?: string, mediaType?: string): Promise<MediaRecord[]> {
    const params = new URLSearchParams();
    if (label) params.append('label', label);
    if (mediaType) params.append('media_type', mediaType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/media${query}`);
  }

  async deleteMediaRecord(mediaId: string): Promise<{ status: string; deleted_id: string }> {
    return this.request(`/media/${mediaId}`, {
      method: 'DELETE',
    });
  }

  // Real Computer Vision Pipeline
  async extractImageLandmarks(formData: FormData): Promise<ExtractionResult> {
    const url = `${BASE_URL}/vision/extract-image`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || `Image extraction failed with status ${response.status}`);
    }
    return await response.json();
  }

  async extractVideoLandmarks(formData: FormData): Promise<ExtractionResult> {
    const url = `${BASE_URL}/vision/extract-video`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || `Video extraction failed with status ${response.status}`);
    }
    return await response.json();
  }

  async getVisionStatus(): Promise<{ mediapipe_available: boolean; opencv_version: string; numpy_version: string; engine: string }> {
    return this.request('/vision/status');
  }

  // Stats
  async getStats(): Promise<DatasetStats> {
    return this.request('/dataset/stats');
  }

  // Export URL helper
  getExportUrl(format: 'json' | 'csv'): string {
    return `${BASE_URL}/dataset/export?format=${format}`;
  }

  // Recognition
  async predictSign(landmarks: LandmarkPoint[], topK: number = 3): Promise<RecognitionResult> {
    return this.request('/recognition/predict', {
      method: 'POST',
      body: JSON.stringify({ landmarks, top_k: topK }),
    });
  }

  // Live Recognition Pipeline
  async recognizeLiveFrame(
    frameBlob: Blob,
    topK: number = 3,
    detectPose: boolean = false,
    detectFace: boolean = false
  ): Promise<LiveFrameRecognitionResponse> {
    const formData = new FormData();
    formData.append('file', frameBlob, 'webcam_frame.jpg');
    const url = `${BASE_URL}/recognition/live-frame?top_k=${topK}&detect_pose=${detectPose}&detect_face=${detectFace}`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || `Live recognition failed with status ${response.status}`);
    }
    return await response.json();
  }

  async getRecognitionModelStatus(): Promise<ModelStatus> {
    return this.request('/recognition/status');
  }

  async resetRecognitionSession(): Promise<{ status: string; timestamp: string }> {
    return this.request('/recognition/reset-session', {
      method: 'POST',
    });
  }

  async getPredictionHistory(): Promise<RecognitionHistoryRecord[]> {
    return this.request('/recognition/history');
  }

  // Languages
  async getLanguages(): Promise<Language[]> {
    return this.request('/dataset/languages');
  }

  // Classes - delete
  async deleteClass(className: string): Promise<{ status: string; deleted_class: string }> {
    return this.request(`/dataset/classes/${encodeURIComponent(className)}`, { method: 'DELETE' });
  }

  // Webcam capture with landmark extraction
  async captureSample(formData: FormData): Promise<SignSample> {
    const url = `${BASE_URL}/dataset/samples/capture`;
    const response = await fetch(url, { method: 'POST', body: formData });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || `Capture failed with status ${response.status}`);
    }
    return await response.json();
  }

  // Quality issues
  async getQualityIssues(): Promise<{ total_issues: number; issues: QualityIssue[] }> {
    return this.request('/dataset/quality/issues');
  }

  // Export
  async generateExport(
    format: string,
    label?: string,
    includeAugmented: boolean = true,
    qualityFilter?: string
  ): Promise<ExportResult> {
    const params = new URLSearchParams({ format });
    if (label) params.append('label', label);
    if (!includeAugmented) params.append('include_augmented', 'false');
    if (qualityFilter) params.append('quality_filter', qualityFilter);
    return this.request(`/dataset/export/generate?${params.toString()}`, { method: 'POST' });
  }

  // Training
  async getTrainingStatus(): Promise<TrainingStatus> {
    return this.request('/recognition/training/status');
  }

  async trainModel(): Promise<TrainingResult> {
    return this.request('/recognition/train', { method: 'POST' });
  }

  // Interactive Gesture Teaching
  async teachGesture(data: {
    label: string;
    language?: string;
    landmarks: LandmarkPoint[];
    samples_count?: number;
    notes?: string;
    auto_train?: boolean;
  }): Promise<TeachGestureResponse> {
    return this.request('/recognition/teach', {
      method: 'POST',
      body: JSON.stringify({
        language: 'ASL',
        samples_count: 8,
        auto_train: true,
        ...data,
      }),
    });
  }

  async teachFromFrame(frameBlob: Blob, label: string, language: string = 'ASL'): Promise<TeachGestureResponse> {
    const formData = new FormData();
    formData.append('file', frameBlob, 'teach_frame.jpg');
    formData.append('label', label);
    formData.append('language', language);
    const url = `${BASE_URL}/recognition/teach-frame`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || `Teaching failed with status ${response.status}`);
    }
    return await response.json();
  }

  async deleteGesture(label: string): Promise<{
    status: string;
    deleted_gesture: string;
    deleted_samples: number;
    model_retrained: boolean;
    classes_remaining: number;
    message: string;
  }> {
    return this.request(`/recognition/gestures/${encodeURIComponent(label)}`, {
      method: 'DELETE',
    });
  }

  // Continuous Sign Recognition & Sentence Generation
  async getContinuousSession(): Promise<ContinuousSessionState> {
    return this.request('/recognition/continuous-session');
  }

  async resetContinuousSession(): Promise<{ status: string; timestamp: string }> {
    return this.request('/recognition/continuous-session/reset', { method: 'POST' });
  }

  async removeContinuousToken(): Promise<{
    status: string;
    removed_token?: SignToken;
    snapshot: ContinuousSessionState;
  }> {
    return this.request('/recognition/continuous-session/remove-token', { method: 'POST' });
  }

  async addContinuousToken(sign: string, confidence: number = 95.0): Promise<{
    status: string;
    token: SignToken;
    snapshot: ContinuousSessionState;
  }> {
    return this.request('/recognition/continuous-session/add-token', {
      method: 'POST',
      body: JSON.stringify({ sign, confidence }),
    });
  }

  async generateSentence(tokens: string[], confidences?: number[]): Promise<GeneratedSentence> {
    return this.request('/recognition/generate-sentence', {
      method: 'POST',
      body: JSON.stringify({ tokens, confidences }),
    });
  }

  // Sentence Mode API
  async getSentenceModeStatus(): Promise<{
    status: string;
    supported_video_formats: string[];
    max_file_size_mb: number;
    default_language: string;
    supported_languages: string[];
    model_status: ModelStatus;
    recommended_recording_duration_s: string;
  }> {
    return this.request('/sentence-mode/status');
  }

  async getSentenceModeHistory(): Promise<SentenceModeProcessingResult[]> {
    return this.request('/sentence-mode/history');
  }

  async translateRecordedSentence(
    videoBlob: Blob,
    targetLanguage: string = 'ISL'
  ): Promise<SentenceModeProcessingResult> {
    const formData = new FormData();
    const extension = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('file', videoBlob, `sentence_recording_${Date.now()}.${extension}`);
    formData.append('target_language', targetLanguage);

    const url = `${BASE_URL}/sentence-mode/translate`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || `Sentence translation failed with status ${response.status}`);
    }

    return await response.json();
  }
}

export const api = new ApiService();
