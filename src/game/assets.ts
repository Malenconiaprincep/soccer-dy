import { Assets, Texture } from 'pixi.js';

const runtimeEnv = (import.meta as unknown as { env?: { VITE_ASSET_BASE_URL?: string } }).env ?? {};
const assetBaseUrl = (runtimeEnv.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '');
let resolverInstalled = false;

export function assetUrl<T>(source: T): T {
  if (typeof source !== 'string') return source;
  if (!source || /^(https?:)?\/\//i.test(source) || /^data:/i.test(source) || source.startsWith('blob:')) return source;
  if (!assetBaseUrl || !source.startsWith('/assets/')) return source;
  return `${assetBaseUrl}${source}` as T;
}

export function installPixiAssetResolver() {
  if (resolverInstalled) return;
  resolverInstalled = true;

  const originalTextureFrom = Texture.from.bind(Texture) as (...args: any[]) => any;
  Texture.from = ((source: unknown, ...args: any[]) => originalTextureFrom(assetUrl(source), ...args)) as typeof Texture.from;

  const originalAssetsLoad = Assets.load.bind(Assets) as (...args: any[]) => any;
  Assets.load = ((urls: unknown, ...args: any[]) => {
    const resolved = Array.isArray(urls) ? urls.map(assetUrl) : assetUrl(urls);
    return originalAssetsLoad(resolved, ...args);
  }) as typeof Assets.load;
}
