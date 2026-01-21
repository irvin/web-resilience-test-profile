const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const WORKTREE_DIR = path.join(__dirname, '..', 'gh-pages-worktree');
const GH_PAGES_BRANCH = 'gh-pages';

console.log('🚀 開始部署到 gh-pages 分支...');

// 1. 確保 dist/ 目錄存在
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ dist/ 目錄不存在，請先執行 npm run build');
  process.exit(1);
}

const originalDir = process.cwd();

try {
  // 2. 檢查 gh-pages 分支是否存在
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${GH_PAGES_BRANCH}`, { stdio: 'ignore' });
    console.log(`✓ 找到 ${GH_PAGES_BRANCH} 分支`);
  } catch (e) {
    console.log(`📦 創建 ${GH_PAGES_BRANCH} 分支...`);
    // 儲存當前分支
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

    // 創建 orphan 分支
    execSync(`git checkout --orphan ${GH_PAGES_BRANCH}`, { stdio: 'inherit' });
    execSync('git rm -rf . --ignore-unmatch', { stdio: 'inherit' });
    execSync('git commit --allow-empty -m "Initial gh-pages"', { stdio: 'inherit' });

    // 不自動 push，讓用戶手動處理
    console.log('ℹ️  請稍後手動 push gh-pages 分支到遠端');

    // 切回原分支
    execSync(`git checkout ${currentBranch}`, { stdio: 'inherit' });
  }

  // 3. 移除舊的 worktree（如果存在）
  if (fs.existsSync(WORKTREE_DIR)) {
    try {
      console.log('🧹 清理舊的 worktree...');
      process.chdir(WORKTREE_DIR);
      execSync('git reset --hard', { stdio: 'ignore' });
      process.chdir(originalDir);
      execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'inherit' });
    } catch (e) {
      // 如果移除失敗，手動刪除目錄
      console.log('⚠️  強制清理 worktree 目錄...');
      fs.rmSync(WORKTREE_DIR, { recursive: true, force: true });
    }
  }

  // 4. 創建 worktree
  console.log('📁 創建 worktree...');
  // 使用引號包裹路徑，避免空格問題
  execSync(`git worktree add "${WORKTREE_DIR}" ${GH_PAGES_BRANCH}`, { stdio: 'inherit' });

  // 5. 清空 worktree 目錄（保留 .git）
  console.log('🧹 清空 worktree 目錄...');
  const files = fs.readdirSync(WORKTREE_DIR);
  files.forEach(file => {
    if (file !== '.git') {
      const filePath = path.join(WORKTREE_DIR, file);
      try {
        fs.rmSync(filePath, { recursive: true, force: true });
      } catch (e) {
        // 忽略錯誤
      }
    }
  });

  // 6. 複製 dist/ 的內容
  console.log('📋 複製建置產物...');
  const distFiles = fs.readdirSync(DIST_DIR);
  distFiles.forEach(file => {
    const src = path.join(DIST_DIR, file);
    const dest = path.join(WORKTREE_DIR, file);
    try {
      if (fs.statSync(src).isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }
    } catch (e) {
      console.error(`⚠️  複製 ${file} 時發生錯誤:`, e.message);
    }
  });

  // 7. 在 worktree 中 commit
  process.chdir(WORKTREE_DIR);
  execSync('git add .', { stdio: 'inherit' });

  const commitMessage = `Deploy: ${new Date().toISOString()}`;
  try {
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    console.log('✓ 已 commit 變更');
  } catch (e) {
    console.log('ℹ️  沒有變更需要 commit');
  }

  // 8. 不自動 push，保留 worktree 供手動 push
  console.log('\n✅ 本地部署完成！');
  console.log(`📁 worktree 位置: ${WORKTREE_DIR}`);
  console.log(`🌿 分支: ${GH_PAGES_BRANCH}`);
  console.log('\n📝 接下來請執行：');
  console.log(`   npm run deploy`);
  console.log(`   或手動執行：`);
  console.log(`   cd ${WORKTREE_DIR}`);
  console.log(`   git push origin ${GH_PAGES_BRANCH}`);
  console.log(`   cd ..`);
  console.log(`   git worktree remove ${WORKTREE_DIR}`);

  // 不自動清理 worktree，讓用戶可以手動 push
  process.chdir(originalDir);

} catch (error) {
  console.error('\n❌ 部署失敗:', error.message);

  // 確保切回原目錄
  try {
    process.chdir(originalDir);
  } catch (e) {
    // 忽略錯誤
  }

  // 嘗試清理 worktree
  try {
    if (fs.existsSync(WORKTREE_DIR)) {
      execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'ignore' });
    }
  } catch (e) {
    // 忽略錯誤
  }

  process.exit(1);
}
