import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [
    {
      name: 'app-version',
      transformIndexHtml(html) {
        return html.replace('%APP_VERSION%', version);
      },
    },
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
