
import React from 'react';
import ReactDOM from 'react-dom/client';
// FIX: The error "File '.../App.tsx' is not a module" is resolved by implementing the App.tsx component.
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);