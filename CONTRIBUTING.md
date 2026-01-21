# Contributing to Link-Snap

First of all, thank you for considering contributing to Link-Snap! It's people like you that make the open source community such an amazing place to learn, inspire, and create.

## 🛠 Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/tanaymondal56/Link-Snap.git
    cd Link-Snap
    ```
3.  **Install dependencies**:
    ```bash
    npm run install:all
    ```
## 🛠 Professional Workflow (Required)

Since `master` is a **Protected Branch**, you cannot push code directly to it. Follow this cycle for every change:

### 1. Start a New Feature
Always create a branch for your work.
```bash
# 1. Update master to ensure you have the latest code
git checkout master
git pull origin master

# 2. Create your feature branch
git checkout -b feature/my-new-feature
```

### 2. Work & Commit
Make your changes, then verify them locally:
```bash
# Run linting to catch errors early
npm run lint

# Commit your changes
git add .
git commit -m "feat: add amazing new dashboard"
```

### 3. Push & Pull Request
Push your branch to GitHub (not master).
```bash
git push origin feature/my-new-feature
```
1.  Go to the repository on GitHub.
2.  Click **"Compare & pull request"**.
3.  **Wait for Checks**: GitHub will run **Lint** and **CodeQL**.
4.  **Merge**: Once checks pass (Green), click **Squash and merge**.

### 4. Sync & Cleanup
After merging on GitHub, update your local machine:
```bash
# 1. Switch back to master
git checkout master

# 2. Download the new merge
git pull origin master

# 3. Delete the old feature branch
git branch -d feature/my-new-feature
```

## 🐛 Reporting Bugs

If you find a bug, please create an issue that includes:
*   A descriptive title.
*   Steps to reproduce the issue.
*   Expected vs. actual behavior.
*   Screenshots or logs if applicable.

## 🔒 Security Vulnerabilities

If you discover a security vulnerability, please **DO NOT** open a public issue.
Refer to our [Security Policy](SECURITY.md) for instructions on responsible disclosure.

## 💡 Feature Requests

We welcome new ideas! Please open an issue to discuss your proposal before starting significant work. This ensures your effort aligns with the project roadmap.

## 📜 Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. Be kind and respectful to everyone.
