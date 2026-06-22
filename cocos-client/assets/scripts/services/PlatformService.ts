export interface PlatformAuth {
  platform: 'web' | 'douyin';
  platformUserId: string;
  nickname: string;
  avatarUrl?: string;
  loginCode?: string;
}

type DouyinTtApi = {
  login?: (options: {
    success?: (res: { code?: string }) => void;
    fail?: () => void;
  }) => void;
  getUserProfile?: (options: {
    success?: (res: { userInfo?: { nickName?: string; avatarUrl?: string; openId?: string } }) => void;
    fail?: () => void;
  }) => void;
  getUserInfo?: (options: {
    withCredentials?: boolean;
    success?: (res: { userInfo?: { nickName?: string; avatarUrl?: string; openId?: string } }) => void;
    fail?: () => void;
  }) => void;
};

const PLATFORM_USER_KEY = 'soccer.cocos.platform-user-id';

export function isDouyinRuntime(): boolean {
  return !!(globalThis as { tt?: DouyinTtApi }).tt?.login;
}

export async function loginPlatform(fallback: { platformUserId: string; nickname: string }): Promise<PlatformAuth> {
  const tt = (globalThis as { tt?: DouyinTtApi }).tt;
  if (tt?.login) return douyinLogin(tt, fallback);
  return {
    platform: 'web',
    platformUserId: fallback.platformUserId,
    nickname: fallback.nickname
  };
}

async function douyinLogin(tt: DouyinTtApi, fallback: { platformUserId: string; nickname: string }): Promise<PlatformAuth> {
  const loginCode = await new Promise<string | undefined>((resolve) => {
    tt.login?.({
      success: (res) => resolve(res.code),
      fail: () => resolve(undefined)
    });
  });

  const profile = await new Promise<{ nickName?: string; avatarUrl?: string; openId?: string } | undefined>((resolve) => {
    if (tt.getUserProfile) {
      tt.getUserProfile({
        success: (res) => resolve(res.userInfo),
        fail: () => resolve(undefined)
      });
      return;
    }
    if (!tt.getUserInfo) {
      resolve(undefined);
      return;
    }
    tt.getUserInfo({
      withCredentials: true,
      success: (res) => resolve(res.userInfo),
      fail: () => resolve(undefined)
    });
  });

  return {
    platform: 'douyin',
    platformUserId: profile?.openId ?? (loginCode ? `douyin-code:${loginCode}` : fallback.platformUserId),
    nickname: profile?.nickName ?? '抖音玩家',
    avatarUrl: profile?.avatarUrl,
    loginCode
  };
}

export function readPreviewPlatformUserId(): string | undefined {
  if (isDouyinRuntime()) return undefined;
  try {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const fromQuery = params.get('testUser');
    if (fromQuery) {
      globalThis.localStorage?.setItem(PLATFORM_USER_KEY, fromQuery);
      return fromQuery;
    }
    return globalThis.localStorage?.getItem(PLATFORM_USER_KEY)
      ?? globalThis.localStorage?.getItem('soccer.cocos.preview-user')
      ?? undefined;
  } catch {
    return undefined;
  }
}

export function rememberPlatformUserId(platformUserId: string): void {
  try {
    globalThis.localStorage?.setItem(PLATFORM_USER_KEY, platformUserId);
  } catch {
    /* preview only */
  }
}
