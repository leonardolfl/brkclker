/**
 * cloaker_worker.mjs
 * CloakerBreaker Enterprise - Processador de Fila para Quebra de Cloaker
 * Lê jobs 'pending' do Supabase -> Executa Playwright -> Salva Evidência -> Atualiza Job
 * 
 * Recursos Enterprise:
 * - Emulação de múltiplos dispositivos (android, iphone, ipad, desktop, windows_phone)
 * - Plataformas simuladas (facebook, google, youtube, instagram)
 * - Suporte a múltiplas regiões/proxies (br, co, us, mx, fr, ca, pt, au-sydney, de, it)
 * - Múltiplos idiomas (pt, en, es, de, it, fr)
 * - Interação humana (scroll, mouse, clique neutro)
 * - Detecção e gravação de VSL (30-60s)
 * - Screenshot full-page
 */

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

import { 
    DEVICE_MAP, 
    PLATFORM_MAP, 
    REGION_MAP, 
    LANGUAGE_MAP,
    CAPTURE_CONFIG,
    getScenarioConfig 
} from './cloaker_config.mjs';

import {
    performHumanInteraction,
    detectVSL,
    watchVSL
} from './human_interaction.mjs';

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
// Proxy dinâmico por região (formato: { region: 'server_url' })
const PROXY_SERVERS = JSON.parse(process.env.PROXY_SERVERS || '{}');
// Fallback para proxy único
const PROXY_SERVER = process.env.PROXY_SERVER || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERRO: Variáveis de ambiente SUPABASE ausentes.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Obtém a URL do proxy para uma região específica
 * @param {string} region - Código da região
 * @returns {string|null}
 */
function getProxyForRegion(region) {
    // Primeiro tenta proxy específico da região
    if (PROXY_SERVERS[region]) {
        return PROXY_SERVERS[region];
    }
    // Fallback para proxy genérico
    if (PROXY_SERVER && region !== 'us') {
        return PROXY_SERVER;
    }
    return null;
}

/**
 * Processa um job de cloaker com recursos enterprise
 * @param {object} job - Job do Supabase
 */
