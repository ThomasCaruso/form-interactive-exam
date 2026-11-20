const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const source = fs.realpathSync(path.resolve(__dirname, '..'));
const repository = path.dirname(source);
const deployment = path.join(repository, 'app');
if (!fs.existsSync(path.join(repository, '.nojekyll'))) {
  throw new Error('Build from source/ inside the FORM Pages repository.');
}

const env = Object.fromEntries(Object.entries(process.env)
  .filter(([name]) => !/^EXPO_PUBLIC_/i.test(name)));
env.EXPO_NO_DOTENV = '1';
env.EXPO_PUBLIC_SIGN_IN = 'off';

const staging = fs.mkdtempSync(path.join(repository, '.pages-build-'));
const output = path.join(staging, 'export');
const backup = path.join(staging, 'previous');
const fallback = path.join(staging, '404.html');
let preserveStaging = false;
try {
  const result = spawnSync(process.execPath, [
    require.resolve('expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', output,
  ], { cwd: source, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Expo web export failed.');

  const entry = path.join(output, 'index.html');
  const appRoutes = path.join(source, 'app');
  for (const file of fs.readdirSync(appRoutes, { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith('.tsx') || ['_layout.tsx', 'index.tsx'].includes(file.name)) continue;
    const route = path.relative(appRoutes, path.join(file.parentPath, file.name)).slice(0, -4)
      .split(path.sep).filter(segment => !segment.startsWith('('));
    const directory = path.join(output, ...route);
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(entry, path.join(directory, 'index.html'));
  }
  fs.copyFileSync(entry, fallback);
  if (fs.existsSync(deployment)) fs.renameSync(deployment, backup);
  preserveStaging = fs.existsSync(backup);
  let installed = false;
  try {
    fs.renameSync(output, deployment);
    installed = true;
    fs.renameSync(fallback, path.join(repository, '404.html'));
  } catch (error) {
    if (installed) fs.renameSync(deployment, output);
    if (preserveStaging) fs.renameSync(backup, deployment);
    preserveStaging = false;
    throw error;
  }
  preserveStaging = false;
} finally {
  if (preserveStaging) {
    console.error('Previous export retained at ' + backup);
  } else if (fs.realpathSync(staging) === staging && path.dirname(staging) === repository) {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
