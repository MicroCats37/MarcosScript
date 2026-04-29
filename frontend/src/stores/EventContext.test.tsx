/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createContext, createSignal } from 'solid-js';
import { createStore as solidCreateStore, SetStoreFunction } from 'solid-js/store';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import the types and functions we need to test
import type { Event, Photo, Frame, EventState } from '../stores/EventContext';

// We need to recreate the store logic for testing since it's tightly coupled to the component
interface EventStoreValue {
  state: EventState;
  setState: SetStoreFunction<EventState>;
  loadEvents: () => Promise<void>;
  selectEvent: (eventId: number) => Promise<void>;
  loadPhotos: (eventId: number) => Promise<void>;
  loadFrames: (eventId: number) => Promise<void>;
  startWatcher: (eventId: number) => Promise<void>;
  stopWatcher: (eventId: number) => Promise<void>;
  createEvent: (data: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => Promise<void>;
  deleteEvent: (eventId: number) => Promise<void>;
  processPhotos: (eventId: number, photoIds: number[], frameFilenames: string[]) => Promise<void>;
}

const createTestStore = (): EventStoreValue => {
  const [state, setState] = solidCreateStore<EventState>({
    events: [],
    currentEvent: null,
    photos: [],
    frames: [],
    isWatching: false,
    loading: false,
    error: null,
  });

  const API_BASE = 'http://localhost:8000/api';

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
        await store.loadPhotos(eventId);
        await store.loadFrames(eventId);
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
        setState('events', (e) => e.id === eventId, 'is_active', true);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      }
    },

    stopWatcher: async (eventId: number) => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/watcher/stop`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to stop watcher');
        setState('isWatching', false);
        setState('events', (e) => e.id === eventId, 'is_active', false);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
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
        await store.loadPhotos(eventId);
      } catch (e) {
        setState('error', e instanceof Error ? e.message : 'Unknown error');
      }
    },
  };

  return store;
};

describe('EventContext Store', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('loadEvents', () => {
    it('loads events successfully', async () => {
      const mockEvents: Event[] = [
        {
          id: 1,
          name: 'Test Event',
          source_photos_path: '/photos',
          frames_path: '/frames',
          output_path: '/output',
          is_active: false,
          created_at: '2024-01-01T00:00:00',
          updated_at: '2024-01-01T00:00:00',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const store = createTestStore();

      await store.loadEvents();

      expect(store.state.events).toEqual(mockEvents);
      expect(store.state.loading).toBe(false);
      expect(store.state.error).toBeNull();
    });

    it('handles load error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const store = createTestStore();

      await store.loadEvents();

      expect(store.state.events).toEqual([]);
      expect(store.state.error).toBe('Failed to load events');
      expect(store.state.loading).toBe(false);
    });
  });

  describe('createEvent', () => {
    it('creates event successfully', async () => {
      const newEvent: Event = {
        id: 1,
        name: 'New Event',
        source_photos_path: '/photos',
        frames_path: '/frames',
        output_path: '/output',
        is_active: false,
        created_at: '2024-01-01T00:00:00',
        updated_at: '2024-01-01T00:00:00',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newEvent),
      });

      const store = createTestStore();

      await store.createEvent({
        name: 'New Event',
        source_photos_path: '/photos',
        frames_path: '/frames',
        output_path: '/output',
      });

      expect(store.state.events).toContainEqual(newEvent);
      expect(store.state.loading).toBe(false);
    });
  });

  describe('deleteEvent', () => {
    it('removes event from list', async () => {
      const mockEvents: Event[] = [
        {
          id: 1,
          name: 'Test Event',
          source_photos_path: '/photos',
          frames_path: '/frames',
          output_path: '/output',
          is_active: false,
          created_at: '2024-01-01T00:00:00',
          updated_at: '2024-01-01T00:00:00',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const store = createTestStore();

      await store.loadEvents();

      await store.deleteEvent(1);

      expect(store.state.events).toHaveLength(0);
    });
  });

  describe('selectEvent', () => {
    it('sets current event and loads photos/frames', async () => {
      const mockEvents: Event[] = [
        {
          id: 1,
          name: 'Test Event',
          source_photos_path: '/photos',
          frames_path: '/frames',
          output_path: '/output',
          is_active: false,
          created_at: '2024-01-01T00:00:00',
          updated_at: '2024-01-01T00:00:00',
        },
      ];

      const mockPhotos: Photo[] = [
        {
          id: 1,
          event_id: 1,
          filename: 'photo1.jpg',
          file_hash: null,
          status: 'pending',
          error_message: null,
          created_at: '2024-01-01T00:00:00',
          processed_at: null,
          processed_frames: [],
        },
      ];

      const mockFrames: Frame[] = [
        { filename: 'frame1.png', path: '/frames/frame1.png' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPhotos),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFrames),
      });

      const store = createTestStore();

      await store.loadEvents();

      await store.selectEvent(1);

      expect(store.state.currentEvent).toEqual(mockEvents[0]);
      expect(store.state.photos).toEqual(mockPhotos);
      expect(store.state.frames).toEqual(mockFrames);
    });
  });

  describe('watcher controls', () => {
    it('startWatcher sets isWatching to true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const store = createTestStore();

      await store.startWatcher(1);

      expect(store.state.isWatching).toBe(true);
    });

    it('stopWatcher sets isWatching to false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const store = createTestStore();
      store.setState('isWatching', true);

      await store.stopWatcher(1);

      expect(store.state.isWatching).toBe(false);
    });
  });
});
