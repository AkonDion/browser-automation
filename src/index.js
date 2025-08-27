#!/usr/bin/env node

const DaikinAutomation = require('./daikinAutomation');
const config = require('./config/config');
const logger = require('./utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'development';

async function main() {
  let automation = null;
  
  try {
    logger.info(`Starting warranty registration automation in ${mode} mode`);
    
    // Get configuration for the specified mode
    const currentConfig = {
      ...config[mode],
      browser: config.browser,
      paths: config.paths,
      form: config.form
    };
    
    logger.info('Configuration loaded', { 
      mode, 
      headless: currentConfig.headless,
      url: currentConfig.form.url 
    });
    
    // Initialize Daikin automation
    automation = new DaikinAutomation(currentConfig);
    await automation.initialize();
    
    // Run the automation (Page 1 only for now)
    const result = await automation.runFirstPageAutomation();
    
    // Log results
    if (result.success) {
      logger.info('✅ Warranty registration completed successfully!', { result });
      console.log('\n🎉 SUCCESS: Warranty registration completed!');
      console.log(`📄 Message: ${result.message}`);
      console.log(`🕐 Completed at: ${result.timestamp}`);
    } else {
      logger.warn('⚠️  Warranty registration completed with warnings', { result });
      console.log('\n⚠️  WARNING: Registration may not have completed properly');
      console.log(`📄 Message: ${result.message}`);
      console.log(`🕐 Attempted at: ${result.timestamp}`);
    }
    
    // In development mode, keep browser open briefly to inspect
    if (mode === 'development') {
      logger.info('Development mode: keeping browser open for 5 seconds for inspection...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
  } catch (error) {
    logger.error('❌ Warranty registration automation failed:', error);
    console.error('\n❌ ERROR: Warranty registration failed');
    console.error(`📄 Error: ${error.message}`);
    
    process.exit(1);
  } finally {
    // Always close browser
    if (automation) {
      await automation.close();
    }
    
    logger.info('Automation process completed');
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    logger.error('Main function failed:', error);
    process.exit(1);
  });
}

module.exports = { main, DaikinAutomation }; 