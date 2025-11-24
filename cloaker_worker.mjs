/**
 * cloaker_worker.mjs
 * Processador de Fila para Quebra de Cloaker
 * Lê jobs 'pending' do Supabase -> Executa Playwright -> Salva Evidência -> Atualiza Job
 */

import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';
import fs from 'fs';

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// SE VOCÊ TIVER UM PROVEDOR DE PROXY REAL (BrightData, IPRoyal), COLOQUE AQUI.
// Se deixar vazio, ele vai rodar com o IP do GitHub Actions (US).
const PROXY_SERVER = process.env.PROXY_SERVER || ""; // ex: 'http://user:pass@br.proxy-provider.com:port'

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERRO: Variáveis de ambiente SUPABASE ausentes.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapeamento de Dispositivos (Sincronizado com o Frontend)
const DEVICE_MAP = {
    'desktop_win': { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', viewport: { width: 1920, height: 1080 } },
    'desktop_mac': { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', viewport: { width: 1440, height: 900 } },
    'android': devices['Galaxy S9+'], // Aproximação do S23
    'iphone': devices['iPhone 14 Pro'],
    'ipad': devices['iPad Pro 11'],
};

// Mapeamento de Referers (Plataformas)
const REFERER_MAP = {
    'facebook': 'https://www.facebook.com/',
    'google': 'https://www.google.com/',
    'youtube': 'https://www.youtube.com/',
    'instagram': 'https://www.instagram.com/',
    'tiktok': 'https://www.tiktok.com/',
    'direct': ''
};

async function processJob(job) {
    console.log(`\n🛡️ Processando Job [${job.id}] - Alvo: ${job.target_url}`);
    
    // 1. Marcar como processando
    await supabase.from('cloaker_jobs').update({ status: 'processing' }).eq('id', job.id);

    let browser = null;
    let context = null;
    let page = null;
    let finalUrl = '';
    let screenshotUrl = null;

    try {
        // 2. Configurar Playwright
        const deviceConfig = DEVICE_MAP[job.device_config] || DEVICE_MAP['desktop_win'];
        const referer = REFERER_MAP[job.platform_config] || '';
        
        const launchOptions = { headless: true };
        
        // Configuração de Proxy (Se disponível)
        // Nota: O GitHub Actions roda nos EUA. Para testar Brasil, precisa de um proxy externo.
        if (PROXY_SERVER && job.proxy_config !== 'us') {
            // Lógica simples: Se tiver proxy server configurado, usa ele.
            // Em produção real, você selecionaria o proxy baseado no 'job.proxy_config' (br, fr, de, etc)
            launchOptions.proxy = { server: PROXY_SERVER };
            console.log(`🌍 Usando Proxy Configurado para região: ${job.proxy_config}`);
        }

        browser = await chromium.launch(launchOptions);
        
        const contextOptions = {
            ...deviceConfig,
            locale: job.lang_config || 'pt-BR',
            extraHTTPHeaders: referer ? { 'Referer': referer } : {}
        };

        context = await browser.newContext(contextOptions);
        page = await context.newPage();

        // 3. Executar Navegação (Com timeout de 30s)
        console.log(`🚀 Navegando para: ${job.target_url}`);
        await page.goto(job.target_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Espera redirecionamentos e scripts de cloaker rodarem
        await page.waitForTimeout(5000); 

        finalUrl = page.url();
        console.log(`🏁 URL Final: ${finalUrl}`);

        // 4. Capturar Evidência (Screenshot)
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const fileName = `${job.id}_${Date.now()}.png`;

        // 5. Upload para Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('cloaker_evidence')
            .upload(fileName, screenshotBuffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) throw new Error(`Erro upload storage: ${uploadError.message}`);

        // Obter URL Pública
        const { data: publicUrlData } = supabase
            .storage
            .from('cloaker_evidence')
            .getPublicUrl(fileName);
            
        screenshotUrl = publicUrlData.publicUrl;
        console.log(`📸 Screenshot salvo: ${screenshotUrl}`);

        // 6. Atualizar Job com Sucesso
        await supabase.from('cloaker_jobs').update({
            status: 'completed',
            result_url: screenshotUrl, // Link da imagem
            error_log: `Redirecionado para: ${finalUrl}`, // Usamos o log para guardar a URL final também
        }).eq('id', job.id);

        console.log("✅ Job finalizado com sucesso.");

    } catch (err) {
        console.error(`❌ Erro no Job: ${err.message}`);
        await supabase.from('cloaker_jobs').update({
            status: 'error',
            error_log: err.message
        }).eq('id', job.id);
    } finally {
        if (browser) await browser.close();
    }
}

async function main() {
    console.log("🔍 Buscando jobs pendentes...");
    
    // Busca jobs pendentes (FIFO)
    const { data: jobs, error } = await supabase
        .from('cloaker_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(5); // Processa até 5 por execução para não estourar tempo

    if (error) {
        console.error("Erro ao buscar jobs:", error);
        return;
    }

    if (!jobs || jobs.length === 0) {
        console.log("💤 Nenhum job pendente.");
        return;
    }

    console.log(`🔥 Encontrados ${jobs.length} jobs. Iniciando processamento...`);

    // Processa sequencialmente
    for (const job of jobs) {
        await processJob(job);
    }
}

main();
