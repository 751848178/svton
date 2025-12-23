/**
 * Taro UI Package ESLint 配置
 */
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    'eslint:recommended',
  ],
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
  rules: {
    // ✅ 强制使用分号
    'semi': ['error', 'always'],
    'semi-spacing': ['error', { before: false, after: true }],
    'semi-style': ['error', 'last'],
    'no-extra-semi': 'error',
    
    // React 规则
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    
    // 其他规则
    'quotes': ['error', 'single', { avoidEscape: true }],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'comma-dangle': ['error', 'always-multiline'],
    'no-console': 'off',
    'no-unused-vars': 'warn',
  },
};
