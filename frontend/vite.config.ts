import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
        port: 3000,
        proxy: {
            '/api': 'http://localhost:5000',
            '/uploads': 'http://localhost:5000',
        }
    },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        }
    }
});
