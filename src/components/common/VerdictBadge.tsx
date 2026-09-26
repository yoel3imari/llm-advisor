interface Props {
  fits: boolean;
  scoreFit: number;
}

export function VerdictBadge({ fits, scoreFit }: Props) {
  if (!fits) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-laser-950/70 text-laser-300 border border-laser-500/40 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-laser-500 shrink-0" />
        No Fit
      </span>
    );
  }

  if (scoreFit < 5.0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-voltage-950/70 text-voltage-300 border border-voltage-500/40 shadow-jewel-amber">
        <span className="w-1.5 h-1.5 rounded-full bg-voltage-400 shrink-0 animate-pulse" />
        Tight Fit
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-phosphor-950/70 text-phosphor-300 border border-phosphor-500/40 shadow-jewel-green">
      <span className="w-1.5 h-1.5 rounded-full bg-phosphor-400 shrink-0" />
      Fits
    </span>
  );
}
