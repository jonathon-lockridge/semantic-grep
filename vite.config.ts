import { defineConfig } from "vite";

// The Pages deploy passes --base=/<repo>/ on the CLI so the SPA resolves its
// assets under the project subpath. Locally (dev/preview) base defaults to "/".
export default defineConfig({
  build: {
    target: "es2022",
    // The bundled ONNX model under public/ is large; silence the chunk warning.
    chunkSizeWarningLimit: 4096,
  },
  // transformers.js pulls in node-only deps it never uses in the browser build;
  // exclude it from pre-bundling so Vite resolves the web entry lazily.
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
});
