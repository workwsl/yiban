import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function copyManifestPlugin() {
  return {
    name: 'copy-extension-manifest',
    closeBundle() {
      mkdirSync('dist', { recursive: true });
      copyFileSync('src/manifest.json', 'dist/manifest.json');

      if (existsSync('dist/src/popup/popup.html')) {
        copyFileSync('dist/src/popup/popup.html', 'dist/popup.html');
      }

      if (existsSync('dist/src/options/options.html')) {
        copyFileSync('dist/src/options/options.html', 'dist/options.html');
      }

      if (existsSync('dist/src/translator/translator.html')) {
        copyFileSync('dist/src/translator/translator.html', 'dist/translator.html');
      }

      const iconsDir = 'src/icons';
      if (existsSync(iconsDir)) {
        mkdirSync('dist/icons', { recursive: true });
        for (const file of readdirSync(iconsDir)) {
          if (file.endsWith('.png')) {
            copyFileSync(join(iconsDir, file), join('dist/icons', file));
          }
        }
      }
    },
  };
}

function contentScriptIifePlugin() {
  return {
    name: 'content-script-iife',
    apply: 'build' as const,
    async closeBundle() {
      const { build } = await import('vite');

      await build({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: resolve(__dirname, 'dist'),
          rollupOptions: {
            input: {
              content: resolve(__dirname, 'src/content/content-script.ts'),
            },
            output: {
              entryFileNames: 'assets/[name].js',
              format: 'iife',
              name: 'YibanContentScript',
              inlineDynamicImports: true,
            },
          },
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin(), contentScriptIifePlugin()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        translator: resolve(__dirname, 'src/translator/translator.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
