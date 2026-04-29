import { Component, Show, For } from 'solid-js';
import { Photo } from '../stores/EventContext';
import { getMediaUrl } from '../api/client';

interface PhotoCardProps {
  photo: Photo;
  sourcePhotosPath: string;
  outputPath: string;
  isSelected: boolean;
  onToggle: (id: number) => void;
  selectedFrames: Set<string>;
  isProcessed: (photo: Photo, frame: string) => boolean;
  onView: (imageUrl: string, title: string) => void; // Cambiado para recibir URL y Título
}

export const PhotoCard: Component<PhotoCardProps> = (props) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      class={`photo-list-item group p-4 rounded-2xl transition-all duration-300 border flex flex-col gap-3 ${
        props.isSelected 
          ? 'bg-indigo-600/10 border-indigo-500 shadow-lg' 
          : 'bg-gray-800/40 border-gray-700 hover:border-gray-600'
      }`}
    >
      {/* Header Info */}
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-3">
          <div 
            onClick={(e) => { e.stopPropagation(); props.onToggle(props.photo.id); }}
            class={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
              props.isSelected ? 'bg-indigo-500 border-indigo-400' : 'bg-gray-700 border-gray-500'
            }`}
          >
            <Show when={props.isSelected}>
              <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </Show>
          </div>
          <span class="text-sm font-bold text-gray-200 truncate max-w-xs">{props.photo.filename}</span>
          <span class="text-[10px] text-gray-500 font-mono bg-black/30 px-2 py-0.5 rounded uppercase">
            {formatDate(props.photo.created_at)}
          </span>
        </div>
        
        <div class="flex items-center gap-2">
           <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            props.photo.status === 'completed' ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {props.photo.status}
          </span>
        </div>
      </div>

      {/* Horizontal Strip of Images */}
      <div class="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
        {/* SOURCE PHOTO */}
        <div class="flex-shrink-0 flex flex-col gap-1">
          <div 
            class="w-40 h-40 bg-gray-900 rounded-xl overflow-hidden border-2 border-gray-700 shadow-inner relative group/img cursor-zoom-in"
            onClick={() => props.onView(getMediaUrl(`${props.sourcePhotosPath}/${props.photo.filename}`), `Original: ${props.photo.filename}`)}
          >
            <img
              src={getMediaUrl(`${props.sourcePhotosPath}/${props.photo.filename}`)}
              alt="Original"
              class="w-full h-full object-cover transition-transform group-hover/img:scale-110 duration-500"
            />
            <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
              <div class="bg-white/20 backdrop-blur-md p-2 rounded-full">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          </div>
          <span class="text-[9px] text-center text-gray-500 uppercase font-bold">Original</span>
        </div>

        {/* PROCESSED PHOTOS */}
        <For each={props.photo.processed_frames}>
          {(pf) => (
            <div class="flex-shrink-0 flex flex-col gap-1">
              <div 
                class="w-40 h-40 bg-gray-900 rounded-xl overflow-hidden border-2 border-indigo-500/50 shadow-lg relative group/item cursor-zoom-in"
                onClick={() => props.onView(getMediaUrl(`${props.outputPath}/${pf.output_filename}`), `Result: ${pf.frame_filename}`)}
              >
                <img
                  src={getMediaUrl(`${props.outputPath}/${pf.output_filename}`)}
                  alt={pf.frame_filename}
                  class="w-full h-full object-cover transition-transform group-hover/item:scale-110 duration-500"
                />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center p-2">
                   <div class="bg-indigo-500/40 backdrop-blur-md p-2 rounded-full">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
              </div>
              <span class="text-[9px] text-center text-indigo-400 uppercase font-bold truncate w-40 px-1">
                {pf.frame_filename}
              </span>
            </div>
          )}
        </For>

        {/* Placeholder for selected frames not yet processed */}
        <For each={Array.from(props.selectedFrames).filter(f => !props.isProcessed(props.photo, f))}>
          {(frame) => (
            <div class="flex-shrink-0 flex flex-col gap-1 opacity-40 grayscale">
              <div class="w-40 h-40 bg-gray-900 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center">
                 <span class="text-[10px] text-gray-500 text-center px-4 font-medium italic">Pending...</span>
              </div>
              <span class="text-[9px] text-center text-gray-600 uppercase font-bold truncate w-40 px-1">{frame}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
