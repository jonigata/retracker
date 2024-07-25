import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'path';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'retracker',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format}.js`
    }
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src'],
      outDir: 'dist',
    })
  ],
  test: {
    include: ['**/*.vitest.ts'],
    exclude: [...configDefaults.exclude],
    globals: true,
  },
});
