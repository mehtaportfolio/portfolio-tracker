import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import reportWebVitals from './reportWebVitals.js';
import './tailwind-output.css';
import { NavigationProvider } from './context/NavigationContext.jsx';
import { EquityVisibilityProvider } from './context/EquityVisibility.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ModeProvider } from './context/ModeContext.jsx';
import { PrivacyProvider } from './context/PrivacyContext.jsx';
import { LivePriceProvider } from './context/LivePriceContext.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ModeProvider>
        <NavigationProvider>
          <PrivacyProvider>
            <EquityVisibilityProvider>
              <LivePriceProvider>
                <App />
              </LivePriceProvider>
            </EquityVisibilityProvider>
          </PrivacyProvider>
        </NavigationProvider>
      </ModeProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Unregister any active service worker to bypass persistent caching
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
      console.log('Service Worker unregistered');
    }
  });
}

reportWebVitals();
