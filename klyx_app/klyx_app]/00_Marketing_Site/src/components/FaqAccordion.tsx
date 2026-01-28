import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type FaqItem = {
  question: string;
  answer: string;
};

type Props = {
  items: readonly FaqItem[];
};

export default function FaqAccordion({ items }: Props) {
  const ids = useMemo(() => items.map((_, i) => `faq-${i}`), [items]);
  const [openId, setOpenId] = useState<string | null>(ids[0] ?? null);

  return (
    <div className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {items.map((item, i) => {
        const id = ids[i];
        const open = openId === id;

        return (
          <div key={id} className="p-0">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={open}
              aria-controls={`${id}-panel`}
              onClick={() => setOpenId(open ? null : id)}
            >
              <span className="text-sm font-semibold text-white">{item.question}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-white/70 transition",
                  open ? "rotate-180" : "rotate-0",
                )}
              />
            </button>
            <div
              id={`${id}-panel`}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden px-6 pb-5">
                <p className="text-sm leading-6 text-white/70">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

