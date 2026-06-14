import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv() {
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

export function validateCloudbaseEnv(env) {
  const envId = env.CLOUDBASE_ENV_ID ?? env.TCB_ENV;
  const apiKey = env.CLOUDBASE_API_KEY ?? env.CLOUDBASE_APIKEY;
  const secretId = env.TENCENTCLOUD_SECRETID ?? env.CLOUDBASE_SECRET_ID;
  const secretKey = env.TENCENTCLOUD_SECRETKEY ?? env.CLOUDBASE_SECRET_KEY;
  const hasApiKey = hasRealValue(apiKey);
  const hasSecretPair = hasRealValue(secretId) && hasRealValue(secretKey);

  if (!hasRealValue(envId)) {
    return { ok: false, message: '缺少 CLOUDBASE_ENV_ID。' };
  }
  if (!hasApiKey && !hasSecretPair) {
    return {
      ok: false,
      message: '缺少可用的 CLOUDBASE_API_KEY，或 TENCENTCLOUD_SECRETID/TENCENTCLOUD_SECRETKEY。'
    };
  }
  return { ok: true };
}

function hasRealValue(value) {
  if (!value) return false;
  return !/^(your-|YOUR_|xxx|placeholder)/i.test(String(value));
}
