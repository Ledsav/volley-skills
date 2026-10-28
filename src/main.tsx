import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import { App } from './App';
import { resetCacheIfSchemaChanged } from './firebase/schemaVersion';
import './index.css';
import { startSystemThemeSync } from './theme/theme';

// Follow the OS colour scheme live while the theme preference is System.
startSystemThemeSync();

// Clear a pre-migration offline cache before Firestore is first used (spec §9.7).
void resetCacheIfSchemaChanged().finally(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
