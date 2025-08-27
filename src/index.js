#!/usr/bin/env node

const DaikinAutomation = require('./daikinAutomation');
const config = require('./config/config');
const logger = require('./utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'development';
const repeat = parseInt(args.find(arg => arg.startsWith('--repeat='))?.split('=')[1] || '1');
const retries = parseInt(args.find(arg => arg.startsWith('--retries='))?.split('=')[1] || '0');

async function runSingleTest(currentConfig, attempt = 1, totalAttempts = 1) {
  let automation = null;
  
  try {
    logger.info(`Starting warranty registration automation in ${mode} mode (Attempt ${attempt}/${totalAttempts})`);
    
    logger.info('Configuration loaded', { 
      mode, 
      headless: currentConfig.headless,
      url: currentConfig.form.url 
    });
    
    // Initialize Daikin automation
    automation = new DaikinAutomation(currentConfig);
    await automation.initialize();
    
    // Run the automation
    const result = await automation.runFirstPageAutomation();
    
    // Log results
    if (result.success) {
      logger.info(`✅ Attempt ${attempt}/${totalAttempts}: Warranty registration completed successfully!`, { result });
      console.log(`\n🎉 SUCCESS (${attempt}/${totalAttempts}): Warranty registration completed!`);
      console.log(`📄 Message: ${result.message}`);
      console.log(`🕐 Completed at: ${result.timestamp}`);
      return true;
    } else {
      logger.warn(`⚠️  Attempt ${attempt}/${totalAttempts}: Registration completed with warnings`, { result });
      console.log(`\n⚠️  WARNING (${attempt}/${totalAttempts}): Registration may not have completed properly`);
      console.log(`📄 Message: ${result.message}`);
      console.log(`🕐 Attempted at: ${result.timestamp}`);
      return false;
    }
  } catch (error) {
    logger.error(`❌ Attempt ${attempt}/${totalAttempts}: Registration failed:`, error);
    console.error(`\n❌ ERROR (${attempt}/${totalAttempts}): Registration failed`);
    console.error(`📄 Error: ${error.message}`);
    return false;
  } finally {
    // Always close browser
    if (automation) {
      await automation.close();
    }
  }
}

async function main() {
  try {
    // Get configuration for the specified mode
    const currentConfig = {
      ...config[mode],
      browser: config.browser,
      paths: config.paths,
      form: config.form
    };
    
    let successCount = 0;
    let failureCount = 0;
    
    logger.info(`Starting smoke test with ${repeat} iterations and ${retries} retries per failure`);
    
    for (let i = 1; i <= repeat; i++) {
      let success = false;
      let attempt = 1;
      const maxAttempts = retries + 1;
      
      // Try the test with retries
      while (!success && attempt <= maxAttempts) {
        success = await runSingleTest(currentConfig, attempt, repeat);
        if (!success && attempt < maxAttempts) {
          logger.info(`Retrying test ${i}/${repeat} (Attempt ${attempt + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between retries
        }
        attempt++;
      }
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    // Log final results
    logger.info('Smoke test completed', {
      totalRuns: repeat,
      successful: successCount,
      failed: failureCount,
      successRate: `${((successCount / repeat) * 100).toFixed(1)}%`
    });
    
    // In development mode, keep browser open briefly to inspect
    if (mode === 'development') {
      logger.info('Development mode: keeping browser open for 5 seconds for inspection...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Exit with status code based on success rate
    process.exit(failureCount > 0 ? 1 : 0);
    
  } catch (error) {
    logger.error('❌ Smoke test failed:', error);
    process.exit(1);
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