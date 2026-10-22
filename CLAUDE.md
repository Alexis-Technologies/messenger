# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**messenger** (npm package `@alexify/messenger`) is a messaging library for Node.js, Bun and Deno,
in the place of notifme-sdk, @visulima/notification or the SDKs of the providers, for the channels
that are not email. It is made of two parts:

1. **The channels:** SMS, WhatsApp, Telegram and Viber, each through the HTTP API of its providers
   on `fetch`, without their SDKs.
2. **A reliability layer on top of them,** which none of the eleven libraries in
   `docs/comparison.json` has whole: a persistent queue and outbox, an append-only audit of the
   states of a message, one model of delivery receipts from verified webhooks, opt-out,
   idempotency, and fallback between providers and between channels decided by the outcome of a
   message, not only by an error of its send.

Email is out of scope: it is the sibling library `@alexify/mailer` (`../mailer`), whose roadmap
leaves SMS, WhatsApp and push out. The two are meant to read alike: the same message/transport/
receipt contracts, the same reliability layer, the same tooling.

It has zero runtime dependencies and runs on Node.js ≥ 22, and on Bun and Deno through their
Node compatibility (see "Platform"; no browser entry).

**Status: the API is being designed.** `createMessenger` is exported as a placeholder that throws
(`src/messenger.js`); its signature in `index.d.ts` is provisional. The package, its tooling, tests
and docs are already wired around that name. The direction is in "Roadmap" below.

It is maintained by Alexis Technologies and set up like the sibling libraries `@alexify/mailer`,
`@alexify/metaschema` and `@alexify/protoarray` (the scaffold follows the "chore: set up the
repository as an Alexis library" commit of mailer and protoarray, with the tooling of mailer
1.2). `origin` is `Alexis-Technologies/messenger`. When the conventions or the tooling of this
repository need a reference, read the local clones `../mailer` and `../protoarray` (their files
and their git history), not GitHub.

Package manager is **pnpm** (pinned in `packageManager`).

## Commands

```bash
pnpm test                          # node --test tests/unit/*.test.js
pnpm test:runtime                  # tests/runtime: the package by its name, no mock
pnpm test:bun                      # tests/unit and tests/runtime on Bun (bun test --parallel)
pnpm test:deno                     # tests/unit and tests/runtime on Deno (deno test --parallel)
node --test tests/unit/messenger.test.js   # a single file
node --test --test-name-pattern="Bundle" tests/unit/*.test.js   # filter by name
pnpm run test:coverage             # c8 over src/, gated at 98 lines/statements, 90 branches, 100 functions
pnpm run test:types                # tsd: tests/types/*.test-d.ts, one file per entry
pnpm run check:dts                 # tsc --noEmit --strict over the d.ts of every entry
pnpm run check:pack                # the files `pnpm publish` would pack: the exports map, nothing else
pnpm run lint                      # oxlint src tests scripts bench
pnpm run format                    # oxfmt src tests scripts bench (format:check in CI)
pnpm size [--check]                # esbuild bundle sizes; --check gates every entry by scripts/size-budgets.json
pnpm bench [filter] [--json] [--save] [--compare]   # ops/sec harness, manual only; --save writes bench/baseline.json
pnpm docs:comparison               # renders docs/comparison.json into docs/guide/comparison.md
pnpm run docs:dev                  # VitePress dev server for docs/ (docs:build, docs:preview)
```

`prepublishOnly` runs lint + format:check + test:coverage + test:runtime + test:types + check:dts +
the size gate + check:pack. CI adds the comparison drift check, the docs build, and the unit and
runtime suites on Bun and Deno. Treat that as the pre-merge gate. There is no build step.

## No build step: CommonJS + hand-written types

- `src/` is plain CommonJS (`require`/`module.exports`) and ships as is. No TypeScript syntax, no
  `import`/`export`, no `'use strict'`.
