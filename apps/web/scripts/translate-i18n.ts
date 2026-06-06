#!/usr/bin/env bun
/**
 * P2PRO i18n 일괄 번역 스크립트 — D-2 글로벌 진출 영어 번역.
 *
 * 동작:
 *   1. src/i18n/ko/*.json 의 한국어 값을 source 로
 *   2. src/i18n/en/*.json 의 비어있거나 한국어와 동일한 키만 골라서
 *   3. OpenAI 또는 Anthropic API 로 일괄 번역
 *   4. en/*.json 에 결과 저장
 *
 * 사용법:
 *   # 환경변수 설정 (둘 중 하나)
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   export OPENAI_API_KEY=sk-...
 *
 *   # dry-run (번역 미리보기, API 호출 X)
 *   bun run scripts/translate-i18n.ts --dry-run
 *
 *   # 비용 추정만
 *   bun run scripts/translate-i18n.ts --estimate
 *
 *   # 실제 번역
 *   bun run scripts/translate-i18n.ts
 *
 *   # 특정 namespace 만
 *   bun run scripts/translate-i18n.ts --ns auth,checkout
 *
 *   # provider 강제
 *   bun run scripts/translate-i18n.ts --provider anthropic
 *   bun run scripts/translate-i18n.ts --provider openai
 *
 * 안전장치:
 *   - 기존 영어 번역 (값이 있는 키) 은 절대 덮어쓰지 않음
 *   - {{variable}} 플레이스홀더 보존 (prompt 명시)
 *   - HTML/마크다운 태그 보존 (prompt 명시)
 *   - dry-run 으로 검토 후 commit 권장
 */

import fs from 'node:fs';
import path from 'node:path';

const I18N_DIR = path.resolve(import.meta.dir, '../src/i18n');
const KO_DIR = path.join(I18N_DIR, 'ko');
const EN_DIR = path.join(I18N_DIR, 'en');

// --- CLI args ---
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isEstimate = args.includes('--estimate');
const nsArg = args.find((a) => a.startsWith('--ns='))?.split('=')[1]
  ?? (args.indexOf('--ns') >= 0 ? args[args.indexOf('--ns') + 1] : undefined);
const targetNamespaces = nsArg ? nsArg.split(',') : null;
const providerArg = args.find((a) => a.startsWith('--provider='))?.split('=')[1]
  ?? (args.indexOf('--provider') >= 0 ? args[args.indexOf('--provider') + 1] : undefined);

// --- Provider 자동 감지 ---
const provider = providerArg
  ?? (process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : null);
if (!provider && !isDryRun && !isEstimate) {
  console.error('❌ ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 환경변수를 설정하세요.');
  process.exit(1);
}

// --- 번역 prompt (마켓플레이스 톤) ---
const SYSTEM_PROMPT = `You are a professional Korean→English translator for P2PRO, a P2P USDT cryptocurrency marketplace.

Tone: friendly, professional, concise. Match e-commerce industry conventions (Amazon, eBay).

Rules:
- Preserve {{variable}} placeholders exactly (e.g., "{{count}}" stays "{{count}}")
- Preserve HTML tags exactly (e.g., <b>, <a href="...">)
- Preserve markdown formatting
- Preserve number/currency formatting (e.g., "USDT", "%")
- Use natural English, NOT literal translation
- For UI labels, prefer short imperative ("Save", "Cancel") over verbose
- For error messages, be clear and actionable
- Do NOT translate technical identifiers (TXID, USDT, KYC, 2FA, TOTP, ERC20, TRC20)
- Currency: keep "USDT" (not translated to dollars)

You will receive a JSON object mapping keys to Korean strings. Return a JSON object with the same keys mapped to English translations. Output ONLY the JSON, no markdown fence, no commentary.`;

// --- File ops ---
type JsonObj = Record<string, unknown>;

const flatten = (obj: JsonObj, prefix = ''): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') result[fullKey] = val;
    else if (val && typeof val === 'object') Object.assign(result, flatten(val as JsonObj, fullKey));
  }
  return result;
};

const unflatten = (flat: Record<string, string>): JsonObj => {
  const result: JsonObj = {};
  for (const [fullKey, val] of Object.entries(flat)) {
    const parts = fullKey.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as JsonObj;
    }
    current[parts[parts.length - 1]] = val;
  }
  return result;
};

// --- API providers ---
const callAnthropic = async (texts: Record<string, string>): Promise<Record<string, string>> => {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as { content: { text: string }[] };
  const text = data.content[0].text.trim();
  // strip markdown fence if any
  const json = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  return JSON.parse(json);
};

const callOpenAI = async (texts: Record<string, string>): Promise<Record<string, string>> => {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(texts) },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as { choices: { message: { content: string } }[] };
  return JSON.parse(data.choices[0].message.content);
};

