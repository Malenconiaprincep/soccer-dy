import { ensureCloudbaseCollections, ensurePlayerState, initCloudbaseDb, upsertProfile } from '../server/cloudbase-db.mjs';
import { loadEnv, validateCloudbaseEnv } from './cloudbase-env.mjs';

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

async function main() {
  const env = loadEnv();
  const validation = validateCloudbaseEnv(env);
  if (!validation.ok) {
    console.error(`[cloudbase:setup] ${validation.message}`);
    process.exit(1);
  }
  if (!initCloudbaseDb(env)) {
    console.error('[cloudbase:setup] CloudBase 初始化失败。');
    process.exit(1);
  }

  const collections = await ensureCloudbaseCollections();
  for (const item of collections) {
    console.info(`[cloudbase:setup] ${item.name}: ${item.status}`);
  }

  for (const [douyinOpenId, nickname] of BOTS) {
    await upsertProfile({ douyinOpenId, nickname, avatarUrl: null, isBot: true });
    console.info(`[cloudbase:setup] bot ready: ${nickname}`);
  }

  const localProfile = await upsertProfile({
    douyinOpenId: 'douyin:web-local-001',
    nickname: '本地测试经理',
    avatarUrl: '/assets/players/generated/saka.png',
    isBot: false
  });
  await ensurePlayerState(localProfile.id);
  console.info('[cloudbase:setup] local test profile ready');
}

main().catch((error) => {
  console.error('[cloudbase:setup] failed', error);
  process.exit(1);
});
