import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Parche global para optimizar el rendimiento de Canvas2D con face-api.js
// Esto elimina las advertencias de "willReadFrequently" y acelera el reconocimiento facial.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: any, attributes?: any) {
  if (type === '2d') {
    attributes = { ...attributes, willReadFrequently: true };
  }
  return originalGetContext.call(this, type, attributes) as any;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
