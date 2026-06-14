export interface PlatformUser {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  loginCode?: string;
}

export interface PlatformApi {
  name: 'web' | 'douyin' | 'wechat';
  login(): Promise<PlatformUser>;
  share(payload: { title: string; imageUrl?: string }): Promise<void>;
  navigateToSidebarScene(): Promise<{ ok: boolean; message?: string }>;
  addDesktopShortcut(): Promise<{ ok: boolean; message?: string }>;
  showRewardVideoAd(scene: string): Promise<boolean>;
  checkAntiAddiction(): Promise<{ allowed: boolean; reason?: string }>;
  purchaseGameItem(payload: GameItemPurchase): Promise<{ ok: boolean; message?: string }>;
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
  canIUse?: (schema: string) => boolean;
  getSystemInfoSync?: () => { platform?: string };
  navigateToScene?: (options: {
    scene: string;
    success?: () => void;
    fail?: (error: { errMsg?: string }) => void;
    complete?: () => void;
  }) => void;
  addShortcut?: (options: {
    success?: () => void;
    fail?: (error: { errMsg?: string }) => void;
    complete?: () => void;
  }) => void;
  requestGamePayment?: (options: Record<string, unknown>) => void;
  openAwemeCustomerService?: (options: Record<string, unknown>) => void;
};

export interface GameItemPurchase {
  id: string;
  title: string;
  priceCents: number;
  productId?: string;
  quantity?: number;
  extra?: Record<string, unknown>;
}

const douyinFallbackUser = (loginCode?: string): PlatformUser => ({
  userId: loginCode ? `douyin-code:${loginCode}` : 'douyin-user',
  nickname: '抖音玩家'
});

export class DouyinPlatform implements PlatformApi {
  name: PlatformApi['name'] = 'douyin';

  async login() {
    const tt = (globalThis as typeof globalThis & { tt?: DouyinTtApi }).tt;
    if (!tt) return douyinFallbackUser();

    return new Promise<PlatformUser>((resolve) => {
      let loginCode: string | undefined;
      const finish = (user: PlatformUser) => resolve({ ...user, loginCode });
      const readProfile = () => {
        if (tt.getUserProfile) {
          tt.getUserProfile({
            success: (res) => {
              const info = res.userInfo;
              finish({
                userId: info?.openId ?? (loginCode ? `douyin-code:${loginCode}` : 'douyin-user'),
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
          finish(douyinFallbackUser(loginCode));
          return;
        }
        tt.getUserInfo({
          withCredentials: true,
          success: (res) => {
            const info = res.userInfo;
            finish({
              userId: info?.openId ?? (loginCode ? `douyin-code:${loginCode}` : 'douyin-user'),
              nickname: info?.nickName ?? '抖音玩家',
              avatarUrl: info?.avatarUrl
            });
          },
          fail: () => finish(douyinFallbackUser(loginCode))
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
          success: (res) => {
            loginCode = res.code;
            requestProfile();
          },
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

  async navigateToSidebarScene(): Promise<{ ok: boolean; message?: string }> {
    const tt = (globalThis as typeof globalThis & { tt?: DouyinTtApi }).tt;
    if (!tt) return { ok: false, message: '当前不在抖音小游戏环境' };

    if (!tt.navigateToScene) {
      return { ok: false, message: '当前抖音版本暂不支持侧边栏复访' };
    }

    return new Promise((resolve) => {
      tt.navigateToScene?.({
        scene: 'sidebar',
        success: () => resolve({ ok: true }),
        fail: (error) => resolve({ ok: false, message: error?.errMsg ?? '打开侧边栏失败' })
      });
    });
  }

  async addDesktopShortcut(): Promise<{ ok: boolean; message?: string }> {
    const tt = (globalThis as typeof globalThis & { tt?: DouyinTtApi }).tt;
    if (!tt) return { ok: false, message: '当前不在抖音小游戏环境' };

    if (!tt.addShortcut) {
      return { ok: false, message: '当前抖音版本暂不支持添加到桌面' };
    }

    return new Promise((resolve) => {
      tt.addShortcut?.({
        success: () => resolve({ ok: true }),
        fail: (error) => resolve({ ok: false, message: error?.errMsg ?? '添加到桌面失败' })
      });
    });
  }

  async showRewardVideoAd() {
    return true;
  }

  async checkAntiAddiction() {
    return { allowed: true };
  }

  async purchaseGameItem(payload: GameItemPurchase): Promise<{ ok: boolean; message?: string }> {
    const tt = (globalThis as typeof globalThis & { tt?: DouyinTtApi }).tt;
    if (!tt) return { ok: false, message: '当前不在抖音小游戏环境' };

    const platform = tt.getSystemInfoSync?.().platform?.toLowerCase() ?? 'android';
    const isIos = platform.includes('ios');
    const apiName = isIos ? 'openAwemeCustomerService' : 'requestGamePayment';
    const supported = tt.canIUse?.(`${apiName}.object.goodType`) ?? !!tt[apiName];
    if (!supported || !tt[apiName]) {
      return { ok: false, message: '当前抖音版本暂不支持道具直购' };
    }

    return new Promise<{ ok: boolean; message?: string }>((resolve) => {
      const orderId = `${payload.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const options = {
        mode: 'game',
        env: '0',
        currencyType: 'CNY',
        platform: isIos ? 'ios' : 'android',
        goodType: 2,
        orderAmount: payload.priceCents,
        goodName: payload.title,
        zoneId: '1',
        customId: orderId,
        extraInfo: JSON.stringify({
          productId: payload.productId ?? payload.id,
          title: payload.title,
          priceCents: payload.priceCents,
          quantity: payload.quantity ?? 1,
          ...payload.extra
        }),
        success: () => resolve({ ok: true }),
        fail: (error: { errMsg?: string }) => {
          resolve({ ok: false, message: error?.errMsg ?? '支付失败' });
        }
      };
      tt[apiName]?.(options);
    });
  }
}

export class WebPlatform implements PlatformApi {
  name: PlatformApi['name'] = 'web';

  async login() {
    return {
      userId: this.webUserId(),
      nickname: '本地测试经理',
      avatarUrl: '/assets/players/generated/saka.png'
    };
  }

  private webUserId() {
    const key = 'soccer-dy3-web-user-id';
    try {
      const params = new URLSearchParams(globalThis.location?.search ?? '');
      const queryUser = params.get('testUser');
      if (queryUser) {
        globalThis.localStorage?.setItem(key, queryUser);
        return queryUser;
      }
      const saved = globalThis.localStorage?.getItem(key);
      if (saved) return saved;
      const next = 'web-local-001';
      globalThis.localStorage?.setItem(key, next);
      return next;
    } catch {
      return 'web-local-001';
    }
  }

  async share() {
    console.info('[platform:web] share mocked');
  }

  async navigateToSidebarScene() {
    console.info('[platform:web] navigateToScene sidebar mocked');
    return { ok: true, message: 'Web 调试环境已模拟侧边栏跳转' };
  }

  async addDesktopShortcut() {
    console.info('[platform:web] addShortcut mocked');
    return { ok: true, message: 'Web 调试环境已模拟添加到桌面' };
  }

  async showRewardVideoAd() {
    return true;
  }

  async checkAntiAddiction() {
    return { allowed: true };
  }

  async purchaseGameItem(payload: GameItemPurchase) {
    console.info('[platform:web] purchase mocked', payload);
    return { ok: true };
  }
}
