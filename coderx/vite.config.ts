import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react-swc'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": resolve(__dirname, './src'),
		},
		dedupe: ['react', 'react-dom'],
	},
	optimizeDeps: {
		include: ['react', 'react-dom', 'react-complex-tree']
	},
})
