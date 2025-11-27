/**
 * standalone_cloaker.mjs
 * Standalone Cloaker Breaker Script
 * Navigates to a URL, waits for cloaker redirects, extracts video/iframe URLs
 * No Supabase dependency - outputs to console
 *
 * Usage: node standalone_cloaker.mjs --url <url> [--wait <ms>] [--headful]
 */

import { chromium } from 'playwright';

// Parse CLI arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        url: '',
        wait: 12000,
        headful: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--url' && args[i + 1]) {
            config.url = args[i + 1];
            i++;
        } else if (args[i] === '--wait' && args[i + 1]) {
            const waitValue = parseInt(args[i + 1], 10);
            if (!isNaN(waitValue) && waitValue > 0) {
                config.wait = waitValue;
            }
            i++;
        } else if (args[i] === '--headful') {
            config.headful = true;
        }
    }

    return config;
}

async function extractMediaUrls(page) {
    // Extract video src and source src from <video> elements
    const videoUrls = await page.evaluate(() => {
        const urls = [];
        
        // Get <video> src attributes
        document.querySelectorAll('video[src]').forEach(video => {
            if (video.src) urls.push(video.src);
        });
        
        // Get <source> src inside <video> elements
        document.querySelectorAll('video source[src]').forEach(source => {
            if (source.src) urls.push(source.src);
        });
        
        return urls;
    });

    // Extract iframe src attributes
    const iframeUrls = await page.evaluate(() => {
        const urls = [];
        document.querySelectorAll('iframe[src]').forEach(iframe => {
            if (iframe.src) urls.push(iframe.src);
        });
        return urls;
    });

    return { videoUrls, iframeUrls };
}

async function main() {
    const config = parseArgs();

    if (!config.url) {
        console.error('❌ ERROR: --url is required');
        console.log('Usage: node standalone_cloaker.mjs --url <url> [--wait <ms>] [--headful]');
        process.exit(1);
    }

    console.log('🛡️ Standalone Cloaker Breaker');
    console.log('================================');
    console.log(`📍 Target URL: ${config.url}`);
    console.log(`⏱️ Wait time: ${config.wait}ms`);
    console.log(`🖥️ Headful mode: ${config.headful}`);
    console.log('');

    let browser = null;

    try {
        // Launch browser
        browser = await chromium.launch({
            headless: !config.headful
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'pt-BR'
        });

        const page = await context.newPage();

        // Navigate to target URL
        console.log('🚀 Navigating to target URL...');
        await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for cloaker redirects and dynamic content
        console.log(`⏳ Waiting ${config.wait}ms for redirects and dynamic content...`);
        await page.waitForTimeout(config.wait);

        // Get final URL after redirects
        const finalUrl = page.url();
        console.log(`🏁 Final URL: ${finalUrl}`);
        console.log('');

        // Extract video and iframe URLs
        const { videoUrls, iframeUrls } = await extractMediaUrls(page);

        // Output results
        console.log('📹 Video URLs found:');
        if (videoUrls.length === 0) {
            console.log('   (none)');
        } else {
            videoUrls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
        }
        console.log('');

        console.log('🖼️ Iframe URLs found:');
        if (iframeUrls.length === 0) {
            console.log('   (none)');
        } else {
            iframeUrls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));
        }
        console.log('');

        // Output summary in GitHub Actions format
        console.log('::group::Summary');
        console.log(`FINAL_URL=${finalUrl}`);
        console.log(`VIDEO_COUNT=${videoUrls.length}`);
        console.log(`IFRAME_COUNT=${iframeUrls.length}`);
        if (videoUrls.length > 0) {
            console.log(`VIDEO_URLS=${JSON.stringify(videoUrls)}`);
        }
        if (iframeUrls.length > 0) {
            console.log(`IFRAME_URLS=${JSON.stringify(iframeUrls)}`);
        }
        console.log('::endgroup::');

        console.log('✅ Cloaker test completed successfully.');

    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

main();
