/**
 * Build preset for this plugin's two halves, self-contained (no vendored DSH
 * source tree, no sync step).
 *
 * The node half is an ordinary ESM library; `tsc` already emitted `lib/types`,
 * so this pass only bundles `lib/types/index.js` into `lib/index.js`.
 *
 * The browser half is the DSH client-plugin artifact: a CommonJS closure the
 * shell hands to `window.__ModuleLoader__.load({ id, factory })`, resolving
 * platform modules through the injected `require` (the loader's module table)
 * and inlining everything else. This plugin imports no stylesheets and no
 * dynamic chunks, so no CSS pipeline or chunking is configured.
 */
import { defineConfig } from 'tsdown'

const ID = '@local/dsh-session-settings'

/**
 * The DSH platform seed: module-table rows the shell shares with every client
 * bundle, so they must stay `require` calls. This is the verbatim seed of the
 * running 0.2.0 shell's `getStaticModules()` — read it from the shipped
 * `@deepseek-ai/dsh-web-frontend/dist/assets/index-*.js` build, which is the
 * only authoritative source. Do NOT derive it from the `@deepseek-ai/dsh-client-web`
 * package: the installed copy of that name is a stale leftover whose module list
 * differs from the live seed. Kept verbatim rather than trimmed to this plugin's
 * current imports, so the purity gate never rejects a legitimate platform row.
 * Rationale: .agents/notes/implemented/architecture/2026-09-29-dsh-0-2-0-compatibility.md
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** Bare specifiers this plugin inlines are limited to itself and its own files. */
const isClientExternal = (specifier) =>
  CLIENT_EXTERNALS.includes(specifier) ||
  CLIENT_EXTERNALS.some((name) => specifier.startsWith(`${name}/`))

/**
 * Fail the build on a cross-plugin value import that the module table cannot
 * answer. Type-only imports are erased and never reach this hook.
 */
const clientPurityGate = {
  name: 'dsh-client-bundle-purity',
  resolveId(source) {
    if (!source.startsWith('@deepseek-ai/')) return null
    if (isClientExternal(source)) return null
    throw new Error(
      `client bundle purity: "${source}" is not a DSH platform module. ` +
        'Cross-plugin value imports are forbidden — collaborate through cordis services, ' +
        'or add the specifier to CLIENT_EXTERNALS once the platform seeds it.',
    )
  },
}

export default defineConfig([
  {
    name: ID,
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: { neverBundle: isClientExternal },
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV ?? 'production',
      ),
      'import.meta.env.MODE': JSON.stringify(
        process.env.NODE_ENV ?? 'production',
      ),
      'import.meta.env': JSON.stringify({
        MODE: process.env.NODE_ENV ?? 'production',
      }),
    },
    plugins: [clientPurityGate],
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapExcludeSources: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
