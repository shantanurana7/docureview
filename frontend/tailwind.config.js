/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#e6eaf4',
                    100: '#c2cce5',
                    200: '#99acd4',
                    300: '#6d8bc2',
                    400: '#4a6fb5',
                    500: '#1e49e2',
                    600: '#1a3fc5',
                    700: '#00338d',
                    800: '#002776',
                    900: '#001a5e',
                },
                surface: {
                    0: '#ffffff',
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                },
                success: { DEFAULT: '#22c55e', light: '#dcfce7' },
                warning: { DEFAULT: '#f59e0b', light: '#fef3c7' },
                danger: { DEFAULT: '#ef4444', light: '#fee2e2' },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            borderRadius: {
                'xl': '0.75rem',
                '2xl': '1rem',
            },
            boxShadow: {
                'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
                'card-hover': '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06)',
            }
        },
    },
    plugins: [],
}
