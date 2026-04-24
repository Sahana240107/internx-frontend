const simpleGit = require('simple-git');
const axios     = require('axios');
const chalk     = require('chalk');
const ora       = require('ora');
const fs        = require('fs');
const path      = require('path');
const auth      = require('./auth');

// ── Read .internx.json written by `internx setup` ──
function readMeta(cwd) {
  try {
    const p = path.join(cwd, '.internx.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return {};
}

// ── Fetch the PR diff from GitHub ──
async function getPrDiff(owner, repo, prNumber, githubToken) {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3.diff',
        },
      }
    );
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch {
    return null;
  }
}

// ── POST to /api/mentor/review — fires in background on backend ──
async function triggerReview(taskId, prDiff, internxToken, apiUrl) {
  try {
    await axios.post(
      `${apiUrl}/api/mentor/review`,
      { task_id: taskId, pr_diff: prDiff },
      { headers: { Authorization: `Bearer ${internxToken}` } }
    );
    return true;
  } catch {
    return false;
  }
}

async function run({ message, base }) {
  const cwd  = process.cwd();
  const git  = simpleGit(cwd);
  const meta = readMeta(cwd);

  // Resolve IDs: .internx.json → env var → null
  const taskId       = meta.task_id       || process.env.INTERNX_TASK_ID  || null;
  const internxToken = meta.internx_token || process.env.INTERNX_TOKEN    || null;
  const apiUrl       = meta.api_url       || process.env.INTERNX_API_URL  || 'http://127.0.0.1:8000';

  // ── Git repo check ──
  if (!(await git.checkIsRepo())) {
    console.error(chalk.red('\n❌ Not inside a git repository.\n'));
    process.exit(1);
  }

  const githubToken = auth.getToken();
  if (!githubToken) {
    console.error(chalk.red('\n❌ No GitHub token. Run: internx login --token ghp_xxx\n'));
    process.exit(1);
  }

  console.log(chalk.bold.blue('\n📤 InternX — Submit for Review\n'));

  // ── 1. Stage ──
  const s1 = ora('Staging changes...').start();
  try {
    await git.add('.');
    const status = await git.status();
    status.files.length === 0
      ? s1.warn(chalk.yellow('No changes to commit.'))
      : s1.succeed(chalk.green(`Staged ${status.files.length} file(s)`));
  } catch (e) {
    s1.fail('Staging failed');
    console.error(chalk.red(e.message));
    process.exit(1);
  }

  // ── 2. Commit ──
  const s2 = ora('Committing...').start();
  try {
    await git.commit(message);
    s2.succeed(chalk.green('Committed'));
  } catch {
    s2.warn(chalk.yellow('Nothing new to commit, pushing existing commits...'));
  }

  // ── 3. Push ──
  const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
  const s3 = ora(`Pushing ${chalk.cyan(branch)}...`).start();
  try {
    await git.push('origin', branch, ['--set-upstream']);
    s3.succeed(chalk.green(`Pushed → origin/${branch}`));
  } catch (e) {
    s3.fail(chalk.red('Push failed'));
    console.error(chalk.red(e.message));
    process.exit(1);
  }

  // ── 4. Parse owner/repo from remote ──
  let owner, repo;
  try {
    const remote = (await git.remote(['get-url', 'origin'])).trim();
    const m = remote.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    if (!m) throw new Error('Cannot parse remote URL');
    [, owner, repo] = m;
  } catch (e) {
    console.error(chalk.red('\n❌ Could not read GitHub remote:'), e.message);
    process.exit(1);
  }

  // ── 5. Create PR (or find existing) ──
  const s5 = ora('Creating Pull Request...').start();
  let prNumber, prUrl;
  try {
    const res = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        title: message,
        head:  branch,
        base,
        body:  `## 📝 Submitted via InternX\n\n**Branch:** \`${branch}\`\n\n${message}\n\n---\n*Created automatically by InternX CLI*`,
      },
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    prNumber = res.data.number;
    prUrl    = res.data.html_url;
    s5.succeed(chalk.green('Pull Request created!'));
  } catch (e) {
    if (e.response?.status === 422) {
      // PR already exists — look it up so we can still trigger review
      s5.warn(chalk.yellow('PR already exists — re-triggering AI review.'));
      try {
        const list = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/pulls`,
          {
            params: { head: `${owner}:${branch}`, base, state: 'open' },
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        if (list.data.length) {
          prNumber = list.data[0].number;
          prUrl    = list.data[0].html_url;
        }
      } catch {}
    } else if (e.response?.status === 401) {
      s5.fail(chalk.red('Token unauthorized.'));
      console.log(chalk.gray('   Re-run: internx login --token ghp_xxx\n'));
      process.exit(1);
    } else {
      s5.fail(chalk.red('Failed to create PR'));
      console.error(chalk.red(e.response?.data?.message || e.message));
      process.exit(1);
    }
  }

  // ── 6. AI Review ──
  if (taskId && prNumber) {
    const s6 = ora('Triggering AI review...').start();
    const diff = await getPrDiff(owner, repo, prNumber, githubToken);
    if (diff) {
      const ok = await triggerReview(taskId, diff, internxToken, apiUrl);
      ok
        ? s6.succeed(chalk.green('AI review started — comments will appear on your PR shortly.'))
        : s6.warn(chalk.yellow('AI review could not connect to InternX backend.'));
    } else {
      s6.warn(chalk.yellow('Could not fetch PR diff — AI review skipped.'));
    }
  } else if (!taskId) {
    console.log(chalk.gray('\n   ℹ  No task ID in .internx.json — AI review skipped.'));
    console.log(chalk.gray('      Click "Connect VS Code" again from the InternX dashboard to fix.\n'));
  }

  // ── Summary ──
  console.log(chalk.bold('\n🎉 Done!\n'));
  if (prUrl) console.log(chalk.gray('   PR     : ') + chalk.cyan.underline(prUrl));
  console.log(chalk.gray('   Branch : ') + chalk.white(`${branch} → ${base}`));
  console.log();
}

module.exports = { run };