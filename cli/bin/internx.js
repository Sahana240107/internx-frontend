#!/usr/bin/env node

const { program } = require('commander');
const setup = require('../src/setup');
const pr = require('../src/pr');
const auth = require('../src/auth');

program
  .name('internx')
  .description('InternX CLI - Setup projects instantly in VS Code')
  .version('1.0.0');

// ─────────────────────────────────────────────
// internx url "internx://setup?..."
// Called automatically by OS when button is clicked in browser
// ─────────────────────────────────────────────
program
  .command('url <url>')
  .description('Handle internx:// protocol URL (called by OS)')
  .action(async (url) => {
    try {
      const parsed = new URL(url);
      const command = parsed.hostname;         // "setup"
      const repo          = parsed.searchParams.get('repo');
      const branch        = parsed.searchParams.get('branch');
      const token         = parsed.searchParams.get('token');
      const taskId        = parsed.searchParams.get('task_id');
      const internxToken  = parsed.searchParams.get('internx_token');
      const apiUrl        = parsed.searchParams.get('api_url');

      if (command === 'setup') {
        await setup.run({ repo, branch, token, taskId, internxToken, apiUrl });
      } else {
        console.error(`Unknown command in URL: ${command}`);
        process.exit(1);
      }
    } catch (err) {
      console.error('Failed to parse internx:// URL:', err.message);
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────
// internx setup --repo org/project --branch john-dev --token xxx
// Can also be run manually from terminal
// ─────────────────────────────────────────────
program
  .command('setup')
  .description('Clone a project and open it in VS Code')
  .requiredOption('--repo <repo>', 'GitHub repo (e.g. internx-org/frontend-app)')
  .requiredOption('--branch <branch>', 'Branch name (e.g. john-dev)')
  .option('--token <token>', 'GitHub auth token')
  .option('--task-id <taskId>', 'InternX task ID (auto-set by the web app)')
  .option('--internx-token <internxToken>', 'InternX API token (auto-set by the web app)')
  .option('--api-url <apiUrl>', 'InternX backend URL (auto-set by the web app)')
  .action(async (options) => {
    await setup.run({ ...options, taskId: options.taskId, internxToken: options.internxToken, apiUrl: options.apiUrl });
  });

// ─────────────────────────────────────────────
// internx pr --message "Feature complete"
// Commit, push, and create a PR — all in one command
// ─────────────────────────────────────────────
program
  .command('pr')
  .description('Commit, push and create a Pull Request')
  .option('--message <message>', 'Commit + PR title', 'Work complete')
  .option('--base <base>', 'Base branch to merge into', 'main')
  .action(async (options) => {
    await pr.run(options);
  });

// ─────────────────────────────────────────────
// internx login --token ghp_xxx
// Save GitHub token locally so internx pr works
// ─────────────────────────────────────────────
program
  .command('login')
  .description('Save your GitHub token for CLI use')
  .requiredOption('--token <token>', 'GitHub personal access token')
  .action((options) => {
    auth.saveToken(options.token);
  });

// ─────────────────────────────────────────────
// internx status
// Show current project info
// ─────────────────────────────────────────────
program
  .command('status')
  .description('Show current project and branch')
  .action(async () => {
    const simpleGit = require('simple-git');
    const git = simpleGit(process.cwd());
    try {
      const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
      const remote = (await git.remote(['get-url', 'origin'])).trim();
      console.log(`\n📁 Repo   : ${remote}`);
      console.log(`🌿 Branch : ${branch}`);
      console.log(`\nRun \`internx pr --message "your message"\` when ready.\n`);
    } catch {
      console.log('❌ Not inside a git repository.');
    }
  });

program.parse(process.argv);