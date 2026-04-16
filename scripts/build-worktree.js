const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '..', 'web');
const WORKTREE_DIR = path.join(__dirname, '..', 'gh-pages-worktree');
const GH_PAGES_BRANCH = 'gh-pages';

console.log('🚀 Preparing gh-pages worktree...');

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ web/ does not exist. Run npm run build first.');
  process.exit(1);
}

const originalDir = process.cwd();

try {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${GH_PAGES_BRANCH}`, { stdio: 'ignore' });
    console.log(`✓ Found branch ${GH_PAGES_BRANCH}`);
  } catch (e) {
    console.log(`📦 Creating branch ${GH_PAGES_BRANCH}...`);
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

    execSync(`git checkout --orphan ${GH_PAGES_BRANCH}`, { stdio: 'inherit' });
    execSync('git rm -rf . --ignore-unmatch', { stdio: 'inherit' });
    execSync('git commit --allow-empty -m "Initial gh-pages"', { stdio: 'inherit' });

    console.log('ℹ️  Push gh-pages to the remote manually when ready.');

    execSync(`git checkout ${currentBranch}`, { stdio: 'inherit' });
  }

  try {
    console.log('🧹 Pruning stale worktree registrations...');
    execSync('git worktree prune', { stdio: 'ignore' });
  } catch (e) {
    // ignore
  }

  if (fs.existsSync(WORKTREE_DIR)) {
    try {
      console.log('🧹 Removing existing worktree...');
      process.chdir(WORKTREE_DIR);
      execSync('git reset --hard', { stdio: 'ignore' });
      process.chdir(originalDir);
      execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'inherit' });
    } catch (e) {
      console.log('⚠️  Forcing worktree cleanup...');
      try {
        execSync('git worktree prune', { stdio: 'ignore' });
      } catch (e2) {
        // ignore
      }
      fs.rmSync(WORKTREE_DIR, { recursive: true, force: true });
    }
  } else {
    try {
      execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'ignore' });
    } catch (e) {
      try {
        execSync('git worktree prune', { stdio: 'ignore' });
      } catch (e2) {
        // ignore
      }
    }
  }

  console.log('📁 Creating worktree...');
  try {
    execSync(`git worktree add "${WORKTREE_DIR}" ${GH_PAGES_BRANCH}`, { stdio: 'inherit' });
  } catch (e) {
    console.log('⚠️  Retrying with -f...');
    execSync(`git worktree add -f "${WORKTREE_DIR}" ${GH_PAGES_BRANCH}`, { stdio: 'inherit' });
  }

  console.log('🧹 Clearing worktree contents (static output will be copied from web/)...');
  const keepEntries = new Set([
    '.git',
    '.gitmodules',
    'report'
  ]);
  const files = fs.readdirSync(WORKTREE_DIR);
  files.forEach(file => {
    if (!keepEntries.has(file)) {
      const filePath = path.join(WORKTREE_DIR, file);
      try {
        fs.rmSync(filePath, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
  });

  console.log('📋 Copying build output from web/...');
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
      console.error(`⚠️  Failed to copy ${file}:`, e.message);
    }
  });

  process.chdir(WORKTREE_DIR);
  execSync('git add .', { stdio: 'inherit' });

  const commitMessage = `Deploy: ${new Date().toISOString()}`;
  try {
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    console.log('✓ Committed changes');
  } catch (e) {
    console.log('ℹ️  Nothing to commit');
  }

  console.log('\n✅ Local gh-pages staging complete.');
  console.log(`📁 Worktree: ${WORKTREE_DIR}`);
  console.log(`🌿 Branch: ${GH_PAGES_BRANCH}`);
  console.log('\nNext:');
  console.log(`   npm run deploy`);
  console.log(`   or manually:`);
  console.log(`   cd ${WORKTREE_DIR}`);
  console.log(`   git push origin ${GH_PAGES_BRANCH}`);
  console.log(`   cd ..`);
  console.log(`   git worktree remove ${WORKTREE_DIR}`);

  process.chdir(originalDir);

} catch (error) {
  console.error('\n❌ Failed:', error.message);

  try {
    process.chdir(originalDir);
  } catch (e) {
    // ignore
  }

  try {
    if (fs.existsSync(WORKTREE_DIR)) {
      execSync(`git worktree remove "${WORKTREE_DIR}" --force`, { stdio: 'ignore' });
    }
  } catch (e) {
    // ignore
  }

  process.exit(1);
}
