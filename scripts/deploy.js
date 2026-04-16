const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKTREE_DIR = path.join(__dirname, '..', 'gh-pages-worktree');
const GH_PAGES_BRANCH = 'gh-pages';

console.log('🚀 Pushing gh-pages to GitHub Pages...\n');

const originalDir = process.cwd();

try {
  if (!fs.existsSync(WORKTREE_DIR)) {
    console.error('❌ gh-pages-worktree does not exist. Run npm run build first.');
    process.exit(1);
  }

  console.log(`📤 Pushing ${GH_PAGES_BRANCH}...`);
  process.chdir(WORKTREE_DIR);

  try {
    execSync(`git push origin ${GH_PAGES_BRANCH}`, { stdio: 'inherit' });
    console.log('✅ Push succeeded\n');
  } catch (error) {
    console.error('❌ Push failed:', error.message);
    process.chdir(originalDir);
    process.exit(1);
  }

  process.chdir(originalDir);
  console.log('🧹 Removing worktree...');

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

  console.log('\n✅ Deploy complete.');

} catch (error) {
  console.error('\n❌ Deploy failed:', error.message);

  try {
    process.chdir(originalDir);
  } catch (e) {
    // ignore
  }

  process.exit(1);
}
