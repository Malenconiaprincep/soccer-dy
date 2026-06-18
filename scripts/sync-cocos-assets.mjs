import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const files = [
  'loading-bg.png',
  'home-bg.jpg',
  'page-bg.jpg',
  'audio/button-click.wav',
  'ui/start.png',
  'ui/start-v2.png',
  'ui/hero.png',
  'ui/top-button.png',
  'ui/top-button-v2.png',
  'ui/avatar-bg.png',
  'ui/back.png',
  'ui/headertitle.png',
  'ui/football-backgrond.png',
  'ui/button-ready.png',
  'ui/players-bg.png',
  'ui/bottom-menu.png',
  'ui/buttons.png',
  'ui/gameevents.png',
  'ui/matchtitle.png',
  'ui/playerscore.png'
];

const sourceRoot = resolve('public/assets');
const targetRoot = resolve('cocos-client/assets/resources');
const playerFiles = (await readdir(resolve(sourceRoot, 'players/generated')))
  .filter((name) => name.endsWith('.png'))
  .map((name) => `players/generated/${name}`);
files.push(...playerFiles);

for (const file of files) {
  const target = resolve(targetRoot, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, file), target);
}

console.info(`[cocos] synced ${files.length} core assets to ${targetRoot}`);
