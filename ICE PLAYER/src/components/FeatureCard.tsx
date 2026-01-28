import { cn } from "@/lib/utils";
import {
  PlayCircle,
  Rocket,
  Smartphone,
  Sparkles,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  PlayCircle,
  Tv,
  Sparkles,
  Users,
  Smartphone,
  Rocket,
};

type Props = {
  title: string;
  description: string;
  icon: string;
};

export default function FeatureCard({ title, description, icon }: Props) {
  const Icon = iconMap[icon] ?? Sparkles;

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/7 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            "bg-violet-700/15 ring-1 ring-violet-500/25",
          )}
        >
          <Icon className="h-5 w-5 text-violet-200" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
        </div>
      </div>
    </div>
  );
}

