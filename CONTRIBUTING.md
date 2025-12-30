# Contributing Guide

Thank you for your interest in contributing to SecureChat! 🎉

## 🚀 Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/luuuccasss/SecureChat.git`
3. Create a branch: `git checkout -b feature/my-feature`
4. Install dependencies: `npm run install:all`
5. Configure your environment (see README.md)

## 📝 Code Standards

### JavaScript/Node.js
- Use ESLint (configuration included)
- Follow camelCase naming conventions
- Comment complex code
- Handle errors properly

### React
- Use modern hooks
- Functional components only
- Props validation with PropTypes (optional)
- CSS modules or styled-components

### Database
- Use Sequelize ORM
- Create migrations for schema changes
- Document relationships

## 🔒 Security

- **Never** commit secrets (`.env`, private keys)
- **Always** validate user input
- **Always** escape HTML output
- **Always** use parameterized queries

## 🧪 Testing

Before submitting a PR:
- Verify code compiles without errors
- Test added/modified features
- Check for regressions

## 📋 Commit Format

Use clear commit messages:
```
feat: Add user banning feature
fix: Fix decryption bug
docs: Update README
refactor: Reorganize routes structure
```

## 🔍 Pull Requests

1. Ensure your code follows standards
2. Add tests if necessary
3. Update documentation if needed
4. Clearly describe your changes in the PR

## ❓ Questions

If you have questions, open an issue or contact the maintainers.

Thank you! 🙏
