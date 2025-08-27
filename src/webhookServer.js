const express = require('express');
const DaikinAutomation = require('./daikinAutomation');
const config = require('./config/config');
const logger = require('./utils/logger');
const CertificateCleanup = require('./utils/certificateCleanup');
const fs = require('fs');
const path = require('path');

class WebhookServer {
  constructor() {
    this.app = express();
    this.port = config.webhook.port;
    this.setupMiddleware();
    this.setupRoutes();
    
    // Initialize certificate cleanup system
    this.certificateCleanup = new CertificateCleanup(config);
    this.cleanupInterval = null;
  }

  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Basic logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        body: req.body,
        headers: req.headers 
      });
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'daikin-warranty-automation'
      });
    });

    // Main webhook endpoint for warranty registration
    this.app.post(config.webhook.endpoint, async (req, res) => {
      try {
        logger.info('Received warranty registration webhook', { payload: req.body });

        // Validate payload
        const validationResult = this.validateWebhookPayload(req.body);
        if (!validationResult.valid) {
          return res.status(400).json({
            error: 'Invalid payload',
            details: validationResult.errors
          });
        }

        // Transform webhook data to our format
        const formData = this.transformWebhookData(req.body);
        
        // Get current environment config
        const mode = process.env.NODE_ENV || 'production';
        const currentConfig = {
          ...config[mode],
          browser: config.browser,
          paths: config.paths,
          form: config.form
        };

        // Run automation and wait for result
        const result = await this.runAutomationAsync(currentConfig, formData, req.body);

        // If we have a PDF, send it back
        if (result && result.downloadPath && fs.existsSync(result.downloadPath)) {
          const pdfBuffer = fs.readFileSync(result.downloadPath);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
          return res.send(pdfBuffer);
        }

        // If no PDF, return success response
        res.json({
          success: true,
          message: 'Warranty registration completed',
          productCount: formData.products.length,
          installationDate: formData.installationDate,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Webhook processing error:', error);
        
        // Handle specific error types from DaikinAutomation
        if (error.type === 'ALREADY_REGISTERED') {
          return res.status(409).json({
            code: 'ALREADY_REGISTERED',
            serial: error.serial
          });
        }
        
        if (error.type === 'INVALID_SERIAL') {
          return res.status(400).json({
            code: 'INVALID_SERIAL',
            serial: error.serial
          });
        }
        
        // Default error response for unhandled errors
        res.status(500).json({
          code: 'ERROR',
          message: error.message
        });
      }
    });

    // Test endpoint for manual testing
    this.app.post('/test', async (req, res) => {
      try {
        const testData = {
          products: [
            { serial: 'E000187', model: 'DH9VSA361C' }
          ],
          installationDate: '6/3/2025'
        };

        logger.info('Running test automation with default data');
        
        const mode = process.env.NODE_ENV || 'development';
        const currentConfig = {
          ...config[mode],
          browser: config.browser,
          paths: config.paths,
          form: config.form
        };

        const result = await this.runAutomationAsync(currentConfig, testData, { test: true });

        // If we have a PDF, send it back
        if (result && result.downloadPath && fs.existsSync(result.downloadPath)) {
          const pdfBuffer = fs.readFileSync(result.downloadPath);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
          return res.send(pdfBuffer);
        }

        res.json({
          success: true,
          message: 'Test automation completed',
          testData: testData
        });

      } catch (error) {
        logger.error('Test endpoint error:', error);
        
        // Handle specific error types from DaikinAutomation
        if (error.type === 'ALREADY_REGISTERED') {
          return res.status(409).json({
            code: 'ALREADY_REGISTERED',
            serial: error.serial
          });
        }
        
        if (error.type === 'INVALID_SERIAL') {
          return res.status(400).json({
            code: 'INVALID_SERIAL',
            serial: error.serial
          });
        }
        
        // Default error response for unhandled errors
        res.status(500).json({
          code: 'ERROR',
          message: error.message
        });
      }
    });
  }

  validateWebhookPayload(payload) {
    const errors = [];

    // Check if products exist and is array
    if (!payload.products || !Array.isArray(payload.products)) {
      errors.push('products field must be an array');
    } else {
      // Filter out empty products and validate the rest
      payload.products = payload.products.filter(product => {
        // Skip empty or null products
        if (!product || (!product.serial && !product.model)) {
          return false;
        }
        return true;
      });

      // Validate remaining products
      payload.products.forEach((product, index) => {
        if (!product.serial) {
          errors.push(`Product ${index}: serial is required`);
        }
        if (!product.model) {
          errors.push(`Product ${index}: model is required`);
        }
      });

      // Ensure we have at least one valid product
      if (payload.products.length === 0) {
        errors.push('At least one valid product with serial and model is required');
      }
    }

    // Check installation date
    if (!payload.installationDate) {
      errors.push('installationDate is required');
    }

    // Validate customer data (optional for backward compatibility)
    if (payload.customer) {
      const customer = payload.customer;
      const requiredCustomerFields = ['firstName', 'lastName', 'phone', 'email', 'address1', 'zipPostal'];
      
      requiredCustomerFields.forEach(field => {
        if (!customer[field]) {
          errors.push(`Customer ${field} is required when customer data is provided`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  transformWebhookData(payload) {
    const transformedData = {
      products: payload.products.map(product => ({
        serial: product.serial.toString(),
        model: product.model.toString()
      })),
      installationDate: payload.installationDate.toString()
    };

    // Include customer data if provided
    if (payload.customer) {
      transformedData.customer = {
        firstName: payload.customer.firstName?.toString() || '',
        lastName: payload.customer.lastName?.toString() || '',
        phone: payload.customer.phone?.toString() || '',
        email: payload.customer.email?.toString() || '',
        address1: payload.customer.address1?.toString() || '',
        zipPostal: payload.customer.zipPostal?.toString() || '',
        city: payload.customer.city?.toString() || 'Ottawa',
        stateProvince: payload.customer.stateProvince?.toString() || 'ON'
      };
    }

    return transformedData;
  }

  async runAutomationAsync(config, formData, originalPayload) {
    let automation = null;
    let result = null;
    
    try {
      logger.info('Starting automation', { 
        productCount: formData.products.length,
        mode: config.headless ? 'production' : 'development'
      });

      // Initialize automation
      automation = new DaikinAutomation(config, formData);
      await automation.initialize();

      // Navigate to form
      await automation.navigateToForm();

      // Add all products
      await automation.addAllProducts();

      // Fill installation date
      await automation.fillInstallationDate();

      // Select residential option
      await automation.selectResidentialOption();

      // Click Next
      await automation.clickNext();

      // If customer data is provided, fill it
      if (formData.customer) {
        await automation.fillCustomerDetails(formData.customer);
        await automation.fillDealerBuilderInfo();
        result = await automation.completeRegistration();
      }

      logger.info('Automation completed successfully');
      return result;

    } catch (error) {
      logger.error('Automation failed:', error);
      throw error;
    } finally {
      if (automation) {
        await automation.close();
      }
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, '0.0.0.0', () => {
          logger.info(`🚀 Webhook server started on port ${this.port}`);
          logger.info(`📡 Webhook endpoint: POST http://localhost:${this.port}${config.webhook.endpoint}`);
          logger.info(`🧪 Test endpoint: POST http://localhost:${this.port}/test`);
          logger.info(`❤️  Health check: GET http://localhost:${this.port}/health`);
          resolve(this.server);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Webhook server stopped');
          resolve();
        });
      });
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new WebhookServer();
  server.start().catch(error => {
    logger.error('Failed to start webhook server:', error);
    process.exit(1);
  });
}

module.exports = WebhookServer;