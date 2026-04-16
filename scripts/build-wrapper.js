#!/usr/bin/env node

/**
 * Build wrapper
 *
 * Forwards CLI arguments to build.js so commands like:
 *   npm run build www.article19.org
 *   npm run build:all
 * work correctly. On success, runs build-worktree.js to stage gh-pages output.
 */

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

const buildScript = path.join(__dirname, 'build.js');
const buildCommand = `node "${buildScript}" ${args.map(arg => `"${arg}"`).join(' ')}`;

try {
  execSync(buildCommand, { stdio: 'inherit' });

  const worktreeScript = path.join(__dirname, 'build-worktree.js');
  execSync(`node "${worktreeScript}"`, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}
