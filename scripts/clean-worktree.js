const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKTREE_DIR = path.join(__dirname, '..', 'gh-pages-worktree');

console.log('🧹 清理 worktree...');

if (!fs.existsSync(WORKTREE_DIR)) {
  console.log('ℹ️  worktree 不存在，無需清理');
  process.exit(0);
}

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
