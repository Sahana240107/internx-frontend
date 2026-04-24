const simpleGit = require('simple-git');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');
const auth = require('./auth');

async function run({ repo, branch, token, taskId, internxToken, apiUrl }) {
  console.log(chalk.bold.blue('\n🚀 InternX Project Setup\n'));

  // ── Resolve token (from param or saved login) ──
  const githubToken = token || auth.getToken();
  if (!githubToken) {
    console.log(chalk.yellow('⚠️  No GitHub token found.'));
    console.log(chalk.gray('   Run: internx login --token ghp_yourtoken\n'));
  }

  // ── Paths ──
  const projectName = repo.split('/')[1];
  const baseDir     = path.join(os.homedir(), 'internx-projects');
  const projectDir  = path.join(baseDir, projectName);

  // ── Step 1: Create base folder ──
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // ── Step 2: Clone (skip if already exists) ──
  if (fs.existsSync(projectDir)) {
    console.log(chalk.yellow(`📁 Project already exists at: ${projectDir}`));
    console.log(chalk.gray('   Skipping clone, opening VS Code...\n'));
  } else {
    const cloneUrl = githubToken
      ? `https://${githubToken}@github.com/${repo}.git`
      : `https://github.com/${repo}.git`;

    const cloneSpinner = ora(`Cloning ${chalk.cyan(repo)}...`).start();
    try {
      const git = simpleGit();
      await git.clone(cloneUrl, projectDir);
      cloneSpinner.succeed(chalk.green(`Cloned → ${projectDir}`));
    } catch (err) {
      cloneSpinner.fail(chalk.red('Clone failed'));
      console.error(chalk.red(err.message));
      console.log(chalk.gray('\nPossible reasons:'));
      console.log(chalk.gray('  • Repo does not exist or is private'));
      console.log(chalk.gray('  • Token missing or invalid'));
      console.log(chalk.gray('  • No internet connection\n'));
      process.exit(1);
    }

    // ── Step 3: Create and checkout branch ──
    const branchSpinner = ora(`Creating branch ${chalk.cyan(branch)}...`).start();
    try {
      const repoGit = simpleGit(projectDir);

      // Check if branch already exists on remote
      const remoteBranches = await repoGit.branch(['-r']);
      const branchExists = remoteBranches.all.some(b => b.includes(branch));

      if (branchExists) {
        await repoGit.checkout(branch);
        branchSpinner.succeed(chalk.green(`Checked out existing branch: ${branch}`));
      } else {
        await repoGit.checkoutLocalBranch(branch);
        branchSpinner.succeed(chalk.green(`Created new branch: ${branch}`));
      }
    } catch (err) {
      branchSpinner.fail(chalk.red('Branch creation failed'));
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  }

  // ── Step 4: Write .internx.json — stores task/project metadata locally ──
  // This lets `internx pr` work without any env vars or extra flags.
  try {
    const internxMeta = {
      repo,
      branch,
      task_id:       taskId       || null,
      internx_token: internxToken || null,
      api_url:       apiUrl       || 'http://127.0.0.1:8000',
      created_at: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(projectDir, '.internx.json'),
      JSON.stringify(internxMeta, null, 2)
    );
  } catch {
    // Non-fatal — pr.js will fall back to env var if file is missing
  }

  // ── Step 5: Open VS Code ──
  // Use spawn detached so VS Code launches independently. execSync can
  // silently fail when invoked from a browser protocol handler context
  // because there's no visible shell to inherit the PATH from.
  const vsSpinner = ora('Opening VS Code...').start();
  try {
    const { spawn } = require('child_process');
    const child = spawn('code', [projectDir], {
      detached: true,
      stdio:    'ignore',
      shell:    true,
    });
    child.unref();
    await new Promise(resolve => setTimeout(resolve, 2000));
    vsSpinner.succeed(chalk.green('VS Code opened!'));

    console.log(chalk.bold('\n✅ You\'re all set!\n'));
    console.log(chalk.gray('   Project : ') + chalk.white(repo));
    console.log(chalk.gray('   Branch  : ') + chalk.white(branch));
    console.log(chalk.gray('   Folder  : ') + chalk.white(projectDir));
    console.log(chalk.bold.gray('\n   When done, run in VS Code terminal:'));
    console.log(chalk.cyan(`   internx pr --message "Your work description"\n`));

  } catch (err) {
    vsSpinner.fail(chalk.red('Could not open VS Code'));
    console.log(chalk.yellow('\n⚠️  Make sure VS Code is installed and "code" is in your PATH.'));
    console.log(chalk.gray('   VS Code → Command Palette → "Shell Command: Install \'code\' command in PATH"'));
    console.log(chalk.gray(`\n   Then open manually: code "${projectDir}"\n`));
  }
}

module.exports = { run };