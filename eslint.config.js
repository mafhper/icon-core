import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/src-tauri/target/**',
      '**/src-tauri/gen/**',
      'dist-pages/**',
      'coverage/**',
      '.dev/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // A5: aria-correctness subset. Interaction rules (click-events-have-key-events,
      // no-static-element-interactions, ...) stay off until A6 migrates the canvas
      // and remaining div-handlers to semantic controls.
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      // A5: hardcoded hex inside class strings is banned outright (zero occurrences
      // today; the .ui-budget.json hex ratchet caps the remaining literals in
      // non-class positions until A6 removes them).
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/\\[#[0-9a-fA-F]+\\]/]',
          message: 'Hardcoded hex color in class string. Use an ic-* token instead.'
        },
        {
          selector: 'TemplateLiteral > TemplateElement[value.raw=/\\[#[0-9a-fA-F]+\\]/]',
          message: 'Hardcoded hex color in class string. Use an ic-* token instead.'
        }
      ]
    }
  }
];
