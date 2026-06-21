import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve('cocos-client');
const resourcesRoot = resolve(projectRoot, 'assets/resources');
const buildRoot = resolve(projectRoot, 'build/bytedance-mini-game');
const failures = [];

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function directorySize(path) {
  const entries = await readdir(path, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    total += entry.isDirectory() ? await directorySize(child) : (await stat(child)).size;
  }
  return total;
}

const dataSource = await readFile(resolve(projectRoot, 'assets/scripts/domain/data.ts'), 'utf8');
const portraits = [...dataSource.matchAll(/['"]\/assets\/(players\/generated\/[^'"]+\.png)['"]/g)].map((match) => match[1]);
for (const portrait of new Set(portraits)) {
  if (!await exists(resolve(resourcesRoot, portrait))) failures.push(`缺少球员头像: ${portrait}`);
}

const requiredAudio = ['bgm', 'tap', 'confirm', 'select', 'reveal', 'kickoff', 'goal', 'danger', 'save', 'card', 'reward', 'win', 'lose', 'whistle'];
for (const name of requiredAudio) {
  if (!await exists(resolve(resourcesRoot, `audio/${name}.wav`))) failures.push(`缺少音频: audio/${name}.wav`);
}

if (await exists(resolve(resourcesRoot, 'players/generated/extra'))) failures.push('运行时资源仍包含 players/generated/extra');

const resourcesBytes = await directorySize(resourcesRoot);
const resourcesMb = resourcesBytes / 1024 / 1024;
if (resourcesMb > 48) failures.push(`resources 仍过大: ${resourcesMb.toFixed(1)}MB（上限 48MB）`);

const gameConfigPath = resolve(projectRoot, 'build/bytedance-mini-game/game.json');
if (await exists(gameConfigPath)) {
  const gameConfig = JSON.parse(await readFile(gameConfigPath, 'utf8'));
  if (gameConfig.deviceOrientation !== 'portrait') failures.push('抖音构建不是竖屏模式');
}

const buildEntry = resolve(buildRoot, 'game.js');
if (!await exists(buildEntry)) {
  failures.push('缺少抖音小游戏构建产物');
} else {
  const sourceFiles = [
    resolve(projectRoot, 'assets/scripts/runtime/GameRoot.ts'),
    resolve(projectRoot, 'assets/scripts/runtime/GameAudio.ts'),
    resolve(projectRoot, 'assets/scripts/domain/GameState.ts')
  ];
  const latestSourceMtime = Math.max(...await Promise.all(sourceFiles.map(async (path) => (await stat(path)).mtimeMs)));
  const buildMtime = (await stat(buildEntry)).mtimeMs;
  if (buildMtime < latestSourceMtime) failures.push('抖音构建早于当前源码，请在 Creator 中重新构建');
  const buildMb = await directorySize(buildRoot) / 1024 / 1024;
  if (buildMb > 50) failures.push(`抖音构建包体过大: ${buildMb.toFixed(1)}MB（目标上限 50MB）`);
}

if (failures.length) {
  failures.forEach((failure) => console.error(`[release] ${failure}`));
  process.exitCode = 1;
} else {
  console.info(`[release] Cocos 资源校验通过：${resourcesMb.toFixed(1)}MB，${new Set(portraits).size} 张动态球员头像`);
}
