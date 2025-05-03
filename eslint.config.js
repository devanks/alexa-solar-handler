// eslint.config.js
import globals from 'globals'; // Recommended way to define globals
import pluginJs from '@eslint/js'; // Recommended base rules
import pluginPrettierRecommended from 'eslint-plugin-prettier/recommended'; // Prettier integration

export default [
  // Base configuration recommended by ESLint
  pluginJs.configs.recommended,

  // Prettier integration - must be last in the extends/plugins list usually
  pluginPrettierRecommended,

  {
    // Apply rules specifically to .mjs files (or js if you use both)
    files: ['**/*.mjs', '**/*.js'], // Specify files to apply this config block to

    languageOptions: {
      ecmaVersion: 'latest', // Use modern ECMAScript
      sourceType: 'module', // Enable ES Modules
      globals: {
        ...globals.node, // Add Node.js global variables
        ...globals.jest, // Add Jest global variables
      },
    },

    rules: {
      // Customize rules here
      'prettier/prettier': 'warn', // Show Prettier formatting issues as warnings
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Warn on unused vars, ignore if starts with _
      'no-console': 'warn', // Discourage console.log in favour of structured logger
      // Add any other specific rules you want
    },

    ignores: ['node_modules/', 'dist/', '*.json'], // Files/directories to ignore
  },
];
