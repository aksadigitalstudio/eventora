import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  server: { host: "127.0.0.1", port: 4200 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          qr: ["qrcode", "jsqr"],
        },
      },
    },
  },
});
