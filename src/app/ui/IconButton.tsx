// src/app/ui/IconButton.tsx
import { artUrl } from './art';

/** A round picture button, at least a child's fingertip in size (spec §11). */
export function IconButton({ icon, label, onClick, className = '' }: { icon: string; label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`icon-button ${className}`} aria-label={label} onClick={onClick}>
      <img src={artUrl(icon)} alt="" />
    </button>
  );
}
