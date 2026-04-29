import { createContext, ParentComponent, useContext, createEffect, onCleanup } from 'solid-js';
import { createStore as solidCreateStore, SetStoreFunction } from 'solid-js/store';

// Types matching the backend schemas
export interface ProcessedFrame {
  id: number;
  frame_filename: string;
  output_filename: string;
  processed_at: string;
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
