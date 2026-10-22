# Changelog

All notable changes to **`@alexify/messenger`** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Package scaffold** set up like the other Alexis libraries: plain CommonJS with no build step,
  a hand-written `index.d.ts`, a closed `exports` map, Node.js 22 or newer, Bun and Deno, and zero
  runtime dependencies.
- **`createMessenger` placeholder.** It throws until the messenger is implemented; its signature
  is provisional.
- **Tooling:** pnpm, oxlint and oxfmt, `node:test` suites with c8 coverage gates, tsd type tests,
  an export-parity check between the runtime and `index.d.ts`, a check that `src/` requires only
  Node builtins, bundle tests through esbuild, a bundle-size budget per entry (`pnpm size
  --check`), a check of the packed files (`pnpm run check:pack`), runtime tests of the package by
  its name on Node, Bun and Deno, and a zero-dependency benchmark harness (`pnpm bench`).
- **CI** on GitHub Actions and a VitePress documentation site at
  [messengerat.vercel.app](https://messengerat.vercel.app/), with a comparison of 11 Node.js
  messaging libraries and SDKs generated from `docs/comparison.json`.

[unreleased]: https://github.com/Alexis-Technologies/messenger/commits/main
