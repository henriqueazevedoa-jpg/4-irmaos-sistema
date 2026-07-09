import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Torna o sistema "instalável" (ícone/janela próprios) e mantém atualização automática.
    VitePWA({
      registerType: "autoUpdate", // pega a versão nova sozinho
      injectRegister: "auto",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Gestão — Loja 4 Irmãos",
        short_name: "4 Irmãos",
        description: "Sistema de gestão da Loja 4 Irmãos",
        lang: "pt-BR",
        theme_color: "#b5451f",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Guarda o "esqueleto" do app para abrir rápido; NÃO guarda os dados (/api).
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/health/],
      },
    }),
  ],
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
