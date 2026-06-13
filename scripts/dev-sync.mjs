import { spawn } from 'node:child_process';

const DEV_PORT = 9527;
const args = new Set(process.argv.slice(2));
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function run(script, label, extraArgs = []) {
  const args = extraArgs.length ? ['run', script, '--', ...extraArgs] : ['run', script];
  const child = spawn(npmCmd, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${label}] stopped (${signal})`);
      return;
    }
    console.log(`[${label}] exited with code ${code ?? 0}`);
    shutdown(code ?? 0);
  });

  return child;
}

function shutdown(code = 0) {
  children.forEach((child) => {
    if (!child.killed) child.kill('SIGTERM');
  });
  setTimeout(() => process.exit(code), 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[dev-sync] Web: http://localhost:${DEV_PORT}`);
console.log('[dev-sync] Douyin output: ./douyin-game (refresh in Douyin DevTools after rebuild)');

run('dev', 'web');
if (args.has('--douyin-debug')) {
  run('debug:douyin:watch', 'douyin-debug');
}
