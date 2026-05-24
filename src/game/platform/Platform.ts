export interface PlatformUser {
  userId: string;
  nickname: string;
  avatarUrl?: string;
}

export interface PlatformApi {
  name: 'web' | 'douyin' | 'wechat';
  login(): Promise<PlatformUser>;
  share(payload: { title: string; imageUrl?: string }): Promise<void>;
  showRewardVideoAd(scene: string): Promise<boolean>;
  checkAntiAddiction(): Promise<{ allowed: boolean; reason?: string }>;
}

type DouyinTtApi = {
  login?: (options: {
    success?: (res: { code?: string }) => void;
    fail?: (error: unknown) => void;
  }) => void;
  authorize?: (options: {
    scope?: string;
    success?: () => void;
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

const douyinFallbackUser = (): PlatformUser => ({
  userId: 'douyin-user',
  nickname: '抖音玩家'
});

export class DouyinPlatform implements PlatformApi {
  name: PlatformApi['name'] = 'douyin';

  async login() {
    const tt = (globalThis as typeof globalThis & { tt?: DouyinTtApi }).tt;
    if (!tt) return douyinFallbackUser();

    return new Promise<PlatformUser>((resolve) => {
      const finish = (user: PlatformUser) => resolve(user);
      const readProfile = () => {
        if (tt.getUserProfile) {
          tt.getUserProfile({
            success: (res) => {
              const info = res.userInfo;
              finish({
                userId: info?.openId ?? 'douyin-user',
                nickname: info?.nickName ?? '抖音玩家',
                avatarUrl: info?.avatarUrl
              });
            },
            fail: () => readLegacyUserInfo()
          });
          return;
        }
        readLegacyUserInfo();
      };
      const readLegacyUserInfo = () => {
        if (!tt.getUserInfo) {
          finish(douyinFallbackUser());
          return;
        }
        tt.getUserInfo({
          withCredentials: true,
          success: (res) => {
            const info = res.userInfo;
            finish({
              userId: info?.openId ?? 'douyin-user',
              nickname: info?.nickName ?? '抖音玩家',
              avatarUrl: info?.avatarUrl
            });
          },
          fail: () => finish(douyinFallbackUser())
        });
      };
      const requestProfile = () => {
        if (tt.authorize) {
          tt.authorize({
            scope: 'scope.userInfo',
            success: readProfile,
            fail: readProfile
          });
          return;
        }
        readProfile();
      };

      if (tt.login) {
        tt.login({
          success: requestProfile,
          fail: requestProfile
        });
        return;
      }
      requestProfile();
    });
  }

  async share() {
    console.info('[platform:douyin] share mocked');
  }

  async showRewardVideoAd() {
    return true;
  }

  async checkAntiAddiction() {
    return { allowed: true };
  }
}

export class WebPlatform implements PlatformApi {
  name: PlatformApi['name'] = 'web';

  async login() {
    return {
      userId: 'local-user',
      nickname: '本地经理',
      avatarUrl: '/assets/players/generated/saka.png'
    };
  }

  async share() {
    console.info('[platform:web] share mocked');
  }

  async showRewardVideoAd() {
    return true;
  }

  async checkAntiAddiction() {
    return { allowed: true };
  }
}
