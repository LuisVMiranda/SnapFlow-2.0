import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'backend/node_modules']),
  { files: ['website/**/*.js'], extends: [js.configs.recommended], languageOptions: { globals: globals.browser } },
  {
    files: ['website/*.js', 'src/lib/websiteApi.js', 'src/hooks/useGalleryCreationCover.js',
      'src/hooks/useWebsiteAdmin.js', 'src/components/GalleryCoverControls.jsx', 'src/components/WebsitePanel.jsx',
      'backend/src/repos/website.js', 'backend/src/routes/websiteRoutes.js',
      'backend/src/services/websiteService.js', 'backend/src/services/galleryCoverService.js'],
    ignores: ['**/*.test.js'],
    rules: { complexity: ['error', 10], 'max-params': ['error', 5], 'max-depth': ['error', 3],
      'max-lines': ['error', { max: 600, skipBlankLines: false, skipComments: false }] },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['backend/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
