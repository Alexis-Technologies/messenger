# Імплементаційний план @alexify/messenger v1

Складено 2026-11-01 з аналізу цього репозиторію, `CLAUDE.md` (розділ «Roadmap»), коду
`@alexify/mailer` 1.2 і коду 11 конкурентів з `docs/comparison.json` та 12 довідкових
бібліотек. Конкуренти склоновані в `~/Documents/open-source/messenger-alternatives/` на тих
самих версіях, що й у порівнянні; індекс з версіями й ліцензіями — `README.md` тієї теки.

**Рішення, ухвалені перед планом:**

- три релізи, як у mailer: **1.0** — канали й декоратори, **1.1** — замкнений цикл (вебхуки,
  receipts, opt-out, фолбек), **1.2** — черга, outbox, аудит, `createMessenger`;
- код з mailer **копіюється** в messenger із заголовком походження; спільного пакета немає
  (нуль залежностей лишається);
- Amazon SMS — через **AWS End User Messaging SMS** (`SendTextMessage`, pinpoint-sms-voice-v2),
  а не SNS Publish;
- **e2e-акаунтів немає**, тож усе перевіряється на фейкових серверах, задокументованих тілах і
  тест-векторах (див. розділ 9);
- нова категорія помилки **`unreachable`** (див. 4.1);
- WhatsApp, Messenger і Instagram — в одному subpath **`./meta`** (див. 4.2).

---

## 1. Коротко

1. **Механічний форк — з mailer, а не з конкурентів.** Із 41 тис. рядків `src/` mailer
   ~6 000 копіюються як є (клас A: `internal/`, breaker, ratelimit, idempotency, bullmq,
   mongodb, частина queue і audit, SNS-верифікатор), ще ~8 900 — з адаптацією (клас B:
   receipt, api-client, mock, retry, pool, tee, hooks, logger, otel, решта queue і webhooks).
   Це найбільша економія часу: надійний шар, HTTP-клієнт з правилом «ніколи не надсилати
   повторно запит невідомого результату», декоратори й тестова інфраструктура вже написані й
   пройшли ревʼю mailer 1.1/1.2.
2. **Жоден конкурент не годиться як «upyo»** (база для порту файл у файл). @visulima/notification
   найближчий за платформою, але його контракти несумісні з нашими (`Result` без категорії й
   `retryable`, payload на тип каналу, немає `AbortSignal`, часткові збої зникають), а
   механічний порт приніс би в ядро п'ять із шести багів, які `CLAUDE.md` уже йому приписує.
   Тому з конкурентів — **feature-порт** як у mailer 1.1: мапінг полів, таблиці помилок,
   алгоритми підписів і тест-вектори на наші контракти, баги виправляються в самому порті.
3. **Майже дослівно** (з заголовком «Ported from …») переносяться лише чисті функції й таблиці:
   Teams-детектор помилки в 2xx і конверт Adaptive Card, APNs JWT і `finalizePushType`, FCM
   JWT, хости Twilio, таблиці кодів Vonage/WhatsApp/APNs/Infobip (thinwrap); алгоритм підпису
   Twilio з ~20 векторами (twilio-node); aes128gcm (http_ece); таблиця GSM-7 і дані тестів
   сегментів (Twilio message-segment-calculator); алгоритм бакетів (discord.js).
4. **Покриття джерелами — ~45 % провайдерів v1.** Без джерела пишемо з документації: RBM,
   Viber, Messenger, Instagram, Slack Web API, Discord-бот, Teams Bot Framework, Google Chat
   API, TurboSMS, AlphaSMS, SMSClub, Web Push (код web-push під MPL-2.0 — не копіюємо).
5. **Обсяг:** ~16 тис. рядків нового `src/` за три релізи (з них ~6 тис. — 20 провайдерів 1.0),
   плюс ~15 тис. скопійованих з mailer; тести ≈1,5–2× від коду. Mailer пройшов той самий шлях
   за 3 PR (82 тис., 37 тис. і 23 тис. вставок).

---

## 2. Звідки що береться

### 2.1 З @alexify/mailer 1.2 — механічна копія

Заголовок скопійованого файла:

```js
// Copied from @alexify/mailer v1.2.0 (src/internal/http.js)
```

Якщо файл mailer сам є портом (upyo, unemail, sently), його заголовок upstream лишається першим,
а рядок `Copied from` іде після нього. Тому `LICENSE` messenger отримує нотиси **Upyo, unemail і
sently** (retry, pool, mock, logger, otel, receipt, abort-signal, priority — з upyo; breaker,
ratelimit, idempotency, tee, uuid — з unemail; hooks — з sently). Нотис nodemailer не потрібен:
його файли (headers, address, list) — email-only. Фікс у спільному коді робиться в обох
репозиторіях.

| Що | Клас | Рядків | Що змінити |
| --- | --- | --- | --- |
| `src/internal/`: abort, sleep, warn, callback, options, log, iterate, settle, heap, priority, queue-options, backoff, uuid, base64, body, loopback, config, delivery-unknown, refusal, schedule, batch, gate, thrown, verify, http, provider-transport, polling-driver | A | 1 902 | перейменування `MAILER_*` (50 місць) |
| `src/internal/`: api-client, api (загальна половина ~70 рядків), decorator, fingerprint, redact, redact-addresses, unsent | B | ~670 | див. 4.3 |
| `src/core/`: abort-signal, priority | A | 53 | — |
| `src/core/`: receipt, transport, id | B | 425 | нові категорії, `segments`, без `RawTransport` і kinds `message-id`/`content-id` |
| `./breaker`, `./ratelimit`, `./idempotency` | A* | 1 205 | без `sendRaw()`; ratelimit отримує багаторівневі правила (6.5) |
| `./retry`, `./pool`, `./tee` | B-light | 1 793 | `pinMessageId` → `pinIdempotencyKey`; у pool `hasMessageRejection` + нові категорії |
| `./mock`, `./hooks`, `./logger` | B | 1 272 | пошук за `to`/`channel` замість Subject; `checkMessage` messenger |
| `./otel` | B | 1 709 | `attributes.js`, `metrics.js`, `message-size.js` — під канали; решта — перейменування `mailer.*` → `messenger.*` |
| `./webhooks`: `request.js` (~780 з 898), `sns.js` | A | ~1 070 | `createEvent` і `recipientOf` — під E.164 |
| `./audit` | A 123 / B 164 | 287 | стани messenger; префікс `mail.` |
| `./queue` | A 991 / B 1 584 | 2 575 | job v1 з повідомленням каналу, без кроку рендеру |
| `./bullmq`, `./mongodb` | A | 1 422 | імена черги, колекцій, індексів, `mailer:pause` |
| SigV4 з `src/ses/http-client.js` | A | ~70 | винести в `internal/sigv4.js` для `./aws-sms` |
| Тести й інфраструктура (див. етап 0) | A/B | ~6 000 | фікстура `createMessage` → messenger |

