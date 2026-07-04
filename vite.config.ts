import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  plugins: [
    AutoImport({
      imports: ['vue', '@vueuse/core', { dayjs: [['default', 'dayjs']] }],
      dts: true,
    }),
    Components({
      dirs: ['src/components'],
      deep: true,
      dts: true,
    }),
    vue(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SCalendar',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['vue', 'dayjs', '@vueuse/core'],
    },
    cssCodeSplit: false,
  },
})
