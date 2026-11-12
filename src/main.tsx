import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './context/AuthContext.tsx';
import { App } from './App.tsx';

// Style layers are imported in the order the design system specifies:
// tokens, then shared layout, then shared components, then per section styles.
import './styles/main.css';
import './styles/shared/layout.css';
import './styles/shared/components.css';
import './styles/auth/auth.css';
import './styles/editor/editor.css';
import './styles/chat/chat.css';

// index.html always carries the mount point.
const container = document.getElementById('root') as HTMLElement;

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
