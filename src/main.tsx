import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/* The fallback markup inside #root is the JavaScript-off reading of the
 * record — real prose, not a placeholder. React replaces it on mount. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
