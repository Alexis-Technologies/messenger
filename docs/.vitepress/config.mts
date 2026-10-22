import { createRequire } from 'node:module';
import { defineConfig } from 'vitepress';

// The nav version label is read from package.json at config load, so a release
// needs no hand-edit here.
const { version } = createRequire(import.meta.url)('../../package.json') as { version: string };

const ogTitle = '@alexify/messenger — chat apps, SMS and push for Node.js';
const ogDescription =
  'Zero-dependency messaging for Node.js, Bun and Deno: SMS, RCS, WhatsApp, Messenger, ' +
  'Instagram, Telegram, Viber, Slack, Discord, Teams, Google Chat and push through their HTTP ' +
  'APIs, with a reliability layer on top — a persistent queue, an audit of message states, one ' +
  'model of delivery receipts, idempotency and fallback between channels.';
const repo = 'https://github.com/Alexis-Technologies/messenger';
const base = '/';
const hostname = 'https://messengerat.vercel.app/';
const ogImage = `${hostname}logo.png`;

const keywords = [
  '@alexify/messenger',
  'node.js sms',
  'whatsapp cloud api',
  'telegram bot api',
  'viber',
  'slack api',
  'discord webhooks',
  'microsoft teams',
  'google chat',
  'facebook messenger api',
  'rcs business messaging',
  'push notifications',
  'twilio alternative',
  'multichannel messaging',
  'sms fallback',
  'delivery receipts',
  'message outbox',
  'message audit log',
  'otp delivery',
  'zero dependency messaging',
].join(', ');

// schema.org structured data: helps search and AI engines read the site as a
// software package rather than plain text.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: '@alexify/messenger',
  alternateName: 'messenger',
  description: ogDescription,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Node.js >= 22, Bun, Deno',
  url: hostname,
  downloadUrl: 'https://www.npmjs.com/package/@alexify/messenger',
  codeRepository: repo,
  license: 'https://opensource.org/licenses/MIT',
  keywords,
  author: { '@type': 'Organization', name: 'Alexis Technologies' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: '@alexify/messenger',
  titleTemplate: ':title — messenger',
  description: ogDescription,
  lang: 'en-US',
  base,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['link', { rel: 'icon', type: 'image/png', href: `${base}favicon.png` }],
    ['meta', { name: 'theme-color', content: '#6366F1' }],
    ['meta', { name: 'author', content: 'Alexis Technologies' }],
    ['meta', { name: 'keywords', content: keywords }],
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: '@alexify/messenger' }],
    ['meta', { property: 'og:title', content: ogTitle }],
    ['meta', { property: 'og:description', content: ogDescription }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: ogTitle }],
    ['meta', { name: 'twitter:description', content: ogDescription }],
    ['meta', { name: 'twitter:image', content: ogImage }],
    ['script', { type: 'application/ld+json' }, JSON.stringify(jsonLd)],
  ],

  // Per-page canonical + og:url for clean SEO indexing
  transformPageData(pageData) {
    const path = pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '');
    const canonical = `${hostname}${path}`;
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:url', content: canonical }],
    );
  },

  themeConfig: {
    logo: { light: '/logo-mark.svg', dark: '/logo-mark-dark.svg', alt: 'messenger' },

    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'API', link: '/api/exports', activeMatch: '/api/' },
      {
        text: `v${version}`,
        items: [
          { text: 'Changelog', link: `${repo}/blob/main/CHANGELOG.md` },
          { text: 'npm', link: 'https://www.npmjs.com/package/@alexify/messenger' },
          { text: 'Releases', link: `${repo}/releases` },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Why @alexify/messenger?', link: '/guide/why' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Compared with alternatives', link: '/guide/comparison' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API',
          items: [{ text: 'Exports', link: '/api/exports' }],
        },
      ],
    },

    search: { provider: 'local' },

    socialLinks: [{ icon: 'github', link: repo }],

    editLink: {
      pattern: `${repo}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Alexis Technologies',
    },

    docFooter: {
      prev: 'Previous page',
      next: 'Next page',
    },
  },
});
