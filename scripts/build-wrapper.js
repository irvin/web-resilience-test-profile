#!/usr/bin/env node

/**
 * Build Wrapper Script
 *
 * 這個腳本用於正確處理 npm run build 時傳入的參數。
 * 當執行 `npm run build www.article19.org` （指定單一特定網址）或 `npm run build:all` （建置所有網站）時，傳遞正確參數給 build.js。
 *
 * 功能：
 * 1. 接收所有命令行參數
 * 2. 將參數傳遞給 build.js 執行建置
 * 3. 如果建置成功，自動執行 build-worktree.js 準備部署
 */

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
