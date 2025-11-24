/**
 * cloaker_config.test.mjs
 * Testes para o módulo de configuração do CloakerBreaker
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    DEVICE_MAP,
    PLATFORM_MAP,
    REGION_MAP,
    LANGUAGE_MAP,
    CAPTURE_CONFIG,
    generateScenarios,
    validateScenario,
    getScenarioConfig
} from '../cloaker_config.mjs';

describe('DEVICE_MAP', () => {
    it('should contain all required devices', () => {
        const requiredDevices = ['android', 'iphone', 'ipad', 'desktop', 'windows_phone'];
        for (const device of requiredDevices) {
            assert.ok(DEVICE_MAP[device], `Device '${device}' should exist`);
        }
    });

    it('should have viewport for each device', () => {
        for (const [name, config] of Object.entries(DEVICE_MAP)) {
            assert.ok(config.viewport, `Device '${name}' should have viewport`);
            assert.ok(config.viewport.width, `Device '${name}' should have viewport.width`);
            assert.ok(config.viewport.height, `Device '${name}' should have viewport.height`);
        }
    });

    it('should have userAgent for each device', () => {
        for (const [name, config] of Object.entries(DEVICE_MAP)) {
            assert.ok(config.userAgent, `Device '${name}' should have userAgent`);
        }
    });
});

describe('PLATFORM_MAP', () => {
    it('should contain all required platforms', () => {
        const requiredPlatforms = ['facebook', 'google', 'youtube', 'instagram', 'direct'];
        for (const platform of requiredPlatforms) {
            assert.ok(PLATFORM_MAP[platform], `Platform '${platform}' should exist`);
        }
    });

    it('should have referer for platforms except direct', () => {
        for (const [name, config] of Object.entries(PLATFORM_MAP)) {
            if (name !== 'direct') {
                assert.ok(config.referer, `Platform '${name}' should have referer`);
                assert.ok(config.referer.startsWith('https://'), `Platform '${name}' referer should start with https://`);
            }
        }
    });
});

describe('REGION_MAP', () => {
    it('should contain all required regions', () => {
        const requiredRegions = ['br', 'co', 'us', 'mx', 'fr', 'ca', 'pt', 'au-sydney', 'de', 'it'];
        for (const region of requiredRegions) {
            assert.ok(REGION_MAP[region], `Region '${region}' should exist`);
        }
    });

    it('should have timezone for each region', () => {
        for (const [name, config] of Object.entries(REGION_MAP)) {
            assert.ok(config.timezone, `Region '${name}' should have timezone`);
        }
    });

    it('should have geolocation for each region', () => {
        for (const [name, config] of Object.entries(REGION_MAP)) {
            assert.ok(config.geolocation, `Region '${name}' should have geolocation`);
            assert.ok(typeof config.geolocation.latitude === 'number', `Region '${name}' should have latitude`);
            assert.ok(typeof config.geolocation.longitude === 'number', `Region '${name}' should have longitude`);
        }
    });
});

describe('LANGUAGE_MAP', () => {
    it('should contain all required languages', () => {
        const requiredLanguages = ['pt', 'en', 'es', 'de', 'it', 'fr'];
        for (const lang of requiredLanguages) {
            assert.ok(LANGUAGE_MAP[lang], `Language '${lang}' should exist`);
        }
    });

    it('should have code and acceptLanguage for each language', () => {
        for (const [name, config] of Object.entries(LANGUAGE_MAP)) {
            assert.ok(config.code, `Language '${name}' should have code`);
            assert.ok(config.acceptLanguage, `Language '${name}' should have acceptLanguage`);
        }
    });
});

describe('CAPTURE_CONFIG', () => {
    it('should have required capture settings', () => {
        assert.ok(CAPTURE_CONFIG.cloakerWaitTime > 0, 'Should have cloakerWaitTime');
        assert.ok(CAPTURE_CONFIG.navigationTimeout > 0, 'Should have navigationTimeout');
        assert.ok(CAPTURE_CONFIG.videoMinDuration > 0, 'Should have videoMinDuration');
        assert.ok(CAPTURE_CONFIG.videoMaxDuration > 0, 'Should have videoMaxDuration');
        assert.ok(CAPTURE_CONFIG.vslPatterns.length > 0, 'Should have vslPatterns');
    });

    it('should have valid video duration range', () => {
        assert.ok(CAPTURE_CONFIG.videoMinDuration >= 30, 'videoMinDuration should be at least 30');
        assert.ok(CAPTURE_CONFIG.videoMaxDuration <= 60, 'videoMaxDuration should be at most 60');
        assert.ok(CAPTURE_CONFIG.videoMinDuration < CAPTURE_CONFIG.videoMaxDuration, 'min should be less than max');
    });
});

describe('generateScenarios', () => {
    it('should generate correct number of scenarios', () => {
        const options = {
            devices: ['android', 'iphone'],
            platforms: ['facebook', 'google'],
            regions: ['br', 'us'],
            languages: ['pt', 'en']
        };
        
        const scenarios = generateScenarios(options);
        const expectedCount = 2 * 2 * 2 * 2; // 16 scenarios
        
        assert.strictEqual(scenarios.length, expectedCount);
    });

    it('should generate scenarios with all properties', () => {
        const options = {
            devices: ['android'],
            platforms: ['facebook'],
            regions: ['br'],
            languages: ['pt']
        };
        
        const scenarios = generateScenarios(options);
        
        assert.strictEqual(scenarios.length, 1);
        assert.strictEqual(scenarios[0].device, 'android');
        assert.strictEqual(scenarios[0].platform, 'facebook');
        assert.strictEqual(scenarios[0].region, 'br');
        assert.strictEqual(scenarios[0].language, 'pt');
        assert.ok(scenarios[0].id);
    });
});

describe('validateScenario', () => {
    it('should validate correct scenario', () => {
        const scenario = {
            device: 'android',
            platform: 'facebook',
            region: 'br',
            language: 'pt'
        };
        
        const result = validateScenario(scenario);
        
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.errors.length, 0);
    });

    it('should reject invalid device', () => {
        const scenario = {
            device: 'invalid_device',
            platform: 'facebook',
            region: 'br',
            language: 'pt'
        };
        
        const result = validateScenario(scenario);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Dispositivo')));
    });

    it('should reject invalid platform', () => {
        const scenario = {
            device: 'android',
            platform: 'invalid_platform',
            region: 'br',
            language: 'pt'
        };
        
        const result = validateScenario(scenario);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Plataforma')));
    });

    it('should reject invalid region', () => {
        const scenario = {
            device: 'android',
            platform: 'facebook',
            region: 'invalid_region',
            language: 'pt'
        };
        
        const result = validateScenario(scenario);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Região')));
    });

    it('should reject invalid language', () => {
        const scenario = {
            device: 'android',
            platform: 'facebook',
            region: 'br',
            language: 'invalid_lang'
        };
        
        const result = validateScenario(scenario);
        
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('Idioma')));
    });
});

describe('getScenarioConfig', () => {
    it('should return complete configuration for scenario', () => {
        const scenario = {
            device: 'android',
            platform: 'facebook',
            region: 'br',
            language: 'pt'
        };
        
        const config = getScenarioConfig(scenario);
        
        assert.ok(config.device);
        assert.ok(config.platform);
        assert.ok(config.region);
        assert.ok(config.language);
        assert.ok(config.contextOptions);
    });

    it('should have correct contextOptions', () => {
        const scenario = {
            device: 'iphone',
            platform: 'google',
            region: 'us',
            language: 'en'
        };
        
        const config = getScenarioConfig(scenario);
        
        assert.ok(config.contextOptions.locale);
        assert.ok(config.contextOptions.timezoneId);
        assert.ok(config.contextOptions.geolocation);
        assert.ok(config.contextOptions.extraHTTPHeaders);
    });

    it('should fallback to defaults for invalid scenario', () => {
        const scenario = {
            device: 'invalid',
            platform: 'invalid',
            region: 'invalid',
            language: 'invalid'
        };
        
        const config = getScenarioConfig(scenario);
        
        // Should return fallback config, not throw
        assert.ok(config.device);
        assert.ok(config.contextOptions);
    });
});
