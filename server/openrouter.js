import { config } from '../config.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 502, 503]);

const RECOGNIZE_PROMPT = `당신은 냉장고 내부 사진을 분석하는 인식 시스템입니다.
사진 속에서 식별 가능한 식재료를 모두 찾아서 아래 JSON 형식으로만 응답하세요.
설명, 마크다운 코드펜스, 그 외 어떤 텍스트도 포함하지 말고 순수 JSON만 출력하세요.

중요: name 필드는 반드시 한국어로만 작성하세요. 예: "beef steak"가 아니라 "소고기 스테이크", "lettuce"가 아니라 "상추".

형식:
{"items":[{"name":"재료명(한국어)","quantity_estimate":"추정 수량(모르면 빈 문자열)","confidence":"high|medium|low"}]}

사진에서 식재료를 찾을 수 없으면 {"items":[]}로 응답하세요.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('응답에서 JSON을 찾을 수 없음');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callOnce(messages) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  const bodyText = await res.text();

  if (!res.ok) {
    const err = new Error(`OpenRouter HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const json = JSON.parse(bodyText);

  if (json.error) {
    const err = new Error(`OpenRouter upstream error: ${json.error.message}`);
    err.status = json.error.code ?? 502;
    throw err;
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('모델 응답에 content가 없음');
  }

  return extractJson(content);
}

async function callWithRetry(messages) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callOnce(messages);
    } catch (err) {
      lastError = err;
      const isRetryable = RETRYABLE_STATUS.has(err.status);
      if (!isRetryable || attempt === MAX_RETRIES) break;
      await sleep(2 ** attempt * 1000);
    }
  }
  throw lastError;
}

export async function recognizeFridgeImage(imageDataUrl) {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: RECOGNIZE_PROMPT },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
  return callWithRetry(messages);
}

function buildRecipePrompt(items, preferences) {
  const ingredientList = items.map((item) => item.name).join(', ');
  const constraints = [];
  if (preferences?.allergies?.length) {
    constraints.push(`알레르기(절대 사용 금지): ${preferences.allergies.join(', ')}`);
  }
  if (preferences?.dislikes?.length) {
    constraints.push(`비선호 재료(가능하면 제외): ${preferences.dislikes.join(', ')}`);
  }
  if (preferences?.diet_type) {
    constraints.push(`식단 유형: ${preferences.diet_type}`);
  }

  return `당신은 레시피 추천 시스템입니다.
아래 보유 재료만으로, 또는 최소한의 추가 재료로 만들 수 있는 레시피 3개를 추천하세요.

보유 재료: ${ingredientList || '없음'}
${constraints.length ? constraints.join('\n') : ''}

각 레시피는 실제로 순서대로 따라할 수 있는 구체적인 조리법을 포함해야 합니다.
중요: title, have, need, steps, difficulty를 포함한 모든 텍스트 필드는 반드시 한국어로만 작성하세요. 보유 재료 목록이 영어로 주어지더라도 응답에서는 한국어로 번역해서 사용하세요.
설명, 마크다운 코드펜스, 그 외 어떤 텍스트도 포함하지 말고 순수 JSON만 아래 형식으로 출력하세요.

형식:
{"recipes":[{"title":"레시피명(한국어)","have":["보유 재료(한국어)"],"need":["부족한 재료(한국어)"],"steps":["1단계 설명(한국어)","2단계 설명(한국어)"],"est_time_min":15,"difficulty":"easy|medium|hard"}]}`;
}

export async function generateRecipes(items, preferences) {
  const messages = [{ role: 'user', content: buildRecipePrompt(items, preferences) }];
  return callWithRetry(messages);
}