- The root `index.js` is a one-line shim over `src/index.js`.
- `src/index.js` lists every export **by name** (`module.exports = { createMessenger }`), never by
  spreading module objects. cjs-module-lexer only sees named keys, and ESM
  `import { createMessenger } from '@alexify/messenger'` depends on it.
- `index.d.ts` is the only source of the public types, written by hand. A public API change touches
  `src/index.js`, `index.d.ts` and a test together. `tests/unit/export-parity.test.js` compares
  runtime exports with the declared value exports and imports every name from ESM.
  `tests/types/index.test-d.ts` (tsd) pins signatures. `check:dts` (`scripts/check-dts.js`) needs
  `--target es2022` because there is no tsconfig.
- `package.json` has a closed `exports` map (`types` first, then `default`), `sideEffects: false`,
  `"type": "commonjs"` (Node's default, declared for Deno, which otherwise reads `.js` as ESM)
  and a `files` allowlist: `index.js`, `index.d.ts`, `src`, README, CHANGELOG, LICENSE and
  SECURITY.
- **Subpaths, not a monorepo** (as in mailer). A provider, a decorator or a driver will be a
  directory `src/<subpath>/` with an `index.js` that lists its exports by name, an `index.d.ts`,
  and an entry `"./<subpath>": { "types": "./src/<subpath>/index.d.ts", "default":
  "./src/<subpath>/index.js" }` in the exports map. The export-parity, bundle and runtime tests,
  `scripts/size.js`, `check:dts` and `check:pack` read the exports map, so a subpath is checked
  as soon as it is declared, and it needs a budget in `scripts/size-budgets.json`.

## Zero dependencies: drivers are passed in

There is no `dependencies` or `peerDependencies` key in `package.json`, and there won't be one.

- **The providers are called over `fetch`:** the SMS APIs, the WhatsApp Cloud API, the Telegram
  Bot API and Viber are plain HTTPS with JSON or form bodies; signatures of requests and webhooks
  (HMAC-SHA1/SHA256, Ed25519) are `node:crypto`. No provider SDK (they bring axios, `request`
  and a dozen packages each; see the comparison).
- **No phone-number library.** E.164 validation and the segments of an SMS are small enough to
  write and test here, rather than bundling libphonenumber-js.
- **Infrastructure drivers are injected.** An adapter for a queue or a store takes the client or
  module the application created, the way `./bullmq` and `./mongodb` of mailer do. The package
  never `require`s them; they are devDependencies only, for tests.
- `tests/unit/dependencies.test.js` fails if `package.json` gains a dependency key or anything
  under `src/` requires a module that is neither a `node:` builtin nor a relative `.js` file.
- If a small helper is needed, copy it into `src/` with an attribution header rather than adding a
  dependency.

## Repository layout

```
index.js  index.d.ts   root entry shim + hand-written types
src/
  index.js          public barrel (explicit named exports)
  messenger.js      createMessenger placeholder
  version.js        the package name and version (OpenTelemetry scope), kept equal to package.json
tests/
  unit/*.test.js    node:test suites, one per area
  runtime/*.test.js the package by its name on Node, Bun and Deno, with no mock
  types/*.test-d.ts tsd assertions, one file per entry
scripts/
  size.js           bundle-size report; --check gates each entry of the exports map
  size-budgets.json the min+gzip budget of each entry in KB (the root, and each subpath on top)
  check-dts.js      tsc --strict over the d.ts of every entry of the exports map
  check-pack.js     the tarball holds every file of the exports map and nothing outside `files`
  comparison.js     renders docs/comparison.json into docs/guide/comparison.md
bench/              zero-dependency ops/sec harness; baseline.json is a snapshot for --compare
docs/               VitePress site (messengerat.vercel.app), not published
  comparison.json   the feature matrix of 11 alternatives (the data of the comparison page)
.claude/skills/     metaskills v1.0.5 skills (js-conventions, npm-publish adapted)
```

As the library grows, `tests/helpers/<sub>/` (fake provider servers, webhook builders) and
`tests/fixtures/<sub>/` (recorded webhook bodies, compared byte for byte; `.gitattributes` keeps
them LF) follow mailer's layout, and `tests/e2e/` holds opt-in suites against real providers.

## Architecture

To be written with Phase 0. The contracts it starts from, shaped like mailer's so that the two
libraries read alike:

- **`Message`**: `channel` (`sms` | `whatsapp` | `telegram` | `viber`), `to` (E.164 for SMS and
  WhatsApp, a `chat_id` for Telegram, a user id for Viber), `from` (a number, an alphanumeric
  sender id, a WhatsApp phone number id, a bot), `text`, `media`, `buttons`, `template` (required
  by WhatsApp outside the 24-hour window), `tags`, `tenantId`, `idempotencyKey`, `scheduledAt`.
  Built by a function that validates it, as `createMessage` does in mailer.
- **`Transport<TProviderId>`**: `send(message, { signal }) → Receipt` and
  `sendMany(messages) → AsyncIterable<Receipt>`. A transport reports a failure in a receipt
  rather than by throwing.
- **`Receipt`**: `{ successful: true, messageId, segments? }` or
  `{ successful: false, errorMessages, errors, retryable }`. A `ReceiptError` carries a `category`:
  mailer's (auth, rate-limit, network, timeout, validation, rejected, unsupported, server-error,
  service-unavailable, configuration, unknown) plus the messaging ones — `invalid-recipient`,
  `opted-out`, `outside-window` (WhatsApp, 24 hours), `blocked` (the user blocked the bot),
  `not-on-channel` (the number is not on Viber or WhatsApp: a reason to fall back).
