export interface PlatformApi {
  name: 'web' | 'douyin' | 'wechat';
  login(): Promise<{ userId: string; nickname: string }>;
  share(payload: { title: string; imageUrl?: string }): Promise<void>;
  showRewardVideoAd(scene: string): Promise<boolean>;
  checkAntiAddiction(): Promise<{ allowed: boolean; reason?: string }>;
}

export class WebPlatform implements PlatformApi {
  name: PlatformApi['name'] = 'web';

  async login() {
    return { userId: 'local-user', nickname: '本地经理' };
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
