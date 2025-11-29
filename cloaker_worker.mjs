/**
 * cloaker_worker.mjs (Modo Resiliente: Tenta múltiplos proxies até conseguir)
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

// --- FUNÇÃO PARA PEGAR LISTA DE PROXIES ---
async function getProxyList(countryCode) {
    if (countryCode === 'us') return []; // US usa o nativo

    console.log(`🌍 Baixando lista de proxies para: ${countryCode.toUpperCase()}...`);
    
    try {
        // Pede 15 proxies HTTPS ordenados por uptime (estabilidade)
        // Fontes: Geonode, PubProxy, Proxyscrape (vamos usar geonode que retorna JSON limpo)
        const apiUrl = `https://proxylist.geonode.com/api/proxy-list?limit=15&page=1&sort_by=lastChecked&sort_type=desc&country=${countryCode.toUpperCase()}&protocols=http%2Chttps`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.data && data.data.length > 0) {
            return data.data.map(p => `http://${p.ip}:${p.port}`);
        } else {
            console.log(`⚠️ Nenhum proxy encontrado para ${countryCode}.`);
            return [];
        }
    } catch (e) {
        console.error(`⚠️ Erro na API de proxies: ${e.message}`);
        return [];
    }
}

// --- MAPAS ---
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

async function attemptNavigation(browser, url, proxy, deviceConfig, refererUrl, lang) {
    let context = null;
    try {
        const options = {
            ...deviceConfig,
            locale: lang,
            ignoreHTTPSErrors: true
        };

        if (refererUrl) options.extraHTTPHeaders = { 'Referer': refererUrl };
        
        // Se tiver proxy, adiciona
        if (proxy) {
            // Nota: Proxies grátis raramente tem user/pass, é só IP:Porta
            options.proxy = { server: proxy };
        }

        context = await browser.newContext(options);
        const page = await context.newPage();

        // Timeout agressivo (20s). Se o proxy for lento demais, pula pro próximo.
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        // Se chegou aqui, carregou!
        return { success: true, page, context, usedProxy: proxy };

    } catch (e) {
        if (context) await context.close();
        return { success: false, error: e.message };
    }
}

async function run() {
    console.log(`\n========================================`);
    console.log(`🛡️ QUEBRA CLOAKER (MODO METRALHADORA)`);
    console.log(`🎯 Alvo: ${TARGET_URL}`);
    console.log(`🌍 País: ${SEL_COUNTRY.toUpperCase()}`);
    console.log(`========================================\n`);

    let browser = null;
    let page = null;
    let context = null;
    let activeProxy = null;

    try {
        const launchOptions = { headless: true };
        browser = await chromium.launch(launchOptions);
        
        const deviceConfig = DEVICE_MAP[SEL_DEVICE] || DEVICE_MAP['android'];
        const refererUrl = REFERER_MAP[SEL_REFERER];

        // 1. Obter lista de candidatos
        let proxies = [];
        if (SEL_COUNTRY !== 'us') {
            proxies = await getProxyList(SEL_COUNTRY);
        }

        // Adiciona "null" no final da lista como último recurso (conexão direta/US)
        proxies.push(null); 

        // 2. Loop de Tentativas
        let success = false;
        
        for (let i = 0; i < proxies.length; i++) {
            const currentProxy = proxies[i];
            const attemptLabel = currentProxy ? `Proxy ${i+1}/${proxies.length - 1} (${currentProxy})` : 'CONEXÃO DIRETA (US)';
            
            console.log(`🔄 Tentando via: ${attemptLabel}...`);

            const result = await attemptNavigation(browser, TARGET_URL, currentProxy, deviceConfig, refererUrl, SEL_LANG);

            if (result.success) {
                console.log(`✅ CONECTADO com sucesso via ${attemptLabel}!`);
                page = result.page;
                context = result.context;
                activeProxy = currentProxy;
                success = true;
                break; // Sai do loop
            } else {
                console.log(`❌ Falhou: ${result.error.substring(0, 50)}...`);
            }
        }

        if (!success) {
            throw new Error("Todas as tentativas de conexão falharam.");
        }

        // 3. Processamento Pós-Navegação
        console.log("⏳ Aguardando carregamento total (8s)...");
        await page.waitForTimeout(8000);

        const finalUrl = page.url();
        console.log(`📍 URL Final: ${finalUrl}`);

        console.log("📸 Tirando Print...");
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const fileName = `retry_${Date.now()}.png`;

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

        console.log(`\n✅ SUCESSO TOTAL!`);
        console.log(`🔗 LINK: ${publicLink.replace('https://', 'https:// ')}`); 

        // --- RESUMO GITHUB ---
        if (process.env.GITHUB_STEP_SUMMARY) {
            const wasRedirected = TARGET_URL.replace(/\/$/, '') !== finalUrl.replace(/\/$/, '');
            const summaryContent = `
### 🛡️ Resultado (Resiliente)

| Config | Valor |
| :--- | :--- |
| **Rota Usada** | \`${activeProxy || 'Direta (US)'}\` |
| **País Alvo** | ${SEL_COUNTRY.toUpperCase()} |
| **Redirect** | ${wasRedirected ? '🚨 SIM' : '⚪ Não'} |
| **URL Final** | \`${finalUrl}\` |

[**🔗 VER IMAGEM**](${publicLink})

<a href="${publicLink}" target="_blank">
  <img src="${publicLink}" width="600" style="border: 2px solid #ccc; border-radius: 8px;" />
</a>
`;
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryContent);
        }

    } catch (err) {
        console.error(`\n❌ FALHA FATAL:`, err.message);
        process.exit(1);
    } finally {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
    }
}

run();
