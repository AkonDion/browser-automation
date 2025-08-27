const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs-extra');
const logger = require('./logger');

class BrowserManager {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initialize() {
    try {
      logger.info('Initializing browser...');
      
      // Ensure directories exist
      await fs.ensureDir(this.config.paths.screenshots);
      await fs.ensureDir(this.config.paths.videos);

      // Launch browser with debug options
      const launchOptions = {
        headless: this.config.headless,
        slowMo: this.config.slowMo,
        devtools: this.config.devtools,
        ...this.config.browser.chromium
      };

      // Enable debugging if PWDEBUG is set
      if (process.env.PWDEBUG) {
        launchOptions.devtools = true;
        logger.info('🐛 Debug mode enabled - Playwright Inspector will open');
      }

      this.browser = await chromium.launch(launchOptions);

      // Create context with recording options
      const contextOptions = {
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        recordVideo: this.config.video ? {
          dir: this.config.paths.videos,
          size: { width: 1920, height: 1080 }
        } : undefined
      };

      this.context = await this.browser.newContext(contextOptions);
      
      // Create page
      this.page = await this.context.newPage();
      
      // Set timeouts
      this.page.setDefaultTimeout(this.config.timeout);
      this.page.setDefaultNavigationTimeout(this.config.timeout);

      // Add page event listeners
      this.page.on('console', msg => {
        logger.info(`Browser console [${msg.type()}]: ${msg.text()}`);
      });

      this.page.on('pageerror', error => {
        logger.error('Browser page error:', error);
      });

      // Log all requests
      this.page.on('request', request => {
        logger.info(`Navigation request: ${request.url()}`);
      });

      this.page.on('requestfailed', request => {
        logger.warn(`Request failed: ${request.url()} - ${request.failure().errorText}`);
      });

      logger.info('Browser initialized successfully');
      return this.page;
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async takeScreenshot(name = 'screenshot') {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${name}_${timestamp}.png`;
      const filepath = path.join(this.config.paths.screenshots, filename);
      
      await this.page.screenshot({
        path: filepath,
        fullPage: true
      });
      
      logger.info(`Screenshot saved: ${filename}`);
      return filepath;
    } catch (error) {
      logger.error('Failed to take screenshot:', error);
      throw error;
    }
  }

  async waitForSelector(selector, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info(`Waiting for selector: ${selector}`);
      const element = await this.page.waitForSelector(selector, {
        timeout: this.config.timeout,
        ...options
      });
      
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      logger.info(`Found element: ${selector}`);
      return element;
    } catch (error) {
      logger.error(`Failed to find element ${selector}:`, error);
      await this.takeScreenshot(`error_${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
      throw error;
    }
  }

  async fillField(selector, value, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info(`Filling field ${selector} with value: ${value}`);
      
      const element = await this.waitForSelector(selector);
      await element.clear();
      await element.fill(value, options);
      
      logger.info(`Successfully filled field: ${selector}`);
    } catch (error) {
      logger.error(`Failed to fill field ${selector}:`, error);
      throw error;
    }
  }

  async selectOption(selector, value, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info(`Selecting option ${value} in ${selector}`);
      
      const element = await this.waitForSelector(selector);
      await element.selectOption(value, options);
      
      logger.info(`Successfully selected option: ${value}`);
    } catch (error) {
      logger.error(`Failed to select option ${value} in ${selector}:`, error);
      throw error;
    }
  }

  async clickElement(selector, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info(`Clicking element: ${selector}`);
      
      const element = await this.waitForSelector(selector);
      await element.click(options);
      
      logger.info(`Successfully clicked element: ${selector}`);
    } catch (error) {
      logger.error(`Failed to click element ${selector}:`, error);
      throw error;
    }
  }

  async getElementText(selector, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info(`Getting text from element: ${selector}`);
      
      const element = await this.waitForSelector(selector, options);
      const text = await element.textContent();
      
      logger.info(`Got text from ${selector}: ${text}`);
      return text;
    } catch (error) {
      logger.error(`Failed to get text from element ${selector}:`, error);
      throw error;
    }
  }

  async pauseForInspection(message = 'Paused for inspection', duration = 0) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      logger.info(`⏸️  ${message}`);
      
      if (process.env.PWDEBUG) {
        // Use Playwright's built-in pause for debugging
        await this.page.pause();
      } else if (duration > 0) {
        // Pause for specific duration
        logger.info(`⏱️  Waiting for ${duration}ms...`);
        await this.page.waitForTimeout(duration);
      } else {
        // Manual pause - wait for user input
        console.log(`\n⏸️  ${message}`);
        console.log('Press Enter to continue...');
        await new Promise(resolve => {
          process.stdin.once('data', () => resolve());
        });
      }
      
      logger.info('▶️  Continuing automation...');
    } catch (error) {
      logger.error('Error during pause:', error);
    }
  }

  async close() {
    try {
      if (this.page) {
        await this.page.close();
        logger.info('Page closed');
      }
      
      if (this.context) {
        await this.context.close();
        logger.info('Browser context closed');
      }
      
      if (this.browser) {
        await this.browser.close();
        logger.info('Browser closed');
      }
    } catch (error) {
      logger.error('Error closing browser:', error);
    }
  }
}

module.exports = BrowserManager; 