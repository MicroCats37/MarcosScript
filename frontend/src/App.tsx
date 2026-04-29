import { Component, onMount } from 'solid-js';
import { EventProvider, useEventStore } from './stores/EventContext';
import { EventList } from './components/EventList';

export const EmptyState: Component = () => (
  <div class="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
    <div class="text-6xl mb-4">📂</div>
    <h2 class="text-2xl font-bold text-gray-300">No Event Selected</h2>
    <p class="mt-2">Select an event from the list on the left to see details and start the watcher.</p>
  </div>
);

const App: Component = (props: any) => {
  const store = useEventStore();

  onMount(() => {
    store.loadEvents();
  });

  return (
    <div class="min-h-screen bg-gray-900 text-gray-100">
      <header class="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 class="text-2xl font-bold text-white">MarcosScript</h1>
        <p class="text-sm text-gray-400">Photo Frame Processing Application</p>
      </header>
      <main class="flex h-[calc(100vh-73px)]">
        <div class="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          <EventList />
        </div>
        <div class="flex-1 overflow-y-auto bg-gray-900">
          {/* Aquí es donde el Router inyectará el componente de la ruta actual */}
          {props.children}
        </div>
      </main>
    </div>
  );
};

const RootApp: Component = (props: any) => {
  return (
    <EventProvider>
      <App {...props} />
    </EventProvider>
  );
};

export default RootApp;
