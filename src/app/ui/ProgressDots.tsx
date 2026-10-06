// src/app/ui/ProgressDots.tsx
import './progressDots.css';

/** Spec §4.4: one dot per round, filled as rounds end — the same for every outcome (no score is shown). */
export function ProgressDots({ total, done }: { total: number; done: number }) {
  return (
    <div className="progress-dots" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < done ? 'progress-dots__dot is-done' : 'progress-dots__dot'} />)}
    </div>
  );
}
