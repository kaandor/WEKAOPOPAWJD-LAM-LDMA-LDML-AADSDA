import { Film } from "lucide-react";

type Props = {
  condensed?: boolean;
};

export default function Logo({ condensed }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-700/20 ring-1 ring-violet-500/30">
        <Film className="h-5 w-5 text-violet-300" />
      </span>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-wide text-white">Klyx</span>
        {!condensed ? (
          <span className="text-xs text-white/60">Streaming & IPTV</span>
        ) : null}
      </div>
    </div>
  );
}

