/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createStore as solidCreateStore } from 'solid-js/store';

// Mock the EventContext
import type { Event, Photo, Frame, EventState } from '../stores/EventContext';

// We need to mock the useEventStore hook
const mockUseEventStore = vi.fn();

vi.mock('../stores/EventContext', () => ({
  useEventStore: () => mockUseEventStore(),
}));

// Now import the component after mocking
import { EventDetail } from '../components/EventDetail';

describe('EventDetail Component', () => {
  const createMockStore = (overrides = {}) => {
    const [state, setState] = solidCreateStore<EventState>({
      events: [],
      currentEvent: null,
      photos: [],
      frames: [],
      isWatching: false,
      loading: false,
      error: null,
      ...overrides,
    });

    return {
      state,
      setState,
      loadEvents: vi.fn(),
      selectEvent: vi.fn(),
      loadPhotos: vi.fn(),
      loadFrames: vi.fn(),
      startWatcher: vi.fn(),
      stopWatcher: vi.fn(),
      createEvent: vi.fn(),
      deleteEvent: vi.fn(),
      processPhotos: vi.fn(),
    };
  };

  const mockEvent: Event = {
    id: 1,
    name: 'Test Event',
    source_photos_path: '/source/photos',
    frames_path: '/frames',
    output_path: '/output',
    is_active: false,
    created_at: '2024-01-01T00:00:00',
    updated_at: '2024-01-01T00:00:00',
  };

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
    {
      id: 2,
      event_id: 1,
      filename: 'photo2.jpg',
      file_hash: null,
      status: 'completed',
      error_message: null,
      created_at: '2024-01-01T00:00:00',
      processed_at: '2024-01-01T01:00:00',
      processed_frames: [{ id: 1, frame_filename: 'frame1.png', output_filename: 'photo2_frame1.png', processed_at: '2024-01-01T01:00:00' }],
    },
  ];

  const mockFrames: Frame[] = [
    { filename: 'frame1.png', path: '/frames/frame1.png' },
    { filename: 'frame2.png', path: '/frames/frame2.png' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fallback message when no event is selected', () => {
    const mockStore = createMockStore({ currentEvent: null });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Select an event to view details')).toBeInTheDocument();
  });

  it('renders event details when event is selected', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('/source/photos')).toBeInTheDocument();
    expect(screen.getByText('/frames')).toBeInTheDocument();
    expect(screen.getByText('/output')).toBeInTheDocument();
  });

  it('renders photos and frames grids', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Available Frames (2)')).toBeInTheDocument();
    expect(screen.getByText('Source Photos (2)')).toBeInTheDocument();
  });

  it('shows "Start Watcher" button when not watching', () => {
    const mockStore = createMockStore({
      currentEvent: { ...mockEvent, is_active: false },
      isWatching: false,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Start Watcher')).toBeInTheDocument();
  });

  it('shows "Stop Watcher" button when watching', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      isWatching: true,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Stop Watcher')).toBeInTheDocument();
  });

  it('shows "Watcher idle" status when not watching', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      isWatching: false,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Watcher idle')).toBeInTheDocument();
  });

  it('shows "Watching for new photos..." status when watching', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      isWatching: true,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Watching for new photos...')).toBeInTheDocument();
  });

  it('calls startWatcher when Start button is clicked', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      isWatching: false,
    });
    mockStore.startWatcher.mockResolvedValue(undefined);
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    fireEvent.click(screen.getByText('Start Watcher'));

    expect(mockStore.startWatcher).toHaveBeenCalledWith(1);
  });

  it('calls stopWatcher when Stop button is clicked', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      isWatching: true,
    });
    mockStore.stopWatcher.mockResolvedValue(undefined);
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    fireEvent.click(screen.getByText('Stop Watcher'));

    expect(mockStore.stopWatcher).toHaveBeenCalledWith(1);
  });

  it('shows photo status badges', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('shows processed frames count', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('1 processed')).toBeInTheDocument();
  });

  it('has Select All and Deselect All buttons for photos', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Deselect All')).toBeInTheDocument();
  });

  it('has Select All and Deselect All buttons for frames', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    // There should be two "Select All" buttons (one for photos, one for frames)
    const selectAllButtons = screen.getAllByText('Select All');
    expect(selectAllButtons).toHaveLength(2);
  });

  it('shows empty message when no frames found', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: [],
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText('No frames found in the frames directory')).toBeInTheDocument();
  });

  it('shows empty message when no photos found', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: [],
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    expect(screen.getByText(/No photos found/)).toBeInTheDocument();
  });

  it('disables Process button when no selection', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    const processButton = screen.getByText('Process Photos') as HTMLButtonElement;
    expect(processButton.disabled).toBe(true);
  });

  it('enables Process button when photos and frames selected', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockStore.processPhotos.mockResolvedValue(undefined);
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    // Select a photo
    fireEvent.click(screen.getByText('photo1.jpg'));

    // Select a frame
    fireEvent.click(screen.getByText('frame1.png'));

    const processButton = screen.getByText('Process Photos') as HTMLButtonElement;
    expect(processButton.disabled).toBe(false);
  });

  it('calls processPhotos when Process button is clicked', async () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockStore.processPhotos.mockResolvedValue(undefined);
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    // Select a photo and frame
    fireEvent.click(screen.getByText('photo1.jpg'));
    fireEvent.click(screen.getByText('frame1.png'));

    // Click process
    fireEvent.click(screen.getByText('Process Photos'));

    await waitFor(() => {
      expect(mockStore.processPhotos).toHaveBeenCalledWith(1, [1], ['frame1.png']);
    });
  });

  it('updates selection counts', () => {
    const mockStore = createMockStore({
      currentEvent: mockEvent,
      photos: mockPhotos,
      frames: mockFrames,
    });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventDetail />);

    // Select a photo
    fireEvent.click(screen.getByText('photo1.jpg'));

    expect(screen.getByText('Selected: 1 photo(s), 0 frame(s)')).toBeInTheDocument();

    // Select a frame
    fireEvent.click(screen.getByText('frame1.png'));

    expect(screen.getByText('Selected: 1 photo(s), 1 frame(s)')).toBeInTheDocument();
  });
});
