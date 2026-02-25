import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  html: {
    title: '流媒体平台',
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
      ],
    },
  },
});