- **The states and events of a message:** `queued → submitted → accepted → sent → delivered |
  read | failed | expired | delivery_unknown`, with correlationId, tenantId, channel, provider,
  attempt and the provider's message id; no phone number in clear. An inbound STOP is an opt-out
  event.
- **`QueueDriver` and `AuditSink`** as in mailer (`../mailer/index.d.ts`): a driver-neutral queue
  with ack/retry/fail/release outcomes, and an append-only sink of events.

## Roadmap

From the market research of 2026-10-22 and the comparison of 11 Node.js libraries and SDKs
(`docs/comparison.json`). The market is not short of providers or SDKs; it is thin in delivery
receipts across channels, fallback on outcome and a record of what happened. P0 is required for a
first release, P1 for an advantage over the alternatives, P2 after the first release.

**Phase 0, contracts.** The message and its builder, `Transport`, `Receipt` and its error
categories, the model of states and events, `QueueDriver`, `AuditSink`. `tenantId` is in the
context from the start.

**Phase 1, reliable sending (P0).**

- **The channels of v1:** SMS (Twilio, Vonage, Infobip, Sinch, Amazon SNS; TurboSMS, AlphaSMS,
  SMSClub for Ukraine), WhatsApp (the Meta Cloud API; a BSP such as Twilio or 360dialog after),
  Telegram (the Bot API), Viber (the Bot API, and Viber with SMS fallback through the Ukrainian
  providers, which run it on their side).
- **The rules of a channel:** E.164 normalization with a default country; the encoding (GSM-7 or
  UCS-2) and the segments of an SMS (160/153, 70/67), counted before it is sent; the WhatsApp
  template, required outside the window.
- **Errors classified:** permanent (invalid number, blocked bot, opted out, outside the window)
  are not retried; temporary ones are, with jitter and `Retry-After`, under an attempt limit.
- **A mock transport** and fake provider servers for the tests; retry and timeout decorators.

**Phase 2, a closed loop (P1).** Webhooks of the providers into the one model of receipts, with
the signature mandatory and replay protection; an opt-out list per tenant across channels,
checked before a message is queued, with a policy for transactional messages (one-time codes);
fallback between providers and between channels (WhatsApp or Viber, then SMS) on refusal, on
`not-on-channel` or on no receipt within a deadline, and never after a send of unknown outcome
without an idempotency key; rate limits per channel and provider (Telegram: about 30 messages a
second, 1 a second per chat, 20 a minute per group; the tiers of WhatsApp); the persistent queue
and outbox, and idempotency mapped to a provider's own deduplication where it has one (TurboSMS
`sequence_id`, 30 days); OpenTelemetry spans and metrics.

