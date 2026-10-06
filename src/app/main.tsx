// src/app/main.tsx
import { createRoot } from 'react-dom/client';
import { pack } from './pack';

createRoot(document.getElementById('root') as HTMLElement).render(<p>Buddy: {pack.templates.size} games</p>);
