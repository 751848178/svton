#!/usr/bin/env node

// 直接使用 CommonJS 格式
const { cli } = require('../dist/index.js');

cli().catch((error) => {
  console.error('Error starting CLI:', error);
  process.exit(1);
});
