/** Enforces docs/ARCHITECTURE.md. Run: npm run deps:check. Every rule is proven by npm run deps:selftest. */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'not-to-unresolvable', comment: 'an unresolved import would silently skip every path rule', severity: 'error',
      from: { path: '^src/' }, to: { couldNotResolve: true } },

    { name: 'no-node-builtins', comment: 'fs/path/child_process etc. only in adapters, app and cli: use a port', severity: 'error',
      from: { path: '^src/(core|services|contracts|ui)/' }, to: { dependencyTypes: ['core'] } },
    { name: 'npm-only-zod', comment: 'allowlist: core, services and contracts may import only zod from npm', severity: 'error',
      from: { path: '^src/(core|services|contracts)/' },
      to: { path: '^node_modules/', pathNot: '^node_modules/zod/' } },

    { name: 'core-is-pure', comment: 'core imports only itself (and zod)', severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^src/(services|adapters|app|ui|cli|contracts)' } },

    { name: 'services-use-core-only', severity: 'error',
      from: { path: '^src/services' }, to: { path: '^src/(adapters|app|ui|cli|contracts)' } },

    { name: 'adapters-implement-ports-only', severity: 'error',
      from: { path: '^src/adapters' }, to: { path: '^src/(services|app|ui|cli|contracts)' } },
    { name: 'adapters-are-independent', severity: 'error',
      from: { path: '^src/adapters/([^/]+)/' },
      to: { path: '^src/adapters/', pathNot: '^src/adapters/$1/' } },

    { name: 'contracts-are-leaf', severity: 'error',
      from: { path: '^src/contracts' },
      to: { path: '^src/(core/(?!domain)|services|adapters|app|ui|cli)' } },

    { name: 'ui-is-a-skin', comment: 'ui talks to the outside only through contracts + one hook per feature', severity: 'error',
      from: { path: '^src/ui' }, to: { path: '^src/(services|adapters|app|cli)' } },
    { name: 'ui-reads-domain-types-only', severity: 'error',
      from: { path: '^src/ui' }, to: { path: '^src/core/(?!domain)' } },
    { name: 'only-claude-adapter-uses-anthropic-sdk', comment: 'ADR 0002: every Claude call goes through adapters/claude', severity: 'error',
      from: { path: '^src/', pathNot: '^src/adapters/claude/' }, to: { path: '^node_modules/@anthropic-ai/' } },
    { name: 'test-fakes-only-in-tests', comment: 'services/testing holds fake ports; only *.test.ts files (excluded from this cruise) may use them', severity: 'error',
      from: { path: '^src/', pathNot: '^src/services/testing/' }, to: { path: '^src/services/testing/' } },
    { name: 'ui-no-electron', comment: 'the renderer reaches the main process only through the preload bridge', severity: 'error',
      from: { path: '^src/ui/' }, to: { path: '^node_modules/electron/' } },
    { name: 'app-cli-no-ui', comment: 'nothing points into ui', severity: 'error',
      from: { path: '^src/(app|cli)/' }, to: { path: '^src/ui/' } },
    { name: 'design-system-knows-no-features', severity: 'error',
      from: { path: '^src/ui/design-system' }, to: { path: '^src/ui/features' } },
    { name: 'tokens-are-a-leaf', severity: 'error',
      from: { path: '^src/ui/design-system/tokens' },
      to: { path: '^src/ui/design-system/(primitives|patterns)' } },
    { name: 'primitives-do-not-use-patterns', severity: 'error',
      from: { path: '^src/ui/design-system/primitives' },
      to: { path: '^src/ui/design-system/patterns' } },
    { name: 'features-are-isolated', comment: 'shared UI moves down to patterns', severity: 'error',
      from: { path: '^src/ui/features/([^/]+)/' },
      to: { path: '^src/ui/features/', pathNot: '^src/ui/features/$1/' } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.tsx?$', '\\.spec\\.tsx?$', '\\.stories\\.tsx?$'] },
    tsPreCompilationDeps: true,
    moduleSystems: ['es6', 'cjs'],
  },
};