**Phase 3, multi-tenant (P2).** Templates by name; scheduled sending as a queue delay; quiet hours
in the recipient's time zone; credentials per tenant; more channels (Slack, Discord, push, RCS),
each only when a user needs it.

**Decisions:**

- **HTTP APIs, not SDKs.** Every provider of the four channels is HTTPS with JSON or form bodies;
  an SDK would bring its HTTP client and its dependencies into a zero-dependency package.
- **Official APIs only.** WhatsApp through the Cloud API or a BSP, never through clients that
  drive WhatsApp Web (Baileys, whatsapp-web.js), which break its terms and get numbers banned.
- **Few providers per channel, done well.** Each provider adds a webhook format and an API that
  drifts; another one waits for a user who needs it.
- **Email stays in mailer.** A fallback to email is the application's, with the receipts of both
  libraries in one model.

**What the competitors appear to get wrong, to not repeat** (from reading their packages as
published on npm in October 2026, not reproduced; the cells and notes of `docs/comparison.json`
name the files): a suppressed or deduplicated send reported as a success, which stops the
fallback to the next channel, and a queue worker that sends every channel again when one failed
(@visulima/notification); a status parser that maps an unknown event to `delivered`
(@visulima/notification) or every SMS reported `sent` whatever the provider answered
(@thinwrap/notifications); a channel with no provider that logs the whole request, recipient
included, and reports success (notifme-sdk); message POSTs retried without an idempotency key
(Telnyx unless one is passed, node-telegram-bot-api after a timeout, grammY's auto-retry without
a limit); HTTP retries stacked at three levels, ignoring `Retry-After`, and one circuit breaker
and rate limiter for every channel (@visulima/notification); webhook signatures compared with
`===` (Vonage SMS, Plivo, Sinch), no window of time (Sinch, Plivo), a JWT checked without the
hash of the body (Vonage), a body re-serialized before its HMAC (Sinch), and a check turned off
by `NODE_ENV` (Novu's bridge); a queue reservation that never expires (@visulima/notification's
unstorage queue); and an import that overwrites the global agents of axios (Plivo).

**Out of scope:** email (`@alexify/mailer`); unofficial WhatsApp clients; the management APIs of
the providers (sender registration, template approval, buying numbers), which their dashboards
and SDKs cover.

## Platform

Node.js ≥ 22 is the target: `engines` is `>=22.0.0`, and CI runs 22 and 24 on Linux and Windows.
Bun 1.4.3 and Deno 2.9.6 run the unit suite and `tests/runtime` in CI too, on Linux, through their
Node compatibility; their versions are pinned in `ci.yml`, and `engines` names neither. A Deno
user imports `npm:@alexify/messenger`. Mailer found that Deno's `fetch` sends a request again when
a reused HTTP/1.1 connection closes before its answer (`../mailer/CLAUDE.md`, "Platform"); a
provider without an idempotency key would send an SMS twice the same way, so the providers will
be tested for it on Deno as mailer's are.

There is no `browser.js` and no `browser` field: sending from a browser would expose the
credentials. `src/` may use `node:*` modules freely. Edge runtimes are not a target for now; every
provider is HTTP, so if they become one, the core and the providers would move behind an entry
with no `node:*` (WebCrypto for the signatures), and a platform test would enforce it as in
protoarray.

## Conventions (oxlint/oxfmt + review)

