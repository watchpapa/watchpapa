import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import ScrollManager from "./components/ScrollManager.jsx";
import "./styles/globals.css";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
        <ScrollManager />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
