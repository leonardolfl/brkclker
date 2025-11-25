#!/usr/bin/env node
/**
 * break_cloaker_test.mjs
 * Script standalone para teste de quebra de cloaker via GitHub Actions ou local.
 *
 * Funcionalidades:
 * - Navega até a URL fornecida
 * - Aguarda possíveis redirecionamentos / carregamentos tardios
 * - Simula pequenas interações para disparar lazy-load
 * - Extrai apenas URLs de <video> (incluindo <source>) e <iframe> (filtrados por domínios relevantes)
 * - Seleciona provável VSL principal (heurística baseada em área e relevância de domínio)
 * - Salva screenshot em ./evidence/<timestamp>_final.png
 * - Imprime JSON final no console (Actions mostra nos logs)
 *
 * Uso local:
 *   node break_cloaker_test.mjs https://exemplo.com --wait=12000 --headful
 *
 * Flags:
 *   --wait=<ms>   Tempo máximo de espera dinâmica por vídeo/iframe (default 12000)
 *   --headful     Abre navegador visível (para debug local; em Actions pode usar false)
 *
 * Saída JSON:
 * {
 *   "input_url": "...",
 *   "final_url": "...",
 *   "redirect_chain": [...],
 *   "screenshot": "evidence/...",
 *   "vsl": {
 *     "videos": [...],
 *     "iframes": [...],
 *     "probable_main": {...}
 *   }
 * }
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// ---------------------- Constantes ----------------------
const DEFAULT_DYNAMIC_WAIT = 12000;
const EVIDENCE_DIR = path.resolve(process.cwd(), 'evidence');

const IFRAME_HOST_KEYWORDS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'hotmart.com',
  'kiwify.com',
  'converteai.com',
  'stream',
  'player',
  'vid',
  'm3u8'
];

// ---------------------- Parse de Argumentos ----------------------
function parseArgs(argv) {
  const args = { url: null, wait: DEFAULT_DYNAMIC_WAIT, headful: false };
  for (const part of argv.slice(2)) {
    if (!part) continue;
    if (part.startsWith('--wait=')) {
      const v = parseInt(part.split('=')[1], 10);
      if (!isNaN(v) && v > 0) args.wait = v;
    } else if (part === '--headful') {
      args.headful = true;
    } else if (!part.startsWith('--') && !args.url) {
      args.url = part.trim();
    }
  }
  return args;
}

// ---------------------- Helpers ----------------------
function normalizeUrl(raw) {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return 'https://' + raw;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  return Date.now();
}

// ---------------------- Extração de VSL ----------------------
async function extractVSL(page) {
  return await page.evaluate((HOST_KEYWORDS) => {
    function isRelevantIframe(src) {
      if (!src) return false;
      const s = src.toLowerCase();
      return HOST_KEYWORDS.some(k => s.includes(k));
    }

    // Vídeos
    const videoEls = Array.from(document.querySelectorAll('video'));
    const videos = videoEls.map(v => {
      const directSrc = v.getAttribute('src') || '';
      const sourceChildren = Array.from(v.querySelectorAll('source'))
        .map(s => s.getAttribute('src') || '')
        .filter(s => s);
      const sources = [];
      if (directSrc) sources.push(directSrc);
      for (const sc of sourceChildren) {
        if (!sources.includes(sc)) sources.push(sc);
      }
      const rect = v.getBoundingClientRect();
      return {
        tag: 'video',
        sources,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0
      };
    }).filter(v => v.sources.length > 0);

    // Iframes
    const iframeEls = Array.from(document.querySelectorAll('iframe'));
    const iframes = iframeEls.map(f => {
      const src = f.getAttribute('src') || '';
      const rect = f.getBoundingClientRect();
      return {
        tag: 'iframe',
        src,
        relevant: isRelevantIframe(src),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0
      };
    }).filter(i => i.src);

    // Heurística probable_main
    const candidates = [];
    for (const v of videos) {
      const firstSrc = v.sources[0] || '';
      candidates.push({
        type: 'video',
        src: firstSrc,
        width: v.width,
        height: v.height,
        area: v.width * v.height
      });
    }
    for (const i of iframes) {
      candidates.push({
        type: 'iframe',
        src: i.src,
        width: i.width,
        height: i.height,
        area: i.width * i.height,
        relevant: i.relevant
      });
    }

    candidates.sort((a, b) => {
      const relA = a.relevant ? 1 : 0;
      const relB = b.relevant ? 1 : 0;
      if (relA !== relB) return relB - relA;
      return b.area - a.area;
    });

    return {
      videos,
      iframes,
      probable_main: candidates.length ? candidates[0] : null
    };
  }, IFRAME_HOST_KEYWORDS);
}

// ---------------------- Espera Dinâmica ----------------------
async function waitForDynamicContent(page, maxWaitMs) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const found = await page.evaluate(() => {
      const vids = document.querySelectorAll('video');
      const ifr = document.querySelectorAll('iframe');
      return (vids.length > 0 || ifr.length > 0);
    });
    if (found) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

// ---------------------- Interação Simulada ----------------------
async function simulateInteraction(page) {
  try {
    await page.mouse.move(50, 50);
    await page.mouse.move(120, 180);
    await page.evaluate(() => { window.scrollBy(0, 300); });
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.scrollBy(0, -150); });
  } catch (_) {
    // Ignora falhas não críticas
  }
}

// ---------------------- Tracking de Redirecionamentos ----------------------
function setupRedirectTracking(page, redirectChain) {
  page.on('response', (resp) => {
    try {
      const url = resp.url();
      const status = resp.status();
      if (status >= 300 && status < 400) {
        if (!redirectChain.includes(url)) redirectChain.push(url);
      }
    } catch (_) {}
  });
  page.on('request', (req) => {
    if (req.isNavigationRequest()) {
      const url = req.url();
      if (!redirectChain.includes(url)) redirectChain.push(url);
    }
  });
}

// ---------------------- Execução Principal ----------------------
async function run() {
  const args = parseArgs(process.argv);
  if (!args.url) {
    console.error('❌ ERRO: URL não fornecida.\nUso: node break_cloaker_test.mjs https://exemplo.com --wait=12000 --headful');
    process.exit(1);
  }

  const targetUrl = normalizeUrl(args.url);
  if (!targetUrl) {
    console.error('❌ ERRO: URL inválida.');
    process.exit(1);
  }

  ensureDir(EVIDENCE_DIR);

  const launchOptions = {
    headless: !args.headful
  };

  let browser;
  let page;
  const redirectChain = [];

  const output = {
    input_url: targetUrl,
    final_url: null,
    redirect_chain: redirectChain,
    screenshot: null,
    vsl: null
  };

  try {
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1536, height: 864 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      extraHTTPHeaders: {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    page = await context.newPage();
    setupRedirectTracking(page, redirectChain);

    console.log(`🚀 Navegando para: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Espera base + interação
    await page.waitForTimeout(3000);
    await simulateInteraction(page);

    // Espera dinâmica por conteúdo de vídeo/iframe
    const foundDynamic = await waitForDynamicContent(page, args.wait);
    console.log(foundDynamic
      ? '✅ Conteúdo de vídeo/iframe detectado antes do timeout.'
      : '⚠️ Nenhum vídeo/iframe detectado dentro do timeout.');

    // Interação adicional + pequena espera
    await simulateInteraction(page);
    await page.waitForTimeout(800);

    const finalUrl = page.url();
    output.final_url = finalUrl;
    console.log(`🏁 URL Final: ${finalUrl}`);

    // Extração VSL
    const vslData = await extractVSL(page);
    output.vsl = vslData;

    // Screenshot
    const fileBase = `${timestamp()}_final`;
    const screenshotPath = path.join(EVIDENCE_DIR, `${fileBase}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    output.screenshot = screenshotPath;

    console.log('📸 Screenshot salva em:', screenshotPath);
    console.log(`🎬 VSL: vídeos=${vslData.videos.length} iframes=${vslData.iframes.length}`);

    console.log('\n=== RESULTADO JSON ===');
    console.log(JSON.stringify(output, null, 2));

  } catch (err) {
    console.error('❌ Erro durante processamento:', err.message);
    output.error = err.message;
    console.log('\n=== RESULTADO JSON (Erro) ===');
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

if (import.meta.main) {
  run();
}