Не копіюється: `mime`, `smtp`, `sendmail`, `jmap`, `render`, email-частина `core`, 18
email-провайдерів (лише як зразок: Postmark — модель провайдера на `createApiClient` +
`ProviderTransport` + `sendConverted`; Mailgun — FormData), `attachments` і `templates` (пізніше:
`fromUrl`/`isPublicUrl` знадобляться для media, шаблони — фаза 3).

### 2.2 З конкурентів і довідкових бібліотек — feature-порт

| Джерело | Ліцензія | Що беремо | Куди | Режим |
| --- | --- | --- | --- | --- |
| **@thinwrap/notifications** 1.2.0 | MIT | запити й відповіді Twilio, Vonage, Infobip, Sinch, SNS (параметри), WhatsApp Cloud, Telegram, Slack/Discord/Teams/Google Chat webhooks, FCM, APNs; таблиці кодів помилок; тести на форму запиту (15–42 на провайдера) | SMS, `./meta`, чати, push | FEATURE; кілька функцій і таблиць — майже дослівно |
| **@visulima/notification** 2.0.0 | MIT | Web Push (VAPID + RFC 8291, коректний), APNs (сесія HTTP/2, кеш JWT), верифікатори (Twilio, Slack v0, Discord/Telnyx Ed25519, Vonage JWT), парсери inbound Twilio/Vonage для STOP, ~60–70 тестів | `./webpush`, `./apns`, `./webhooks` | FEATURE (~1 000 з 8 968 рядків) |
| **@novu/providers** 2.6.5 | MIT | лише таблиці статусів `parseEventBody` (Twilio, Telnyx, Plivo) — з виправленнями | `./webhooks` | REFERENCE |
| **twilio-node** 6.2.0 | MIT | алгоритм `X-Twilio-Signature` (варіанти URL, масиви, `bodySHA256`) і ~20 векторів; enum `MessageStatus` | `./webhooks`, `./twilio` | FEATURE |
| **telnyx-node** 7.28.0 | MIT | Ed25519-верифікатор, статуси | довідка (Telnyx не у v1) | REFERENCE |
| **vonage-node-sdk** 3.30.1 | Apache-2.0 | 5 векторів підпису SMS (md5hash, md5, sha1, sha256, sha512) | тести `./webhooks` | код — з документації, вектори — з атрибуцією |
| **sinch-sdk-node** 1.7.0 | Apache-2.0 | вектори DLR SMS і Conversation, enum статусів і `Reason` | тести `./webhooks`, `./sinch` | так само |
| **plivo-node** 4.79.0 | MIT | V2/legacy вектори | довідка (Plivo не у v1) | REFERENCE |
| **node-telegram-bot-api** 2.1.0 | MIT | конверт `ok:false`, поля помилок, політика обов'язкового secret token, тести транспорту й вебхука, фейковий годинник лімітера | `./telegram` | FEATURE |
| **grammY** 1.46.0 | MIT | лише звірка | — | REFERENCE |
| **notifme-sdk** 1.16.25 | MIT | нічого (усе старше й гірше за інші джерела) | — | SKIP |
| **http_ece** 1.2.1 (encrypted-content-encoding) | MIT | aes128gcm одним записом, вектори RFC 8188 §3.1–3.2 | `./webpush` | FEATURE |
| **message-segment-calculator** 1.3.0 (Twilio) | MIT | таблиця GSM-7 (137 кодових точок), математика 1120 біт / UDH, `TestData`, опційна мапа smart encoding (~270) | `src/core/sms.js` | FEATURE, таблиці дослівно |
| **split-sms** 0.1.7 | MIT | правило розрізання (не розривати escape і сурогатну пару), кейси | `src/core/sms.js` | FEATURE |
| **@parse/node-apn** 8.1.1 | MIT | сесія HTTP/2 (reconnect на goaway, ping), таймаут з `NGHTTP2_CANCEL`, лічильник поколінь токена, заголовки, тестовий h2c-сервер | `./apns` | FEATURE |
| **@discordjs/rest** 2.5.0 | Apache-2.0 | алгоритм бакетів `X-RateLimit-*` і глобальний 50/с | `./discord`, `./ratelimit` | код — з документації Discord, алгоритм як довідка |
| **firebase-admin** 14.5.0 | Apache-2.0 | вилучення коду помилки FCM (`details[].errorCode` перед `status`), таблиця кодів, політика кешу токена | `./fcm` | з документації + атрибуція таблиці |
| **@slack/bolt** 5.1.0, **@slack/web-api** 8.3.0 | MIT | верифікатор v0 (з виправленим вікном) і документований вектор; семантика 429 | `./slack` | FEATURE / REFERENCE |
| **botframework-connector** 4.1.6 | MIT | OpenID/JWKS, перевірка claims (`iss`, `aud`, endorsements, `serviceurl`), шляхи Connector API | `./teams` | FEATURE |
| **viber-bot** 1.0.18 | Apache-2.0 | ендпоінти, `X-Viber-Auth-Token`, вектор HMAC | `./viber` | REFERENCE + вектор |
| **@infobip-api/sdk** 0.3.2 | MIT | SMS v3 / WhatsApp запити | `./infobip` | REFERENCE |
| **@google/rcsbusinessmessaging** 1.0.10 | Apache-2.0 | ендпоінти `agentMessages` (`messageId`), capability check | `./rbm` | REFERENCE |

