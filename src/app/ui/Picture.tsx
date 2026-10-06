// src/app/ui/Picture.tsx
import { useState } from 'react';
import { isGlyphAsset } from '../../engine/content/assets';
import { artUrl } from './art';
import './picture.css';

export interface PictureProps {
  /** a path inside public/art, or `glyph:<text>` drawn as letters */
  asset: string;
  /** what it is, for screen readers and the missing-picture stand-in */
  label: string;
  /** width and height in px */
  size: number;
  className?: string;
}

const warned = new Set<string>();

/** One picture (spec §13: a missing one shows a neutral stand-in and logs its path, never blocking the round). */
export function Picture({ asset, label, size, className = '' }: PictureProps) {
  // the asset that failed, not a flag: an instance that is handed another picture (a vignette's friend changing face) tries it
  const [failed, setFailed] = useState<string | null>(null);
  const missing = failed === asset;
  const box = { width: size, height: size };
  if (isGlyphAsset(asset)) {
    const text = asset.slice('glyph:'.length);
    return (
      <span className={`picture picture--glyph ${className}`} style={{ ...box, fontSize: size * (text.length > 1 ? 0.62 : 0.82) }} role="img" aria-label={label}>
        {text}
      </span>
    );
  }
  if (missing) {
    return <span className={`picture picture--missing ${className}`} style={box} role="img" aria-label={label} />;
  }
  return (
    <img
      className={`picture ${className}`}
      style={box}
      src={artUrl(asset)}
      alt={label}
      draggable={false}
      onError={() => {
        if (!warned.has(asset)) console.warn(`missing picture: ${asset}`);
        warned.add(asset);
        setFailed(asset);
      }}
    />
  );
}
