/**
 * cloaker_config.mjs
 * Configurações do CloakerBreaker Enterprise
 * Define dispositivos, plataformas, regiões e idiomas suportados
 */

import { devices } from 'playwright';

// ============================================
// DISPOSITIVOS SUPORTADOS
// ============================================
export const DEVICE_MAP = {
    // Desktop
    'desktop': {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
    },
    'desktop_win': {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
    },
    'desktop_mac': {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: false
    },
    // Android
    'android': {
        ...devices['Galaxy S9+'],
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    },
    // iPhone
    'iphone': {
        ...devices['iPhone 14 Pro'],
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    },
    // iPad
    'ipad': {
        ...devices['iPad Pro 11'],
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_1_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    },
    // Windows Phone
    'windows_phone': {
        userAgent: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Edge/14.14393',
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 4,
        isMobile: true,
        hasTouch: true
    }
};

// ============================================
// PLATAFORMAS SIMULADAS (Referers)
// ============================================
export const PLATFORM_MAP = {
    'facebook': {
        referer: 'https://www.facebook.com/',
        headers: {
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document'
        }
    },
    'google': {
        referer: 'https://www.google.com/',
        headers: {
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document'
        }
    },
    'youtube': {
        referer: 'https://www.youtube.com/',
        headers: {
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Dest': 'document'
        }
    },
    'instagram': {
        referer: 'https://www.instagram.com/',
        headers: {
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Dest': 'document'
        }
    },
    'tiktok': {
        referer: 'https://www.tiktok.com/',
        headers: {
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Dest': 'document'
        }
    },
    'direct': {
        referer: '',
        headers: {}
    }
};

// ============================================
// REGIÕES/PROXIES SUPORTADOS
// ============================================
export const REGION_MAP = {
    'br': {
        name: 'Brasil',
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR',
        geolocation: { latitude: -23.5505, longitude: -46.6333 } // São Paulo
    },
    'co': {
        name: 'Colômbia',
        timezone: 'America/Bogota',
        locale: 'es-CO',
        geolocation: { latitude: 4.7110, longitude: -74.0721 } // Bogotá
    },
    'us': {
        name: 'Estados Unidos',
        timezone: 'America/New_York',
        locale: 'en-US',
        geolocation: { latitude: 40.7128, longitude: -74.0060 } // New York
    },
    'mx': {
        name: 'México',
        timezone: 'America/Mexico_City',
        locale: 'es-MX',
        geolocation: { latitude: 19.4326, longitude: -99.1332 } // Mexico City
    },
    'fr': {
        name: 'França',
        timezone: 'Europe/Paris',
        locale: 'fr-FR',
        geolocation: { latitude: 48.8566, longitude: 2.3522 } // Paris
    },
    'ca': {
        name: 'Canadá',
        timezone: 'America/Toronto',
        locale: 'en-CA',
        geolocation: { latitude: 43.6532, longitude: -79.3832 } // Toronto
    },
    'pt': {
        name: 'Portugal',
        timezone: 'Europe/Lisbon',
        locale: 'pt-PT',
        geolocation: { latitude: 38.7223, longitude: -9.1393 } // Lisboa
    },
    'au-sydney': {
        name: 'Austrália (Sydney)',
        timezone: 'Australia/Sydney',
        locale: 'en-AU',
        geolocation: { latitude: -33.8688, longitude: 151.2093 } // Sydney
    },
    'de': {
        name: 'Alemanha',
        timezone: 'Europe/Berlin',
        locale: 'de-DE',
        geolocation: { latitude: 52.5200, longitude: 13.4050 } // Berlin
    },
    'it': {
        name: 'Itália',
        timezone: 'Europe/Rome',
        locale: 'it-IT',
        geolocation: { latitude: 41.9028, longitude: 12.4964 } // Roma
    }
};

