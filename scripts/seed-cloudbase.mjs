import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initCloudbaseDb, upsertProfile, ensurePlayerState } from '../server/cloudbase-db.mjs';

const BOTS = [
  ['bot-spark-001', '星河前锋'],
  ['bot-spark-002', '青柠队长'],
  ['bot-spark-003', '风暴经理人'],
  ['bot-spark-004', '南看台小王'],
  ['bot-spark-005', '凌空抽射'],
  ['bot-spark-006', '今晚补时绝杀'],
  ['bot-spark-007', '蓝焰十一人'],
  ['bot-spark-008', '门线救险']
];

function loadEnv() {
  const values = { ...process.env };
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      if (values[key] == null) values[key] = value;
    }
  }
  return values;
}

async function main() {
  const env = loadEnv();
  if (!initCloudbaseDb(env)) {
    console.error('[seed] 请配置 CLOUDBASE_ENV_ID、TENCENTCLOUD_SECRETID、TENCENTCLOUD_SECRETKEY');
    process.exit(1);
  }

  for (const [douyinOpenId, nickname] of BOTS) {
    await upsertProfile({ douyinOpenId, nickname, avatarUrl: null, isBot: true });
    console.info(`[seed] bot ${nickname}`);
  }

  const localProfile = await upsertProfile({
    douyinOpenId: 'douyin:web-local-001',
    nickname: '本地测试经理',
    avatarUrl: '/assets/players/generated/saka.png',
    isBot: false
  });
  await ensurePlayerState(localProfile.id);
  console.info('[seed] local test profile ready');
}

main().catch((error) => {
  console.error('[seed] failed', error);
  process.exit(1);
});
