import { ensureCloudbaseCollections, ensurePlayerState, initCloudbaseDb, upsertProfile } from '../server/cloudbase-db.mjs';
import { loadEnv, validateCloudbaseEnv } from './cloudbase-env.mjs';

async function main() {
  const env = loadEnv();
  const validation = validateCloudbaseEnv(env);
  if (!validation.ok) {
    console.error(`[cloudbase:test-login] ${validation.message}`);
    process.exit(1);
  }
  if (!initCloudbaseDb(env)) {
    console.error('[cloudbase:test-login] CloudBase 初始化失败。');
    process.exit(1);
  }

  await ensureCloudbaseCollections();

  const loginId = `douyin:test-login-${Date.now()}`;
  const firstProfile = await upsertProfile({
    douyinOpenId: loginId,
    nickname: '登录写入测试',
    avatarUrl: null,
    isBot: false
  });
  const firstState = await ensurePlayerState(firstProfile.id);

  const secondProfile = await upsertProfile({
    douyinOpenId: loginId,
    nickname: '登录写入测试-更新',
    avatarUrl: '/assets/players/generated/saka.png',
    isBot: false
  });
  const secondState = await ensurePlayerState(secondProfile.id);

  if (firstProfile.id !== secondProfile.id) {
    throw new Error('同一个 douyin_open_id 二次登录没有命中同一用户。');
  }
  if (secondProfile.nickname !== '登录写入测试-更新') {
    throw new Error('二次登录没有更新 profile.nickname。');
  }
  if (secondState.user_id !== firstProfile.id) {
    throw new Error('player_state.user_id 和 profile.id 不一致。');
  }

  console.info('[cloudbase:test-login] ok');
  console.info(`[cloudbase:test-login] userId=${secondProfile.id}`);
  console.info(`[cloudbase:test-login] coins=${Number(secondState.coins ?? firstState.coins ?? 0)}`);
  console.info(`[cloudbase:test-login] energy=${Number(secondState.energy ?? firstState.energy ?? 0)}`);
}

main().catch((error) => {
  console.error('[cloudbase:test-login] failed', error);
  process.exit(1);
});
