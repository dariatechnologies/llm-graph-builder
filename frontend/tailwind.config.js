/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#ff8552',
        'secondary': '#fff8f5',
      },
    },
  },
  plugins: [],
  presets:[require('@neo4j-ndl/base').tailwindConfig],
  corePlugins: {
    preflight: false,
  },
  prefix:""
}