// ============================================
// IDIOMAS SUPORTADOS
// ============================================
export const LANGUAGE_MAP = {
    'pt': {
        code: 'pt-BR',
        acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8'
    },
    'en': {
        code: 'en-US',
        acceptLanguage: 'en-US,en;q=0.9'
    },
    'es': {
        code: 'es-ES',
        acceptLanguage: 'es-ES,es;q=0.9,en;q=0.8'
    },
    'de': {
        code: 'de-DE',
        acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8'
    },
    'it': {
        code: 'it-IT',
        acceptLanguage: 'it-IT,it;q=0.9,en;q=0.8'
    },
    'fr': {
        code: 'fr-FR',
        acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8'
    }
};

// ============================================
// CONFIGURAÇÕES DE CAPTURA
// ============================================
export const CAPTURE_CONFIG = {
    // Tempo para esperar scripts de cloaker executarem (ms)
    cloakerWaitTime: 5000,
    
    // Timeout para navegação (ms)
    navigationTimeout: 30000,
    
    // Duração mínima de gravação de vídeo para VSL (segundos)
    videoMinDuration: 30,
    
    // Duração máxima de gravação de vídeo para VSL (segundos)
    videoMaxDuration: 60,
    
    // Padrões para detectar VSL na página
    vslPatterns: [
        'video',
        'iframe[src*="vimeo"]',
        'iframe[src*="youtube"]',
        'iframe[src*="wistia"]',
        'iframe[src*="vsl"]',
        '.vsl-container',
        '[class*="video"]',
        '[id*="video"]',
        'video-js',
        '.wistia_embed',
        '.evp-player',
        '[data-video-id]'
    ],
    
    // Intervalo de scroll para simular comportamento humano (ms)
    scrollInterval: 500,
    
    // Quantidade de pixels para scroll
    scrollAmount: 100
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Gera todas as combinações possíveis de cenários
 */
export function generateScenarios(options = {}) {
    const devices = options.devices || Object.keys(DEVICE_MAP);
    const platforms = options.platforms || Object.keys(PLATFORM_MAP);
    const regions = options.regions || Object.keys(REGION_MAP);
    const languages = options.languages || Object.keys(LANGUAGE_MAP);
    
    const scenarios = [];
    
    for (const device of devices) {
        for (const platform of platforms) {
            for (const region of regions) {
                for (const language of languages) {
                    scenarios.push({
                        device,
                        platform,
                        region,
                        language,
                        id: `${device}_${platform}_${region}_${language}`
                    });
                }
            }
        }
    }
    
    return scenarios;
}

/**
 * Valida uma configuração de cenário
 */
export function validateScenario(scenario) {
    const errors = [];
    
    if (!DEVICE_MAP[scenario.device]) {
        errors.push(`Dispositivo inválido: ${scenario.device}`);
    }
    
    if (!PLATFORM_MAP[scenario.platform]) {
        errors.push(`Plataforma inválida: ${scenario.platform}`);
    }
    
    if (!REGION_MAP[scenario.region]) {
        errors.push(`Região inválida: ${scenario.region}`);
    }
    
    if (!LANGUAGE_MAP[scenario.language]) {
        errors.push(`Idioma inválido: ${scenario.language}`);
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Obtém configuração completa para um cenário
 */
export function getScenarioConfig(scenario) {
    const device = DEVICE_MAP[scenario.device] || DEVICE_MAP['desktop'];
    const platform = PLATFORM_MAP[scenario.platform] || PLATFORM_MAP['direct'];
    const region = REGION_MAP[scenario.region] || REGION_MAP['us'];
    const language = LANGUAGE_MAP[scenario.language] || LANGUAGE_MAP['en'];
    
    return {
        device,
        platform,
        region,
        language,
        contextOptions: {
            ...device,
            locale: language.code,
            timezoneId: region.timezone,
            geolocation: region.geolocation,
            permissions: ['geolocation'],
            extraHTTPHeaders: {
                ...platform.headers,
                'Accept-Language': language.acceptLanguage,
                ...(platform.referer ? { 'Referer': platform.referer } : {})
            }
        }
    };
}
