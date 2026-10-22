/**
 * Zero-dependency ops/sec benchmark for the messenger's hot paths.
 *
 * Run: pnpm bench [filter] [--json] [--save] [--compare]
 *
 * An optional filter runs only the scenarios whose name contains it, e.g.
 * `pnpm bench SMS`. `--json` prints the results as JSON, `--save` writes them
 * to bench/baseline.json, and `--compare` prints the change against that
 * baseline (numbers are machine-specific: compare on one machine, before and
 * after a change). Manual only, not part of CI.
 *
 * Until the channels and the reliability layer are implemented, the scenarios
 * are the reference points their hot paths are made of: counting the segments
 * of an SMS, normalizing a phone number to E.164, verifying the signature of a
 * provider's webhook, and the hash and JSON of an outbox record.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  bench,
  TEXT_GSM,
  TEXT_UCS2,
  PHONES,
  WEBHOOK_BODY,
  TWILIO_URL,
  TWILIO_PARAMS,
  OUTBOX_RECORD,
} = require('./helpers.js');

const BASELINE = path.join(__dirname, 'baseline.json');

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const filter = args.find((arg) => !arg.startsWith('--')) || '';
const json = flags.has('--json');

const percent = (current, base) => {
  const delta = ((current - base) / base) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
};

const compare = (results) => {
  if (!fs.existsSync(BASELINE)) {
    console.error(`No baseline at ${BASELINE}; run with --save first`);
    process.exitCode = 1;
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const base = new Map(baseline.results.map((row) => [row.name, row.opsPerSec]));
  console.log(`\nAgainst baseline from ${baseline.date} (${baseline.node}):`);
  for (const { name, opsPerSec } of results) {
    const before = base.get(name);
    const change = before ? percent(opsPerSec, before) : 'no baseline';
    console.log(`${name.padEnd(52)} ${change.padStart(12)}`);
  }
};

// GSM 03.38: the basic alphabet takes one septet a character, the extension
// table two (an escape, then the character). Anything else makes the whole
// message UCS-2. A segment holds 160 septets or 70 UTF-16 code units alone,
// 153 or 67 when the message is split (the rest is the concatenation header).
const GSM_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
const GSM_EXTENSION = new Set('\f^{}\\[~]|€');

const segments = (text) => {
  let septets = 0;
  for (const char of text) {
    if (GSM_BASIC.has(char)) septets += 1;
    else if (GSM_EXTENSION.has(char)) septets += 2;
    else {
      const units = text.length;
      return { encoding: 'UCS-2', count: units <= 70 ? 1 : Math.ceil(units / 67) };
    }
  }
  return { encoding: 'GSM-7', count: septets <= 160 ? 1 : Math.ceil(septets / 153) };
};

// A phone number as typed, for a default country code: separators dropped,
// a 00 or a national 0 prefix replaced, the result checked against E.164.
const E164 = /^\+[1-9]\d{1,14}$/;
const SEPARATORS = /[\s().-]/g;
const toE164 = (input, countryCode) => {
  let digits = input.replace(SEPARATORS, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  else if (digits.startsWith('0')) digits = `+${countryCode}${digits.slice(1)}`;
  else if (!digits.startsWith('+')) digits = `+${digits}`;
  return E164.test(digits) ? digits : null;
};

const verifyHmac = (algorithm, key, payload, signature, encoding) => {
  const expected = crypto.createHmac(algorithm, key).update(payload).digest();
  const given = Buffer.from(signature, encoding);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

const twilioPayload = (url, params) => {
  let payload = url;
  for (const key of Object.keys(params).sort()) payload += key + params[key];
  return payload;
};

const main = () => {
  if (!json) console.log(`Node ${process.version} | ${new Date().toISOString()}\n`);
  const secret = crypto.randomBytes(32).toString('hex');
  const metaSignature = crypto.createHmac('sha256', secret).update(WEBHOOK_BODY).digest('hex');
  const twilioSignature = crypto
    .createHmac('sha1', secret)
    .update(twilioPayload(TWILIO_URL, TWILIO_PARAMS))
    .digest('base64');
  const recordJson = JSON.stringify(OUTBOX_RECORD);

  const scenarios = [
    ['SMS segments — GSM-7 text, 2 segments', () => segments(TEXT_GSM)],
    ['SMS segments — UCS-2 text, 4 segments', () => segments(TEXT_UCS2)],
    ['E.164 — 4 numbers as typed, default +380', () => PHONES.map((p) => toE164(p, '380'))],
    [
      'Webhook — WhatsApp, HMAC-SHA256 of the body',
      () => verifyHmac('sha256', secret, WEBHOOK_BODY, metaSignature, 'hex'),
    ],
    [
      'Webhook — Twilio, HMAC-SHA1 of URL and params',
      () =>
        verifyHmac(
          'sha1',
          secret,
          twilioPayload(TWILIO_URL, TWILIO_PARAMS),
          twilioSignature,
          'base64',
        ),
    ],
    ['Webhook — JSON.parse of a WhatsApp status', () => JSON.parse(WEBHOOK_BODY)],
    [
      'Audit log — SHA-256 of an outbox record',
      () => crypto.createHash('sha256').update(recordJson).digest('hex'),
    ],
    ['Outbox — JSON.stringify of a record', () => JSON.stringify(OUTBOX_RECORD)],
    ['Outbox — JSON.parse of a record', () => JSON.parse(recordJson)],
  ];

  const results = [];
  for (const [name, fn, options] of scenarios) {
    if (name.includes(filter)) results.push(bench(name, fn, { ...options, quiet: json }));
  }
  if (json) console.log(JSON.stringify(results, null, 2));
  if (flags.has('--save')) {
    const snapshot = { node: process.version, date: new Date().toISOString(), results };
    fs.writeFileSync(BASELINE, `${JSON.stringify(snapshot, null, 2)}\n`);
    if (!json) console.log(`\nSaved ${results.length} results to ${BASELINE}`);
  }
  if (flags.has('--compare')) compare(results);
};

main();
