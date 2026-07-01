import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // permite acesso pela rede (além de localhost)
    allowedHosts: true, // aceita o acesso vindo do encaminhador HTTPS (celular)
    // Encaminha as chamadas /api para o servidor (API), evitando problemas de CORS.
    proxy: {
      "/api": "http://127.0.0.1:3333",
    },
  },
});
