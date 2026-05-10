import { Component, For, Show, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { useEventStore, Event } from '../stores/EventContext';
import { ConfirmDialog } from '../App';
import { LoadingSpinner, EmptyStateMessage } from '../App';

export const EventList: Component = () => {
  const store = useEventStore();
  const [showForm, setShowForm] = createSignal(false);
  const [newEvent, setNewEvent] = createSignal({
    name: '',
    source_photos_path: '',
    frames_path: '',
    output_path: '',
  });
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = createSignal<{ eventId: number; eventName: string } | null>(null);

  const handleInput = (e: InputEvent & { target: HTMLInputElement }) => {
    const target = e.target;
    setNewEvent({ ...newEvent(), [target.name]: target.value });
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    await store.createEvent(newEvent());
    setShowForm(false);
    setNewEvent({ name: '', source_photos_path: '', frames_path: '', output_path: '' });
  };

  const handleSelect = async (event: Event) => {
    await store.selectEvent(event.id);
  };

  const handleDeleteClick = (e: MouseEvent, event: Event) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm({ eventId: event.id, eventName: event.name });
  };

  const confirmDelete = async () => {
    if (deleteConfirm()) {
      await store.deleteEvent(deleteConfirm()!.eventId);
      setDeleteConfirm(null);
    }
  };

  return (
    <div class="event-list p-4">
      <div class="event-list-header flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-blue-100">Events</h2>
        <button
          onClick={() => setShowForm(!showForm())}
          class="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-900/20"
        >
          {showForm() ? 'Cancel' : '+ New'}
        </button>
      </div>

      <Show when={showForm()}>
        <form class="event-form bg-slate-800/60 rounded-xl p-4 mb-4 space-y-3 border border-slate-700 animate-slide-up" onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="name" class="block text-sm text-blue-200 mb-1 font-medium">Event Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={newEvent().name}
              onInput={handleInput}
              required
              placeholder="My Event"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-blue-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div class="form-group">
            <label for="source_photos_path" class="block text-sm text-blue-200 mb-1 font-medium">Source Photos Path</label>
            <input
              type="text"
              id="source_photos_path"
              name="source_photos_path"
              value={newEvent().source_photos_path}
              onInput={handleInput}
              required
              placeholder="/path/to/photos"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-blue-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div class="form-group">
            <label for="frames_path" class="block text-sm text-blue-200 mb-1 font-medium">Frames Path</label>
            <input
              type="text"
              id="frames_path"
              name="frames_path"
              value={newEvent().frames_path}
              onInput={handleInput}
              required
              placeholder="/path/to/frames"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-blue-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div class="form-group">
            <label for="output_path" class="block text-sm text-blue-200 mb-1 font-medium">Output Path</label>
            <input
              type="text"
              id="output_path"
              name="output_path"
              value={newEvent().output_path}
              onInput={handleInput}
              required
              placeholder="/path/to/output"
              class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-blue-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <button type="submit" class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/30">
            Create Event
          </button>
        </form>
      </Show>

      <Show when={store.state.loading}>
        <div class="py-8">
          <LoadingSpinner size="md" message="Loading events..." />
        </div>
      </Show>

      <Show when={store.state.error}>
        <div class="bg-red-900/20 border border-red-800/50 text-red-300 p-3 rounded-lg mb-4 text-sm">
          <span class="font-medium">Error:</span> {store.state.error}
        </div>
      </Show>

      <div class="events-grid space-y-2">
        <For each={store.state.events}>
          {(event) => (
            <A
              href={`/events/${event.id}`}
              class={`event-card block p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                store.state.currentEvent?.id === event.id
                  ? 'bg-blue-600/20 border-2 border-blue-500/50 shadow-lg shadow-blue-900/20'
                  : 'bg-slate-800/40 border border-slate-700 hover:bg-slate-700/60 hover:border-slate-600'
              }`}
            >
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-semibold text-blue-100 truncate">{event.name}</h3>
                <span class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                  event.is_active 
                    ? 'bg-green-900/40 text-green-300 border border-green-700/50' 
                    : 'bg-slate-700/60 text-slate-400 border border-slate-600/50'
                }`}>
                  <span class={`w-1.5 h-1.5 rounded-full ${event.is_active ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                  {event.is_active ? 'Active' : 'Idle'}
                </span>
              </div>
              <p class="text-xs text-blue-400/70 mt-2 truncate font-mono">
                Source: {event.source_photos_path}
              </p>
              <p class="text-xs text-blue-400/60 truncate font-mono">
                Frames: {event.frames_path}
              </p>
              <p class="text-xs text-blue-400/60 truncate font-mono">
                Output: {event.output_path}
              </p>
              <button
                class="delete-btn mt-3 text-xs w-full py-1.5 bg-red-900/20 hover:bg-red-800/40 text-red-400 hover:text-red-300 rounded-lg transition-all border border-red-900/30 hover:border-red-700/50 font-medium"
                onClick={(e) => handleDeleteClick(e, event)}
              >
                Delete Event
              </button>
            </A>
          )}
        </For>
      </div>

      <Show when={store.state.events.length === 0 && !store.state.loading}>
        <EmptyStateMessage 
          icon="📁" 
          title="No Events Yet" 
          message="Create your first event to start processing photos with frames."
        />
      </Show>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm()}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteConfirm()?.eventName}"? This will remove all photos and processed frames associated with this event.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
