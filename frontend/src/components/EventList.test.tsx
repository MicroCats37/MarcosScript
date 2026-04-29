/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { createStore as solidCreateStore, SetStoreFunction } from 'solid-js/store';

// Mock the EventContext
import type { Event, EventState } from '../stores/EventContext';

// We need to mock the useEventStore hook
const mockUseEventStore = vi.fn();

vi.mock('../stores/EventContext', () => ({
  useEventStore: () => mockUseEventStore(),
}));

// Now import the component after mocking
import { EventList } from '../components/EventList';

describe('EventList Component', () => {
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
      createEvent: vi.fn(),
      deleteEvent: vi.fn(),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No events yet" when events list is empty', () => {
    const mockStore = createMockStore();
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    expect(screen.getByText('No events yet. Create one to get started!')).toBeInTheDocument();
  });

  it('renders loading state when loading', () => {
    const mockStore = createMockStore({ loading: true });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });

  it('renders error message when error exists', () => {
    const mockStore = createMockStore({ error: 'Failed to load events' });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    expect(screen.getByText('Failed to load events')).toBeInTheDocument();
  });

  it('renders event cards when events exist', () => {
    const mockEvents: Event[] = [
      {
        id: 1,
        name: 'Test Event 1',
        source_photos_path: '/photos1',
        frames_path: '/frames1',
        output_path: '/output1',
        is_active: false,
        created_at: '2024-01-01T00:00:00',
        updated_at: '2024-01-01T00:00:00',
      },
      {
        id: 2,
        name: 'Test Event 2',
        source_photos_path: '/photos2',
        frames_path: '/frames2',
        output_path: '/output2',
        is_active: true,
        created_at: '2024-01-02T00:00:00',
        updated_at: '2024-01-02T00:00:00',
      },
    ];

    const mockStore = createMockStore({ events: mockEvents });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    expect(screen.getByText('Test Event 1')).toBeInTheDocument();
    expect(screen.getByText('Test Event 2')).toBeInTheDocument();
  });

  it('shows "New Event" button when not showing form', () => {
    const mockStore = createMockStore();
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    expect(screen.getByText('New Event')).toBeInTheDocument();
  });

  it('toggles form visibility when "New Event" button is clicked', () => {
    const mockStore = createMockStore();
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    const button = screen.getByText('New Event');
    fireEvent.click(button);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls createEvent when form is submitted', async () => {
    const mockStore = createMockStore();
    mockStore.createEvent.mockResolvedValue(undefined);
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    // Open form
    fireEvent.click(screen.getByText('New Event'));

    // Fill in form fields
    const nameInput = screen.getByLabelText('Event Name') as HTMLInputElement;
    const sourceInput = screen.getByLabelText('Source Photos Path') as HTMLInputElement;
    const framesInput = screen.getByLabelText('Frames Path') as HTMLInputElement;
    const outputInput = screen.getByLabelText('Output Path') as HTMLInputElement;

    fireEvent.input(nameInput, { target: { value: 'New Test Event' } });
    fireEvent.input(sourceInput, { target: { value: '/new/photos' } });
    fireEvent.input(framesInput, { target: { value: '/new/frames' } });
    fireEvent.input(outputInput, { target: { value: '/new/output' } });

    // Submit form
    fireEvent.submit(screen.getByRole('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockStore.createEvent).toHaveBeenCalledWith({
        name: 'New Test Event',
        source_photos_path: '/new/photos',
        frames_path: '/new/frames',
        output_path: '/new/output',
      });
    });
  });

  it('calls selectEvent when event card is clicked', () => {
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

    const mockStore = createMockStore({ events: mockEvents });
    mockStore.selectEvent.mockResolvedValue(undefined);
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    fireEvent.click(screen.getByText('Test Event'));

    expect(mockStore.selectEvent).toHaveBeenCalledWith(1);
  });

  it('calls deleteEvent when delete button is clicked', () => {
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

    const mockStore = createMockStore({ events: mockEvents });
    mockStore.deleteEvent.mockResolvedValue(undefined);
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    fireEvent.click(screen.getByText('Delete'));

    expect(mockStore.deleteEvent).toHaveBeenCalledWith(1);
  });

  it('shows watching status for active events', () => {
    const mockEvents: Event[] = [
      {
        id: 1,
        name: 'Active Event',
        source_photos_path: '/photos',
        frames_path: '/frames',
        output_path: '/output',
        is_active: true,
        created_at: '2024-01-01T00:00:00',
        updated_at: '2024-01-01T00:00:00',
      },
    ];

    const mockStore = createMockStore({ events: mockEvents, isWatching: true });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    expect(screen.getByText('Watching')).toBeInTheDocument();
  });

  it('shows idle status for inactive events', () => {
    const mockEvents: Event[] = [
      {
        id: 1,
        name: 'Idle Event',
        source_photos_path: '/photos',
        frames_path: '/frames',
        output_path: '/output',
        is_active: false,
        created_at: '2024-01-01T00:00:00',
        updated_at: '2024-01-01T00:00:00',
      },
    ];

    const mockStore = createMockStore({ events: mockEvents, isWatching: false });
    mockUseEventStore.mockReturnValue(mockStore);

    render(() => <EventList />);

    expect(screen.getByText('Idle')).toBeInTheDocument();
  });
});
