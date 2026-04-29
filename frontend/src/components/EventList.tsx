import { Component, For, Show, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { useEventStore, Event } from '../stores/EventContext';

export const EventList: Component = () => {
  const store = useEventStore();
  // ... rest of signals ...
  const [showForm, setShowForm] = createSignal(false);
  const [newEvent, setNewEvent] = createSignal({
    name: '',
    source_photos_path: '',
    frames_path: '',
    output_path: '',
  });

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

  return (
    <div class="event-list p-4">
      <div class="event-list-header flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-100">Events</h2>
        <button
          onClick={() => setShowForm(!showForm())}
          class="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
        >
          {showForm() ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      <Show when={showForm()}>
        <form class="event-form bg-gray-700 rounded-lg p-4 mb-4 space-y-3" onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="name" class="block text-sm text-gray-300 mb-1">Event Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={newEvent().name}
              onInput={handleInput}
              required
              class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div class="form-group">
            <label for="source_photos_path" class="block text-sm text-gray-300 mb-1">Source Photos Path</label>
            <input
              type="text"
              id="source_photos_path"
              name="source_photos_path"
              value={newEvent().source_photos_path}
              onInput={handleInput}
              required
              class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div class="form-group">
            <label for="frames_path" class="block text-sm text-gray-300 mb-1">Frames Path</label>
            <input
              type="text"
              id="frames_path"
              name="frames_path"
              value={newEvent().frames_path}
              onInput={handleInput}
              required
              class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div class="form-group">
            <label for="output_path" class="block text-sm text-gray-300 mb-1">Output Path</label>
            <input
              type="text"
              id="output_path"
              name="output_path"
              value={newEvent().output_path}
              onInput={handleInput}
              required
              class="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button type="submit" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors">
            Create Event
          </button>
        </form>
      </Show>

      <Show when={store.state.loading}>
        <p class="text-gray-400 text-center py-4">Loading events...</p>
      </Show>

      <Show when={store.state.error}>
        <p class="error text-red-400 bg-red-900/30 p-3 rounded-md mb-4">{store.state.error}</p>
      </Show>

      <div class="events-grid space-y-2">
        <For each={store.state.events}>
          {(event) => (
            <A
              href={`/events/${event.id}`}
              class={`event-card block p-3 rounded-lg cursor-pointer transition-all ${
                store.state.currentEvent?.id === event.id
                  ? 'bg-indigo-600 ring-2 ring-indigo-400'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div class="flex items-start justify-between">
                <h3 class="font-medium text-white">{event.name}</h3>
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  event.is_active ? 'bg-green-900 text-green-300' : 'bg-gray-600 text-gray-300'
                }`}>
                  <span class={`w-1.5 h-1.5 rounded-full mr-1.5 ${event.is_active ? 'bg-green-400' : 'bg-gray-400'}`} />
                  {event.is_active ? 'Watching' : 'Idle'}
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-1 truncate">
                Source: {event.source_photos_path}
              </p>
              <p class="text-xs text-gray-400 truncate">
                Frames: {event.frames_path}
              </p>
              <p class="text-xs text-gray-400 truncate">
                Output: {event.output_path}
              </p>
              <button
                class="delete-btn mt-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 px-2 py-1 rounded transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  store.deleteEvent(event.id);
                }}
              >
                Delete
              </button>
            </A>
          )}
        </For>
      </div>

      <Show when={store.state.events.length === 0 && !store.state.loading}>
        <p class="text-gray-500 text-center py-8">No events yet. Create one to get started!</p>
      </Show>
    </div>
  );
};
