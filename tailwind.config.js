/** @type {import('tailwindcss').Config} */
export default {
  darkMode:'class',
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens con significado (ver src/styles/tokens.css). Se prefieren a
        // `gray-XXX` sueltos: el tema los resuelve solo, sin `dark:` repetido.
        fondo: "rgb(var(--fondo) / <alpha-value>)",
        superficie: "rgb(var(--superficie) / <alpha-value>)",
        "superficie-2": "rgb(var(--superficie-2) / <alpha-value>)",
        borde: "rgb(var(--borde) / <alpha-value>)",
        texto: "rgb(var(--texto) / <alpha-value>)",
        sutil: "rgb(var(--sutil) / <alpha-value>)",
        acento: "rgb(var(--acento) / <alpha-value>)",
        "acento-fuerte": "rgb(var(--acento-fuerte) / <alpha-value>)",
        "acento-texto": "rgb(var(--acento-texto) / <alpha-value>)",
        "acento-suave": "rgb(var(--acento-suave) / <alpha-value>)",
        exito: "rgb(var(--exito) / <alpha-value>)",
        aviso: "rgb(var(--aviso) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
      },
      // Escala tipográfica fija, en vez de encadenar
      // `text-sm sm:text-base lg:text-lg 2xl:text-2xl` en cada componente.
      fontSize: {
        display: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        titulo: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        subtitulo: ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        cuerpo: ["1rem", { lineHeight: "1.6" }],
        apoyo: ["0.875rem", { lineHeight: "1.5" }],
        etiqueta: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "600" }],
      },
      borderRadius: { tarjeta: "1rem", chip: "0.75rem" },
      fontFamily: {
        // Modo infantil: tipografía redondeada y juguetona. La CSP de
        // producción no permite cargar fuentes externas (font-src 'self'),
        // así que usamos las tipografías redondeadas que ya trae Windows en
        // vez de depender de una red que la app no necesita para nada más.
        comic: ['"Comic Sans MS"', '"Segoe Print"', "system-ui", "sans-serif"],
        // Traductor: letra redonda y gruesa, empaquetada con la app
        // (@fontsource-variable/fredoka) para que funcione sin internet.
        llamativa: ['"Fredoka Variable"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
