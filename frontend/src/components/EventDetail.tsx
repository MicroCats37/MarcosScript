import { Component, For, Show, createSignal, createMemo, createEffect, onCleanup } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useEventStore, Photo, isSendable, ProcessedFrame } from '../stores/EventContext';
import { getMediaUrl } from '../api/client';
import { PhotoGrid } from './PhotoGrid';
import { PhotoModal } from './PhotoModal';
import { EmailSendPanel } from './EmailSendPanel';
import { LoadingSpinner, EmptyStateMessage } from '../App';

export const EventDetail: Component = () => {
  const params = useParams();
  const store = useEventStore();
  const [selectedPhotos, setSelectedPhotos] = createSignal<Set<number>>(new Set<number>());
  const [selectedFrames, setSelectedFrames] = createSignal<Set<string>>(new Set<string>());
  const [processing, setProcessing] = createSignal(false);
  const [showEmailPanel, setShowEmailPanel] = createSignal(false);
  const [modalImage, setModalImage] = createSignal<{url: string, title: string} | null>(null);

  createEffect(() => {
    if (!params.id) return;
    const id = parseInt(params.id);
    if (!isNaN(id)) {
      store.selectEvent(id);
      let envBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
      let wsBase = envBase.replace('localhost', '127.0.0.1');
      if (!wsBase.startsWith('http')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${protocol}//127.0.0.1:8000`;
      } else {
        wsBase = wsBase.replace('http', 'ws');
      }
      const wsUrl = `${wsBase}/ws/events/${id}`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'photo_added' || data.type === 'photo_updated') {
            store.loadPhotos(id);
          } else if (data.type === 'frame_added') {
            store.loadFrames(id);
          } else if (data.type === 'watcher_status') {
            store.fetchWatcherStatus(id);
          }
        } catch (err) { console.error('WS parse error:', err); }
      };
      onCleanup(() => ws.close());
    }
  });

  const currentEvent = () => store.state.currentEvent;
  const photos = () => store.state.photos;
  const frames = () => store.state.frames;
  const isWatching = () => store.state.isWatching;

  const sendableFrames = createMemo(() => {
    const sendable: ProcessedFrame[] = [];
    for (const photo of photos()) {
      for (const pf of photo.processed_frames) {
        if (isSendable(pf)) {
          sendable.push(pf);
        }
      }
    }
    return sendable;
  });

  const togglePhoto = (photoId: number) => {
    const newSet = new Set(selectedPhotos());
    newSet.has(photoId) ? newSet.delete(photoId) : newSet.add(photoId);
    setSelectedPhotos(newSet);
  };

  const toggleFrame = (frameFilename: string) => {
    const newSet = new Set(selectedFrames());
    newSet.has(frameFilename) ? newSet.delete(frameFilename) : newSet.add(frameFilename);
    setSelectedFrames(newSet);
  };

  const selectAllPhotos = () => setSelectedPhotos(new Set(photos().map((p) => p.id)));
  const deselectAllPhotos = () => setSelectedPhotos(new Set<number>());
  const canProcess = createMemo(() => selectedPhotos().size > 0 && selectedFrames().size > 0 && !processing());
  const isPhotoFrameProcessed = (photo: Photo, frameFilename: string) => photo.processed_frames.some((pf) => pf.frame_filename === frameFilename);

  const handleProcess = async () => {
    const event = currentEvent();
    if (!event || !canProcess()) return;
    setProcessing(true);
    try {
      await store.processPhotos(event.id, Array.from(selectedPhotos()), Array.from(selectedFrames()));
      setSelectedPhotos(new Set<number>());
      setSelectedFrames(new Set<string>());
    } finally { setProcessing(false); }
  };

  const handleStartWatcher = async () => currentEvent() && await store.startWatcher(currentEvent()!.id);
  const handleStopWatcher = async () => currentEvent() && await store.stopWatcher(currentEvent()!.id);
  const toggleEmailPanel = () => setShowEmailPanel((v) => !v);
  const sendableCount = createMemo(() => sendableFrames().length);

  return (
    <Show when={currentEvent()} fallback={
      <div class="flex items-center justify-center h-full">
        <EmptyStateMessage 
          icon="👈" 
          title="Select an Event" 
          message="Choose an event from the sidebar to view and process photos."
        />
      </div>
    }>
      <div class="event-detail flex flex-col h-full">
        {/* Header */}
        <div class="event-detail-header flex-shrink-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 px-6 py-5">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-4">
              <h2 class="text-2xl font-bold text-blue-50 tracking-tight">{currentEvent()!.name}</h2>
              <div class={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${
                isWatching() 
                  ? 'bg-green-900/30 border-green-700/50 text-green-300 watcher-active' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                <div class={`w-2 h-2 rounded-full ${isWatching() ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
                <span>{isWatching() ? 'Watcher Active' : 'Watcher Inactive'}</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <Show when={!isWatching()}>
                <button 
                  onClick={handleStartWatcher} 
                  class="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/30 active:scale-95"
                >
                  Start Watcher
                </button>
              </Show>
              <Show when={isWatching()}>
                <button 
                  onClick={handleStopWatcher} 
                  class="px-5 py-2.5 bg-red-600/20 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white font-bold rounded-xl transition-all active:scale-95"
                >
                  Stop Watcher
                </button>
              </Show>
            </div>
          </div>
          
          {/* Event Paths */}
          <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 grid grid-cols-3 gap-4">
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold text-blue-500/70 uppercase tracking-widest">Source</span>
              <span class="text-xs text-blue-300/80 font-mono truncate">{currentEvent()!.source_photos_path}</span>
            </div>
            <div class="flex flex-col gap-1 border-l border-slate-700/50 pl-4">
              <span class="text-[10px] font-bold text-blue-500/70 uppercase tracking-widest">Frames</span>
              <span class="text-xs text-blue-300/80 font-mono truncate">{currentEvent()!.frames_path}</span>
            </div>
            <div class="flex flex-col gap-1 border-l border-slate-700/50 pl-4">
              <span class="text-[10px] font-bold text-blue-500/70 uppercase tracking-widest">Output</span>
              <span class="text-xs text-blue-300/80 font-mono truncate">{currentEvent()!.output_path}</span>
            </div>
          </div>
        </div>

        {/* Main Content — two-panel layout */}
        <div class="photo-frame-container flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
          {/* LEFT: Photos grid + Process footer */}
          <div class="col-span-8 bg-slate-800/20 rounded-2xl p-5 border border-slate-700/50 flex flex-col overflow-hidden">
            <PhotoGrid
              photos={photos()}
              sourcePhotosPath={currentEvent()!.source_photos_path}
              outputPath={currentEvent()!.output_path}
              selectedPhotos={selectedPhotos()}
              togglePhoto={togglePhoto}
              selectedFrames={selectedFrames()}
              isPhotoFrameProcessed={isPhotoFrameProcessed}
              onSelectAll={selectAllPhotos}
              onDeselectAll={deselectAllPhotos}
              onViewImage={(url, title) => setModalImage({url, title})}
            />
            {/* Process Footer */}
            <div class="process-section mt-4 bg-slate-800/60 rounded-xl p-4 flex items-center justify-between border border-slate-700 flex-shrink-0">
              <div class="text-blue-300 text-sm">
                <span class="font-semibold text-blue-100">{selectedPhotos().size}</span> photos selected, 
                <span class="font-semibold text-blue-100 ml-2">{selectedFrames().size}</span> frames selected
              </div>
              <div class="flex gap-3">
                <Show when={sendableCount() > 0}>
                  <button
                    onClick={toggleEmailPanel}
                    class="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all shadow-lg"
                  >
                    {showEmailPanel() ? 'Hide Email' : `Email (${sendableCount()})`}
                  </button>
                </Show>
                <button 
                  class="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg disabled:cursor-not-allowed" 
                  disabled={!canProcess()} 
                  onClick={handleProcess}
                >
                  {processing() ? (
                    <span class="flex items-center gap-2">
                      <span class="spinner w-4 h-4 border-2 border-white/30 border-t-white" />
                      Processing...
                    </span>
                  ) : 'Process Selected'}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Frames panel + EmailSendPanel */}
          <div class="col-span-4 bg-slate-800/20 rounded-2xl p-5 border border-slate-700/50 flex flex-col gap-4 min-h-0 overflow-hidden">
            {/* Frames List */}
            <div class="flex-shrink-0">
              <h3 class="text-lg font-bold text-blue-100 mb-3 flex items-center gap-2">
                Frames
                <span class="text-xs font-semibold text-blue-400/60 bg-slate-800 px-2 py-0.5 rounded-full">
                  {frames().length}
                </span>
              </h3>
              <div class="frames-grid grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar" style="max-height: 35vh">
                <Show when={frames().length === 0}>
                  <div class="col-span-2 flex items-center justify-center py-8 text-blue-400/50 text-sm">
                    No frames available
                  </div>
                </Show>
                <For each={frames()}>
                  {(frame) => (
                    <div 
                      class={`frame-card p-2 rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center ${
                        selectedFrames().has(frame.filename) 
                          ? 'bg-blue-600/20 border-2 border-blue-500/50' 
                          : 'bg-slate-800/60 border border-slate-700 hover:border-slate-600'
                      }`} 
                      onClick={() => toggleFrame(frame.filename)}
                    >
                      <div class="frame-preview w-full aspect-square bg-slate-900 rounded-lg flex items-center justify-center mb-2 overflow-hidden shadow-inner">
                        <img src={getMediaUrl(frame.path)} alt={frame.filename} class="w-full h-full object-contain" />
                      </div>
                      <span class="text-[10px] text-blue-300 truncate w-full text-center px-1">{frame.filename}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Email Send Panel Area */}
            <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
              <Show when={showEmailPanel() && currentEvent()}>
                <EmailSendPanel
                  sendableFrames={sendableFrames()}
                  outputPath={currentEvent()!.output_path}
                  eventId={currentEvent()!.id}
                />
              </Show>
              <Show when={!showEmailPanel() && sendableCount() > 0}>
                <div class="flex items-center justify-center h-full">
                  <button
                    onClick={toggleEmailPanel}
                    class="px-6 py-4 bg-green-600/20 hover:bg-green-600 border border-green-600/50 text-green-400 hover:text-white font-bold rounded-xl transition-all"
                  >
                    Show Email Panel ({sendableCount()})
                  </button>
                </div>
              </Show>
              <Show when={!showEmailPanel() && sendableCount() === 0}>
                <div class="flex items-center justify-center h-full text-blue-400/50 text-sm italic">
                  No sendable frames yet
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <PhotoModal 
        isOpen={!!modalImage()} 
        imageUrl={modalImage()?.url || null} 
        title={modalImage()?.title || null} 
        onClose={() => setModalImage(null)} 
      />
    </Show>
  );
};
