// src/app/main.tsx
// Andika (SIL, OFL): made for children learning to read — single-storey a and g; Latin only, so it caches small
import '@fontsource/andika/latin-400.css';
import '@fontsource/andika/latin-700.css';
import './styles/theme.css';
import { createRoot } from 'react-dom/client';
import { App, AppBoundary, Trouble } from './App';
import { createServices } from './services';

const root = createRoot(document.getElementById('root') as HTMLElement);
createServices().then(
  (services) => root.render(<AppBoundary><App services={services} /></AppBoundary>),
  (e: unknown) => {
    console.error(e);
    root.render(<Trouble />); // with a button: an app on the home screen has no reload
  },
);
