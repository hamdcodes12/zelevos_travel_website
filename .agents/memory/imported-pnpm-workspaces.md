---
name: Imported pnpm workspaces
description: Dependency restoration behavior for imported Replit pnpm monorepos
---

For an imported pnpm workspace with a committed lockfile, restore dependencies from the lockfile before running artifact scripts. The package-management helper may try to add a package to the workspace root instead of restoring the existing tree.

**Why:** An imported workspace can have all package manifests and lockfiles present while `node_modules` is absent; running typecheck or Vite immediately then fails with missing binaries.

**How to apply:** Prefer the repository's frozen pnpm install for dependency restoration, then run the package's existing typecheck/build scripts without changing dependency declarations.