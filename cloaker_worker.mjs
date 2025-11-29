/**
 * cloaker_worker.mjs (Versão Pro)
 * Suporte a Referer, Idioma e Timezone
 */

import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';
import fs from 'fs';

// --- CONFIGURAÇÃO ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const TARGET_URL = process.env.INPUT_URL;
const SEL_DEVICE = process.env.INPUT_DEVICE || 'android';
const SEL_REFERER = process.env.INPUT_REFERER || 'facebook';
const SEL_LANG = process.env.INPUT_LANGUAGE || 'pt-BR';
const SEL_COUNTRY = process.env.INPUT_COUNTRY || 'br';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERRO: Configure as Secrets no GitHub.");
    process.exit(1);
}
if (!TARGET_URL) {
    console.error("❌ ERRO: Nenhuma URL fornecida.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- MAPAS DE SIMULAÇÃO ---

const REFERER_MAP = {
    'facebook': 'https://m.facebook.com/', // Mobile facebook é melhor pra ads
    'instagram': 'https://www.instagram.com/',
    'google': 'https://www.google.com/',
    'youtube': 'https://www.youtube.com/',
    'tiktok': 'https://www.tiktok.com/',
    'direct': ''
};

const TIMEZONE_MAP = {
    'br': 'America/Sao_Paulo',
    'us': 'America/New_York',
    'fr': 'Europe/Paris',
    'it': 'Europe/Rome',
    'de': 'Europe/Berlin',
    'co': 'America/Bogota',
    'cl': 'America/Santiago'
};

const DEVICE_MAP = {
    'desktop_win': { 
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
        viewport: { width: 1920, height: 1080 },
        hasTouch: false
    },
    'desktop_mac': { 
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
        viewport: { width: 1440, height: 900 },
        hasTouch: false
    },
    'android': devices['Galaxy S9+'],
    'iphone': devices['iPhone 14 Pro'],
};

async function run() {
    console.log(`\n========================================`);
    console.log(`🛡️ INICIANDO QUEBRA CLOAKER (PRO)`);
    console.log(`🎯 Alvo: ${TARGET_URL}`);
    console.log(`📱 Config: ${SEL_DEVICE} | ${SEL_LANG} | ${SEL_COUNTRY.toUpperCase()}`);
    console.log(`🔗 Origem Simulada: ${SEL_REFERER}`);
    console.log(`========================================\n`);

    let browser = null;

    try {
        const deviceConfig = DEVICE_MAP[SEL_DEVICE] || DEVICE_MAP['android'];
        const refererUrl = REFERER_MAP[SEL_REFERER];
        const timezone = TIMEZONE_MAP[SEL_COUNTRY] || 'America/New_York';

        const launchOptions = { headless: true };
        browser = await chromium.launch(launchOptions);
        
        // Contexto com Locale e Timezone corretos (Isso engana muitos cloakers)
        const context = await browser.newContext({
            ...deviceConfig,
            locale: SEL_LANG,
            timezoneId: timezone,
            extraHTTPHeaders: refererUrl ? { 'Referer': refererUrl } : {}
        });

        const page = await context.newPage();

        console.log(`🚀 Acessando URL...`);
        
        // Timeout longo pois cloakers as vezes demoram
        const response = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("⏳ Aguardando scripts de redirecionamento (8s)...");
        await page.waitForTimeout(8000);

        const finalUrl = page.url();
        const title = await page.title();
        console.log(`📍 URL Final: ${finalUrl}`);

        console.log("📸 Tirando Print...");
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const fileName = `pro_${Date.now()}.png`;

        console.log("☁️ Uploading...");
        const { error } = await supabase
            .storage
            .from('cloaker_evidence')
            .upload(fileName, screenshotBuffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (error) throw new Error(`Erro no Upload: ${error.message}`);

        const { data: publicUrlData } = supabase
            .storage
            .from('cloaker_evidence')
            .getPublicUrl(fileName);

        const publicLink = publicUrlData.publicUrl;

        console.log(`\n✅ SUCESSO!`);
        console.log(`🔗 URL: ${publicLink.replace('https://', 'https:// ')}`); 

        // --- RESUMO VISUAL NO GITHUB ---
        if (process.env.GITHUB_STEP_SUMMARY) {
            const wasRedirected = TARGET_URL.replace(/\/$/, '') !== finalUrl.replace(/\/$/, '');
            const summaryContent = `
### 🛡️ Relatório de Análise

| Parâmetro | Valor |
| :--- | :--- |
| **URL Entrada** | \`${TARGET_URL}\` |
| **URL Destino** | \`${finalUrl}\` |
| **Redirect Detectado** | ${wasRedirected ? '🚨 SIM' : '⚪ Não (Página Segura?)'} |
| **Simulação** | ${SEL_DEVICE} / ${SEL_LANG} / ${SEL_COUNTRY.toUpperCase()} |
| **Origem** | ${SEL_REFERER} |

#### 📸 Evidência Visual
[**🔗 ABRIR IMAGEM ORIGINAL**](${publicLink})

<a href="${publicLink}" target="_blank">
  <img src="${publicLink}" width="600" style="border: 2px solid #333; border-radius: 8px;" />
</a>
`;
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryContent);
        }

    } catch (err) {
        console.error(`\n❌ FALHA FATAL:`, err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

run();
