import { cn } from "@/lib/utils";

type Props<T extends string> = {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
};

export default function FilterChips<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              selected
                ? "border-violet-400/40 bg-violet-500/15 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