**Не копіюємо:** `web-push` (MPL-2.0, файловий копілефт) — Web Push будується з http_ece і RFC
8291/8292; офіційний WhatsApp Node SDK (Facebook Platform License, архів 2023, підпис через `==`);
решту Novu (SDK-обгортки); notifme; черги, middleware, wrappers, mock, otel visulima (у mailer
краще).

**Apache-2.0** (Vonage, Sinch, Viber, firebase-admin, discord.js): алгоритми — 5–15 рядків,
пишемо з публічної документації, щоб пакет лишався чистим MIT. Тест-вектори лежать у `tests/`,
яке не публікується; у тестовому файлі — рядок атрибуції. Якщо колись портуватиметься код —
текст Apache-2.0 у `LICENSE`, рядок «Changed in the port:» у заголовку файла, SPDX
`MIT AND Apache-2.0`.

### 2.3 Українські провайдери

Відкритого Node-коду немає (лише PHP-пакети `daaner/turbosms`, `developingw/turbosmsua` і старий
`node-alphasms`). Пишемо з документації: turbosms.ua/api.html (+ callback.html — DLR і вхідні
Viber), alphasms.ua (вебхуки статусів, підписані ключем API — за стороннім клієнтом, перевірити),
smsclub.mobi/en/api (`im.smsclub.mobi/sms/send` і `/sms/status`, до 100 id, 9 запитів/с, статуси
— лише опитуванням). Гібрид Viber → SMS усі троє роблять на своєму боці.

---

## 3. Правила порту (додати в `CLAUDE.md` разом з етапом 0)

1. **Копія з mailer** зберігає поведінку mailer; змінюється платформа messenger (імена, коди,
   стани). Окремий `fix:` — лише якщо знайдено баг mailer (і тоді той самий фікс у mailer).
2. **Feature-порт з конкурента** — як «Code ported from nodemailer, unemail and sently» у mailer:
   - переноситься фіча на наші контракти (`Receipt`, `createApiClient`, injected `fetch`,
     `signal`), а не HTTP-шар, ретраї й модель помилок джерела;
   - відомий баг джерела виправляється **в тому ж `feat:`-коміті**, з тестом, що падає на
     поведінці джерела, і рядком у списку багів `CLAUDE.md` (префікси: V — visulima, T —
     thinwrap, NV — Novu, TG — ntba/grammY, TW — twilio-node, VG — Vonage, SN — Sinch, AP —
     node-apn, FB — firebase-admin, DC — discord.js, SL — Slack SDK, VB — viber-bot, BB —
     botbuilder, EC — http_ece);
   - заголовок `// Ported from @thinwrap/notifications v1.2.0 (src/providers/twilio/twilio.connector.ts)`
     + рядок нотиса; друге джерело — `// Also ported from …`;
   - портовані сюїти зберігають `describe`/`it`; `expect` → `node:assert`,
     `vi.stubGlobal('fetch')` → `t.mock.method(globalThis, 'fetch')`, `vi.useFakeTimers` →
     `t.mock.timers`, `vi.mock('node:http2')` → локальний h2c-сервер; тест, що закріплював баг,
     позначається «Changed in the port».
3. **Файл без джерела** починається з `// Not ported:` і що це.
4. `tests/unit/attribution.test.js` (з mailer) приймає `Ported from`, `Copied from` і `Not ported:`
   і звіряє нотиси з `LICENSE`.

---

## 4. Архітектура (фаза 0)

### 4.1 Корінь

- **`createMessage(input)`** — дискримінований union за `channel` (`sms` | `rcs` | `whatsapp` |
  `messenger` | `instagram` | `telegram` | `viber` | `slack` | `discord` | `teams` |
  `googleChat` | `push`). Поля: `to`, `from`, `text`, `media`, `buttons`, `template`, `payload`
  (типізований escape hatch каналу: Block Kit, Adaptive Card, embed, cards v2, WhatsApp
  template, overrides FCM `android`/`apns`/`webpush`), `mentions` (нічого, якщо не дозволено),
  `tags`, `metadata`, `tenantId`, `idempotencyKey`, `scheduledAt`, `expiresAt` (TTL push,
  validity period SMS), `correlationId`, `priority`. Патерн і `checkMetadata`/`checkScheduledAt`
  — з `core/message.js` mailer (клас C).
- **`src/core/phone.js`** — `normalizePhone(input, { defaultCountry })` → E.164: таблиця
  calling codes ITU (~250), зняття trunk-префікса (`067…` → `+38067…`), ≤15 цифр, `isE164`.
- **`src/core/sms.js`** — `countSegments(text)` → `{ encoding, segments, units, characters }`:
  GSM-7 + extension (escape не розривається), UCS-2 у code units (сурогатна пара не
  розривається), 160/153 і 70/67; режим графем через `Intl.Segmenter` — опційно; smart encoding —
  опційно. Українська кирилиця завжди UCS-2 (національних таблиць TS 23.038 немає ні в кого).
- **`src/core/markup.js`** — екранування Telegram HTML (`& < >`, `"` в `href`), Slack mrkdwn
  (`& < >`), Discord Markdown; масові згадки (`<!channel>`, `<!here>`, `@everyone`, `@here`)
  нейтралізуються за замовчуванням.
- **`src/core/limits.js`** — ліміти каналів (Telegram 4096/1024 після розбору entities,
  `callback_data` 64 байти; Discord 2000 / 10 embeds / 6000; Slack 40 000 і 50 blocks; WhatsApp
  4096 і 3 reply-кнопки; Messenger 2000; Web Push ≤3993 байт; APNs 4 КБ / 5 КБ VoIP; FCM 4 КБ…),
  перевіряються до відправлення → receipt `validation`, а не 400.
- **Receipt** (з mailer) + `segments`, `channel`, `deliveryReport: 'provider' | 'none'` (робочі
  чати й push зупиняються на `sent`, і receipt це каже).
