const path = require('path');
require('dotenv').config();

const config = {
  // Environment settings
  development: {
    headless: false,
    slowMo: 1000,
    timeout: 30000,
    screenshot: true,
    video: true,
    devtools: true
  },
  debug: {
    headless: false,
    slowMo: 0,
    timeout: 0, // No timeout in debug mode
    screenshot: true,
    video: true,
    devtools: true
  },
  production: {
    headless: true,
    slowMo: 0,
    timeout: 10000,
    screenshot: false,
    video: false,
    devtools: false
  },
  vm: {
    headless: true,
    slowMo: 0,
    timeout: 15000,
    screenshot: false,
    video: false,
    devtools: false
  },
  test: {
    headless: false,
    slowMo: 500,
    timeout: 15000,
    screenshot: true,
    video: true,
    devtools: false
  },

  // Browser settings
  browser: {
    chromium: {
      // Use Playwright's bundled Chromium instead of system Chrome
      // channel: 'chrome', // Commented out - use Playwright Chromium
      args: [
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  },

  // Daikin Form configuration
  form: {
    url: process.env.FORM_URL || 'https://daikincomfort.com/my-daikin-systems/product-registration',
    
    // Daikin-specific selectors (updated with actual form selectors)
    selectors: {
      // Container selectors - we'll search for inputs within these
      serialNumberContainer: '#cdk-step-content-1-0 > mat-card > form > section > div > mat-form-field.mat-form-field.ng-tns-c84-18.mat-primary.mat-form-field-type-mat-input.mat-form-field-appearance-legacy.mat-form-field-can-float.mat-form-field-has-label.mat-form-field-hide-placeholder.ng-valid.ng-star-inserted.ng-dirty.ng-touched > div > div.mat-form-field-flex.ng-tns-c84-18 > div',
      modelContainer: '#cdk-step-content-1-0 > mat-card > form > section > div > mat-form-field.mat-form-field.example-full-width.ng-tns-c84-19.mat-primary.mat-form-field-type-mat-input.mat-form-field-appearance-legacy.mat-form-field-can-float.mat-form-field-has-label.mat-form-field-hide-placeholder.ng-valid.ng-star-inserted.ng-pristine.mat-form-field-should-float.ng-touched > div > div.mat-form-field-flex.ng-tns-c84-19 > div',
      
      // Primary selectors - based on your provided paths + input targeting
      serialNumber: '#cdk-step-content-1-0 > mat-card > form > section > div > mat-form-field.mat-form-field.ng-tns-c84-18.mat-primary.mat-form-field-type-mat-input.mat-form-field-appearance-legacy.mat-form-field-can-float.mat-form-field-has-label.mat-form-field-hide-placeholder.ng-valid.ng-star-inserted.ng-dirty.ng-touched input',
      model: '#cdk-step-content-1-0 > mat-card > form > section > div > mat-form-field.mat-form-field.example-full-width.ng-tns-c84-19.mat-primary.mat-form-field-type-mat-input.mat-form-field-appearance-legacy.mat-form-field-can-float.mat-form-field-has-label.mat-form-field-hide-placeholder.ng-valid.ng-star-inserted.ng-pristine.mat-form-field-should-float.ng-touched input',
      
      // Simplified alternatives for inputs
      serialNumberSimple: process.env.SERIAL_NUMBER_SELECTOR || '#cdk-step-content-1-0 mat-form-field:nth-of-type(1) input',
      modelSimple: process.env.MODEL_SELECTOR || '#cdk-step-content-1-0 mat-form-field:nth-of-type(2) input',
      
      // Buttons and other elements
      addSerialButton: process.env.ADD_SERIAL_BUTTON || '#cdk-step-content-1-0 > mat-card > form > section > div > div:nth-child(3) > button',
      installationDate: process.env.INSTALLATION_DATE_SELECTOR || '#mat-input-14',
      residentialRadio: process.env.RESIDENTIAL_RADIO_BUTTON || '#mat-radio-6 > label > span.mat-radio-container > span.mat-radio-outer-circle',
      nextButton: process.env.NEXT_BUTTON || '#cdk-step-content-1-0 > mat-card > form > section > div > div:nth-child(7) > button',
      
      // Future pages (to be updated as we progress)
      confirmationMessage: process.env.CONFIRMATION_SELECTOR || '.confirmation-message, .success-message, .alert-success'
    },

    // Default test data (from test-payload.json)
    data: {
      products: [
        {
          serial: "2309060933",
          model: "DZ6VSA421E"
        }
      ],
      installationDate: "08/08/2025",
      customer: {
        firstName: "Jeremy",
        lastName: "Lachaine",
        phone: "6135555555",
        email: "jeremy@comforthub.ca",
        address1: "420 lapland private",
        zipPostal: "K2V 0S2",
        city: "Kanata",
        stateProvince: "ON",
        country: "Canada"
      },
      dealer: {
        dealerZip: "k2m 2g9",
        dealerName: "comfort hub",
        dealerAddress: "430 lapland private",
        dealerCity: "Kanata",
        dealerState: "ON",
        dealerPhone: "6135811700",
        dealerCountry: "Canada"
      },
      registrationType: "contractor",
      residentialType: "ownerOccupied"
    }
  },

  // Webhook configuration
  webhook: {
    port: process.env.WEBHOOK_PORT || 3000,
    endpoint: process.env.WEBHOOK_ENDPOINT || '/webhook/warranty-registration'
  },

  // Paths
  paths: {
    screenshots: path.join(__dirname, '../../screenshots'),
    videos: path.join(__dirname, '../../videos'),
    logs: path.join(__dirname, '../../logs')
  },

  // Download configuration (VM deployment ready)
  downloads: {
    // VM-optimized path - use environment variable or default to /app/downloads for VM
    path: process.env.DOWNLOAD_PATH || (process.env.NODE_ENV === 'vm' ? '/app/downloads' : path.join(require('os').homedir(), 'Downloads')),
    
    // For VM deployment - serve downloads via API for easy access
    serveViaAPI: process.env.SERVE_DOWNLOADS_VIA_API === 'true' || process.env.NODE_ENV === 'vm',
    apiEndpoint: '/downloads'
  },

  // Certificate cleanup configuration
  cleanup: {
    enabled: process.env.CLEANUP_ENABLED !== 'false', // Default enabled, can disable with env var
    retentionHours: parseInt(process.env.CLEANUP_RETENTION_HOURS || '48'), // Default 48 hours
    scheduleInterval: parseInt(process.env.CLEANUP_SCHEDULE_HOURS || '6'), // Run every 6 hours
    runOnStartup: process.env.CLEANUP_RUN_ON_STARTUP !== 'false' // Default run on startup
  }
};

module.exports = config; 