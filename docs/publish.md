# Publishing DebugPilot to VS Code Marketplace

## Prerequisites

- Node.js + pnpm installed
- Azure DevOps account (free) — [create one](https://learn.microsoft.com/azure/devops/organizations/accounts/create-organization)
- Publisher `inkan-link` on the [Marketplace](https://marketplace.visualstudio.com/manage/publishers/inkan-link)

## Step 1: Get a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://go.microsoft.com/fwlink/?LinkId=307137)
2. Select your organization
3. User settings (top-right) → **Personal access tokens**
4. Click **New Token**
5. Configure:
   - **Name**: `vsce-debugpilot` (or any name)
   - **Organization**: **All accessible organizations**
   - **Expiration**: your choice
   - **Scopes**: Custom defined → Show all scopes → **Marketplace** → check **Manage**
6. Click **Create** and **copy the token immediately**

## Step 2: Login with vsce

```bash
npx vsce login inkan-link
# Paste your PAT when prompted
```

## Step 3: Build and Verify

```bash
pnpm install
node esbuild.config.mjs          # Build
npx tsc --noEmit                  # Type check
npx vitest run                    # Tests (77 should pass)
npx vsce package --no-dependencies  # Package .vsix
```

Inspect the .vsix output — it should contain:
- `dist/extension.js`
- `assets/icon.png`
- `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`

## Step 4: Publish

### Option A: Direct publish

```bash
npx vsce publish --no-dependencies
```

### Option B: Version bump + publish

```bash
npx vsce publish patch --no-dependencies   # 0.5.0 → 0.5.1
npx vsce publish minor --no-dependencies   # 0.5.0 → 0.6.0
npx vsce publish major --no-dependencies   # 0.5.0 → 1.0.0
```

### Option C: Upload .vsix manually

1. Build: `npx vsce package --no-dependencies`
2. Go to https://marketplace.visualstudio.com/manage/publishers/inkan-link
3. Click your extension → **Update** → upload the `.vsix` file

## Step 5: Verify

1. Check https://marketplace.visualstudio.com/manage/publishers/inkan-link — extension should appear
2. Search "DebugPilot" in VS Code Extensions view
3. Install and confirm the MCP server starts on `http://127.0.0.1:45853/mcp`

## Pre-release Versions

```bash
npx vsce publish --pre-release --no-dependencies
```

Convention: odd minor = pre-release (`0.5.x`), even minor = release (`0.6.x`).

## Unpublish

```bash
npx vsce unpublish inkan-link.debugpilot        # Soft (keeps stats)
npx vsce unpublish inkan-link.debugpilot --force # Hard (deletes everything)
```

Or use the [Publisher Management](https://marketplace.visualstudio.com/manage/publishers/inkan-link) page.

## Troubleshooting

| Error | Fix |
|-------|-----|
| 401/403 on publish | PAT must have "All accessible organizations" + Marketplace Manage scope |
| "Already exists" | Extension ID `debugpilot` is taken — change `name` in package.json |
| Icon missing in listing | Check `.vscodeignore` includes `!assets/**` |
| >30 tags error | Reduce `keywords` array in package.json to ≤30 |
