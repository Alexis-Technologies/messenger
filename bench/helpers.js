const { performance } = require('node:perf_hooks');

const WARMUP_ITERATIONS = 2_000;
const MEASURE_MS = 1_000;

const bench = (name, fn, options = {}) => {
  const { warmup = WARMUP_ITERATIONS, measureMs = MEASURE_MS, quiet = false } = options;
  for (let i = 0; i < warmup; i++) fn();
  let iterations = 0;
  const start = performance.now();
  while (performance.now() - start < measureMs) {
    fn();
    iterations++;
  }
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  const ops = opsPerSec.toLocaleString('en-US').padStart(12);
  if (!quiet) console.log(`${name.padEnd(52)} ${ops} ops/sec`);
  return { name, opsPerSec };
};

// Two texts of an SMS: one fits the GSM 03.38 alphabet (290 septets, two
// segments), the other needs UCS-2 (Cyrillic, and an emoji that takes two
// UTF-16 code units: 207 units, four segments).
const TEXT_GSM =
  'Your code is 482913. It expires in 10 minutes. Never share it with anyone, ' +
  'not even with our support team: we will never ask you for it. If you did ' +
  'not request a code, ignore this message and change your password at once. ' +
  'Questions? Reply HELP; to stop these messages reply STOP. Acme Bank.';
const TEXT_UCS2 =
  'Ваш код: 482913. Він дійсний 10 хвилин. Нікому не повідомляйте його, навіть ' +
  'службі підтримки — ми ніколи його не питаємо. Якщо ви не запитували код, ' +
  'змініть пароль. Відповідь STOP — відписатися. Acme Bank 🔐';

// Phone numbers as people type them, for a default country of Ukraine (+380).
const PHONES = ['+380 (50) 123-45-67', '0501234567', '00380501234567', '+1 415 555 2671'];

// A WhatsApp Cloud API delivery-status webhook (what Meta signs with
// X-Hub-Signature-256 over the raw body).
const WEBHOOK_BODY = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' },
            statuses: [
              {
                id: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgARGBJDQjZCMzlEQUE4OTJBMTE4RTUA',
                status: 'delivered',
                timestamp: '1792606562',
                recipient_id: '380501234567',
                pricing: { billable: true, pricing_model: 'PMP', category: 'utility' },
              },
            ],
          },
        },
      ],
    },
  ],
});

// The parameters Twilio posts to a status callback, which it signs with
// X-Twilio-Signature: HMAC-SHA1 of the URL followed by each sorted key and its
// value.
const TWILIO_URL = 'https://acme.example/webhooks/twilio/status';
const TWILIO_PARAMS = {
  AccountSid: 'AC00000000000000000000000000000000',
  ApiVersion: '2010-04-01',
  From: '+14155552671',
  MessageSid: 'SM00000000000000000000000000000000',
  MessageStatus: 'delivered',
  SmsSid: 'SM00000000000000000000000000000000',
  SmsStatus: 'delivered',
  To: '+380501234567',
};

// The record an outbox keeps per message: what to send, to whom, through
// which channels in turn, and where it is in its lifecycle.
const OUTBOX_RECORD = {
  id: '0193a7c2-6f1e-7c4b-9a51-3d2e8f6b1c0a',
  tenantId: 'acme',
  idempotencyKey: 'acme:otp:+380501234567:2026-10-22T10',
  state: 'queued',
  attempt: 0,
  createdAt: '2026-10-22T10:15:00.000Z',
  route: ['whatsapp', 'viber', 'sms'],
  message: {
    to: '+380501234567',
    from: 'AcmeBank',
    text: 'Your code is 482913. It expires in 10 minutes.',
    template: { name: 'otp_code', language: 'uk', parameters: ['482913'] },
    tags: { kind: 'otp' },
  },
};

module.exports = {
  bench,
  TEXT_GSM,
  TEXT_UCS2,
  PHONES,
  WEBHOOK_BODY,
  TWILIO_URL,
  TWILIO_PARAMS,
  OUTBOX_RECORD,
};
