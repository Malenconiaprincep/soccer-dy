import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const files = [
  'loading-bg.png',
  'home-bg.jpg',
  'page-bg.jpg',
  'audio/button-click.wav',
  'audio/tap.wav',
  'audio/confirm.wav',
  'audio/select.wav',
  'audio/reveal.wav',
  'audio/kickoff.wav',
  'audio/goal.wav',
  'audio/danger.wav',
  'audio/save.wav',
  'audio/card.wav',
  'audio/reward.wav',
  'audio/win.wav',
  'audio/lose.wav',
  'audio/whistle.wav',
  'audio/bgm.wav',
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
  'ui/replace_player.png',
  'ui/gamereadybg.png',
  'ui/readybutton.png',
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
  'ui/sevenday/accpet-end.png',
  'ui/result/team-home.png',
  'ui/result/team-away.png',
  'ui/result/stats-panel.png',
  'ui/result/timeline-panel.png',
  'ui/result/reward-panel.png',
  'ui/result/primary-button.png',
  'ui/result/event-ball.png',
  'ui/result/event-save.png',
  'ui/result/event-whistle.png',
  'ui/result/reward-coin.png',
  'ui/result/reward-energy.png'
];

const sourceRoot = resolve('public/assets');
const targetRoot = resolve('cocos-client/assets/resources');
const collectTopLevelPngFiles = async (relativeDir) => {
  const entries = await readdir(resolve(sourceRoot, relativeDir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => `${relativeDir}/${entry.name}`);
};
const playerFiles = await collectTopLevelPngFiles('players/generated');
files.push(...playerFiles);

// `extra` contains the source portrait library, not runtime players. Keeping a
// stale copy here silently adds tens of megabytes to every mini-game build.
await rm(resolve(targetRoot, 'players/generated/extra'), { recursive: true, force: true });

for (const file of files) {
  const target = resolve(targetRoot, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, file), target);
}

console.info(`[cocos] synced ${files.length} core assets to ${targetRoot}`);
