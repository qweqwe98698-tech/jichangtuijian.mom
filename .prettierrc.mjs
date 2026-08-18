/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  singleQuote: true,
  semi: true,
  trailingComma: 'es5',
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  overrides: [
    { files: '*.astro', options: { parser: 'astro' } },
    { files: ['*.md', '*.mdx'], options: { printWidth: 80, proseWrap: 'preserve' } },
  ],
};