- **Категорії помилок:** mailer-ові + `invalid-recipient`, `opted-out`, `outside-window`,
  `blocked`, `not-on-channel`, `unregistered`, `unreachable`. `unreachable` (рішення
  2026-11-01) — апарат тимчасово недоступний (Twilio 30003, Vonage DLR 2/7, Sinch 404):
  повторюється пізніше і є приводом для фолбеку, а не `rejected`. Перелік категорій у
  `CLAUDE.md` («Architecture») оновлюється на етапі 1.
- **Стани:** `queued → submitted → accepted → sent → delivered | read | failed | expired |
  delivery_unknown`, **з рангом**: колбеки, що прийшли не по порядку, не відкочують стан назад
  (жодне джерело цього не робить).
- **`DeliveryEvent`**: `accepted`, `sent`, `delivered`, `read`, `failed`, `expired`,
  `rejected`, `opted_out`, `opted_in`, `unknown`; `channel`, `provider`, `messageId` провайдера,
  `recipientHash` (HMAC, не номер), `error { category, code }`, `occurredAt`, `raw`.
- Типи `Transport`, `TransportOptions`, `RetryEvent`, `Logger`, `IdGenerator`, `QueueDriver`,
  `QueueSource`, `AuditSink` — з `index.d.ts` mailer (~700 рядків агностичні).

### 4.2 Subpath-и

| Реліз | Subpath-и |
| --- | --- |
| 1.0 декоратори | `./mock`, `./retry`, `./pool`, `./breaker`, `./ratelimit`, `./idempotency`, `./hooks`, `./tee`, `./logger`, `./otel` |
| 1.0 SMS/RCS | `./twilio`, `./vonage`, `./infobip`, `./sinch`, `./aws-sms`, `./turbosms`, `./alphasms`, `./smsclub`, `./rbm` |
| 1.0 месенджери | `./meta` (WhatsApp, Messenger, Instagram: один Graph-клієнт, одна модель 24-годинного вікна), `./telegram`, `./viber` |
| 1.0 робочі чати | `./slack`, `./discord`, `./teams`, `./google-chat` |
| 1.0 push | `./fcm`, `./apns`, `./webpush` |
| 1.1 | `./webhooks` (один entry, як у mailer), `./optout`, `./fallback` |
| 1.2 | `./queue`, `./bullmq`, `./mongodb`, `./audit` |

`./meta`, а не три subpath-и: у них спільні клієнт, верифікатор `X-Hub-Signature-256` і вікно;
слово `messenger` у subpath плутало б з назвою пакета.

### 4.3 Спільний HTTP-шар (`src/internal/`)

`http.js` (`requestWithRetry`) копіюється як є: він уже агностичний і вже дає «не надсилати
повторно двозначний запит без ключа» (`hasIdempotencyKey`) та «Retry-After понад 30 с —
кинути для черги». Розширення `api-client.js`:

1. тіла `URLSearchParams` (Twilio, Vonage, SNS/AWS Query, обмін OAuth) і сирі байти з явним
   Content-Type (Web Push `aes128gcm`); зараз `URLSearchParams` мовчки стає `{}`;
2. текстова відповідь (Slack webhook відповідає `ok`; зараз це «не JSON» → `deliveryUnknown`);
3. `isAnswer` для відмови всередині 2xx: Vonage `messages[].status`, Infobip REJECTED, Telegram і
   Slack `ok:false` (`internal_error`/`fatal_error` Slack лишаються `deliveryUnknown`), Teams
   legacy;
4. `retryAfterOf(json, headers)`: Telegram `parameters.retry_after`, Discord `retry_after` у тілі;
5. `classify`, що повертає `rate-limit` з 400 (Graph: 4, 80007, 130429, 131056);
6. `authorize` з кешованим токеном і single-flight: **`internal/google-auth.js`** (RS256 JWT
   сервісного акаунта → `oauth2.googleapis.com/token`, оновлення за 5 хв до кінця; спільний для
   FCM, RBM і Google Chat app — різняться лише scope), **`internal/jwt.js`** (RS256/ES256 на
   `node:crypto`, `dsaEncoding: 'ieee-p1363'`), Bot Framework client credentials;
7. редагування секретів у URL: токен Telegram у шляху, URL вебхуків Slack/Discord/Teams (сам URL
   — секрет);
8. `fetch`-шим над `node:http2` для APNs (`internal/http2.js`): одна сесія на origin,
   reconnect на goaway/close, ping, `unref`, таймаут через `stream.close(NGHTTP2_CANCEL)`;
   `unsent.js` отримує REFUSED_STREAM і GOAWAY з last-stream-id нижче потоку (RFC 9113 §8.7).

---

## 5. Реліз 1.0 — канали й декоратори

Гілка `feature/v1`, один PR, коміти по одному на subpath, як у mailer.

### Етап 0. Підготовка репозиторію (`chore:`)

- з mailer: `tests/unit/graph.test.js` (без циклів, крос-subpath лише по дозволених ребрах),
  `attribution.test.js` (з `Copied from`), `api.test.js`, генерична частина `internal.test.js`,
  `delivery.test.js`, `secrets.test.js`, `privacy.test.js`, `codes.test.js`, `gate.test.js`,
  `decorators.test.js`; хелпери `providers/fetch.js` (+ розбір form-тіл), `decorators/fake.js`;
  `tests/runtime/http.test.js` (власний fetch рантайму, повтор запиту Deno);
- `LICENSE` з нотисами Upyo, unemail, sently і джерел feature-порту (thinwrap, visulima, twilio-node,
  ntba, http_ece, message-segment-calculator, split-sms, node-apn, Slack, botbuilder);
- розділ «Code ported …» у `CLAUDE.md` за розділом 3 цього плану; виправити формулювання про
  thinwrap (див. 10.4).

### Етап 1. Корінь (`feat(core):`)

Копія `abort-signal`, `priority`, `receipt` (B), `transport` (B), `id` (B); нові `message`,
`phone`, `sms`, `markup`, `limits`; типи кореня. Видалити плейсхолдер `createMessenger`
(`refactor:`, як mailer прибрав `createMailer`) — повернеться справжнім фасадом у 1.2.

