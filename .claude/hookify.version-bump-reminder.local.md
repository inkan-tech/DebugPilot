---
name: version-bump-reminder
enabled: true
event: bash
pattern: git\s+commit
action: warn
---

**Version & Changelog Check**

Before committing, verify:
1. Check if any `src/` files are staged: `git diff --cached --name-only | grep '^src/'`
2. If src/ files are staged:
   - Has `version` in `package.json` been bumped?
   - Has `CHANGELOG.md` been updated with the new changes?
   - Has `version` in `src/server.ts` been updated to match?

If not, stage those updates before committing. Use `npx vsce publish patch` conventions:
- Bug fix → patch (0.5.0 → 0.5.1)
- New feature → minor (0.5.0 → 0.6.0)
- Breaking change → major (0.5.0 → 1.0.0)

After pushing, create a git tag and GitHub release:
```bash
VERSION=$(node -p "require('./package.json').version")
git tag -a "v$VERSION" -m "v$VERSION"
git push origin "v$VERSION"
gh release create "v$VERSION" --title "v$VERSION" --notes-file CHANGELOG.md
```
