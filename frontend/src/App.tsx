import { Component, onMount, Show, createSignal } from 'solid-js';
import { EventProvider, useEventStore } from './stores/EventContext';
import { EventList } from './components/EventList';

export const EmptyState: Component = () => (
  <div class="flex flex-col items-center justify-center h-full text-blue-300 p-8 text-center animate-fade-in">
    <div class="text-7xl mb-6">📂</div>
    <h2 class="text-3xl font-bold text-blue-100 mb-2">No Event Selected</h2>
    <p class="text-blue-400/70 max-w-md">Select an event from the list on the left to see details and start processing photos.</p>
  </div>
);

// Confirmation Dialog Component
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 confirm-dialog-overlay animate-fade-in">
        <div class="confirm-dialog-content rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-700 animate-slide-up">
          <h3 class="text-xl font-bold text-blue-100 mb-2">{props.title}</h3>
          <p class="text-blue-300/80 mb-6">{props.message}</p>
          <div class="flex gap-3 justify-end">
            <button
              onClick={props.onCancel}
              class="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-blue-200 font-medium rounded-xl transition-all border border-slate-600"
            >
              {props.cancelText || 'Cancel'}
            </button>
            <button
              onClick={props.onConfirm}
              class={`px-5 py-2.5 font-bold rounded-xl transition-all ${
                props.variant === 'danger'
                  ? 'bg-red-600/20 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white'
                  : 'bg-amber-600/20 hover:bg-amber-600 border border-amber-500/50 text-amber-400 hover:text-white'
              }`}
            >
              {props.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

// Loading Spinner Component
export const LoadingSpinner: Component<{ size?: 'sm' | 'md' | 'lg'; message?: string }> = (props) => {
  const sizeClass = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }[props.size || 'md'];
  
  return (
    <div class="flex flex-col items-center justify-center gap-4">
      <div class={`spinner ${sizeClass}`} />
      <Show when={props.message}>
        <p class="text-blue-400/70 text-sm">{props.message}</p>
      </Show>
    </div>
  );
};

// Empty State with Icon Component
export const EmptyStateMessage: Component<{ icon?: string; title: string; message: string }> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div class="text-6xl mb-4 opacity-60">{props.icon || '📭'}</div>
      <h3 class="text-xl font-semibold text-blue-200 mb-2">{props.title}</h3>
      <p class="text-blue-400/60 text-sm max-w-sm">{props.message}</p>
    </div>
  );
};

const App: Component = (props: any) => {
  const store = useEventStore();
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

  onMount(() => {
    store.loadEvents();
  });

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed());

  return (
    <div class="min-h-screen bg-slate-950 text-blue-50">
      {/* Fixed Header */}
      <header class="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-blue-100 transition-all border border-slate-700"
              title={sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sidebarCollapsed() ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <div>
              <h1 class="text-2xl font-bold text-blue-50 tracking-tight">MarcosScript</h1>
              <p class="text-sm text-blue-400/70">Photo Frame Processing</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main class="flex h-screen pt-[73px]">
        {/* Sidebar */}
        <aside
          class={`fixed left-0 top-[73px] bottom-0 bg-slate-900 border-r border-slate-700/50 overflow-y-auto transition-all duration-300 custom-scrollbar ${
            sidebarCollapsed() ? 'w-16' : 'w-80'
          }`}
        >
          <Show when={!sidebarCollapsed()}>
            <EventList />
          </Show>
          <Show when={sidebarCollapsed()}>
            <div class="p-3 flex flex-col items-center gap-2">
              <div class="w-10 h-10 rounded-lg bg-blue-900/30 flex items-center justify-center text-blue-400 text-lg font-bold border border-blue-800">
                {store.state.events.length}
              </div>
              <Show when={store.state.currentEvent}>
                <div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
              </Show>
            </div>
          </Show>
        </aside>

        {/* Content Area */}
        <div
          class={`flex-1 overflow-y-auto transition-all duration-300 custom-scrollbar ${
            sidebarCollapsed() ? 'ml-16' : 'ml-80'
          }`}
        >
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
