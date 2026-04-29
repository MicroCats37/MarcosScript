import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { Photo } from '../stores/EventContext';
import { PhotoCard } from './PhotoCard';

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
  onViewImage: (imageUrl: string, title: string) => void; // Cambiado para imagen individual
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
      <div class="flex flex-col gap-4 mb-6 sticky top-0 bg-gray-900/90 backdrop-blur-md py-4 z-20 border-b border-gray-800">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 flex-1">
            <h3 class="text-lg font-bold text-white whitespace-nowrap">
              Photos ({filteredPhotos().length})
            </h3>
            <div class="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchTerm()}
                onInput={(e) => setSearchTerm(e.currentTarget.value)}
                class="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          
          <div class="flex gap-2">
            <button onClick={props.onSelectAll} class="px-3 py-1.5 text-xs font-bold bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white rounded-lg transition-all border border-gray-700">
              Select All
            </button>
            <button onClick={props.onDeselectAll} class="px-3 py-1.5 text-xs font-bold bg-gray-800 hover:bg-red-900/40 text-gray-300 hover:text-red-400 rounded-lg transition-all border border-gray-700">
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
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                {status}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* List layout */}
      <div class="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
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
        <div class="flex justify-center mt-6 mb-2">
          <button
            onClick={loadMore}
            class="px-8 py-2.5 bg-gray-800 hover:bg-indigo-600 text-white font-bold rounded-xl border border-gray-700 transition-all shadow-lg"
          >
            Load More (+{Math.min(PAGE_SIZE, filteredPhotos().length - displayLimit())})
          </button>
        </div>
      </Show>

      <Show when={filteredPhotos().length === 0}>
        <div class="flex flex-col items-center justify-center py-20 text-gray-500">
          <p class="text-lg font-medium">No photos found</p>
        </div>
      </Show>
    </div>
  );
};
