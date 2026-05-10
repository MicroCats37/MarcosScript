import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { Photo } from '../stores/EventContext';
import { PhotoCard } from './PhotoCard';
import { LoadingSpinner, EmptyStateMessage } from '../App';

interface PhotoGridProps {
  photos: Photo[];
  sourcePhotosPath: string;
  outputPath: string;
  selectedPhotos: Set<number>;
  togglePhoto: (id: number) => void;
  selectedFrames: Set<string>;
  isPhotoFrameProcessed: (photo: Photo, frame: string) => boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onViewImage: (imageUrl: string, title: string) => void;
}

export const PhotoGrid: Component<PhotoGridProps> = (props) => {
  const PAGE_SIZE = 24;
  const [displayLimit, setDisplayLimit] = createSignal(PAGE_SIZE);
  const [searchTerm, setSearchTerm] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<'all' | 'pending' | 'completed'>('all');

  const filteredPhotos = createMemo(() => {
    let result = props.photos;
    if (statusFilter() !== 'all') {
      result = result.filter(p => p.status === statusFilter());
    }
    if (searchTerm()) {
      const term = searchTerm().toLowerCase();
      result = result.filter(p => p.filename.toLowerCase().includes(term));
    }
    return result;
  });

  const visiblePhotos = createMemo(() => {
    return filteredPhotos().slice(0, displayLimit());
  });

  const hasMore = createMemo(() => displayLimit() < filteredPhotos().length);
  const loadMore = () => setDisplayLimit(l => l + PAGE_SIZE);

  return (
    <div class="photo-grid-container flex flex-col h-full">
      {/* Header with Search and Selection Controls */}
      <div class="flex flex-col gap-4 mb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 flex-1">
            <h3 class="text-lg font-bold text-blue-100 whitespace-nowrap flex items-center gap-2">
              Photos
              <span class="text-xs font-semibold text-blue-400/60 bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredPhotos().length}
              </span>
            </h3>
            <div class="relative max-w-xs w-full">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg class="w-4 h-4 text-blue-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search photos..."
                value={searchTerm()}
                onInput={(e) => setSearchTerm(e.currentTarget.value)}
                class="w-full bg-slate-900/60 border border-slate-700 text-blue-200 text-sm rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-slate-500"
              />
            </div>
          </div>
          
          <div class="flex gap-2">
            <button 
              onClick={props.onSelectAll} 
              class="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 rounded-lg transition-all border border-slate-700 hover:border-blue-500/50"
            >
              Select All
            </button>
            <button 
              onClick={props.onDeselectAll} 
              class="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-red-900/30 text-blue-300 hover:text-red-400 rounded-lg transition-all border border-slate-700 hover:border-red-500/50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div class="flex gap-2">
          <For each={['all', 'pending', 'completed'] as const}>
            {(status) => (
              <button
                onClick={() => setStatusFilter(status)}
                class={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                  statusFilter() === status 
                    ? 'bg-blue-600 border-blue-500/50 text-white shadow-lg shadow-blue-900/30' 
                    : 'bg-slate-800 border-slate-700 text-blue-400/70 hover:border-slate-600'
                }`}
              >
                {status}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Photos List */}
      <div class="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pb-20">
        <Show when={props.photos.length === 0}>
          <EmptyStateMessage 
            icon="🖼️" 
            title="No Photos Yet" 
            message="Photos from the source folder will appear here when the watcher is active."
          />
        </Show>
        <Show when={props.photos.length > 0 && filteredPhotos().length === 0}>
          <EmptyStateMessage 
            icon="🔍" 
            title="No Results" 
            message={`No photos match the current filter. Try a different search or status.`}
          />
        </Show>
        <For each={visiblePhotos()}>
          {(photo) => (
            <PhotoCard
              photo={photo}
              sourcePhotosPath={props.sourcePhotosPath}
              outputPath={props.outputPath}
              isSelected={props.selectedPhotos.has(photo.id)}
              onToggle={props.togglePhoto}
              selectedFrames={props.selectedFrames}
              isProcessed={props.isPhotoFrameProcessed}
              onView={props.onViewImage}
            />
          )}
        </For>
      </div>

      {/* Load More Button */}
      <Show when={hasMore()}>
        <div class="flex justify-center mt-4 mb-2">
          <button
            onClick={loadMore}
            class="px-8 py-2.5 bg-slate-800 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 font-semibold rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all shadow-lg"
          >
            Load More (+{Math.min(PAGE_SIZE, filteredPhotos().length - displayLimit())})
          </button>
        </div>
      </Show>
    </div>
  );
};