// --- Main ---
const main = async () => {
  const namespaceFiles = fs.readdirSync(KO_DIR).filter((f) => f.endsWith('.json'));
  const namespaces = namespaceFiles.map((f) => f.replace('.json', ''));
  const filtered = targetNamespaces
    ? namespaces.filter((ns) => targetNamespaces!.includes(ns))
    : namespaces;

  console.log(`📚 Namespaces: ${filtered.join(', ')}`);
  console.log(`🌐 Provider: ${provider ?? '(none — dry-run/estimate only)'}\n`);

  let totalKeys = 0;
  let totalToTranslate = 0;
  const allMissing: { ns: string; keys: Record<string, string> }[] = [];

  for (const ns of filtered) {
    const koPath = path.join(KO_DIR, `${ns}.json`);
    const enPath = path.join(EN_DIR, `${ns}.json`);
    if (!fs.existsSync(enPath)) {
      console.warn(`⚠️  ${ns}: en/${ns}.json 미존재, skip`);
      continue;
    }
    const koFlat = flatten(JSON.parse(fs.readFileSync(koPath, 'utf-8')));
    const enFlat = flatten(JSON.parse(fs.readFileSync(enPath, 'utf-8')));

    const missing: Record<string, string> = {};
    for (const [key, koVal] of Object.entries(koFlat)) {
      const enVal = enFlat[key];
      // 영어가 비어 있거나 한국어와 동일 (= 번역 안 됨) 인 경우
      if (!enVal || enVal === koVal) {
        missing[key] = koVal;
      }
    }
    totalKeys += Object.keys(koFlat).length;
    totalToTranslate += Object.keys(missing).length;
    if (Object.keys(missing).length > 0) {
      allMissing.push({ ns, keys: missing });
      console.log(`📝 ${ns}: ${Object.keys(missing).length} keys to translate`);
    } else {
      console.log(`✅ ${ns}: 완료 상태`);
    }
  }

  console.log(`\n📊 Total: ${totalToTranslate} / ${totalKeys} keys 번역 필요`);

  // 비용 추정 (대략적)
  const avgInputTokens = 100;  // key + ko value
  const avgOutputTokens = 60;  // en value
  const totalInputTokens = totalToTranslate * avgInputTokens + totalToTranslate * 5; // overhead
  const totalOutputTokens = totalToTranslate * avgOutputTokens;

  const costAnthropic = (totalInputTokens * 1 / 1_000_000) + (totalOutputTokens * 5 / 1_000_000); // claude-haiku-4-5 추정 가격
  const costOpenAI = (totalInputTokens * 0.15 / 1_000_000) + (totalOutputTokens * 0.60 / 1_000_000); // gpt-4o-mini

  console.log(`\n💰 비용 추정:`);
  console.log(`   Anthropic (claude-haiku-4-5): ~$${costAnthropic.toFixed(4)}`);
  console.log(`   OpenAI (gpt-4o-mini):         ~$${costOpenAI.toFixed(4)}`);

  if (isEstimate) {
    console.log(`\n(--estimate 모드: 번역 실행 안 함)`);
    return;
  }

  if (totalToTranslate === 0) {
    console.log(`\n✨ 번역할 키 없음. 완료.`);
    return;
  }

  if (isDryRun) {
    console.log(`\n🔍 DRY-RUN: 첫 namespace 의 첫 5개 키 미리보기:\n`);
    const first = allMissing[0];
    if (first) {
      const preview = Object.entries(first.keys).slice(0, 5);
      preview.forEach(([k, v]) => console.log(`  ${k}: "${v}"`));
    }
    console.log(`\n실제 번역하려면 --dry-run 빼고 실행.`);
    return;
  }

  // --- 실제 번역 ---
  console.log(`\n🚀 번역 시작 (provider: ${provider})...\n`);
  const translateBatch = provider === 'anthropic' ? callAnthropic : callOpenAI;

  for (const { ns, keys } of allMissing) {
    const enPath = path.join(EN_DIR, `${ns}.json`);
    const enExisting = flatten(JSON.parse(fs.readFileSync(enPath, 'utf-8')));

    // batch size: API 응답 안정성 위해 한 번에 50개 정도
    const entries = Object.entries(keys);
    const batchSize = 50;
    let translated: Record<string, string> = {};

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = Object.fromEntries(entries.slice(i, i + batchSize));
      console.log(`  [${ns}] batch ${Math.floor(i / batchSize) + 1} (${Object.keys(batch).length} keys)...`);
      try {
        const result = await translateBatch(batch);
        translated = { ...translated, ...result };
      } catch (err) {
        console.error(`  ❌ batch 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
      // rate limit 방지 짧은 sleep
      await new Promise((r) => setTimeout(r, 200));
    }

    // 기존 영어 (값 있는 키) 보존, 새로 번역된 것만 update
    const merged = { ...enExisting, ...translated };
    fs.writeFileSync(enPath, JSON.stringify(unflatten(merged), null, 2) + '\n', 'utf-8');
    console.log(`  ✅ ${ns}: ${Object.keys(translated).length} keys 저장됨\n`);
  }

  console.log(`\n🎉 번역 완료. en/*.json 파일들을 검토 후 commit 하세요:`);
  console.log(`   git diff src/i18n/en/`);
};

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
