import { SHOP_CONFIG_KEY, defaultShopConfig, normalizeShopConfig } from '../server/shop-config.mjs';

let memoryShopConfig = defaultShopConfig;

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method === 'GET') {
    response.status(200).json(await readConfig());
    return;
  }

  if (request.method === 'PUT') {
    const config = normalizeShopConfig(request.body ?? {});
    await writeConfig(config);
    response.status(200).json(config);
    return;
  }

  response.status(405).json({ error: 'method_not_allowed' });
}

async function readConfig() {
  const kvConfig = await readKvConfig();
  if (kvConfig) return kvConfig;
  return memoryShopConfig;
}

async function writeConfig(config) {
  memoryShopConfig = config;
  await writeKvConfig(config);
}

async function readKvConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  const result = await fetch(`${url}/get/${encodeURIComponent(SHOP_CONFIG_KEY)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!result.ok) throw new Error(`KV read failed: ${result.status}`);
  const payload = await result.json();
  if (!payload?.result) return null;
  const raw = typeof payload.result === 'string' ? JSON.parse(payload.result) : payload.result;
  return normalizeShopConfig(raw);
}

async function writeKvConfig(config) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;

  const result = await fetch(`${url}/set/${encodeURIComponent(SHOP_CONFIG_KEY)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(JSON.stringify(config))
  });
  if (!result.ok) throw new Error(`KV write failed: ${result.status}`);
}