async function processJob(job) {
    console.log(`\n🛡️ Processando Job [${job.id}] - Alvo: ${job.target_url}`);
    console.log(`📱 Dispositivo: ${job.device_config || 'desktop'}`);
    console.log(`🌐 Plataforma: ${job.platform_config || 'direct'}`);
    console.log(`🌍 Região: ${job.proxy_config || 'us'}`);
    console.log(`🗣️ Idioma: ${job.lang_config || 'en'}`);
    
    // 1. Marcar como processando
    await supabase.from('cloaker_jobs').update({ status: 'processing' }).eq('id', job.id);

    let browser = null;
    let context = null;
    let page = null;
    let finalUrl = '';
    let screenshotUrl = null;
    let videoUrl = null;
    let vslDetected = false;

    // Diretório temporário para gravações
    const tempDir = `/tmp/cloaker_${job.id}_${Date.now()}`;
    
    try {
        // Criar diretório temporário
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 2. Obter configuração completa do cenário
        const scenario = {
            device: job.device_config || 'desktop',
            platform: job.platform_config || 'direct',
            region: job.proxy_config || 'us',
            language: job.lang_config || 'en'
        };
        
        const config = getScenarioConfig(scenario);
        
        // 3. Configurar opções de lançamento do browser
        const launchOptions = { headless: true };
        
        // Configurar proxy por região
        const proxyServer = getProxyForRegion(scenario.region);
        if (proxyServer) {
            launchOptions.proxy = { server: proxyServer };
            console.log(`🌍 Usando Proxy para região: ${scenario.region}`);
        }

        browser = await chromium.launch(launchOptions);
        
        // 4. Criar contexto com configuração completa
        const contextOptions = {
            ...config.contextOptions,
            recordVideo: {
                dir: tempDir,
                size: { width: 1280, height: 720 }
            }
        };

        context = await browser.newContext(contextOptions);
        page = await context.newPage();

        // 5. Executar Navegação
        console.log(`🚀 Navegando para: ${job.target_url}`);
        await page.goto(job.target_url, { 
            waitUntil: 'domcontentloaded', 
            timeout: CAPTURE_CONFIG.navigationTimeout 
        });
        
        // 6. Espera inicial para scripts de cloaker rodarem
        await page.waitForTimeout(CAPTURE_CONFIG.cloakerWaitTime);

        // 7. Executar interação humana
        await performHumanInteraction(page, {
            scrollDown: true,
            scrollUp: true,
            clickNeutral: true,
            moveMouseRandomly: true,
            duration: 5000
        });

        // 8. Detectar VSL
        const vslResult = await detectVSL(page);
        vslDetected = vslResult.hasVSL;

        // 9. Se VSL detectado, assistir por tempo configurado
        if (vslDetected) {
            const watchDuration = CAPTURE_CONFIG.videoMinDuration + 
                Math.floor(Math.random() * (CAPTURE_CONFIG.videoMaxDuration - CAPTURE_CONFIG.videoMinDuration));
            await watchVSL(page, watchDuration);
        }

        // 10. Capturar URL final após todas as interações
        finalUrl = page.url();
        console.log(`🏁 URL Final: ${finalUrl}`);

        // 11. Capturar Screenshot Full-Page
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const screenshotFileName = `${job.id}_screenshot_${Date.now()}.png`;

        // 12. Upload do screenshot para Supabase Storage
        const { error: screenshotError } = await supabase
            .storage
            .from('cloaker_evidence')
            .upload(screenshotFileName, screenshotBuffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (screenshotError) throw new Error(`Erro upload screenshot: ${screenshotError.message}`);

        // Obter URL Pública do screenshot
        const { data: screenshotPublicUrl } = supabase
            .storage
            .from('cloaker_evidence')
            .getPublicUrl(screenshotFileName);
            
        screenshotUrl = screenshotPublicUrl.publicUrl;
        console.log(`📸 Screenshot salvo: ${screenshotUrl}`);

        // 13. Salvar e fazer upload do vídeo se VSL foi detectado
        if (vslDetected) {
            // Fechar página para finalizar gravação
            await page.close();
            
            // Aguardar um pouco para o vídeo ser salvo
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Encontrar arquivo de vídeo gerado
            const videoFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.webm'));
            
            if (videoFiles.length > 0) {
                const videoPath = path.join(tempDir, videoFiles[0]);
                const videoBuffer = fs.readFileSync(videoPath);
                const videoFileName = `${job.id}_video_${Date.now()}.webm`;
                
                const { error: videoError } = await supabase
                    .storage
                    .from('cloaker_evidence')
                    .upload(videoFileName, videoBuffer, {
                        contentType: 'video/webm',
                        upsert: true
                    });

                if (!videoError) {
                    const { data: videoPublicUrl } = supabase
                        .storage
                        .from('cloaker_evidence')
                        .getPublicUrl(videoFileName);
                    
                    videoUrl = videoPublicUrl.publicUrl;
                    console.log(`🎥 Vídeo VSL salvo: ${videoUrl}`);
                }
            }
        }

        // 14. Atualizar Job com Sucesso
        const resultData = {
            status: 'completed',
            result_url: screenshotUrl,
            error_log: JSON.stringify({
                finalUrl,
                vslDetected,
                videoUrl: videoUrl || null,
                scenario: {
                    device: scenario.device,
                    platform: scenario.platform,
                    region: scenario.region,
                    language: scenario.language
                },
                timestamp: new Date().toISOString()
            })
        };

        await supabase.from('cloaker_jobs').update(resultData).eq('id', job.id);

        console.log("✅ Job finalizado com sucesso.");

    } catch (err) {
        console.error(`❌ Erro no Job: ${err.message}`);
        await supabase.from('cloaker_jobs').update({
            status: 'error',
            error_log: JSON.stringify({
                error: err.message,
                stack: err.stack,
                timestamp: new Date().toISOString()
            })
        }).eq('id', job.id);
    } finally {
        // Cleanup
        if (browser) await browser.close();
        
        // Limpar diretório temporário
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupErr) {
            console.warn('⚠️ Erro ao limpar diretório temporário:', cleanupErr.message);
        }
    }
}

/**
 * Função principal - Processa jobs da fila
 */
async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("🛡️  CloakerBreaker Enterprise v1.0");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📋 Dispositivos suportados:", Object.keys(DEVICE_MAP).join(', '));
    console.log("🌐 Plataformas suportadas:", Object.keys(PLATFORM_MAP).join(', '));
    console.log("🌍 Regiões suportadas:", Object.keys(REGION_MAP).join(', '));
    console.log("🗣️ Idiomas suportados:", Object.keys(LANGUAGE_MAP).join(', '));
    console.log("═══════════════════════════════════════════════════════════\n");
    
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

    // Estatísticas
    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Processa sequencialmente
    for (const job of jobs) {
        try {
            await processJob(job);
            successful++;
        } catch (e) {
            console.error(`Erro ao processar job ${job.id}:`, e.message);
            failed++;
        }
        processed++;
    }

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(`📊 Resumo: ${processed} processados | ${successful} sucesso | ${failed} falhas`);
    console.log("═══════════════════════════════════════════════════════════");
}

// Exportar funções para uso externo
export { processJob, main, getProxyForRegion };

// Executar se chamado diretamente
main();
