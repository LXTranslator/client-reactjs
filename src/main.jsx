import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './context/AuthContext.jsx';
import { App } from './App.jsx';

// Style layers are imported in the order the design system specifies:
// tokens, then shared layout, then shared components, then per section styles.
import './styles/main.css';
import './styles/shared/layout.css';
import './styles/shared/components.css';
import './styles/auth/auth.css';
import './styles/editor/editor.css';
import './styles/chat/chat.css';

const container = document.getElementById('root');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
