interface Props {
  fits: boolean;
  scoreFit: number;
}

export function VerdictBadge({ fits, scoreFit }: Props) {
  if (!fits) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        No Fit
      </span>
    );
  }

  if (scoreFit < 5.0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Tight Fit
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      Fits
    </span>
  );
}