### Етап 2. Спільний шар (`feat:`/`refactor:`)

Копія `internal/` у порядку залежностей (листя → `http` → `api-client` → `provider-transport`),
розширення 4.3, `internal/sigv4.js`, `internal/jwt.js`, `internal/google-auth.js`,
`internal/http2.js`.

### Етап 3. Декоратори з mailer (`feat(<subpath>):`)

`./mock` → `./retry` → `./breaker` → `./ratelimit` → `./idempotency` → `./hooks` → `./tee` →
`./pool` → `./logger` → `./otel`, кожен зі своїми тестами mailer (фікстура `createMessage`
замінюється). `./pool` не переходить на іншого провайдера після `deliveryUnknown` і на
`invalid-recipient`, `opted-out`, `blocked`; переходить на `unsupported`, `not-on-channel`.

### Етап 4. Канали (`feat(<subpath>):`, по коміту на провайдера)

| Subpath | Джерело | Нове | Баги джерела, що виправляються | ~src | Розмір |
| --- | --- | --- | --- | --- | --- |
| `./twilio` (SMS, MMS, WhatsApp-prefix, RCS `rcs:`) | thinwrap (запит, хости), twilio-node (статуси) | `num_segments` у receipt, коди → категорії (21610 → `opted-out`, 21211/21614 → `invalid-recipient`, 21408 → `configuration`, 63016 → `outside-window`), correlation id у query `StatusCallback` (підпис його покриває) | T1, T6, T11, V7, V8 | 300 | M |
| `./vonage` (SMS API) | thinwrap | усі `messages[]`, `message-count` → segments, `client-ref` | T2 | 220 | S |
| `./infobip` (SMS v3, RCS) | thinwrap, Infobip SDK | REJECTED у 200 → відмова за назвою групи | NV4 | 200 | S |
| `./sinch` (SMS batches) | thinwrap | `client_reference`, регіони | — | 130 | S |
| `./aws-sms` (End User Messaging SMS) | SigV4 з mailer `./ses` | `SendTextMessage`, configuration set, `MessageId`, коди помилок AWS | — | 220 | S–M |
| `./turbosms` (SMS, Viber, гібрид) | документація | `sequence_id` як ключ ідемпотентності (дедуплікація провайдера) | — | 250 | M |
| `./alphasms` (SMS, Viber, гібрид) | документація | — | — | 250 | M |
| `./smsclub` (SMS, Viber, гібрид) | документація | ліміт 9 запитів/с, статуси опитуванням (1.1) | — | 250 | M |
| `./rbm` (Google RCS Business Messaging) | документація, @google/rcsbusinessmessaging як довідка | `google-auth`, `messageId` клієнта = ідемпотентність, capability check → `not-on-channel` до відправлення | — | 300 | M |
| `./meta` | thinwrap (WhatsApp Cloud: text/template/interactive, таблиця `mapWhatsAppCode`) | Messenger Send API і Instagram (нові), шаблон обов'язковий поза вікном, `message_status`, версія Graph як опція | T10 | 600 | L |
| `./telegram` | ntba (конверт, поля помилок), thinwrap | опис → категорія (403 blocked/kicked → `blocked`, «can't initiate conversation» → `not-on-channel`, 400 «chat not found» → `invalid-recipient`, `migrate_to_chat_id`), HTML-екранування, ліміти, inline-кнопки, media через нативний `FormData` | T7, V11, TG1 | 580 | M |
| `./viber` (Bot API) | документація, viber-bot як довідка | `status != 0` → помилка; 5/6 → `not-on-channel` | VB1 (у 1.1) | 250 | M |
| `./slack` (Web API + incoming webhook) | thinwrap, visulima (`chat.postMessage`) | `ok:false` → категорії, mrkdwn, `ts` як id, без ретраю `chat.postMessage` після мережевої помилки | SL1 | 280 | M |
| `./discord` (бот REST + webhook) | thinwrap (webhook `?wait=true`) | бот REST, `allowed_mentions: { parse: [] }` за замовчуванням, `thread_id` у query, `nonce` + `enforce_nonce` (безпечний повтор), бакети з `X-RateLimit-*` | T8, V10, DC1 | 300 | M |
| `./teams` (Workflows webhook + Bot Framework) | thinwrap (конверт Adaptive Card, `failureStatusFor2xx`) | Workflows 202 → `accepted`; бот: токен client credentials, `serviceUrl` лише з allowlist, проактивне `POST /v3/conversations` | T9, V-MessageCard, BB1 | 320 | M–L |
| `./google-chat` (webhook + Chat API app) | thinwrap (webhook) | Chat API app через `google-auth`, `name` як id, `threadKey` | — | 250 | M |
| `./fcm` (HTTP v1) | thinwrap (JWT, oneof цілі), firebase-admin як довідка | `details[].errorCode` перед `status` (UNREGISTERED → `unregistered`, SENDER_ID_MISMATCH → `invalid-recipient`, QUOTA_EXCEEDED → `rate-limit`), зарезервовані ключі data, TTL у `android`/`apns`/`webpush` | T3, T5, V16, FB1 | 350 | M |
| `./apns` (HTTP/2, token) | thinwrap (`createApnsJwt`, `finalizePushType`, таблиця reasons), node-apn і visulima (сесія) | `internal/http2.js`, `apns-id` як id, явне середовище (не `NODE_ENV`), priority 5 для background, ліміт 4/5 КБ, `ExpiredProviderToken` → новий токен один раз | T3, T4, V15, AP1 | 400 | M–L |
| `./webpush` (VAPID) | http_ece, visulima (звірка), RFC 8291/8292 | `node:crypto` (`createECDH`, `hkdfSync`), JWT на аудиторію в кеші, ≤3993 байт, перевірка `p256dh`/`auth`, `Topic`, 404/410 → `unregistered`, 413 → `validation`, SSRF-перевірка endpoint (`isPublicUrl` з mailer) | V14, EC1 | 250 | M |

Разом ~5 700 рядків `src/` провайдерів, плюс d.ts (~40 %) і тести (1,5–2×). Кожен subpath
отримує бюджет у `scripts/size-budgets.json` (орієнтир mailer: провайдер 7–9,5 КБ, декоратори
2–6,5 КБ).

**Хвилі всередині етапу 4** (порядок — від того, що закриває одноразові коди й алерти):
SMS-провайдери → `./telegram` → `./meta` → push → робочі чати → `./viber`, `./rbm`, українські.

### Етап 5. Ревʼю, продуктивність, документація

- хвиля ревʼю (`fix:`/`perf:`), як у mailer 1.1 (R1–R42): кожна знахідка — коміт з тестом;
- `pnpm bench` для гарячих шляхів (сегменти, екранування, підпис), `bench/baseline.json`;
- README, сторінки docs на кожен subpath, клітинки `@alexify/messenger` у
  `docs/comparison.json` (🔜 → ✅ лише для зробленого), CHANGELOG; `chore(release): 1.0.0`.

---

## 6. Реліз 1.1 — замкнений цикл

### 6.1 `./webhooks`

Копія `request.js` (сирий body обов'язковий, вікно часу, `claimDelivery` з reserve/commit/release
і токеном, порівняння секретів через HMAC, `WebhookVerificationError` зі статусом) і `sns.js`
(для AWS End User Messaging SMS — потрібен лише новий `eventsOf`). Верифікатори:

| Провайдер | Схема | Джерело | Вектори |
| --- | --- | --- | --- |
| Twilio | HMAC-SHA1 від URL + відсортованих параметрів, `bodySHA256` для JSON; URL лише з опцій, не із заголовка; дедуплікація за `I-Twilio-Idempotency-Token` | twilio-node (FEATURE) | ~20 з `spec/validation.spec.js` |
| Vonage | SMS `sig` (4 алгоритми) з вікном `timestamp`; Messages JWT лише HS256 + `payload_hash` = sha256(body) + вікно `iat` + `jti` | документація | 5 з SDK |
| Sinch | HMAC-SHA256 `body.nonce.timestamp` над сирими байтами, вікно, nonce у сховище | документація | DLR SMS і Conversation |
| Infobip | облікові дані з налаштувань вебхука (`tokenCheckOf`/Basic з `request.js`) | документація | згенерувати й заморозити |
| AWS End User Messaging SMS | SNS v1/v2 (вже є) | mailer | з mailer |
| Meta (WhatsApp, Messenger, Instagram) | `X-Hub-Signature-256` HMAC над сирим body + GET `hub.challenge` | документація | згенерувати |
| Viber | `X-Viber-Content-Signature` HMAC-SHA256 ключем-токеном | документація | 1 з viber-bot |
| RBM | `X-Goog-Signature` HMAC-SHA512 від base64-тіла, `clientToken` | документація | згенерувати |
| Telegram | `X-Telegram-Bot-Api-Secret-Token` обов'язковий, дедуплікація `update_id`; `my_chat_member` → `kicked` = `blocked` | ntba (політика) | тести ntba 224–268 |
| TurboSMS, AlphaSMS | колбеки DLR за документацією; SMSClub — лише опитування | документація | з прикладів документації |
| Teams bot (опційно) | Bot Framework JWT: OpenID → JWKS, RS256/384/512, `iss`, `aud`, endorsements `msteams`, `serviceurl` = `activity.serviceUrl` | botbuilder (FEATURE) | згенерувати |

**Таблиці статусів** (з рангом, закріплені `webhooks-mapping.test.js` для кожного провайдера,
правило як у `docs/guide/webhooks.md` mailer: `unknown` замість здогадки):

- Twilio: accepted/scheduled/queued/sending → `accepted`; sent → `sent`; delivered →
  `delivered`; read → `read`; undelivered/failed → `failed` (категорія з ErrorCode); canceled →
  `failed`; partially_delivered → `delivery_unknown` (Novu губить scheduled, read, canceled,
  partially_delivered — NV1);
- Vonage DLR: accepted/buffered → `sent`, delivered, expired, failed/rejected → `failed`,
  unknown → `delivery_unknown`;
- Sinch SMS: Queued → `accepted`, Dispatched → `sent`, Delivered, Expired,
  Failed/Rejected/Aborted/Cancelled/Deleted → `failed`, Unknown → `delivery_unknown`;
- Meta: sent, delivered, read, failed (131047 → `outside-window`, 131026 → `not-on-channel`,
  131050 → `opted-out`); Messenger/Instagram — за watermark;
- Viber: delivered, seen → `read`, failed; subscribed/unsubscribed → opt-in/opt-out.

**Звірка без вебхуків:** `pollStatus(ids)` на транспортах, що вміють (SMSClub, TurboSMS), і
функція `reconcile`, яку в 1.2 викликає воркер черги.

### 6.2 Opt-out (`./optout`)

Контракт `OptOutStore` (`isOptedOut(tenantId, recipientHash, channel | '*')`, `optOut`, `optIn`),
сховище в пам'яті (MongoDB — у 1.2). Перевірка до постановки в чергу; відмова — **невдалий**
receipt `opted-out`, а не успіх (баг V1). Політика для транзакційних (одноразові коди): обхід лише
явним прапорцем. Джерела подій: Twilio `OptOutType` (STOP/START/HELP), Vonage inbound, Sinch
`OPT_OUT`, WhatsApp 131050, Viber `unsubscribed`, Telegram `kicked`, помилки відправлення
(21610 тощо).

### 6.3 24-годинне вікно (у `./meta`)

`ConversationWindowStore` оновлюється з вхідних вебхуків (час останнього повідомлення
користувача на пару сторінка/номер — одержувач); поза вікном вільний текст відмовляється з
`outside-window` (шаблон або message tag Messenger `HUMAN_AGENT`, 7 днів).

### 6.4 Фолбек між каналами (`./fallback`)

Синхронний: наступний канал на `rejected`, `not-on-channel`, `outside-window`, `unregistered`,
`unreachable`; ніколи на `opted-out`; ніколи після `deliveryUnknown` без ключа ідемпотентності.
Пригнічене чи дедупліковане відправлення не є успіхом (V1). Фолбек «немає receipt до дедлайну»
потребує черги — у 1.2.

### 6.5 Rate limits каналів

`./ratelimit` mailer + `rules: [{ key?, limit, intervalMs, burst }]`, атомарне резервування за
всіма правилами (GCRA: `t = max(now, maxᵢ(TATᵢ − τᵢ))`), пауза ключа на `retry_after` з 429.
Пресети: Telegram 30/с глобально + 1/с на чат (20/хв, якщо `chat_id < 0`); Slack ~1/с на канал;
WhatsApp — тири; Discord — бакети із заголовків усередині `./discord` (алгоритм discord.js:
очікування до відправлення, глобальні 50/с, переназначення хешів бакетів, ліміт ретраїв на 429).
Лімітер ntba — лише довідка (послідовне захоплення токенів перевищує ліміт — TG3).

---

## 7. Реліз 1.2 — черга, outbox, аудит, фасад

- `./queue`: спершу файли класу A (memory-queue, hash, signing, json, errors, outcome), потім
  job v1 повідомлення каналу (без рендеру; шаблони за назвою — фаза 3), handler, `deriveId`;
- `./bullmq`, `./mongodb` (outbox як `QueueSource`, сховища opt-out, вікна, ідемпотентності,
  аудиту; перейменування колекцій), `instrumentHandler` у `./otel`;
- `./audit` зі станами messenger і **стиранням номерів** (HMAC одержувача + зашифрований блок,
  crypto-shredding; у mailer цього ще немає — нова робота, ~400 рядків);
- фолбек за дедлайном: відкладений job, що читає стан з аудиту;
- ідемпотентність відображається на дедуплікацію провайдера, де вона є: TurboSMS `sequence_id`,
  RBM `messageId`, Discord `nonce` + `enforce_nonce`; деінде — `delivery_unknown` і звірка;
- відкладене відправлення (`scheduledAt` як затримка черги) приходить з копією черги майже
  безкоштовно;
- `createMessenger({ transports, queue, audit, optOut, fallback })` — маршрутизація за каналом,
  opt-out до черги, фолбек, аудит; `send`, `enqueue`, обробка вебхуків.

---

## 8. Баги конкурентів, які не повторюємо (виправляються в порті)

| Id | Джерело, місце | Що не так | Як у нас |
| --- | --- | --- | --- |
| V1 | visulima `suppression.ts:57`, `dedupe.ts:35`, `routing/index.ts:83` | пригнічене/дедупліковане = успіх, фолбек зупиняється | невдалий receipt `opted-out` / `deliveryUnknown` |
| V2 | visulima `queue/worker.ts:55` | збій одного каналу перевідправляє всі | job на одне повідомлення каналу |
| V3 | visulima `webhooks/standard.ts:63`, `slack.ts:38`, `sns.ts:232` | невідома подія → `delivered` | `unknown` |
| V4 | visulima `http.ts:94`, `retry.ts:22`, `worker.ts:43` | ретраї на трьох рівнях (до 80 POST), без Retry-After | один рівень, Retry-After |
| V5 | visulima `circuit-breaker.ts:23`, `rate-limit.ts:22` | один breaker і лімітер на всі канали | декоратор на транспорт |
| V7 | visulima `http.ts:103` | POST повторюється після таймауту | `deliveryUnknown` |
| V8 | visulima `utils/sms.ts:12` | частковий збій прихований | receipt на одержувача |
| V9 | visulima SNS `:167`, APNs `:153` | вигадані id як id провайдера | `MessageId`, `apns-id` |
| V12 | visulima `webhooks/twilio.ts:101` | підписаний URL береться із заголовка запиту | URL лише з опцій |
| V14 | visulima `push/web-push` | немає ліміту розміру, поганий ключ кидає з `send()`, 404/410 не класифіковані | 6.5/4.1, `unregistered` |
| V15 | visulima `push/apns` | немає таймауту, GOAWAY, `unref`; reasons сирим текстом | `internal/http2.js`, таблиця reasons |
| T1 | thinwrap `twilio.connector.ts:214` і ще 7 | прийняте SMS завжди `sent` | `accepted` + статус провайдера |
| T2 | thinwrap `vonage.connector.ts:161` | перевіряється лише `messages[0]`, сегменти губляться | усі частини, `segments` |
| T3 | thinwrap apns `:94`, fcm `:136` | немає кешу токена → `TooManyProviderTokenUpdates` | кеш + single-flight |
| T5 | thinwrap fcm `:545` | `details[].errorCode` не читається | читається першим |
| T6 | thinwrap twilio `:330` | 21610 (STOP) → `invalid_recipient` | `opted-out` |
| T7 | thinwrap telegram `:153` | будь-який 403 → `invalid_recipient` | `blocked` / `not-on-channel` |
| T8, V10 | thinwrap discord `:77`, visulima discord `:42` | немає `allowed_mentions`, `@everyone` пінгує | `parse: []` за замовчуванням |
| T9 | thinwrap ms-teams `:184` | Workflows 202 = `sent` | `accepted` |
| T10 | thinwrap whatsapp `:84` | `type: 'template'` без шаблону | `validation` до запиту |
| T11 | thinwrap `base.connector.ts:85` | без signal і таймауту; abort → `invalid_request` | `signal`, `timeout` |
| NV1 | Novu twilio `:82`, `:88` | губить scheduled, read, canceled, partially_delivered | таблиця 6.1 |
| NV2 | Novu telnyx `:58` | кореляція за id події, не повідомлення | `data.payload.id` |
| NV4 | Novu infobip `:45` | REJECTED у 200 = успіх | `isAnswer` |
| TG1 | ntba `transport.ts:165–191` | `sendMessage` повторюється після таймауту, 5xx і збою читання після 200 | лише 429 повторюється |
| TG2 | grammY `webhook.ts:39` | без secret приймає все; ранній вихід за довжиною | secret обов'язковий, HMAC-порівняння |
| TG3 | ntba `ratelimiter.ts:115` | токени захоплюються послідовно → перевищення | GCRA атомарно |
| TW1 | twilio-node `webhooks.ts:450`, `:433` | токен з `process.env`, `validate: false` вимикає перевірку | лише опції, перевірка завжди |
| VG1 | vonage `sms.ts:185`; `jwt/verifySignature.ts:47` | `===`, без вікна; JWT без `payload_hash`, RS256+HS256 | 6.1 |
| SN1 | sinch `authorization.helper.ts:55`, `:64` | `===`, час не перевіряється, тіло пересеріалізується | 6.1 |
| AP1 | node-apn `client.js:565`, `:142`, `config.js:27` | `Retry-After` з великої літери в HTTP/2, ретраї 500/503, середовище з `NODE_ENV` | малі літери, без ретраю, явне середовище |
| FB1 | firebase-admin `api-request.ts:250` | `messages:send` повторюється після ETIMEDOUT | `deliveryUnknown` |
| DC1 | discord.js `SequentialHandler.ts:428`, `utils.ts:140` | 429 не рахується → безмежні ретраї; таймаут повторюється | ліміт; `nonce` + `enforce_nonce` |
| SL1 | @slack/web-api `WebClient.ts:664`; bolt `verify-request.ts:47` | `chat.postMessage` повторюється після мережевої помилки; вікно лише в минуле | `deliveryUnknown`; модуль різниці |
| VB1 | viber-bot `middleware.js:60`, `message-validator.js:13` | заголовок ніколи не читається, `==`, підписи в лог | 6.1 |
| BB1 | botbuilder `openIdMetadata.ts:45` | збій оновлення метаданих через 24 год відкидає все; немає single-flight | кеш лишається, single-flight |
| EC1 | http_ece `ece.js:28` | `ECE_KEYLOG=1` друкує ключі | не переноситься |

---

## 9. Тестування без e2e-акаунтів

- **Провайдери** — проти фейкових серверів (`node:http`, h2c для APNs за патерном
  `node-apn/test/client.js`) або `t.mock.method(globalThis, 'fetch')`; форма запиту, помилки в
  2xx, Retry-After, редагування секретів — з тестів thinwrap і visulima.
- **Вебхуки** — проти векторів: Twilio (~20), Vonage (5), Sinch (2), Viber (1), Slack (1), RFC
  8188 §3.1–3.2 і RFC 8291 Appendix A для Web Push; для решти — згенерувати ключі один раз і
  заморозити тіло й підпис у `tests/fixtures/webhooks/` (LF, порівняння байт у байт).
- **Тіла відповідей і колбеків** — з прикладів офіційної документації; у тестах і в docs
  позначати «перевірено за документацією, не на живому API».
- **Deno** — тест повтору запиту на перевикористаному з'єднанні для провайдерів без ключа
  ідемпотентності (як у mailer).
- **`tests/e2e/`** — набори пишуться одразу, але пропускаються без змінних середовища.
  Безкоштовні акаунти, які варто створити першими, щоб зняти найбільші ризики: Telegram-бот
  (BotFather), Slack і Discord (робочий простір), Firebase-проєкт (FCM), тестовий номер WhatsApp
  Cloud API (Meta for Developers), пробний Twilio, AWS sandbox. Українські провайдери платні;
  без акаунта їхні колбеки й коди статусів лишаються неперевіреними — це головний ризик 1.1.

---

## 10. Ризики й відкриті питання

1. **TurboSMS, AlphaSMS, SMSClub** — документація неповна (формат колбеків, підпис AlphaSMS,
   статуси Viber), джерела коду немає, акаунта немає. Пропозиція: зробити їх в 1.0 за
   документацією і явно позначити як неперевірені до першого користувача з акаунтом.
2. **Teams Bot Framework** — найскладніший канал (токени, JWKS, `serviceUrl`, проактивні розмови
   потребують вхідної події інсталяції). У 1.0 — відправлення за відомою conversation reference;
   прийом activity — у 1.1.
3. **Категорія `unreachable`** — вирішено: додається (див. 4.1).
4. **Формулювання в `CLAUDE.md` про thinwrap** неточні: «every SMS reported `sent`» правдиве лише
   для успіхів (відмови в 200 Vonage й Infobip ловляться) — краще «an accepted SMS is always
   reported `sent`, never `queued`»; «Slack `providerMessageId` always null» — це відсутність Web
   API, а не баг. Виправити разом з етапом 0 і клітинками `docs/comparison.json`.
5. **Telnyx** — не в roadmap, але дешевий (~1–2 дні: верифікатор ~25 рядків, 7 статусів) і
   єдиний SMS-провайдер з власним `Idempotency-Key`. За правилом «few providers per channel» —
   чекає користувача.
6. **Версії Graph API** дрейфують: версія — опція `./meta` з датованим значенням за
   замовчуванням.
7. **HTTP/2 на Bun і Deno** — через Node-сумісність; `tests/runtime` має надіслати на локальний
   HTTP/2-сервер на всіх трьох (уже записано в `CLAUDE.md`).

---

## 11. Обсяг

| Реліз | Скопійовано з mailer (A / B) | Нове `src/` | Основне |
| --- | --- | --- | --- |
| 1.0 | ~3 200 / ~5 600 | ~8 500 (ядро ~1 500, спільний шар ~800, провайдери ~5 700, d.ts окремо) | 20 провайдерів, 10 декораторів |
| 1.1 | ~1 100 / ~300 | ~4 000 (верифікатори й мапінг ~2 500, opt-out, вікно, фолбек ~1 100, ratelimit ~400) | замкнений цикл |
| 1.2 | ~2 500 / ~1 800 | ~1 500 (crypto-shredding, фасад, фолбек за дедлайном) | черга, outbox, аудит |

---

## 12. Перші кроки

1. Етап 0 одним `chore:`-комітом: тести інфраструктури з mailer, `LICENSE`, розділ правил порту
   в `CLAUDE.md`.
2. Рішення ухвалено: `unreachable` додається, WhatsApp, Messenger і Instagram — у `./meta`;
   назви `./aws-sms` і `./google-chat` — як у таблиці 4.2.
3. Етап 1 (корінь) і етап 2 (спільний шар) — після них кожен провайдер і декоратор незалежний,
   тож етапи 3–4 можна вести паралельно по subpath-ах.
