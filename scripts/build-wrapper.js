#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// 取得所有參數（除了 node 和腳本路徑）
const args = process.argv.slice(2);

// 執行 build.js，並傳遞所有參數
const buildScript = path.join(__dirname, 'build.js');
const buildCommand = `node "${buildScript}" ${args.map(arg => `"${arg}"`).join(' ')}`;

try {
  execSync(buildCommand, { stdio: 'inherit' });
  
  // 如果 build.js 成功執行，則執行 build-worktree.js
  const worktreeScript = path.join(__dirname, 'build-worktree.js');
  execSync(`node "${worktreeScript}"`, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}
