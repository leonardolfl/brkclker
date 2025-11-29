/**
 * cloaker_worker.mjs (Versão Completa: Proxy + Referer + Lang)
 */

import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';
import fs from 'fs';

// --- INPUTS ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const TARGET_URL = process.env.INPUT_URL;
const SEL_DEVICE = process.env.INPUT_DEVICE || 'android';
const SEL_REFERER = process.env.INPUT_REFERER || 'facebook';
const SEL_LANG = process.env.INPUT_LANGUAGE || 'pt-BR';
const SEL_COUNTRY = process.env.INPUT_COUNTRY || 'us';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERRO: Secrets ausentes.");
    process.exit(1);
}
if (!TARGET_URL) {
    console.error("❌ ERRO: URL não informada.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- MAPAS DE CONFIGURAÇÃO ---

// 1. Proxies (Configure aqui ou use Secrets)
const PROXY_MAP = {
    'us': '', // Vazio = IP do GitHub
    'br': process.env.PROXY_BR || '', // Ex: 'http://user:pass@br.proxy.com:port'
    'fr': process.env.PROXY_FR || '',
    'de': process.env.PROXY_DE || '',
    'it': process.env.PROXY_IT || '',
    'co': process.env.PROXY_CO || ''
};

// 2. Referers (Origens Simuladas)
const REFERER_MAP = {
    'facebook': 'https://m.facebook.com/', 
    'instagram': 'https://www.instagram.com/',
    'google': 'https://www.google.com/',
    'youtube': 'https://www.youtube.com/',
    'tiktok': 'https://www.tiktok.com/',
    'direct': ''
};

const DEVICE_MAP = {
    'desktop_win': { 
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
        viewport: { width: 1920, height: 1080 }
    },
    'desktop_mac': { 
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 
        viewport: { width: 1440, height: 900 }
    },
    'android': devices['Galaxy S9+'],
    'iphone': devices['iPhone 14 Pro'],
};

async function run() {
    const proxyUrl = PROXY_MAP[SEL_COUNTRY];
    const refererUrl = REFERER_MAP[SEL_REFERER];
    
    console.log(`\n========================================`);
    console.log(`🛡️ QUEBRA CLOAKER (FULL)`);
    console.log(`🎯 Alvo: ${TARGET_URL}`);
    console.log(`🌍 País: ${SEL_COUNTRY.toUpperCase()} | Proxy: ${proxyUrl ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`🗣️ Idioma: ${SEL_LANG}`);
    console.log(`🔗 Origem: ${SEL_REFERER}`);
    console.log(`========================================\n`);

    let browser = null;

    try {
        const deviceConfig = DEVICE_MAP[SEL_DEVICE];
        const launchOptions = { headless: true };
        
        if (proxyUrl) {
            launchOptions.proxy = { server: proxyUrl };
        }

        browser = await chromium.launch(launchOptions);
        
        // CONFIGURAÇÃO DO DISFARCE
        const context = await browser.newContext({
            ...deviceConfig,
            locale: SEL_LANG, // Define o idioma do navegador
            // Timezone removemos como pedido, usamos o do sistema (US do GitHub) ou do Proxy se ele mascarar
            extraHTTPHeaders: refererUrl ? { 'Referer': refererUrl } : {} // Injeta o Referer
        });

        const page = await context.newPage();

        console.log(`🚀 Acessando URL...`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("⏳ Aguardando redirecionamentos (8s)...");
        await page.waitForTimeout(8000);

        const finalUrl = page.url();
        console.log(`📍 URL Final: ${finalUrl}`);

        console.log("📸 Tirando Print...");
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const fileName = `full_${Date.now()}.png`;

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
        console.log(`🔗 LINK: ${publicLink.replace('https://', 'https:// ')}`); 

        // --- RESUMO NO GITHUB ---
        if (process.env.GITHUB_STEP_SUMMARY) {
            const wasRedirected = TARGET_URL.replace(/\/$/, '') !== finalUrl.replace(/\/$/, '');
            const summaryContent = `
### 🛡️ Resultado da Análise

| Parâmetro | Valor |
| :--- | :--- |
| **Origem** | ${SEL_REFERER} |
| **Idioma** | ${SEL_LANG} |
| **País / Proxy** | ${SEL_COUNTRY.toUpperCase()} / ${proxyUrl ? '✅' : '❌'} |
| **Redirect** | ${wasRedirected ? '🚨 SIM' : '⚪ Não'} |
| **URL Final** | \`${finalUrl}\` |

[**🔗 ABRIR IMAGEM**](${publicLink})

<a href="${publicLink}" target="_blank">
  <img src="${publicLink}" width="600" style="border: 2px solid #ccc; border-radius: 8px;" />
</a>
`;
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryContent);
        }

    } catch (err) {
        console.error(`\n❌ FALHA:`, err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

run();
