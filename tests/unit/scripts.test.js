const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pkg = require('../../package.json');

const ROOT = path.join(__dirname, '../..');

const run = (script, args) =>
  spawnSync(process.execPath, [path.join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8' });

test('Scripts: a subpath is measured on top of the root entry', async () => {
  const { subpathsOf, extrasOf } = require('../../scripts/size.js');
  const subpaths = subpathsOf({
    '.': { types: './index.d.ts', default: './index.js' },
    './twilio': { types: './src/twilio/index.d.ts', default: './src/twilio/index.js' },
    './telegram': { types: './src/telegram/index.d.ts', default: './src/telegram/index.js' },
  });
  assert.deepStrictEqual(
    subpaths.map(({ label, subpath, key }) => [label, subpath, key]),
    [
      ['Twilio (./twilio) on top of the Node entry', './src/twilio/index.js', './twilio'],
      ['Telegram (./telegram) on top of the Node entry', './src/telegram/index.js', './telegram'],
    ],
  );
  // A fake measure: a size per subpath in the bundle, over a core of 1000.
  const sizes = { './src/twilio/index.js': 400, './src/telegram/index.js': 70 };
  const size = (entry, list) => {
    let total = 1000;
    for (const subpath of list) total += sizes[subpath];
    return { label: entry.label, raw: total * 3, min: total * 2, gzip: total };
  };
  const core = { label: 'core', raw: 3000, min: 2000, gzip: 1000 };
  const extras = await extrasOf(core, size, subpaths);
  assert.deepStrictEqual(
    extras.map(({ gzip, min, raw, key }) => [gzip, min, raw, key]),
    [
      [400, 800, 1200, './twilio'],
      [70, 140, 210, './telegram'],
    ],
  );
});

test('Scripts: every entry of the exports map has a size budget, and only those', () => {
  const { budgetProblems } = require('../../scripts/size.js');
  assert.deepStrictEqual(
    budgetProblems(require('../../scripts/size-budgets.json'), pkg.exports),
    [],
  );
  const exportsMap = { '.': {}, './twilio': {}, './telegram': {} };
  assert.deepStrictEqual(budgetProblems({ '.': 8, './twilio': 0, './viber': 1 }, exportsMap), [
    './telegram has no budget',
    './twilio needs a budget of a positive number of kilobytes',
    './viber has a budget but is not in the exports map',
  ]);
  assert.deepStrictEqual(
    budgetProblems({ '.': '8', './twilio': 1, './telegram': Infinity }, exportsMap),
    [
      '. needs a budget of a positive number of kilobytes',
      './telegram needs a budget of a positive number of kilobytes',
    ],
  );
});

test('Scripts: size reports the entries and, with --check, enforces their budgets', (t) => {
  const { SUBPATHS } = require('../../scripts/size.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'messenger-size-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const write = (name, budgets) => {
    const file = path.join(directory, name);
    fs.writeFileSync(file, JSON.stringify(budgets));
    return file;
  };
  const everyEntry = (limit) => {
    const budgets = {};
    for (const key of Object.keys(pkg.exports)) budgets[key] = limit;
    return budgets;
  };

  const ok = run('scripts/size.js', ['--check', '--budgets', write('ok.json', everyEntry(100))]);
  assert.strictEqual(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /\| Node entry \(index\.js\) \|/);
  for (const { label } of SUBPATHS) assert.ok(ok.stdout.includes(`| ${label} |`), label);

  // Without --check the budgets are not read.
  const report = run('scripts/size.js', ['--budgets', path.join(directory, 'none.json')]);
  assert.strictEqual(report.status, 0, report.stderr);

  const over = run('scripts/size.js', [
    '--check',
    '--budgets',
    write('over.json', everyEntry(0.001)),
  ]);
  assert.strictEqual(over.status, 1);
  assert.match(over.stderr, /Bundle budget exceeded: Node entry/);
  for (const { label } of SUBPATHS) {
    assert.ok(over.stderr.includes(`Bundle budget exceeded: ${label}`), label);
  }

  const { '.': root, ...missing } = everyEntry(100);
  const unbudgeted = run('scripts/size.js', [
    '--check',
    '--budgets',
    write('missing.json', missing),
  ]);
  assert.strictEqual(unbudgeted.status, 1);
  assert.match(unbudgeted.stderr, /missing\.json: \. has no budget/);
  assert.strictEqual(unbudgeted.stdout, '');
});

test('Scripts: check-pack wants every file of the exports map and nothing else', () => {
  const { packProblems } = require('../../scripts/check-pack.js');
  const manifest = {
    main: 'index.js',
    types: 'index.d.ts',
    exports: {
      '.': { types: './index.d.ts', default: './index.js' },
      './twilio': { types: './src/twilio/index.d.ts', default: './src/twilio/index.js' },
    },
  };
  const complete = [
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'SECURITY.md',
    'index.js',
    'index.d.ts',
    'src/twilio/index.js',
    'src/twilio/index.d.ts',
    'src/twilio/twilio-transport.js',
  ];
  assert.deepStrictEqual(packProblems(complete, manifest), []);
  const broken = complete.filter((file) => file !== 'src/twilio/index.d.ts' && file !== 'LICENSE');
  broken.push(
    'tests/unit/twilio.test.js',
    'docs/index.md',
    'scripts/size.js',
    'src/twilio/notes.md',
  );
  assert.deepStrictEqual(packProblems(broken, manifest), [
    'LICENSE is missing from the tarball',
    'src/twilio/index.d.ts is missing from the tarball',
    'tests/unit/twilio.test.js should not be in the tarball',
    'docs/index.md should not be in the tarball',
    'scripts/size.js should not be in the tarball',
    'src/twilio/notes.md should not be in the tarball',
  ]);
});

test('Scripts: check-dts compiles the types of every entry of the exports map', () => {
  const { typesOf } = require('../../scripts/check-dts.js');
  assert.deepStrictEqual(
    typesOf(pkg.exports),
    Object.values(pkg.exports).map((entry) => entry.types),
  );
  assert.strictEqual(typesOf(pkg.exports)[0], './index.d.ts');
});