- Formatting: 2 spaces, single quotes, semicolons, trailing commas, **100 columns**, LF
  (`.oxfmtrc.json`, `.editorconfig`). Lint: `.oxlintrc.json` (the copy of mailer's: the explicit
  rule list, plus the `correctness` and `suspicious` categories as errors and `no-console`
  everywhere but `scripts/`, `bench/`, `tests/e2e/` and `tests/helpers/`). The code style below is
  enforced where a rule exists: `func-style` (expressions), `no-nested-ternary` and `max-depth` 4
  everywhere; in `src/`, `no-restricted-properties` on the array iteration methods, the unicorn
  rules `no-array-for-each`, `no-array-reduce`, `no-useless-spread` and `prefer-set-has`, and
  `max-lines-per-function` 80 as a warning. Suppress a rule only for an intentional construct,
  with a targeted `// oxlint-disable-next-line <rule>`; `pnpm lint` fails on a directive that
  suppresses nothing.
- Code style:
  - module-level functions are arrow functions assigned to `const`; classes and prototype objects
    use method shorthand; no `function` declarations;
  - `Object.create(null)` for dictionaries;
  - **loops, one pass, keyed collections** (as in mailer): `src/` uses no array iteration method
    (`map`, `filter`, `some`, `every`, `find`, `findIndex`, `findLast`, `reduce`, `flatMap`,
    `forEach`), cold paths included, but `for` and `for…of` loops, index loops on hot paths (the
    characters of a text, the messages of a batch), with no destructuring in them; whatever a
    collection gives is computed in one pass with an early exit; membership goes through a
    module-level `Set`, keyed lookups through a `Map` built once, and caches or metadata on
    objects the library does not own through a `WeakMap` or `WeakSet`. Plain objects stay for
    fixed shapes, and `tests/`, `scripts/` and `bench/` are exempt;
  - prefer `const`; no `var`;
  - private class members with `#`.
