const BrowserManager = require('./utils/browser');
const logger = require('./utils/logger');

class WarrantyAutomation {
  constructor(config) {
    this.config = config;
    this.browserManager = new BrowserManager(config);
  }

  async initialize() {
    logger.info('Initializing warranty automation...');
    await this.browserManager.initialize();
    return this;
  }

  async navigateToForm() {
    logger.info(`Navigating to warranty form: ${this.config.form.url}`);
    
    try {
      await this.browserManager.page.goto(this.config.form.url, {
        waitUntil: 'networkidle'
      });
      
      await this.browserManager.takeScreenshot('form_loaded');
      logger.info('Successfully navigated to warranty form');
    } catch (error) {
      logger.error('Failed to navigate to warranty form:', error);
      throw error;
    }
  }

  async fillSerialNumber() {
    const { selectors, data } = this.config.form;
    
    logger.info('Filling serial number...');
    await this.browserManager.fillField(selectors.serialNumber, data.serialNumber);
  }

  async fillProductType() {
    const { selectors, data } = this.config.form;
    
    logger.info('Filling product type...');
    
    try {
      // Try as dropdown first
      const element = await this.browserManager.page.$(selectors.productType);
      const tagName = await element.evaluate(el => el.tagName.toLowerCase());
      
      if (tagName === 'select') {
        await this.browserManager.selectOption(selectors.productType, data.productType);
      } else {
        await this.browserManager.fillField(selectors.productType, data.productType);
      }
    } catch (error) {
      // Fallback to regular fill
      await this.browserManager.fillField(selectors.productType, data.productType);
    }
  }

  async fillInstallationDate() {
    const { selectors, data } = this.config.form;
    
    logger.info('Filling installation date...');
    await this.browserManager.fillField(selectors.installationDate, data.installationDate);
  }

  async fillCustomerInformation() {
    const { selectors, data } = this.config.form;
    
    logger.info('Filling customer information...');
    
    // Fill customer fields
    const customerFields = [
      { selector: selectors.firstName, value: data.firstName, name: 'First Name' },
      { selector: selectors.lastName, value: data.lastName, name: 'Last Name' },
      { selector: selectors.email, value: data.email, name: 'Email' },
      { selector: selectors.phone, value: data.phone, name: 'Phone' },
      { selector: selectors.address, value: data.address, name: 'Address' },
      { selector: selectors.city, value: data.city, name: 'City' },
      { selector: selectors.zipCode, value: data.zipCode, name: 'Zip Code' }
    ];

    for (const field of customerFields) {
      try {
        logger.info(`Filling ${field.name}...`);
        await this.browserManager.fillField(field.selector, field.value);
      } catch (error) {
        logger.warn(`Could not fill ${field.name} (${field.selector}): ${error.message}`);
        // Continue with other fields
      }
    }

    // Handle state field (might be dropdown)
    try {
      logger.info('Filling state...');
      const stateElement = await this.browserManager.page.$(selectors.state);
      const tagName = await stateElement.evaluate(el => el.tagName.toLowerCase());
      
      if (tagName === 'select') {
        await this.browserManager.selectOption(selectors.state, data.state);
      } else {
        await this.browserManager.fillField(selectors.state, data.state);
      }
    } catch (error) {
      logger.warn(`Could not fill state field: ${error.message}`);
    }
  }

  async fillAllFormFields() {
    logger.info('Starting to fill all form fields...');
    
    try {
      await this.fillSerialNumber();
      await this.fillProductType();
      await this.fillInstallationDate();
      await this.fillCustomerInformation();
      
      await this.browserManager.takeScreenshot('form_filled');
      logger.info('All form fields filled successfully');
    } catch (error) {
      logger.error('Error filling form fields:', error);
      await this.browserManager.takeScreenshot('form_fill_error');
      throw error;
    }
  }

  async submitForm() {
    const { selectors } = this.config.form;
    
    logger.info('Submitting warranty registration form...');
    
    try {
      await this.browserManager.takeScreenshot('before_submit');
      await this.browserManager.clickElement(selectors.submitButton);
      
      logger.info('Form submitted, waiting for response...');
      
      // Wait a moment for the form to process
      await this.browserManager.page.waitForTimeout(2000);
      
      await this.browserManager.takeScreenshot('after_submit');
    } catch (error) {
      logger.error('Failed to submit form:', error);
      await this.browserManager.takeScreenshot('submit_error');
      throw error;
    }
  }

  async captureConfirmation() {
    const { selectors } = this.config.form;
    
    logger.info('Capturing confirmation message...');
    
    try {
      // Try to find confirmation message
      const confirmationElement = await this.browserManager.page.waitForSelector(
        selectors.confirmationMessage, 
        { timeout: 10000, state: 'visible' }
      );
      
      if (confirmationElement) {
        const confirmationText = await confirmationElement.textContent();
        logger.info(`Confirmation message received: ${confirmationText}`);
        
        await this.browserManager.takeScreenshot('confirmation');
        
        return {
          success: true,
          message: confirmationText.trim(),
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.warn('Could not find specific confirmation message, checking page for success indicators...');
    }

    // Fallback: Check for common success indicators
    try {
      const currentUrl = this.browserManager.page.url();
      const pageTitle = await this.browserManager.page.title();
      const pageContent = await this.browserManager.page.content();
      
      // Look for success indicators in URL, title, or content
      const successIndicators = [
        'success', 'confirmation', 'thank you', 'complete', 'submitted',
        'registered', 'warranty', 'receipt'
      ];
      
      const hasSuccessIndicator = successIndicators.some(indicator => 
        currentUrl.toLowerCase().includes(indicator) ||
        pageTitle.toLowerCase().includes(indicator) ||
        pageContent.toLowerCase().includes(indicator)
      );
      
      if (hasSuccessIndicator) {
        logger.info('Success indicators found on page');
        await this.browserManager.takeScreenshot('success_page');
        
        return {
          success: true,
          message: `Form appears to have been submitted successfully. Current URL: ${currentUrl}`,
          pageTitle: pageTitle,
          timestamp: new Date().toISOString()
        };
      }
      
      // If no success indicators, assume there might be an error
      logger.warn('No clear success indicators found');
      await this.browserManager.takeScreenshot('unclear_result');
      
      return {
        success: false,
        message: 'Form submission result unclear - no confirmation message found',
        pageTitle: pageTitle,
        currentUrl: currentUrl,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Error capturing confirmation:', error);
      await this.browserManager.takeScreenshot('confirmation_error');
      
      return {
        success: false,
        message: `Error capturing confirmation: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async runAutomation() {
    logger.info('Starting warranty registration automation...');
    
    try {
      // Navigate to form
      await this.navigateToForm();
      
      // Fill form fields
      await this.fillAllFormFields();
      
      // Submit form
      await this.submitForm();
      
      // Capture confirmation
      const result = await this.captureConfirmation();
      
      logger.info('Warranty registration automation completed', { result });
      return result;
      
    } catch (error) {
      logger.error('Warranty registration automation failed:', error);
      await this.browserManager.takeScreenshot('automation_error');
      throw error;
    }
  }

  async close() {
    logger.info('Closing warranty automation...');
    await this.browserManager.close();
  }
}

module.exports = WarrantyAutomation; 