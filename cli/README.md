# internx-cli

InternX CLI — Setup projects instantly, submit PRs for AI review.

## Install (once)

```bash
npm install -g internx-cli
```

This automatically registers `internx://` as a URL protocol on your OS.

---

## Usage

### 1. Save your GitHub token
```bash
internx login --token ghp_your_github_token_here
```

### 2. Setup a project (usually triggered by clicking the button in the web app)
```bash
internx setup --repo internx-org/your-project --branch yourname-dev
```

This will:
- Create `~/internx-projects/your-project/`
- Clone the repo
- Create and checkout your branch
- Open VS Code automatically

### 3. Work normally in VS Code
Edit files, use the built-in Git panel, run the terminal — everything works as normal.

### 4. Submit for AI Review
When your work is done, run this in the VS Code terminal:
```bash
internx pr --message "Implemented login page"
```

This will:
- Stage all your changes
- Commit with your message
- Push the branch to GitHub
- Create a Pull Request automatically
- Trigger the InternX AI review (Claude will post comments on your PR)

### Check current project status
```bash
internx status
```

---

## How the browser button works

When you click "Setup for VS Code" in the InternX dashboard:

1. The web app calls the backend to generate a secure setup link
2. The link looks like: `internx://setup?repo=org/project&branch=yourname-dev&token=xxx`
3. Your browser hands this to the OS
4. The OS recognizes `internx://` and launches this CLI
5. The CLI clones, branches, and opens VS Code — automatically

---

## Commands

| Command | Description |
|---|---|
| `internx login --token <token>` | Save GitHub token |
| `internx setup --repo <repo> --branch <branch>` | Clone + open VS Code |
| `internx pr --message <message>` | Commit + push + create PR |
| `internx status` | Show current branch and repo |
| `internx url <internx://...>` | Handle protocol URL (called by OS) |