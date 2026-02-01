#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

async function copyTemplates() {
  const cliRoot = path.join(__dirname, '..');
  const projectRoot = path.join(cliRoot, '../..');
  const sourceTemplates = path.join(projectRoot, 'templates');
  const targetTemplates = path.join(cliRoot, 'templates');

  try {
    // 删除旧的 templates 目录（如果存在）
    if (await fs.pathExists(targetTemplates)) {
      await fs.remove(targetTemplates);
      console.log('Removed old templates directory');
    }

    // 复制 templates 目录
    if (await fs.pathExists(sourceTemplates)) {
      await fs.copy(sourceTemplates, targetTemplates);
      console.log('✓ Templates copied successfully');
    } else {
      console.warn('⚠ Warning: templates directory not found at', sourceTemplates);
    }
  } catch (error) {
    console.error('✗ Failed to copy templates:', error.message);
    process.exit(1);
  }
}

copyTemplates();
