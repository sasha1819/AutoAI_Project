/** Enforces docs/ARCHITECTURE.md. Run: npm run deps:check  (depcruise src --config .dependency-cruiser.cjs) */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },

    { name: 'core-is-pure', comment: 'core imports only itself (and zod)', severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^src/(services|adapters|app|ui|cli|contracts)' } },
    { name: 'core-no-node-builtins', comment: 'no fs/path/child_process etc. in core: use a port', severity: 'error',
      from: { path: '^src/core' }, to: { dependencyTypes: ['core'] } },
    { name: 'core-no-io-libraries', severity: 'error',
      from: { path: '^src/core' },
      to: { path: 'node_modules/(electron|playwright|@playwright|@anthropic-ai|better-sqlite3|react)(/|$)' } },

    { name: 'services-use-core-only', severity: 'error',
      from: { path: '^src/services' }, to: { path: '^src/(adapters|app|ui|cli)' } },

    { name: 'adapters-implement-ports-only', severity: 'error',
      from: { path: '^src/adapters' }, to: { path: '^src/(services|app|ui|cli)' } },
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
