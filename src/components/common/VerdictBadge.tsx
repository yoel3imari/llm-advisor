interface Props {
  fits: boolean;
  scoreFit: number;
}

export function VerdictBadge({ fits, scoreFit }: Props) {
  if (!fits) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-950/80 text-red-400 border border-red-800/50">
        Does Not Fit
      </span>
    );
  }

  if (scoreFit < 3.0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/50">
        Tight Fit ({scoreFit.toFixed(1)}/10)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
      Fits Comfortably
    </span>
  );
}
