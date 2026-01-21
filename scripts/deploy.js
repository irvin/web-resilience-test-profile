const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKTREE_DIR = path.join(__dirname, '..', 'gh-pages-worktree');
const GH_PAGES_BRANCH = 'gh-pages';

console.log('🚀 開始部署到 GitHub Pages...\n');

const originalDir = process.cwd();

try {
  // 1. 檢查 worktree 是否存在
  if (!fs.existsSync(WORKTREE_DIR)) {
    console.error('❌ gh-pages-worktree 目錄不存在，請先執行 npm run build');
    process.exit(1);
  }

  // 2. 切換到 worktree 目錄並 push
  console.log(`📤 推送 ${GH_PAGES_BRANCH} 分支到遠端...`);
  process.chdir(WORKTREE_DIR);

  try {
    execSync(`git push origin ${GH_PAGES_BRANCH}`, { stdio: 'inherit' });
    console.log('✅ 推送成功\n');
  } catch (error) {
    console.error('❌ 推送失敗:', error.message);
    process.chdir(originalDir);
    process.exit(1);
  }

  // 3. 切回原目錄並清理 worktree
  process.chdir(originalDir);
  console.log('🧹 清理 worktree...');

  try {
    execSync(`git worktree remove "${WORKTREE_DIR}"`, { stdio: 'inherit' });
    console.log('✅ worktree 已清理');
  } catch (error) {
    console.error('⚠️  清理失敗，嘗試強制清理...');
    try {
      execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'inherit' });
      console.log('✅ worktree 已強制清理');
    } catch (forceError) {
      console.error('❌ 無法清理 worktree，請手動刪除:', WORKTREE_DIR);
      process.exit(1);
    }
  }

  console.log('\n✅ 部署完成！');

} catch (error) {
  console.error('\n❌ 部署失敗:', error.message);

  // 確保切回原目錄
  try {
    process.chdir(originalDir);
  } catch (e) {
    // 忽略錯誤
  }

  process.exit(1);
}
