/** Typed fetch wrappers for the MarcosScript FastAPI backend. */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export const getMediaUrl = (path: string) => 
  `${API_BASE}/media?path=${encodeURIComponent(path)}`;

export interface ProcessRequest {
  photo_ids: number[];
  frame_filenames: string[];
}

export interface ProcessResult {
  photo_id: number;
  photo_filename: string;
  frame_filename: string;
  status: 'processed' | 'skipped' | 'error';
  output_filename?: string;
  error?: string;
}

export interface ProcessResponse {
  results: ProcessResult[];
  total_processed: number;
  total_skipped: number;
}

export interface WatcherStatus {
  event_id: number;
  is_watching: boolean;
  is_active: boolean;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// Event API
export const eventsApi = {
  list: () => fetchJson<any[]>(`${API_BASE}/events/`),

  get: (eventId: number) => fetchJson<any>(`${API_BASE}/events/${eventId}`),

  create: (data: {
    name: string;
    source_photos_path: string;
    frames_path: string;
    output_path: string;
  }) =>
    fetchJson<any>(`${API_BASE}/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (eventId: number, data: Partial<any>) =>
    fetchJson<any>(`${API_BASE}/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  delete: (eventId: number) =>
    fetch(`${API_BASE}/events/${eventId}`, { method: 'DELETE' }),
};

// Photos API
export const photosApi = {
  listPhotos: (eventId: number) =>
    fetchJson<any[]>(`${API_BASE}/events/${eventId}/photos`),

  listFrames: (eventId: number) =>
    fetchJson<any[]>(`${API_BASE}/events/${eventId}/frames`),
};

// Watcher API
export const watcherApi = {
  start: (eventId: number) =>
    fetchJson<{ status: string; event_id: number; path: string }>(
      `${API_BASE}/events/${eventId}/watcher/start`,
      { method: 'POST' }
    ),

  stop: (eventId: number) =>
    fetchJson<{ status: string; event_id: number }>(
      `${API_BASE}/events/${eventId}/watcher/stop`,
      { method: 'POST' }
    ),

  status: (eventId: number) =>
    fetchJson<WatcherStatus>(`${API_BASE}/events/${eventId}/watcher/status`),
};

// Process API
export const processApi = {
  process: (eventId: number, request: ProcessRequest) =>
    fetchJson<ProcessResponse>(
      `${API_BASE}/events/${eventId}/process`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }
    ),
};
