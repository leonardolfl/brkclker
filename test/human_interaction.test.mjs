/**
 * human_interaction.test.mjs
 * Testes para o módulo de interação humana do CloakerBreaker
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mock do page do Playwright
function createMockPage(options = {}) {
    const viewport = options.viewport || { width: 1920, height: 1080 };
    const mousePositions = [];
    const scrollEvents = [];
    
    return {
        viewportSize: () => viewport,
        mouse: {
            move: async (x, y) => {
                mousePositions.push({ x, y });
            },
            wheel: async (deltaX, deltaY) => {
                scrollEvents.push({ deltaX, deltaY });
            },
            down: async () => {},
            up: async () => {}
        },
        click: async () => {},
        $: async () => null,
        $$: async (selector) => [],
        waitForTimeout: async (ms) => {
            // Fast mock - don't actually wait
        },
        // Expose internal state for testing
        _getMousePositions: () => mousePositions,
        _getScrollEvents: () => scrollEvents
    };
}

// Import functions to test (they work with page mock)
import {
    humanMouseMove,
    humanScroll,
    neutralClick,
    performHumanInteraction,
    detectVSL
} from '../human_interaction.mjs';

describe('humanMouseMove', () => {
    it('should move mouse to target position', async () => {
        const mockPage = createMockPage();
        
        await humanMouseMove(mockPage, 500, 300);
        
        const positions = mockPage._getMousePositions();
        assert.ok(positions.length > 0, 'Should have mouse movements');
        
        // Last position should be near target
        const lastPos = positions[positions.length - 1];
        assert.ok(Math.abs(lastPos.x - 500) < 10, 'Should end near target X');
        assert.ok(Math.abs(lastPos.y - 300) < 10, 'Should end near target Y');
    });

    it('should handle null viewport gracefully', async () => {
        const mockPage = {
            viewportSize: () => null,
            mouse: {
                move: async () => {}
            },
            waitForTimeout: async () => {}
        };
        
        // Should not throw
        await humanMouseMove(mockPage, 100, 100);
    });
});

describe('humanScroll', () => {
    it('should scroll down', async () => {
        const mockPage = createMockPage();
        
        await humanScroll(mockPage, 100, 'down');
        
        const scrolls = mockPage._getScrollEvents();
        assert.ok(scrolls.length > 0, 'Should have scroll events');
        
        // Sum of scroll deltas should be positive (down)
        const totalDeltaY = scrolls.reduce((sum, e) => sum + e.deltaY, 0);
        assert.ok(totalDeltaY > 0, 'Total scroll should be positive for down');
    });

    it('should scroll up', async () => {
        const mockPage = createMockPage();
        
        await humanScroll(mockPage, 100, 'up');
        
        const scrolls = mockPage._getScrollEvents();
        assert.ok(scrolls.length > 0, 'Should have scroll events');
        
        // Sum of scroll deltas should be negative (up)
        const totalDeltaY = scrolls.reduce((sum, e) => sum + e.deltaY, 0);
        assert.ok(totalDeltaY < 0, 'Total scroll should be negative for up');
    });
});

describe('neutralClick', () => {
    it('should perform click without error', async () => {
        const mockPage = createMockPage();
        let clicked = false;
        
        mockPage.mouse.down = async () => { clicked = true; };
        mockPage.mouse.up = async () => {};
        
        await neutralClick(mockPage);
        
        assert.ok(clicked, 'Should have performed click');
    });

    it('should handle missing viewport gracefully', async () => {
        const mockPage = {
            viewportSize: () => null,
            mouse: {
                move: async () => {},
                down: async () => {},
                up: async () => {}
            },
            waitForTimeout: async () => {}
        };
        
        // Should not throw
        await neutralClick(mockPage);
    });
});

describe('performHumanInteraction', () => {
    it('should perform all interactions', async () => {
        const mockPage = createMockPage();
        
        await performHumanInteraction(mockPage, {
            scrollDown: true,
            scrollUp: true,
            clickNeutral: true,
            moveMouseRandomly: true,
            duration: 100
        });
        
        const mousePositions = mockPage._getMousePositions();
        const scrollEvents = mockPage._getScrollEvents();
        
        assert.ok(mousePositions.length > 0, 'Should have mouse movements');
        assert.ok(scrollEvents.length > 0, 'Should have scroll events');
    });

    it('should respect disabled options', async () => {
        const mockPage = createMockPage();
        
        await performHumanInteraction(mockPage, {
            scrollDown: false,
            scrollUp: false,
            clickNeutral: false,
            moveMouseRandomly: false,
            duration: 100
        });
        
        // Should complete without error even with all options disabled
    });
});

describe('detectVSL', () => {
    it('should detect no VSL on empty page', async () => {
        const mockPage = {
            $$: async () => []
        };
        
        const result = await detectVSL(mockPage);
        
        assert.strictEqual(result.hasVSL, false);
        assert.strictEqual(result.elements.length, 0);
    });

    it('should detect VSL when video elements exist', async () => {
        const mockPage = {
            $$: async (selector) => {
                if (selector === 'video') {
                    return [{}]; // One video element
                }
                return [];
            }
        };
        
        const result = await detectVSL(mockPage);
        
        assert.strictEqual(result.hasVSL, true);
        assert.ok(result.elements.length > 0);
        assert.ok(result.elements.some(e => e.pattern === 'video'));
    });

    it('should detect VSL when iframe with video source exists', async () => {
        const mockPage = {
            $$: async (selector) => {
                if (selector.includes('youtube') || selector.includes('vimeo')) {
                    return [{}];
                }
                return [];
            }
        };
        
        const result = await detectVSL(mockPage);
        
        assert.strictEqual(result.hasVSL, true);
    });
});
