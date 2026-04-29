import { Component, Show } from 'solid-js';

interface PhotoModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  title: string | null;
  onClose: () => void;
}

export const PhotoModal: Component<PhotoModalProps> = (props) => {
  return (
    <Show when={props.isOpen && props.imageUrl}>
      <div 
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl transition-all"
        onClick={props.onClose}
      >
        {/* Close Button */}
        <button 
          onClick={props.onClose}
          class="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 p-3 rounded-full hover:scale-110 z-[110]"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div 
          class="relative max-w-7xl w-full h-full flex flex-col items-center justify-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image Container */}
          <div class="relative w-full h-full flex items-center justify-center overflow-hidden">
            <img 
              src={props.imageUrl!} 
              alt={props.title || 'Image'}
              class="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/5 animate-in fade-in zoom-in duration-300"
            />
          </div>

          {/* Label */}
          <div class="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 mb-4 animate-in slide-in-from-bottom duration-500">
            <span class="text-white font-bold tracking-wide">{props.title}</span>
          </div>
        </div>
      </div>
    </Show>
  );
};
