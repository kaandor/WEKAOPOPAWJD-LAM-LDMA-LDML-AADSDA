import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-violet-700 text-white shadow-sm hover:-translate-y-0.5 hover:bg-violet-600 hover:shadow-md active:translate-y-0",
  secondary:
    "border border-white/10 bg-white/5 text-white hover:bg-white/10",
  ghost: "text-white/80 hover:bg-white/5 hover:text-white",
};

export default function Button({ className, variant = "primary", ...props }: Props) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

