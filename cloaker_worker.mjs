/**
 * cloaker_worker.mjs (Foco em Proxy)
 */

import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';
import fs from 'fs';

// --- CONFIGURAÇÃO BÁSICA ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const TARGET_URL = process.env.INPUT_URL;
const SEL_DEVICE = process.env.INPUT_DEVICE || 'desktop_win';
const SEL_COUNTRY = process.env.INPUT_COUNTRY || 'us';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERRO: Secrets do Supabase ausentes.");
    process.exit(1);
}
if (!TARGET_URL) {
    console.error("❌ ERRO: URL não informada.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==============================================================================
// 🚨 CONFIGURAÇÃO DOS PROXIES
// Coloque a string de conexão do seu proxy aqui.
// Formato: 'http://usuario:senha@ip:porta'
// ==============================================================================
const PROXY_MAP = {
    'us': '', // Deixe vazio para usar o IP do GitHub (que já é US)
    'br': process.env.PROXY_BR || '', // Cole seu proxy BR aqui entre as aspas se não usar secrets
    'fr': process.env.PROXY_FR || '',
    'de': process.env.PROXY_DE || '',
    'it': process.env.PROXY_IT || '',
    'co': process.env.PROXY_CO || ''
};
// ==============================================================================

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
    // 1. Identificar Proxy
    const proxyUrl = PROXY_MAP[SEL_COUNTRY];
    
    console.log(`\n========================================`);
    console.log(`🛡️ QUEBRA CLOAKER (PROXY MODE)`);
    console.log(`🎯 Alvo: ${TARGET_URL}`);
    console.log(`🌍 País Selecionado: ${SEL_COUNTRY.toUpperCase()}`);
    console.log(`🔌 Proxy: ${proxyUrl ? '✅ CONFIGURADO' : (SEL_COUNTRY === 'us' ? '✅ US (Nativo)' : '❌ NÃO CONFIGURADO (Usando US)')}`);
    console.log(`========================================\n`);

    let browser = null;

    try {
        const deviceConfig = DEVICE_MAP[SEL_DEVICE];
        
        // 2. Configurar Launch Options com Proxy
        const launchOptions = { headless: true };
        
        if (proxyUrl) {
            launchOptions.proxy = { server: proxyUrl };
        }

        browser = await chromium.launch(launchOptions);
        
        // 3. Criar Contexto (Sem Timezone, apenas UserAgent e Viewport)
        const context = await browser.newContext({
            ...deviceConfig,
            locale: SEL_COUNTRY === 'br' ? 'pt-BR' : 'en-US' // Ajuste básico de idioma
        });

        const page = await context.newPage();

        console.log(`🚀 Acessando URL...`);
        // Timeout de 60s
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("⏳ Aguardando carregamento (8s)...");
        await page.waitForTimeout(8000);

        const finalUrl = page.url();
        console.log(`📍 URL Final: ${finalUrl}`);

        console.log("📸 Tirando Print...");
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const fileName = `proxy_${Date.now()}.png`;

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

        // --- RELATÓRIO NO GITHUB ---
        if (process.env.GITHUB_STEP_SUMMARY) {
            const summaryContent = `
### 🛡️ Resultado (Modo Proxy)

| Config | Valor |
| :--- | :--- |
| **País** | ${SEL_COUNTRY.toUpperCase()} |
| **Proxy Usado** | ${proxyUrl ? '✅ Sim' : '⚠️ Não (IP Datacenter)'} |
| **Device** | ${SEL_DEVICE} |
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
