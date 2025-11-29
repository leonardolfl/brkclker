/**
 * cloaker_worker.mjs (Modo MacGyver: Caçador de Proxy Grátis)
 */

import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';
import fs from 'fs';

// --- CONFIGURAÇÃO ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const TARGET_URL = process.env.INPUT_URL;
const SEL_DEVICE = process.env.INPUT_DEVICE || 'desktop_win';
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

// ==============================================================================
// 🧙‍♂️ O MAGO DOS PROXIES GRÁTIS
// ==============================================================================
async function getFreeProxy(countryCode) {
    if (countryCode === 'us') return null; // US usamos o nativo do GitHub que é rápido

    console.log(`🌍 Caçando proxy grátis para: ${countryCode.toUpperCase()}...`);
    
    try {
        // API da Geonode (Free List)
        // Buscamos proxies HTTPS, do país escolhido, ordenados por latência (mais rápidos)
        const apiUrl = `https://proxylist.geonode.com/api/proxy-list?limit=10&page=1&sort_by=latency&sort_type=asc&country=${countryCode.toUpperCase()}&protocols=http%2Chttps`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.data && data.data.length > 0) {
            // Pega o primeiro da lista (teoricamente o mais rápido)
            const p = data.data[0];
            const proxyString = `http://${p.ip}:${p.port}`;
            console.log(`✅ Proxy Encontrado: ${proxyString} (Latência: ${p.latency}ms)`);
            return proxyString;
        } else {
            console.log(`⚠️ Nenhum proxy grátis decente encontrado para ${countryCode}.`);
            return null;
        }
    } catch (e) {
        console.error(`⚠️ Erro ao buscar proxy grátis: ${e.message}`);
        return null;
    }
}
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
    // 1. Tenta conseguir um proxy grátis
    let proxyUrl = await getFreeProxy(SEL_COUNTRY);
    
    console.log(`\n========================================`);
    console.log(`🛡️ QUEBRA CLOAKER (FREE MODE)`);
    console.log(`🎯 Alvo: ${TARGET_URL}`);
    console.log(`🌍 País Alvo: ${SEL_COUNTRY.toUpperCase()}`);
    console.log(`🔌 Rota: ${proxyUrl ? '🔀 PROXY PÚBLICO' : '⚡ DIRETO (DATACENTER US)'}`);
    console.log(`========================================\n`);

    let browser = null;

    try {
        const deviceConfig = DEVICE_MAP[SEL_DEVICE];
        const launchOptions = { headless: true };
        
        if (proxyUrl) {
            launchOptions.proxy = { server: proxyUrl };
        }

        browser = await chromium.launch(launchOptions);
        
        // Contexto
        const context = await browser.newContext({
            ...deviceConfig,
            locale: SEL_COUNTRY === 'br' ? 'pt-BR' : 'en-US',
            timezoneId: SEL_COUNTRY === 'br' ? 'America/Sao_Paulo' : 'America/New_York',
            ignoreHTTPSErrors: true // Proxies grátis costumam ter erro de SSL
        });

        const page = await context.newPage();

        console.log(`🚀 Acessando URL...`);
        
        // Timeout maior (90s) porque proxy grátis é lento
        try {
            await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
        } catch (navError) {
            console.warn("⚠️ Timeout ou erro de navegação com Proxy.");
            if (proxyUrl) {
                console.log("♻️ Tentando novamente SEM proxy (Fallback US)...");
                await browser.close();
                // Reinicia sem proxy
                launchOptions.proxy = undefined;
                browser = await chromium.launch(launchOptions);
                const context2 = await browser.newContext({ ...deviceConfig });
                const page2 = await context2.newPage();
                await page2.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
                // Substitui a referência da page
                // (Gambiarra rápida para não reescrever a função inteira)
                await page.close(); 
                // Nota: O fluxo ideal seria recursivo, mas para script simples, 
                // vamos assumir que se falhar o proxy, a gente aborta ou aceita o erro.
                // Vou lançar erro para simplificar o log
                throw new Error("Proxy Grátis falhou (comum). Tente rodar novamente ou escolha 'US'.");
            } else {
                throw navError;
            }
        }
        
        console.log("⏳ Aguardando (8s)...");
        await page.waitForTimeout(8000);

        const finalUrl = page.url();
        console.log(`📍 URL Final: ${finalUrl}`);

        console.log("📸 Tirando Print...");
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const fileName = `free_${Date.now()}.png`;

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
### 🛡️ Resultado (Free Mode)

| Config | Valor |
| :--- | :--- |
| **País Alvo** | ${SEL_COUNTRY.toUpperCase()} |
| **Proxy Usado** | \`${proxyUrl || 'Nenhum (US)'}\` |
| **Device** | ${SEL_DEVICE} |
| **URL Final** | \`${finalUrl}\` |

> **Nota:** Proxies gratuitos podem ser lentos ou falhar. Se der erro, tente de novo.

[**🔗 ABRIR IMAGEM**](${publicLink})

<a href="${publicLink}" target="_blank">
  <img src="${publicLink}" width="600" style="border: 2px solid #ccc; border-radius: 8px;" />
</a>
`;
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryContent);
        }

    } catch (err) {
        console.error(`\n❌ FALHA:`, err.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

run();
