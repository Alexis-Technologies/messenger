const { test } = require('node:test');
const assert = require('node:assert');
const { createMessenger } = require('../../index.js');

test('Messenger: createMessenger is a placeholder until the messenger is implemented', () => {
  assert.throws(() => createMessenger({}), { message: 'createMessenger is not implemented yet' });
});
