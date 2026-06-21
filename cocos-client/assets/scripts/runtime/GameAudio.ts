import { AudioClip, AudioSource, Node, resources } from 'cc';

export type GameSound = 'tap' | 'confirm' | 'select' | 'reveal' | 'kickoff' | 'goal' | 'danger' | 'save' | 'card' | 'reward' | 'win' | 'lose' | 'whistle';

const volumes: Record<GameSound, number> = {
  tap: 0.42,
  confirm: 0.48,
  select: 0.46,
  reveal: 0.58,
  kickoff: 0.62,
  goal: 0.72,
  danger: 0.52,
  save: 0.62,
  card: 0.5,
  reward: 0.58,
  win: 0.68,
  lose: 0.56,
  whistle: 0.62
};

export class GameAudio {
  private static source?: AudioSource;
  private static musicSource?: AudioSource;
  private static musicClip?: AudioClip;
  private static readonly clips = new Map<GameSound, AudioClip>();
  private static readonly loading = new Set<GameSound>();

  static attach(host: Node): void {
    this.source = host.getComponent(AudioSource) ?? host.addComponent(AudioSource);
    this.source.volume = 1;
    this.source.loop = false;
    const musicNode = new Node('BackgroundMusic');
    host.addChild(musicNode);
    this.musicSource = musicNode.addComponent(AudioSource);
    this.musicSource.loop = true;
    this.musicSource.volume = 0.14;
    (Object.keys(volumes) as GameSound[]).forEach((name) => this.load(name));
    resources.load('audio/bgm', AudioClip, (error, clip) => {
      if (error || !clip || !this.musicSource?.isValid) {
        if (error) console.warn('[audio] failed to load background music', error);
        return;
      }
      this.musicClip = clip;
      this.musicSource.clip = clip;
      this.startMusic();
    });
  }

  static play(name: GameSound): void {
    this.startMusic();
    const clip = this.clips.get(name);
    if (clip && this.source?.isValid) {
      this.source.playOneShot(clip, volumes[name]);
      return;
    }
    this.load(name, true);
  }

  static startMusic(): void {
    if (!this.musicSource?.isValid || !this.musicClip || this.musicSource.playing) return;
    this.musicSource.play();
  }

  static setMusicEnabled(enabled: boolean): void {
    if (!this.musicSource?.isValid) return;
    if (enabled) this.startMusic();
    else this.musicSource.stop();
  }

  private static load(name: GameSound, playWhenReady = false): void {
    if (this.clips.has(name)) {
      if (playWhenReady) this.play(name);
      return;
    }
    if (this.loading.has(name)) return;
    this.loading.add(name);
    resources.load(`audio/${name}`, AudioClip, (error, clip) => {
      this.loading.delete(name);
      if (error || !clip) {
        console.warn(`[audio] failed to load ${name}`, error);
        return;
      }
      this.clips.set(name, clip);
      if (playWhenReady) this.play(name);
    });
  }
}
