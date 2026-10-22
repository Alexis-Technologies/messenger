# Why @alexify/messenger?

::: warning Work in progress
@alexify/messenger is being designed. The direction below is settled; the API is not.
`createMessenger` is exported today as a placeholder that throws.
:::

## Two parts

@alexify/messenger is the sibling of [@alexify/mailer](https://mailerat.vercel.app/) for the
channels that are not email, made of two parts:

1. **The channels.** Twelve of them, each through the HTTP API of its providers, without their
   SDKs:
   - **SMS and RCS:** the international providers (Twilio, Vonage, Infobip, Sinch, Amazon SNS)
     and the Ukrainian ones (TurboSMS, AlphaSMS, SMSClub);
   - **Meta's platform:** WhatsApp (the Cloud API), Messenger and Instagram;
   - **Telegram and Viber,** through their bot APIs;
   - **work chats:** Slack, Discord, Microsoft Teams and Google Chat;
   - **push:** FCM, APNs and Web Push.
2. **A reliability layer on top of them.** A persistent queue and outbox, an append-only audit of
   the states of a message, one model of delivery receipts from verified webhooks, opt-out,
   idempotency and fallback between providers and between channels.

## The gap it fills

The [comparison](/guide/comparison) puts eleven Node.js solutions side by side: unified libraries
over many channels (@visulima/notification, @thinwrap/notifications, notifme-sdk), a
notification platform (Novu), the official SDKs of five providers (Twilio, Telnyx, Vonage, Plivo,
Sinch) and two Telegram libraries. Every one of them sends a message. What is left to the
application is what happens after `send()`:

- **A delivery receipt is a different webhook for every provider**, in a different shape, signed
  in a different way or not at all. The unified libraries parse the statuses of one provider or
  none; the SDKs type their own at best.
- **Fallback between channels moves on only when a send fails.** A message that WhatsApp took
  and never delivered does not move on to SMS, unless one provider does it inside its own
  network, and a retry after a timeout that hid an acceptance is a second one-time code on the
  user's phone.
- **Nothing is recorded outside a hosted platform.** No library keeps a log of the states of a
  message, so a job that dies between "submitted" and "accepted" is lost or sent again.
- **The rules of each channel are the application's:** E.164 numbers, the segments of an SMS in
  GSM-7 or UCS-2, the 24-hour window and the templates of WhatsApp, the rate limits of Telegram,
  Slack and Discord, STOP replies.
- **Some channels come only with one provider's SDK.** Messenger, Instagram and Viber are in no
  unified library, only in the SDKs of Twilio, Vonage or Sinch; the work chats are reached
  through their incoming webhooks at best; and no library has TurboSMS, AlphaSMS, SMSClub or
  SMS-Fly.

Breadth of providers is not where the gap is. Each provider is one more webhook format and one
more API that drifts, so the library starts with few providers per channel and puts its effort
into what happens to a message after `send()`.

## Design

- **At least once, with deduplication.** Exactly-once delivery is not possible over HTTP. A
  message carries an idempotency key, the outbox deduplicates by it, the key is passed to a
  provider that deduplicates itself (TurboSMS keeps a `sequence_id` for 30 days), and a provider
  that cannot leads to a `delivery_unknown` state that is reconciled from receipts, never to a
  blind retry.
- **Every state is recorded.** `queued → submitted → accepted → sent → delivered | read | failed |
  expired | delivery_unknown`, with the channel, the provider, the attempt and the provider's
  message id. A channel that reports no delivery (a Slack post, a push) stops at `sent`, and says
  so. A phone number, a chat id or a device token is personal data: it is stored so that it can
  be erased later (a keyed hash plus an encrypted block whose key can be destroyed).
- **Fallback on the outcome, not only on an error.** A message moves to the next channel when the
  provider refused it, when the recipient is not on that channel, or when no receipt says it was
  delivered within a deadline, and never after a send of unknown outcome without an idempotency
  key.
- **Errors are classified.** Permanent failures (an invalid number, a bot the user blocked, an
  opted-out recipient, a message outside the window of WhatsApp or Messenger, a push token that
  is no longer registered) are not retried; temporary ones are, with jitter and `Retry-After`.
- **The rules of a channel are in the library:** numbers checked against E.164, the encoding and
  the segments of an SMS counted before it is sent, the window and the templates of Meta's
  channels, the rate limits of Telegram, Slack and Discord, mentions (`@everyone`, `<!channel>`)
  that ping only when asked to, and one opt-out list across channels.
- **Secure by default.** A webhook is verified before it is parsed, with the signature of its
  provider and a window of time against replays; credentials and webhook URLs, which are
  credentials too, are never logged, and recipients are redacted in logs.
- **No dependencies.** The providers are called with `fetch` (APNs, which requires HTTP/2, with
  `node:http2`) and signed with `node:crypto`, the tokens of FCM and APNs and the encryption of
  Web Push included. The driver of a queue or a database is created by your application and
  passed in.

## The plan

1. **Contracts:** the message, the channel, the transport, the receipt, the model of states and
   delivery events, the queue driver and the audit sink.
2. **Reliable sending:** the providers of the twelve channels, E.164 and the segments of an SMS,
   the classification of errors, retries and a mock transport.
3. **A closed loop:** webhooks into the model of receipts, opt-out, fallback between providers and
   channels, rate limits per channel, the queue and outbox, idempotency, OpenTelemetry.
4. **Multi-tenant:** templates, scheduled sending, quiet hours, credentials per tenant, and more
   channels (LINE, WeChat, KakaoTalk, Zalo; Mattermost, Rocket.Chat, Matrix) when a user needs
   them.

Out of scope: email, which is [@alexify/mailer](https://mailerat.vercel.app/); channels without
an official API for this (Signal, whose bots run on the unofficial signal-cli, and iMessage,
reached only through Apple's certified providers) and unofficial WhatsApp clients, which drive
WhatsApp Web against its terms; and the management APIs of the providers (sender registration,
template approval, buying numbers, app manifests), which their dashboards and SDKs cover.
