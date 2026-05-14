import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const target = process.argv[2];
if (target !== 'wechat' && target !== 'douyin') {
  console.error('Usage: node scripts/copy-game-json.mjs <wechat|douyin>');
  process.exit(1);
}
const src = path.join(root, 'templates', `game.${target}.json`);
const dest = path.join(root, 'build', target, 'game.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('copied', dest);
