/**
 * A messenger: sends messages to chat apps, SMS and push through their
 * providers, with the reliability layer (queue, audit of message states,
 * delivery receipts) on top.
 *
 * Provisional: the shape is defined with the Phase 0 contracts.
 */
export interface Messenger {
  send(message: object): Promise<unknown>;
}

/**
 * Creates a messenger.
 *
 * Placeholder: throws until the messenger is implemented. The signature is
 * provisional.
 */
export function createMessenger(options: object): Messenger;
