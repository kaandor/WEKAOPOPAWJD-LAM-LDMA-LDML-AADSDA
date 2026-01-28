import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Container from "@/components/Container";
import FilterChips from "@/components/FilterChips";
import Lightbox from "@/components/Lightbox";
import { cn } from "@/lib/utils";
import { galleryCategories, screenshots, type ScreenshotCategory } from "@/utils/klyxContent";

export default function Gallery() {
  const [category, setCategory] = useState<ScreenshotCategory>("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (category === "All") return screenshots;
    return screenshots.filter((s) => s.category === category);
  }, [category]);

  const items = filtered.map((s) => ({ title: s.title, imageUrl: s.imageUrl }));

  return (
    <div className="py-14 sm:py-16">
      <Container>
        <div className="flex flex-col gap-3">
          <Link className="text-sm text-white/70 transition hover:text-white" to="/">
            ← Home
          </Link>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Screenshots Gallery</h1>
            <p className="max-w-2xl text-sm leading-6 text-white/70">
              Browse Klyx screens across key flows. Use filters to narrow down, then open any image for a full-screen view.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <FilterChips<ScreenshotCategory>
            value={category}
            options={galleryCategories}
            onChange={setCategory}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((shot, i) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => setOpenIndex(i)}
                className={cn(
                  "group overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left",
                  "transition hover:bg-white/7 hover:shadow-md",
                )}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-black/30">
                  <img
                    src={shot.imageUrl}
                    alt={shot.title}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{shot.title}</div>
                      <div className="mt-1 text-xs text-white/60">{shot.category}</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                      View
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Container>

      {openIndex !== null ? (
        <Lightbox
          items={items}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onPrev={() => setOpenIndex((v) => (v === null ? 0 : (v - 1 + items.length) % items.length))}
          onNext={() => setOpenIndex((v) => (v === null ? 0 : (v + 1) % items.length))}
        />
      ) : null}
    </div>
  );
}
