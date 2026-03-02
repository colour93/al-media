import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/rspack';
import { InjectManifest } from '@aaroon/workbox-rspack-plugin';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  html: {
    title: 'AL Media',
    meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:39994'
      },
      '/admin': {
        target: 'http://localhost:39995'
      }
    },
    port: 39996,
  },
  plugins: [pluginReact()],
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({
          target: 'react',
          autoCodeSplitting: true,
        }),
        new InjectManifest({
          swSrc: './src/sw.ts',
          swDest: 'service-worker.js',
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        }),
      ],
    },
  },
});
