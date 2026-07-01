import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Encaminha as chamadas /api para o servidor (API), evitando problemas de CORS.
    proxy: {
      "/api": "http://127.0.0.1:3333",
    },
  },
});
