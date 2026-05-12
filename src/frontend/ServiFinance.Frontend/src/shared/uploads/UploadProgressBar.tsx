interface UploadProgressBarProps {
  label?: string;
  progress: number | null;
}

export function UploadProgressBar({ label = "Uploading", progress }: UploadProgressBarProps) {
  if (progress === null) {
    return null;
  }

  const boundedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="grid gap-2 rounded-2xl border border-blue-200/80 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{label}</span>
        <span className="text-xs font-bold tabular-nums">{boundedProgress}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-blue-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={boundedProgress}
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-200"
          style={{ width: `${boundedProgress}%` }}
        />
      </div>
      {boundedProgress >= 100 ? (
        <p className="text-xs leading-5 text-blue-700">
          Upload received. Final provider processing may continue for a moment.
        </p>
      ) : null}
    </div>
  );
}
