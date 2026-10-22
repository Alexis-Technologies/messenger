import { expectError, expectType } from 'tsd';
import { createMessenger, type Messenger } from '../../index.js';

const messenger = createMessenger({});
expectType<Messenger>(messenger);
expectType<Promise<unknown>>(messenger.send({ channel: 'sms', to: '+380501234567', text: 'Hi' }));

expectError(createMessenger());
expectError(createMessenger('twilio://localhost'));
expectError(messenger.send('Hello'));
