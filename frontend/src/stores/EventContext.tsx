import { createContext, ParentComponent, useContext, createEffect, onCleanup } from 'solid-js';
import { createStore as solidCreateStore, SetStoreFunction } from 'solid-js/store';

// Types matching the backend schemas
export interface ProcessedFrame {
  id: number;
  frame_filename: string;
  output_filename: string;
  processed_at: string;
  // Drive metadata
  drive_file_id?: string | null;
  drive_web_view_link?: string | null;
  drive_uploaded_at?: string | null;
  drive_upload_error?: string | null;
  // Helper
  is_sendable?: boolean;
}

// Helper to check if a processed frame has a Drive link (sendable)
export const isSendable = (frame: ProcessedFrame): boolean =>
  !!frame.drive_web_view_link;

export interface CipLookupResult {
  cip: string;
  name: string | null;
  email: string | null;
  found: boolean;
}

export interface EmailSendRecord {
  id: number;
  event_id: number;
  cip: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  created_at: string;
  items: Array<{
    id: number;
    processed_frame_id: number;
    drive_link: string;
    status: string;
    error_message: string | null;
    sent_at: string | null;
  }>;
}

export interface Photo {
  id: number;
  event_id: number;
  filename: string;
  file_hash: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  processed_frames: ProcessedFrame[];
}

export interface Frame {
  filename: string;
  path: string;
}

export interface Event {
  id: number;
  name: string;
  source_photos_path: string;
  frames_path: string;
  output_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventState {
  events: Event[];
  currentEvent: Event | null;
  photos: Photo[];
  frames: Frame[];
  isWatching: boolean;
  loading: boolean;
  error: string | null;
}

interface EventStoreValue {
  state: EventState;
  setState: SetStoreFunction<EventState>;
  // Actions
  loadEvents: () => Promise<void>;
  selectEvent: (eventId: number) => Promise<void>;
  loadPhotos: (eventId: number) => Promise<void>;
  loadFrames: (eventId: number) => Promise<void>;
  startWatcher: (eventId: number) => Promise<void>;
  stopWatcher: (eventId: number) => Promise<void>;
  fetchWatcherStatus: (eventId: number) => Promise<void>;
  createEvent: (data: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => Promise<void>;
  deleteEvent: (eventId: number) => Promise<void>;
  processPhotos: (eventId: number, photoIds: number[], frameFilenames: string[]) => Promise<void>;
  // Email send actions
  cipLookup: (cip: string) => Promise<CipLookupResult>;
  sendEmail: (eventId: number, request: EmailSendRequest) => Promise<EmailSendRecord[]>;
  listEmailSends: (eventId: number, status?: string) => Promise<EmailSendRecord[]>;
  getEmailSend: (sendId: number) => Promise<EmailSendRecord>;
  retryDriveUpload: (frameId: number) => Promise<DriveUploadResponse>;
}

export interface EmailSendRequest {
  processed_frame_ids: number[];
  recipients: RecipientInput[];
  subject: string;
  body?: string;
  html: boolean;
  cc?: string[];
  bcc?: string[];
  usuario_creacion?: string;
}

export interface RecipientInput {
  cip?: string;
  name?: string;
  email: string;
}

export interface DriveUploadResponse {
  success: boolean;
  message: string;
  drive_file_id?: string | null;
  drive_web_view_link?: string | null;
  drive_uploaded_at?: string | null;
  drive_upload_error?: string | null;
}

const EventContext = createContext<EventStoreValue>();

export const EventProvider: ParentComponent = (props) => {
  const [state, setState] = solidCreateStore<EventState>({
    events: [],
    currentEvent: null,
    photos: [],
    frames: [],
    isWatching: false,
    loading: false,
    error: null,
  });

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

  const store: EventStoreValue = {
    state,
    setState,

    loadEvents: async () => {
      setState('loading', true);
      setState('error', null);
      try {
        const res = await fetch(`${API_BASE}/events`);
        if (!res.ok) throw new Error('Failed to load events');
        const data = await res.json();
        setState('events', data);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setState('loading', false);
      }
    },

    selectEvent: async (eventId: number) => {
      const event = state.events.find((e) => e.id === eventId);
      if (event) {
        setState('currentEvent', event);
        await Promise.all([
          store.loadPhotos(eventId),
          store.loadFrames(eventId),
          store.fetchWatcherStatus(eventId)
        ]);
      }
    },

    loadPhotos: async (eventId: number) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/photos`);
        if (!res.ok) throw new Error('Failed to load photos');
        const data = await res.json();
        setState('photos', data);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      }
    },

    loadFrames: async (eventId: number) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/frames`);
        if (!res.ok) throw new Error('Failed to load frames');
        const data = await res.json();
        setState('frames', data);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      }
    },

