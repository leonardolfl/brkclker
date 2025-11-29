/**
 * cloaker_worker.mjs (Modo Direto)
 * Recebe URL via Variável de Ambiente -> Tira Print -> Sobe no Storage
 */

import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';

// 1. Configuração e Leitura dos Inputs do GitHub
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const TARGET_URL = process.env.INPUT_URL;
const SELECTED_DEVICE = process.env.INPUT_DEVICE || 'desktop_win';
const SELECTED_COUNTRY = process.env.INPUT_COUNTRY || 'us';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERRO: Configure as Secrets SUPABASE_URL e SUPABASE_KEY no GitHub.");
    process.exit(1);
}
if (!TARGET_URL) {
    console.error("❌ ERRO: Nenhuma URL fornecida.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapeamento de Dispositivos
const DEVICE_MAP = {
    'desktop_win': { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', viewport: { width: 1920, height: 1080 } },
    'desktop_mac': { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', viewport: { width: 1440, height: 900 } },
    'android': devices['Galaxy S9+'],
    'iphone': devices['iPhone 14 Pro'],
};

async function run() {
    console.log(`\n========================================`);
    console.log(`🛡️ INICIANDO QUEBRA CLOAKER (Modo Direto)`);
    console.log(`🎯 Alvo: ${TARGET_URL}`);
    console.log(`📱 Device: ${SELECTED_DEVICE}`);
    console.log(`🌍 País: ${SELECTED_COUNTRY}`);
    console.log(`========================================\n`);

    let browser = null;

    try {
        // Configuração do Browser
        const deviceConfig = DEVICE_MAP[SELECTED_DEVICE] || DEVICE_MAP['desktop_win'];
        
        // NOTA: Sem proxy real, o GitHub roda sempre IP dos EUA.
        // Se você tiver proxy, a lógica entraria aqui.
        const launchOptions = { headless: true };
        
        browser = await chromium.launch(launchOptions);
        
        const context = await browser.newContext({
            ...deviceConfig,
            locale: SELECTED_COUNTRY === 'br' ? 'pt-BR' : 'en-US',
            timezoneId: SELECTED_COUNTRY === 'br' ? 'America/Sao_Paulo' : 'America/New_York'
        });

        const page = await context.newPage();

        console.log(`🚀 Acessando URL...`);
        // Timeout de 60s para garantir
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Espera inteligente para cloakers (3s é pouco, 10s é seguro)
        console.log("⏳ Aguardando redirecionamentos e carregamento (8s)...");
        await page.waitForTimeout(8000);

        const finalUrl = page.url();
        const title = await page.title();
        console.log(`\n📍 URL Final: ${finalUrl}`);
        console.log(`📑 Título da Página: ${title}`);

        // Screenshot
        console.log("📸 Tirando Print...");
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const fileName = `manual_${Date.now()}.png`;

        // Upload
        console.log("☁️ Enviando para Supabase Storage...");
        const { data, error } = await supabase
            .storage
            .from('cloaker_evidence') // Certifique-se que esse bucket existe e é PUBLICO
            .upload(fileName, screenshotBuffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (error) throw new Error(`Erro no Upload: ${error.message}`);

        // Pegar URL Pública
        const { data: publicUrlData } = supabase
            .storage
            .from('cloaker_evidence')
            .getPublicUrl(fileName);

        const publicLink = publicUrlData.publicUrl;

        console.log(`\n✅ SUCESSO!`);
        console.log(`🖼️ LINK DO PRINT: ${publicLink}`);
        console.log(`(Copie e cole esse link no navegador)`);

    } catch (err) {
        console.error(`\n❌ FALHA FATAL:`, err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

run();
