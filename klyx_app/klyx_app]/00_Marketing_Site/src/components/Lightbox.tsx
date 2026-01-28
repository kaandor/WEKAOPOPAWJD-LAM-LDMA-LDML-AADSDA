import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  title: string;
  imageUrl: string;
};

type Props = {
  items: readonly Item[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function Lightbox({ items, index, onClose, onPrev, onNext }: Props) {
  const item = items[index];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, onPrev, onNext]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F17] shadow-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{item.title}</div>
              <div className="text-xs text-white/60">Use ← → to navigate, Esc to close</div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative bg-black/30">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="block h-auto w-full select-none"
              draggable={false}
            />

            <button
              type="button"
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-white/5 p-2",
                "text-white/80 transition hover:bg-white/10 hover:text-white",
              )}
              onClick={onPrev}
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-white/5 p-2",
                "text-white/80 transition hover:bg-white/10 hover:text-white",
              )}
              onClick={onNext}
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

