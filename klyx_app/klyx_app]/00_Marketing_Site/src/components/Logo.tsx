import LogoImg from '../assets/logo.png';

type Props = {
  condensed?: boolean;
};

export default function Logo({ condensed }: Props) {
  return (
    <div className="flex items-center gap-2">
      <img 
        src={LogoImg} 
        alt="Klyx Logo" 
        className="h-9 w-9 rounded-xl object-contain"
      />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-wide text-white">Klyx</span>
        {!condensed ? (
          <span className="text-xs text-white/60">Streaming & IPTV</span>
        ) : null}
      </div>
    </div>
  );
}

