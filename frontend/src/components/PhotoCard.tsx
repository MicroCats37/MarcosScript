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
  onView: (imageUrl: string, title: string) => void;
}

export const PhotoCard: Component<PhotoCardProps> = (props) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      class={`photo-list-item group p-4 rounded-2xl transition-all duration-200 border flex flex-col gap-3 ${
        props.isSelected 
          ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-900/10' 
          : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      {/* Header Info */}
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-3">
          <div 
            onClick={(e) => { e.stopPropagation(); props.onToggle(props.photo.id); }}
            class={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
              props.isSelected ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-600 hover:border-blue-500/50'
            }`}
          >
            <Show when={props.isSelected}>
              <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </Show>
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-blue-100 truncate max-w-md">{props.photo.filename}</span>
            <span class="text-[10px] text-blue-500/60 font-mono">{formatDate(props.photo.created_at)}</span>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <span class={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
            props.photo.status === 'completed' 
              ? 'bg-green-900/40 text-green-300 border border-green-700/50' 
              : props.photo.status === 'processing'
              ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
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
            class="w-40 h-40 bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-700 shadow-inner relative group/img cursor-pointer"
            onClick={() => props.onView(getMediaUrl(`${props.sourcePhotosPath}/${props.photo.filename}`), `Original: ${props.photo.filename}`)}
          >
            <img
              src={getMediaUrl(`${props.sourcePhotosPath}/${props.photo.filename}`)}
              alt="Original"
              class="w-full h-full object-cover transition-transform group-hover/img:scale-110 duration-300"
            />
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
              <div class="bg-blue-600/80 backdrop-blur-sm p-2.5 rounded-full">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          </div>
          <span class="text-[9px] text-center text-blue-500/70 uppercase font-bold tracking-wider">Original</span>
        </div>

        {/* PROCESSED PHOTOS */}
        <For each={props.photo.processed_frames}>
          {(pf) => (
            <div class="flex-shrink-0 flex flex-col gap-1">
              <div 
                class="w-40 h-40 bg-slate-900 rounded-xl overflow-hidden border-2 border-blue-600/40 shadow-lg relative group/item cursor-pointer"
                onClick={() => props.onView(getMediaUrl(`${props.outputPath}/${pf.output_filename}`), `Result: ${pf.frame_filename}`)}
              >
                <img
                  src={getMediaUrl(`${props.outputPath}/${pf.output_filename}`)}
                  alt={pf.frame_filename}
                  class="w-full h-full object-cover transition-transform group-hover/item:scale-110 duration-300"
                />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center p-2">
                  <div class="bg-blue-600/80 backdrop-blur-sm p-2.5 rounded-full">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
                {/* Processed badge */}
                <div class="absolute top-2 right-2 bg-green-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  ✓
                </div>
              </div>
              <span class="text-[9px] text-center text-blue-400 uppercase font-bold truncate w-40 px-1">
                {pf.frame_filename}
              </span>
            </div>
          )}
        </For>

        {/* Placeholder for selected frames not yet processed */}
        <For each={Array.from(props.selectedFrames).filter(f => !props.isProcessed(props.photo, f))}>
          {(frame) => (
            <div class="flex-shrink-0 flex flex-col gap-1 opacity-40">
              <div class="w-40 h-40 bg-slate-900 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center">
                <span class="text-[10px] text-slate-500 text-center px-4 font-medium italic">Pending...</span>
              </div>
              <span class="text-[9px] text-center text-slate-600 uppercase font-bold truncate w-40 px-1">{frame}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
