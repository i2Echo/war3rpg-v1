import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

function inlineEntryCss(): Plugin {
  return {
    name: "inline-entry-css",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const htmlAsset = bundle["index.html"];
      if (!htmlAsset || htmlAsset.type !== "asset" || typeof htmlAsset.source !== "string") return;

      let html = htmlAsset.source;
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "asset" || !fileName.endsWith(".css")) continue;
        const css = typeof chunk.source === "string" ? chunk.source : Buffer.from(chunk.source).toString("utf8");
        html = html.replace(
          new RegExp(`<link rel="stylesheet"[^>]*href="[^"]*${fileName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"[^>]*>`),
          `<style>${css}</style>`,
        );
        delete bundle[fileName];
      }

      htmlAsset.source = html;
    },
  };
}

export default defineConfig({
  plugins: [vue(), inlineEntryCss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("/node_modules/")) return "vendor";
        },
      },
    },
  },
});
