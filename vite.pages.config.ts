import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({root:'github-pages',base:'./',publicDir:'../public',plugins:[react()],build:{outDir:'../dist-pages',emptyOutDir:true,rollupOptions:{input:{main:resolve('github-pages/index.html'),honda:resolve('github-pages/honda-watch/index.html')}}}});