- Built-ins with the `node:` prefix; relative requires always end in `.js`.
- Self-descriptive code; comments explain *why*, not what.
- Conventional Commits (`feat(scope):`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor!:`).
  A commit per subpath and per fix, so that a review reads one at a time.

## Skills

`.claude/skills/` holds the seven [metaskills](https://github.com/metarhia/metaskills) v1.0.5
skills: `js-conventions`, `js-data-structures`, `data-structures`, `metautil-data-structures`,
`js-gof`, `error-handling` and `npm-publish`.

- **`js-conventions` is adapted to this toolchain** (the same copy as mailer: oxlint/oxfmt
  instead of ESLint/Prettier, pnpm, 100 columns, the rule of loops, one pass and keyed
  collections, and a Modules section: CommonJS, no `'use strict'`, `node:` prefix, `.js` in
  relative requires). Its other naming, best-practice and optimization rules are upstream's.
- **`npm-publish` is adapted to the release process below:** pnpm commands, the `prepublishOnly`
  gates plus the CI ones (comparison drift, docs build), this CHANGELOG's format, docs and
  `pnpm pack` checks, and `pnpm run release`.
- **The other five are verbatim copies.**

Keep the two adapted skills in sync with this file when conventions or the release process
change. **This file wins** if they ever disagree.

## Testing notes

- Runner: Node's built-in `node:test` + `node:assert`. Suites use flat
  `test('Area: description', …)`; keep that style.
- `pnpm test` passes the glob unquoted (`tests/unit/*.test.js`): the shell expands it on Linux and
  macOS, and Node ≥ 22 expands it itself where cmd.exe does not, so Windows runs every version.
- `tests/unit/bundle.test.js` builds every entry of the exports map with esbuild in memory
  (minified and not) and checks its exports through the result, so the shipped files keep working
  after a consumer's bundler (a serverless function, a single-file deploy).
- `tests/unit/dependencies.test.js` guards "Zero dependencies" above.
- `tests/unit/scripts.test.js` checks that every entry of the exports map has a budget in
  `scripts/size-budgets.json` and nothing else does, runs `scripts/size.js --check` with budgets
  it always meets, budgets it never can and a missing one, checks `check-pack` and `check-dts`,
  and keeps the list of gates in CONTRIBUTING equal to `prepublishOnly`.
- `tests/unit/version.test.js` keeps `src/version.js` equal to `package.json`.
- **Size budgets** (`scripts/size-budgets.json`, min+gzip KB, the root alone and each subpath on
  top of it) are raised in the commit whose change needs the room, never in one of their own, by
  the smallest half-KB step that passes, and that commit's message says what took it. A budget is
  lowered when its entry falls a whole KB under it. The root is in the bundle of every subpath, so
  it grows only for the contract they share.
- New behavior needs a test that fails without the change. Providers are tested against local
  fake servers on `node:http` or a stubbed `fetch` (`t.mock.method(globalThis, 'fetch', …)`), and
  webhooks against recorded bodies with their real signatures, never against a real provider in
  `pnpm test`. Opt-in suites against real providers (`tests/e2e/`, skipped until their variables
  are set) stay outside the gates.
- **`tests/runtime/`** runs the package as a consumer does, by its name, with no mock, on Node,
  Bun and Deno, so it uses `node:test` and `node:assert` alone, never `t.mock`.
- **Bun and Deno** (`pnpm test:bun`, `pnpm test:deno`) run each file in a fresh global
  (`--parallel`), as `node --test` runs each in a process of its own. The import by name of
  `export-parity` spawns the node CLI, which Deno is not, so it is skipped there.

## Documentation site

VitePress in `docs/`, deployed to Vercel (`vercel.json`) at `messengerat.vercel.app` (the Vercel
project is created by hand; `messenger.vercel.app` is taken). It is not published to npm, and
lint/format do not cover it.

- Only `docs/index.md` has frontmatter; links between pages are absolute and extensionless.
- `ignoreDeadLinks` is off, so `pnpm docs:build` failing on a dead link is a feature.
- The nav version label is read from `package.json`.
- **The comparison page is generated.** `docs/guide/comparison.md` holds the prose; the table
  between `<!-- comparison:start -->` and `<!-- comparison:end -->` is rendered by
  `pnpm docs:comparison` from `docs/comparison.json` (`legend`, `groups[].rows[]`,
  `libraries[].cells[rowId] = { mark, text, note? }`). Edit the data, never the table; CI fails on
  a diff. The first library of the data is @alexify/messenger itself (🔜 for the roadmap), which
  `custom.css` tints in the brand indigo as the second column and pins beside the features from
  768px up; keep its cells true to the code when behavior changes. The page takes the full width
  through `.VPDoc:has(.ml-matrix)` in `custom.css`. The cells were decided by reading the
  packages as published on npm (`npm pack`), not their READMEs and not their repositories; the
  page says so, and a bug claim should be reproduced before it is made stronger.
- The brand is an indigo "speech bubble" mark (`#4338CA`, `#A5B4FC` on dark; a placeholder until
  a final logo), set apart from mailer's teal: `docs/public/logo-mark*.svg`, `favicon.svg`
  (follows `prefers-color-scheme`), `favicon.png` and `logo.png` (the 1200×630 og:image, rendered
  from SVG with `rsvg-convert`).
- When behavior changes, update README and the matching docs page together. Keep example outputs in
  the docs true to the code.

## Release process

Manual, as in the sibling repositories: no workflow publishes, and GitHub CI is not changed for
it. The `npm-publish` skill walks through it step by step:

1. Bump `version` in `package.json` and in `src/version.js` (`tests/unit/version.test.js` fails
   while they differ).
2. Turn `## [Unreleased]` in CHANGELOG.md into `## [X.Y.Z] - YYYY-MM-DD` and add its link
   reference.
3. Run the gates no CI runs: `pnpm test:bun` and `pnpm test:deno` where they are installed, and
   the `tests/e2e` suites of the providers that changed.
4. Commit, merge into `main` (a squash merge), then tag `vX.Y.Z` on the commit of `main`, never on
   the feature branch.
5. Run `pnpm run release` (`pnpm publish`, gated by `prepublishOnly`, which includes the size
   gate and the tarball check; `publishConfig.access` is public).
