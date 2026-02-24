import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:39994'
      }
    }
  },
  html: {
    title: '视频平台管理',
    meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
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
