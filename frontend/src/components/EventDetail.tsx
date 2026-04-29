import { Component, For, Show, createSignal, createMemo, createEffect, onCleanup } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useEventStore, Photo } from '../stores/EventContext';
import { getMediaUrl } from '../api/client';
import { PhotoGrid } from './PhotoGrid';
import { PhotoModal } from './PhotoModal';

export const EventDetail: Component = () => {
  const params = useParams();
  const store = useEventStore();
  const [selectedPhotos, setSelectedPhotos] = createSignal<Set<number>>(new Set<number>());
  const [selectedFrames, setSelectedFrames] = createSignal<Set<string>>(new Set<string>());
  const [processing, setProcessing] = createSignal(false);
  
  // Estado para el modal de imagen individual
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
        } catch (err) { console.error('❌ [WS] Parse error:', err); }
      };
      onCleanup(() => ws.close());
    }
  });

  const currentEvent = () => store.state.currentEvent;
  const photos = () => store.state.photos;
  const frames = () => store.state.frames;
  const isWatching = () => store.state.isWatching;

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

  return (
    <Show when={currentEvent()} fallback={<div class="flex items-center justify-center h-full text-gray-500">Select an event</div>}>
      <div class="event-detail p-6 max-h-screen overflow-hidden flex flex-col">
        {/* Header */}
        <div class="event-detail-header mb-6 flex-shrink-0">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-3xl font-black text-white tracking-tight">{currentEvent()!.name}</h2>
            <div class="watcher-controls flex items-center gap-3">
              <Show when={!isWatching()}>
                <button onClick={handleStartWatcher} class="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95">Start Watcher</button>
              </Show>
              <Show when={isWatching()}>
                <button onClick={handleStopWatcher} class="px-5 py-2.5 bg-red-600/20 hover:bg-red-600 border border-red-600/50 text-red-400 hover:text-white font-bold rounded-xl transition-all active:scale-95">Stop Watcher</button>
              </Show>
              <div class={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isWatching() ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                <div class={`w-2 h-2 rounded-full ${isWatching() ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                <span class="text-sm font-medium">{isWatching() ? 'Active Watcher' : 'Inactive'}</span>
              </div>
            </div>
          </div>
          <div class="event-paths-detail bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4 grid grid-cols-3 gap-6 shadow-xl">
             <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Source</span>
              <span class="text-xs text-gray-300 font-mono truncate">{currentEvent()!.source_photos_path}</span>
            </div>
            <div class="flex flex-col gap-1 border-x border-gray-700/50 px-6">
              <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Frames</span>
              <span class="text-xs text-gray-300 font-mono truncate">{currentEvent()!.frames_path}</span>
            </div>
            <div class="flex flex-col gap-1 pl-6">
              <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Output</span>
              <span class="text-xs text-gray-300 font-mono truncate">{currentEvent()!.output_path}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div class="photo-frame-container grid grid-cols-12 gap-6 flex-1 min-h-0 mt-2">
          <div class="col-span-9 bg-gray-800/20 rounded-3xl p-6 border border-gray-700/50 flex flex-col overflow-hidden shadow-2xl">
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
          </div>

          <div class="col-span-3 bg-gray-800/20 rounded-3xl p-6 border border-gray-700/50 flex flex-col min-h-0">
             <h3 class="text-xl font-bold text-white mb-6">Frames ({frames().length})</h3>
             <div class="frames-grid grid grid-cols-1 gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              <For each={frames()}>
                {(frame) => (
                  <div class={`frame-card p-2 rounded-xl cursor-pointer transition-all duration-300 flex flex-col items-center shrink-0 ${selectedFrames().has(frame.filename) ? 'bg-indigo-600 border-indigo-400' : 'bg-gray-800/60 border border-gray-700 hover:border-gray-500'}`} onClick={() => toggleFrame(frame.filename)}>
                    <div class="frame-preview w-full aspect-square bg-gray-900 rounded-lg flex items-center justify-center mb-2 overflow-hidden shadow-inner">
                      <img src={getMediaUrl(frame.path)} alt={frame.filename} class="w-full h-full object-contain" />
                    </div>
                    <span class="text-[10px] text-gray-300 truncate w-full text-center">{frame.filename}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Process Footer */}
        <div class="process-section mt-6 bg-gray-800 rounded-2xl p-4 flex items-center justify-between border border-gray-700">
          <div class="text-gray-300 text-sm">
            Selected: <strong class="text-white">{selectedPhotos().size}</strong> photos, <strong class="text-white">{selectedFrames().size}</strong> frames
          </div>
          <button class="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-bold rounded-xl transition-all" disabled={!canProcess()} onClick={handleProcess}>
            {processing() ? 'Processing...' : 'Process Selected'}
          </button>
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
