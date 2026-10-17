import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        mpesa: {
          50: '#eefbf2',
          100: '#d7f6e0',
          500: '#00a859', // Iconic Safaricom Green
          600: '#008b47',
          700: '#006e39',
        },
      },
    },
  },
  plugins: [],
};

export default config;
