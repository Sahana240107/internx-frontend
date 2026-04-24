const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const CONFIG_DIR  = path.join(os.homedir(), '.internx');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function saveToken(token) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const config = { github_token: token, saved_at: new Date().toISOString() };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  console.log(chalk.green('\n✅ GitHub token saved!'));
  console.log(chalk.gray(`   Stored at: ${CONFIG_FILE}`));
  console.log(chalk.gray('\n   You can now run:'));
  console.log(chalk.cyan('   internx pr --message "Your message"\n'));
}

function getToken() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return config.github_token || null;
  } catch {
    return null;
  }
}

function clearToken() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
    console.log(chalk.green('✅ Logged out. Token cleared.\n'));
  } else {
    console.log(chalk.yellow('No token found.\n'));
  }
}

module.exports = { saveToken, getToken, clearToken };