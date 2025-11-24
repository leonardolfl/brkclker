/**
 * human_interaction.mjs
 * Módulo de Interação Humana para CloakerBreaker Enterprise
 * Simula comportamentos realistas de usuário para bypass de cloakers
 */

import { CAPTURE_CONFIG } from './cloaker_config.mjs';

/**
 * Gera um delay aleatório dentro de um intervalo
 * @param {number} min - Mínimo em ms
 * @param {number} max - Máximo em ms
 * @returns {number}
 */
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gera um ponto aleatório na viewport
 * @param {object} viewport - Dimensões da viewport
 * @returns {{x: number, y: number}}
 */
function randomPoint(viewport) {
    return {
        x: Math.floor(Math.random() * viewport.width),
        y: Math.floor(Math.random() * viewport.height)
    };
}

/**
 * Gera pontos intermediários para movimento de mouse mais natural
 * @param {number} startX 
 * @param {number} startY 
 * @param {number} endX 
 * @param {number} endY 
 * @param {number} steps 
 * @returns {Array<{x: number, y: number}>}
 */
function generateBezierPath(startX, startY, endX, endY, steps = 10) {
    const points = [];
    
    // Pontos de controle para curva Bezier
    const cp1x = startX + (endX - startX) * 0.25 + (Math.random() - 0.5) * 50;
    const cp1y = startY + (endY - startY) * 0.25 + (Math.random() - 0.5) * 50;
    const cp2x = startX + (endX - startX) * 0.75 + (Math.random() - 0.5) * 50;
    const cp2y = startY + (endY - startY) * 0.75 + (Math.random() - 0.5) * 50;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.pow(1-t, 3) * startX + 
                  3 * Math.pow(1-t, 2) * t * cp1x + 
                  3 * (1-t) * Math.pow(t, 2) * cp2x + 
                  Math.pow(t, 3) * endX;
        const y = Math.pow(1-t, 3) * startY + 
                  3 * Math.pow(1-t, 2) * t * cp1y + 
                  3 * (1-t) * Math.pow(t, 2) * cp2y + 
                  Math.pow(t, 3) * endY;
        points.push({ x: Math.round(x), y: Math.round(y) });
    }
    
    return points;
}

/**
 * Simula movimento de mouse realista com curva Bezier
 * @param {Page} page - Instância do Playwright Page
 * @param {number} targetX - Coordenada X destino
 * @param {number} targetY - Coordenada Y destino
 */
export async function humanMouseMove(page, targetX, targetY) {
    try {
        const viewport = page.viewportSize();
        if (!viewport) return;
        
        // Posição inicial aleatória
        const startX = Math.floor(Math.random() * viewport.width);
        const startY = Math.floor(Math.random() * viewport.height);
        
        // Gera caminho com curva
        const path = generateBezierPath(startX, startY, targetX, targetY, 8);
        
        for (const point of path) {
            await page.mouse.move(point.x, point.y);
            await page.waitForTimeout(randomDelay(10, 30));
        }
    } catch (error) {
        console.warn('⚠️ Erro ao mover mouse:', error.message);
    }
}

/**
 * Simula scroll suave como um usuário real
 * @param {Page} page - Instância do Playwright Page
 * @param {number} amount - Quantidade de pixels para scroll
 * @param {string} direction - 'down' ou 'up'
 */
export async function humanScroll(page, amount = 100, direction = 'down') {
    try {
        const delta = direction === 'down' ? amount : -amount;
        const steps = Math.ceil(Math.abs(amount) / 20);
        
        for (let i = 0; i < steps; i++) {
            await page.mouse.wheel(0, delta / steps);
            await page.waitForTimeout(randomDelay(30, 80));
        }
    } catch (error) {
        console.warn('⚠️ Erro ao fazer scroll:', error.message);
    }
}

/**
 * Simula clique em área neutra (não interage com elementos importantes)
 * @param {Page} page - Instância do Playwright Page
 */
export async function neutralClick(page) {
    try {
        const viewport = page.viewportSize();
        if (!viewport) return;
        
        // Clica em área segura (centro da viewport, levemente offset)
        const x = Math.floor(viewport.width / 2) + randomDelay(-50, 50);
        const y = Math.floor(viewport.height / 2) + randomDelay(-50, 50);
        
        await humanMouseMove(page, x, y);
        await page.waitForTimeout(randomDelay(100, 300));
        
        // Clique suave
        await page.mouse.down();
        await page.waitForTimeout(randomDelay(50, 150));
        await page.mouse.up();
    } catch (error) {
        console.warn('⚠️ Erro ao clicar:', error.message);
    }
}

