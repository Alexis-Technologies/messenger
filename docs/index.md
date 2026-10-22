---
layout: home

title: '@alexify/messenger'
titleTemplate: Chat apps, SMS and push for Node.js, with a reliability layer

hero:
  name: messenger
  text: Chat apps, SMS and push, with a reliability layer
  tagline: "One message model for SMS and RCS, WhatsApp, Messenger and Instagram, Telegram and Viber, Slack, Discord, Teams and Google Chat, and push, and on top of it what the other libraries leave to you: a persistent queue, an audit of every state, one model of delivery receipts, idempotency and fallback between channels. Zero dependencies."
  image:
    src: /logo-mark.svg
    alt: messenger
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why messenger?
      link: /guide/why
    - theme: alt
      text: Compared with alternatives
      link: /guide/comparison

features:
  - icon: 💬
    title: Twelve channels, one message
    details: "SMS and RCS, WhatsApp, Messenger and Instagram, Telegram and Viber, Slack, Discord, Teams and Google Chat, and push, through the HTTP APIs of their providers without their SDKs — including the Ukrainian SMS and Viber providers no other library has."
    link: /guide/why
    linkText: The channels
  - icon: 🧾
    title: A reliability layer
    details: "A persistent queue and outbox, an audit of every state of a message, and one model of delivery receipts from webhooks that are verified before they are read."
    link: /guide/comparison
    linkText: The comparison
  - icon: 🔁
    title: Fallback that knows what happened
    details: "WhatsApp, then SMS if it was not delivered in time; never a second one-time code after a send of unknown outcome. Idempotency keys, errors classified as permanent or temporary."
    link: /guide/why
    linkText: The design
  - icon: 🪶
    title: Zero dependencies
    details: "Built on node:* modules and fetch, for Node.js 22+, Bun and Deno. A queue or a database driver is passed in by your application. CommonJS with ESM named imports and hand-written typings."
    link: /api/exports
    linkText: API
---

::: warning Work in progress
The library is being designed: the features above are what it is built to do, not what the
published package does yet. See [Why @alexify/messenger?](/guide/why) for the plan.
:::