    startWatcher: async (eventId: number) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/watcher/start`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to start watcher');
        setState('isWatching', true);
        // Update event's is_active in the list
        setState('events', (e) => e.id === eventId, 'is_active', true);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      }
    },

    stopWatcher: async (eventId: number) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/watcher/stop`, { method: 'POST' });
        if (res.ok) {
          setState('isWatching', false);
          setState('events', (e) => e.id === eventId, 'is_active', false);
        }
      } catch (e) {
        console.error('Failed to stop watcher', e);
      }
    },

    fetchWatcherStatus: async (eventId: number) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/watcher/status`);
        if (res.ok) {
          const data = await res.json();
          setState('isWatching', data.is_watching);
        }
      } catch (e) {
        console.error('Failed to fetch watcher status', e);
      }
    },

    createEvent: async (data) => {
      setState('loading', true);
      try {
        const res = await fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create event');
        const newEvent = await res.json();
        setState('events', (events) => [...events, newEvent]);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setState('loading', false);
      }
    },

    deleteEvent: async (eventId: number) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete event');
        setState('events', (events) => events.filter((e) => e.id !== eventId));
        if (state.currentEvent?.id === eventId) {
          setState('currentEvent', null);
          setState('photos', []);
          setState('frames', []);
        }
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      }
    },

    processPhotos: async (eventId: number, photoIds: number[], frameFilenames: string[]) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_ids: photoIds, frame_filenames: frameFilenames }),
        });
        if (!res.ok) throw new Error('Failed to process photos');
        // Reload photos to get updated processed_frames
        await store.loadPhotos(eventId);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      }
    },

    cipLookup: async (cip: string) => {
      const res = await fetch(`${API_BASE}/cip/${encodeURIComponent(cip)}/lookup`);
      if (!res.ok) throw new Error('CIP lookup failed');
      return res.json() as CipLookupResult;
    },

    sendEmail: async (eventId: number, request: EmailSendRequest) => {
      const res = await fetch(`${API_BASE}/events/${eventId}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Email send failed' }));
        throw new Error(err.detail || 'Email send failed');
      }
      const data = await res.json();
      return (data.sends as EmailSendResponse[]);
    },

    listEmailSends: async (eventId: number, status?: string) => {
      const url = status
        ? `${API_BASE}/events/${eventId}/email/sends?status=${encodeURIComponent(status)}`
        : `${API_BASE}/events/${eventId}/email/sends`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load email history');
      return res.json() as EmailSendRecord[];
    },

    getEmailSend: async (sendId: number) => {
      const res = await fetch(`${API_BASE}/email/sends/${sendId}`);
      if (!res.ok) throw new Error('Failed to load email send details');
      return res.json() as EmailSendRecord;
    },

    retryDriveUpload: async (frameId: number) => {
      const res = await fetch(`${API_BASE}/processed-frames/${frameId}/drive-upload`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Retry failed' }));
        throw new Error(err.detail || 'Retry failed');
      }
      // Reload photos after retry
      if (state.currentEvent) {
        await store.loadPhotos(state.currentEvent.id);
      }
      return res.json() as DriveUploadResponse;
    },
  };

  return (
    <EventContext.Provider value={store}>
      {props.children}
    </EventContext.Provider>
  );
};

export const useEventStore = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventStore must be used within an EventProvider');
  }
  return context;
};
