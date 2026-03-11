---
name: publish-vsce
description: Build, package, and publish a VS Code extension to the Marketplace using vsce
user_invocable: true
---

# Publish VS Code Extension

Builds, validates, packages, and publishes a VS Code extension to the Marketplace.

## Steps

1. **Read project state**
   - Read `package.json` for name, version, publisher, icon, engines
   - Check `README.md`, `CHANGELOG.md`, `LICENSE` exist
   - Check `.vscodeignore` includes required files

2. **Pre-publish validation**
   ```bash
   # Build
   node esbuild.config.mjs 2>&1 || pnpm run build 2>&1

   # Type check
   npx tsc --noEmit 2>&1

   # Tests
   npx vitest run 2>&1
   ```
   Stop and report if any step fails.

3. **Package**
   ```bash
   npx vsce package --no-dependencies 2>&1
   ```
   Verify the .vsix output contains: dist/, assets/icon.png, package.json, README, CHANGELOG, LICENSE.

4. **Confirm with user before publishing**
   Show:
   - Extension: `{publisher}.{name}`
   - Version: `{version}`
   - .vsix size
   - Ask: "Ready to publish? (publish / publish --pre-release / abort)"

5. **Publish**
   ```bash
   # If not logged in yet:
   npx vsce login {publisher}
   # Then:
   npx vsce publish --no-dependencies
   ```

6. **Verify**
   - Show marketplace URL: `https://marketplace.visualstudio.com/items?itemName={publisher}.{name}`
   - Remind user to check the listing

## Pre-publish checklist

- [ ] `package.json` has: name, version, publisher, icon, engines.vscode, repository
- [ ] `README.md` exists and has no broken image links
- [ ] `CHANGELOG.md` exists with current version entry
- [ ] `LICENSE` exists
- [ ] `.vscodeignore` includes `!dist/**`, `!assets/**`, `!README.md`, `!CHANGELOG.md`, `!LICENSE`
- [ ] Icon is PNG, at least 128x128
- [ ] Keywords ≤ 30
- [ ] Build passes
- [ ] Type check passes
- [ ] Tests pass

## Version bump options

```bash
npx vsce publish patch   # 0.5.0 → 0.5.1
npx vsce publish minor   # 0.5.0 → 0.6.0
npx vsce publish major   # 0.5.0 → 1.0.0
```

## Authentication

### Option A: Azure CLI token (recommended — no PAT needed)

```bash
TOKEN=$(az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798" --query accessToken -o tsv)
npx vsce publish --no-dependencies --pat "$TOKEN"
```

Requires `az login` with the same Microsoft account as the publisher.

### Option B: PAT setup (manual)

1. Go to https://go.microsoft.com/fwlink/?LinkId=307137
2. User settings → Personal access tokens → New Token
3. Organization: **All accessible organizations**
4. Scopes: Show all → Marketplace → **Manage**
5. Copy token → `npx vsce login {publisher}`

## Troubleshooting

| Error | Fix |
|-------|-----|
| 401/403 | PAT needs "All accessible organizations" + Marketplace Manage |
| "Already exists" | Extension name taken — change `name` in package.json |
| Icon missing | `.vscodeignore` must have `!assets/**` |
