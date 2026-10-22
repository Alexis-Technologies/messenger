# Security Policy

## Supported versions

Only the latest published version receives fixes.

| Version | Supported |
|---|---|
| 0.x | ✅ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through
[GitHub's private vulnerability reporting](https://github.com/Alexis-Technologies/messenger/security/advisories/new),
or by email to <dolid.sasha@gmail.com>.

Include, as far as you can:

- what an attacker can do, and what they need in order to do it;
- the affected version and the runtime (Node.js, Bun or Deno) and its version;
- the channel and provider involved (SMS, WhatsApp, Slack, push…; Twilio, TurboSMS, the
  WhatsApp Cloud API, FCM…);
- a minimal reproduction.

You can expect an acknowledgement within a few days, and an assessment of severity and a fix
timeline once the report is confirmed.

## Threat model

The messenger is still being designed, and this section will be completed with it. The principles
it is designed around:

- **Message content is untrusted data.** Phone numbers, chat ids, texts, button labels, file
  names and template parameters can come from users. A number is accepted only in E.164 form, and
  every field is sent to a provider in the encoding its API defines (JSON, form data), never
  spliced into a URL or a query by hand, so that no input can change the recipient, the sender or
  the request.
- **Text does not become markup or a ping.** User text is escaped for the markup of its channel
  (Slack's `&`, `<` and `>`, Telegram's HTML or MarkdownV2, Discord's Markdown), so it cannot add
  a link, a button or a mention; mentions of everyone (`@everyone`, `@here`, `<!channel>`, a role)
  are off unless the application allows them, as Discord's `allowed_mentions` does.
- **Webhooks are verified before they are read.** A delivery receipt or an inbound message is
  accepted only with a valid signature of its provider (an HMAC, an Ed25519 signature, a secret
  token, whichever the provider has) and within a replay window, and the signature is compared in
  constant time. A provider that signs nothing is accepted only behind a secret the application
  sets in the webhook URL or a header.
- **Credentials stay on the server and out of logs.** Account SIDs and auth tokens, API keys, bot
  tokens (Telegram, Slack, Discord), the access tokens of Meta's platform, FCM service-account
  keys, APNs signing keys and VAPID private keys are never logged or put in error messages. The
  incoming-webhook URLs of Slack, Discord, Teams and Google Chat are credentials too, as anyone who
  has one can post, and so is the URL of a request that carries a token in its path (the Telegram
  Bot API): all are redacted. There is no browser entry, as sending from a browser would hand them
  to every visitor.
- **A recipient is personal data.** Phone numbers, chat and user ids and push tokens are redacted
  in logs and telemetry. The audit log stores a recipient as a keyed hash and an encrypted block
  whose key can be destroyed, so a request to erase someone's data does not require editing an
  append-only log.
- **Opt-out is honoured before a message is queued.** A recipient who replied STOP is not sent
  marketing messages again through any channel; transactional messages (a one-time code) follow a
  policy the application sets.
- **A message is not sent twice by accident.** A send of unknown outcome is not retried blindly
  and does not fall back to another channel without an idempotency key, so a timeout cannot put a
  second one-time code on a phone.
- **Drivers are the application's.** A queue or database driver passed in is trusted the same as
  any other module the application `require`s; its connection security is the application's to
  configure.
