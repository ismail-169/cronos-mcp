/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          cyan: "#22d3ee",
          purple: "#8B5CF6",
          amber: "#f59e0b",
          green: "#22c55e",
          dark: "#1a1a1a",
          light: "#fafafa",
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-newsreader)', 'Georgia', 'serif'],
      },
      boxShadow: {
        'neo-sm': '3px 3px 0 #1a1a1a',
        'neo': '4px 4px 0 #1a1a1a',
        'neo-lg': '6px 6px 0 #1a1a1a',
        'neo-xl': '8px 8px 0 #1a1a1a',
        'neo-cyan': '4px 4px 0 #22d3ee',
        'neo-cyan-lg': '6px 6px 0 #22d3ee',
        'neo-purple': '4px 4px 0 #8B5CF6',
        'neo-purple-lg': '6px 6px 0 #8B5CF6',
        'neo-amber': '4px 4px 0 #f59e0b',
        'neo-amber-lg': '6px 6px 0 #f59e0b',
        'neo-green': '4px 4px 0 #22c55e',
        'neo-green-lg': '6px 6px 0 #22c55e',
      },
      borderRadius: {
        'neo': '8px',
        'neo-lg': '12px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};