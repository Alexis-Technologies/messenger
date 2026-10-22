# Exports

::: warning Work in progress
`createMessenger` is a placeholder: it throws until the messenger is implemented, and its
signature will change with the design of the messages, the channels and the queue.
:::

```js
const { createMessenger } = require('@alexify/messenger');
```

## `createMessenger(options)`

Creates a messenger that sends messages to SMS, WhatsApp, Telegram and Viber through their
providers, with the reliability layer on top.

```ts
interface Messenger {
  send(message: object): Promise<unknown>;
}

function createMessenger(options: object): Messenger;
```

Throws `Error('createMessenger is not implemented yet')`.
