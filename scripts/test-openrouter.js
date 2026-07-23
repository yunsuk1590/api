import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { config, validateEnv } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const imageBuffer = readFileSync(path.join(__dirname, 'test-image.jpg'));
const TEST_IMAGE_DATA_URL = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

async function callOpenRouter(messages, label) {
  const start = Date.now();
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });
  } catch (err) {
    return { label, ok: false, error: `network error: ${err.message}` };
  }

  const elapsedMs = Date.now() - start;
  const text = await res.text();

  if (!res.ok) {
    return { label, ok: false, status: res.status, elapsedMs, error: text.slice(0, 500) };
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { label, ok: false, status: res.status, elapsedMs, error: 'failed to parse JSON response' };
  }

  const answer = json.choices?.[0]?.message?.content ?? '(no content)';
  return { label, ok: true, status: res.status, elapsedMs, answer, usage: json.usage, raw: json };
}

async function main() {
  validateEnv();

  const textResult = await callOpenRouter(
    [{ role: 'user', content: '한 문장으로: 대한민국의 수도는 어디야?' }],
    'text-recognition'
  );

  const imageResult = await callOpenRouter(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: '이 이미지에 무엇이 보이는지 한 문장으로 설명해줘.' },
          { type: 'image_url', image_url: { url: TEST_IMAGE_DATA_URL } },
        ],
      },
    ],
    'image-recognition'
  );

  for (const result of [textResult, imageResult]) {
    console.log(`\n=== ${result.label} ===`);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
