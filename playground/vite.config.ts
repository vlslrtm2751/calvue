import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname),
  resolve: { alias: { vue: 'vue/dist/vue.esm-bundler.js' } },
  plugins: [
    AutoImport({ imports: ['vue', '@vueuse/core', { dayjs: [['default', 'dayjs']] }] }),
    Components({ dirs: [resolve(__dirname, '../src/components')], deep: true }),
    vue()
  ]
})
