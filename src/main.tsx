import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AvatarProvider } from "./lib/store.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AvatarProvider>
        <App />
      </AvatarProvider>
    </BrowserRouter>
  </StrictMode>,
);
