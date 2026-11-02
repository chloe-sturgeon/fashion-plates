import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = `http://localhost:${process.env.PORT ?? 3001}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": API, "/uploads": API },
  },
  optimizeDeps: {
    // onnxruntime-web ships its own wasm loader; let it resolve its files at runtime.
    exclude: ["@imgly/background-removal"],
  },
});
