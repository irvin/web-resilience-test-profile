const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKTREE_DIR = path.join(__dirname, '..', 'gh-pages-worktree');

console.log('🧹 Removing worktree...');

if (!fs.existsSync(WORKTREE_DIR)) {
  console.log('ℹ️  Worktree does not exist; nothing to do.');
  process.exit(0);
}

try {
  execSync(`git worktree remove "${WORKTREE_DIR}"`, { stdio: 'inherit' });
  console.log('✅ Worktree removed');
} catch (error) {
  console.error('⚠️  Remove failed, retrying with --force...');
  try {
    execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'inherit' });
    console.log('✅ Worktree removed (--force)');
  } catch (forceError) {
    console.error('❌ Could not remove worktree. Delete manually:', WORKTREE_DIR);
    process.exit(1);
  }
}