/**
 * Executa uma sequência completa de interação humana
 * @param {Page} page - Instância do Playwright Page
 * @param {object} options - Opções de interação
 */
export async function performHumanInteraction(page, options = {}) {
    const {
        scrollDown = true,
        scrollUp = false,
        clickNeutral = true,
        moveMouseRandomly = true,
        duration = 3000 // Duração total em ms
    } = options;
    
    console.log('🤖 Simulando comportamento humano...');
    
    const startTime = Date.now();
    const viewport = page.viewportSize();
    
    if (!viewport) {
        console.warn('⚠️ Viewport não disponível');
        return;
    }
    
    try {
        // 1. Movimento inicial do mouse
        if (moveMouseRandomly) {
            const point = randomPoint(viewport);
            await humanMouseMove(page, point.x, point.y);
        }
        
        // 2. Pequena pausa (usuário "lendo" a página)
        await page.waitForTimeout(randomDelay(500, 1000));
        
        // 3. Scroll para baixo (explorar conteúdo)
        if (scrollDown) {
            const scrollSteps = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < scrollSteps; i++) {
                await humanScroll(page, randomDelay(80, 150), 'down');
                await page.waitForTimeout(randomDelay(200, 500));
                
                // Verifica se ainda há tempo
                if (Date.now() - startTime > duration * 0.7) break;
            }
        }
        
        // 4. Clique neutro (mostrar interatividade)
        if (clickNeutral) {
            await neutralClick(page);
        }
        
        // 5. Scroll para cima (volta um pouco)
        if (scrollUp) {
            await humanScroll(page, randomDelay(50, 100), 'up');
        }
        
        // 6. Movimento final aleatório
        if (moveMouseRandomly) {
            const point = randomPoint(viewport);
            await humanMouseMove(page, point.x, point.y);
        }
        
        console.log('✅ Interação humana concluída');
    } catch (error) {
        console.warn('⚠️ Erro durante interação humana:', error.message);
    }
}

/**
 * Detecta presença de VSL (Video Sales Letter) na página
 * @param {Page} page - Instância do Playwright Page
 * @returns {Promise<{hasVSL: boolean, elements: Array}>}
 */
export async function detectVSL(page) {
    console.log('🔍 Detectando VSL na página...');
    
    const vslElements = [];
    
    for (const pattern of CAPTURE_CONFIG.vslPatterns) {
        try {
            const elements = await page.$$(pattern);
            if (elements.length > 0) {
                vslElements.push({
                    pattern,
                    count: elements.length
                });
            }
        } catch {
            // Ignora erros de seletores inválidos
        }
    }
    
    const hasVSL = vslElements.length > 0;
    
    if (hasVSL) {
        console.log(`🎬 VSL Detectado! Padrões encontrados: ${vslElements.map(e => e.pattern).join(', ')}`);
    } else {
        console.log('📝 Nenhum VSL detectado');
    }
    
    return { hasVSL, elements: vslElements };
}

/**
 * Aguarda e interage com VSL
 * @param {Page} page - Instância do Playwright Page
 * @param {number} duration - Duração em segundos para assistir VSL
 */
export async function watchVSL(page, duration = 30) {
    console.log(`🎥 Assistindo VSL por ${duration} segundos...`);
    
    // Tenta clicar no player para iniciar
    try {
        const videoSelectors = [
            'video',
            '.video-container',
            '[class*="play"]',
            '[aria-label*="play"]',
            '.vsl-container'
        ];
        
        for (const selector of videoSelectors) {
            const element = await page.$(selector);
            if (element) {
                const box = await element.boundingBox();
                if (box) {
                    // Clica no centro do elemento de vídeo
                    await humanMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
                    await page.waitForTimeout(randomDelay(200, 400));
                    await page.click(selector, { force: true }).catch(() => {});
                    break;
                }
            }
        }
    } catch (error) {
        console.warn('⚠️ Não foi possível interagir com o player VSL:', error.message);
    }
    
    // Simula assistindo o vídeo com pequenas interações
    const watchTime = duration * 1000;
    const intervalTime = 5000; // A cada 5 segundos faz algo
    const intervals = Math.floor(watchTime / intervalTime);
    
    for (let i = 0; i < intervals; i++) {
        await page.waitForTimeout(intervalTime);
        
        // Pequena interação aleatória (mouse move ou scroll pequeno)
        if (Math.random() > 0.5) {
            const viewport = page.viewportSize();
            if (viewport) {
                const point = randomPoint(viewport);
                await humanMouseMove(page, point.x, point.y);
            }
        }
    }
    
    console.log('✅ VSL assistido');
}
