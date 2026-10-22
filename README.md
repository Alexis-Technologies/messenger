# messenger

[![npm](https://img.shields.io/npm/v/%40alexify%2Fmessenger)](https://www.npmjs.com/package/@alexify/messenger)
[![CI](https://github.com/Alexis-Technologies/messenger/actions/workflows/ci.yml/badge.svg)](https://github.com/Alexis-Technologies/messenger/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/%40alexify%2Fmessenger)](#installation)
[![dependencies](https://img.shields.io/badge/runtime_dependencies-0-brightgreen)](#why-alexifymessenger)
[![docs](https://img.shields.io/badge/docs-online-blue)](https://messengerat.vercel.app/)
[![license](https://img.shields.io/npm/l/%40alexify%2Fmessenger)](./LICENSE)

**Chat apps, SMS and push for Node.js, with a reliability layer.** One message model over the HTTP
APIs of SMS and RCS, WhatsApp, Messenger and Instagram, Telegram and Viber, Slack, Discord,
Microsoft Teams and Google Chat, and push, and on top of it what the other libraries leave to the
application: a persistent queue and outbox, an audit of every state of a message, one model of
delivery receipts, idempotency and fallback between channels. Zero runtime dependencies.

> 🚧 **Work in progress.** The API is being designed. `createMessenger` is exported today as a
> placeholder that throws.

### 📖 [Read the documentation →](https://messengerat.vercel.app/)

## Why @alexify/messenger

- **Twelve channels, one message.** SMS (Twilio, Vonage, Infobip, Sinch, Amazon SNS, and the
  Ukrainian TurboSMS, AlphaSMS and SMSClub) and RCS; WhatsApp, Messenger and Instagram on Meta's
  platform; the Telegram Bot API and Viber; Slack, Discord, Microsoft Teams and Google Chat; and
  push through FCM, APNs and Web Push. Each is called over `fetch` (APNs over `node:http2`),
  without its SDK.
- **What happens after `send()`.** A persistent queue and outbox, an append-only audit of the
  states of a message, and one model of delivery receipts (sent, delivered, read, failed,
  expired) from webhooks that are verified before they are read, for the channels that report
  them.
- **Fallback that knows what happened.** WhatsApp, then SMS if no receipt says it was delivered in
  time; never a second one-time code after a send of unknown outcome. Idempotency keys, errors
  classified as permanent or temporary, one opt-out list across channels.
- **The rules of each channel in the library.** E.164 numbers, the GSM-7 or UCS-2 segments of an
  SMS, the 24-hour window and templates of WhatsApp, Messenger and Instagram, the rate limits of
  Telegram, Slack and Discord, and mentions such as `@everyone` that never ping by accident.
- **Zero dependencies.** Built on `node:*` modules and `fetch`, for Node.js 22+, Bun and Deno. The
  driver of a queue or a database is created by your application and passed in. CommonJS with ESM
  named imports and hand-written TypeScript typings, no build step.

Email is out of scope: it is the sibling library
[@alexify/mailer](https://github.com/Alexis-Technologies/mailer).

## Installation

```bash
pnpm add @alexify/messenger
# or
npm install @alexify/messenger
```

Requires Node.js 22 or newer; Bun and Deno (`npm:@alexify/messenger`) are tested in CI.

## Exports

```js
const { createMessenger } = require('@alexify/messenger');
```

```js
import { createMessenger } from '@alexify/messenger';
```

The [API reference](https://messengerat.vercel.app/api/exports) lists every member.

## Compared with alternatives

The [comparison](https://messengerat.vercel.app/guide/comparison) puts @visulima/notification,
@thinwrap/notifications, Novu, notifme-sdk, the SDKs of Twilio, Telnyx, Vonage, Plivo and Sinch,
grammY and node-telegram-bot-api side by side, feature by feature, from their published code.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE) © Alexis Technologies
