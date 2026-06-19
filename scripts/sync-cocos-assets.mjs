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
  'ui/card-guess1.png',
  'ui/cardbg.png',
  'ui/gameevents.png',
  'ui/matchtitle.png',
  'ui/vs.png',
  'ui/vs-squard.png',
  'ui/squard-qc.png',
  'ui/playercore.png',
  'ui/playbutton.png',
  'ui/playerscore.png',
  'ui/qiandao.png',
  'ui/toolstitle.png',
  'ui/everyday-active.png',
  'ui/gift.png',
  'ui/sevenday/giftbg.png',
  'ui/sevenday/flash.png',
  'ui/sevenday/diamond.png',
  'ui/sevenday/ticket.png',
  'ui/sevenday/accpet.png',
  'ui/sevenday/accpet-end.png'
];

const sourceRoot = resolve('public/assets');
const targetRoot = resolve('cocos-client/assets/resources');
const collectPngFiles = async (relativeDir) => {
  const entries = await readdir(resolve(sourceRoot, relativeDir), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return collectPngFiles(relativePath);
    return entry.isFile() && entry.name.endsWith('.png') ? [relativePath] : [];
  }));
  return nested.flat();
};
const playerFiles = await collectPngFiles('players/generated');
files.push(...playerFiles);

for (const file of files) {
  const target = resolve(targetRoot, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, file), target);
}

console.info(`[cocos] synced ${files.length} core assets to ${targetRoot}`);
