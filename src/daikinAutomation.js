const BrowserManager = require('./utils/browser');
const logger = require('./utils/logger');
const CertificateCleanup = require('./utils/certificateCleanup');
const { FIELD_SELECTORS, FormInteractions } = require('./utils/formUtils');

class DaikinAutomation {
  constructor(config, webhookData = null) {
    this.config = config;
    this.browserManager = new BrowserManager(config);
    this.webhookData = webhookData;
    this.certificateCleanup = new CertificateCleanup(config);
    this.formData = webhookData || config.form.data;
    this.formInteractions = null; // Will be initialized after browser setup
    
    // Convert all text inputs to uppercase
    if (this.formData.products) {
      this.formData.products = this.formData.products.map(product => ({
        ...product,
        serial: product.serial?.toString().toUpperCase(),
        model: product.model?.toString().toUpperCase()
      }));
    }
    
    if (this.formData.customer) {
      this.formData.customer = {
        ...this.formData.customer,
        firstName: this.formData.customer.firstName?.toString().toUpperCase(),
        lastName: this.formData.customer.lastName?.toString().toUpperCase(),
        address1: this.formData.customer.address1?.toString().toUpperCase(),
        city: this.formData.customer.city?.toString().toUpperCase(),
        stateProvince: this.formData.customer.stateProvince?.toString().toUpperCase(),
        zipPostal: this.formData.customer.zipPostal?.toString().toUpperCase()
      };
    }
    
    if (!Array.isArray(this.formData.products)) {
      this.formData.products = [this.formData.products];
    }
    
    logger.info('Daikin automation initialized', {
      productCount: this.formData.products.length,
      installationDate: this.formData.installationDate
    });
  }

  async initialize() {
    logger.info('Initializing Daikin automation...');
    await this.browserManager.initialize();
    this.formInteractions = new FormInteractions(this.browserManager.page, this.config);
    return this;
  }

  async navigateToForm() {
    const directUrl = 'https://warranty.goodmanmfg.com/newregistration/#/reg-layout';
    logger.info(`Navigating to warranty form: ${directUrl}`);
    
    try {
      await this.browserManager.page.goto(directUrl, { waitUntil: 'networkidle' });
      
      // Wait for page load
      await this.browserManager.page.waitForLoadState('networkidle');
      
      // CRITICAL: Must select registration type before adding serials
      await this.browserManager.page.locator('#mat-radio-10').getByText('I am registering on behalf of').click();
      logger.info('Registration type selected');
      
    } catch (error) {
      logger.error('Failed to navigate to form:', error);
      throw error;
    }
  }

  async addProduct(product) {
    logger.info(`Adding serial number: ${product.serial}`);
    
    try {
      // Fill serial number and press Enter
      await this.browserManager.page.getByRole('textbox', { name: 'Serial number' }).fill(product.serial);
      await this.browserManager.page.getByRole('textbox', { name: 'Serial number' }).press('Enter');
      
      // Wait for potential error dialogs
      await this.browserManager.page.waitForLoadState('networkidle');

      // Check for "already registered" error
      const alreadyRegisteredText = await this.browserManager.page.getByText(/error.*unit has already been registered/i).isVisible();
      if (alreadyRegisteredText) {
        const error = {
          type: 'ALREADY_REGISTERED',
          message: 'This unit has already been registered',
          lookupUrl: 'https://www.goodmanmfg.com/warranty-lookup',
          serial: product.serial
        };
        logger.error('Serial number already registered:', error);
        throw error;
      }

      // Check for "invalid serial" error
      const invalidSerialText = await this.browserManager.page.getByText(/the serial #.*invalid/i).isVisible();
      if (invalidSerialText) {
        const error = {
          type: 'INVALID_SERIAL',
          message: 'The Serial number is invalid',
          serial: product.serial,
          tips: 'Your serial # is likely a numeric digit with no letters. If not, your serial # will be 7 digits and start with a letter.'
        };
        logger.error('Invalid serial number:', error);
        throw error;
      }
      
    } catch (error) {
      // If it's one of our custom errors, throw it as is
      if (error.type === 'ALREADY_REGISTERED' || error.type === 'INVALID_SERIAL') {
        throw error;
      }
      // Otherwise log it as a general error
      logger.error(`Failed to add serial number ${product.serial}:`, error);
      throw error;
    }
  }

  async addAllProducts() {
    logger.info(`Adding ${this.formData.products.length} serial numbers...`);
    
    try {
      for (const product of this.formData.products) {
        await this.addProduct(product);
      }
      
      logger.info('All serial numbers added');
      
    } catch (error) {
      logger.error('Failed to add all serial numbers:', error);
      throw error;
    }
  }

  async fillInstallationDate() {
    logger.info(`Filling installation date: ${this.formData.installationDate}`);
    
    try {
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.installDate, this.formData.installationDate, {
        verify: true,
        clear: true
      });
      
      // Wait for any date picker to close
      await this.browserManager.page.waitForLoadState('networkidle');
      
    } catch (error) {
      logger.error('Failed to fill installation date:', error);
      throw error;
    }
  }

  async selectResidentialOption() {
    logger.info('Selecting residential option...');
    
    try {
      await this.browserManager.page.getByText('Residential(Owner Occupied').click();
      await this.browserManager.page.waitForLoadState('networkidle');
      
    } catch (error) {
      logger.error('Failed to select residential option:', error);
      throw error;
    }
  }

  async clickNext() {
    logger.info('Clicking Next and Continue...');
    
    try {
      // Click Next button and wait for navigation
      await this.formInteractions.clickButton(FIELD_SELECTORS.next, {
        waitForNavigation: true
      });
      
      // Click Continue button and wait for navigation
      await this.formInteractions.clickButton(FIELD_SELECTORS.continue, {
        waitForNavigation: true
      });
      
    } catch (error) {
      logger.error('Failed to click Next/Continue:', error);
      throw error;
    }
  }

  async fillCustomerDetails(customerData) {
    logger.info('Filling customer details...');

    try {
      // Fill personal information
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.firstName, customerData.firstName, { verify: true });
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.lastName, customerData.lastName, { verify: true });
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.phone, customerData.phone, { verify: true });
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.email, customerData.email, { verify: true });
      
      // Fill address information
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.address1, customerData.address1, { verify: true });
      
      // Fill postal code and click outside to trigger validation
      const postalField = this.browserManager.page.getByRole('textbox', { name: 'Zip/Postal Code' });
      await postalField.click();
      await postalField.fill(customerData.zipPostal);
      
      // Click outside the field
      await this.browserManager.page.locator('reg-layout').click();
      await this.browserManager.page.waitForTimeout(1000);
      
      // Check if city was autofilled
      const cityField = this.browserManager.page.getByRole('textbox', { name: 'City' });
      await cityField.click();
      const cityValue = await cityField.inputValue();
      
      // Check if state/province was autofilled
      const stateField = this.browserManager.page.getByRole('textbox', { name: 'State/Province' });
      await stateField.click();
      const stateValue = await stateField.inputValue();
      
      // Fill city and state if not autofilled
      if (!cityValue) {
        await this.formInteractions.typeIntoField(FIELD_SELECTORS.city, customerData.city, { verify: true });
      }
      if (!stateValue) {
        await this.formInteractions.typeIntoField(FIELD_SELECTORS.stateProvince, customerData.stateProvince, { verify: true });
      }
      

      
      // Uncheck terms box first (in case it's checked)
      const termsCheckbox = this.browserManager.page.locator('#mat-checkbox-4').getByText('By checking this box, you');
      await termsCheckbox.waitFor({ state: 'visible' });
      await termsCheckbox.click();
      
      // Wait a moment and click Next
      await this.browserManager.page.waitForTimeout(500);
      await this.formInteractions.clickButton(FIELD_SELECTORS.next, {
        waitForNavigation: true
      });
      
    } catch (error) {
      logger.error('Failed to fill customer details:', error);
      throw error;
    }
  }

  async fillDealerBuilderInfo() {
    logger.info('Filling dealer information...');
    
    try {
      const dealer = this.formData.dealer;
      
      // EXACT sequence for dealer info
      // Click zip field
      const dealerZip = this.browserManager.page.getByRole('textbox', { name: 'Dealer/Builder Zip code*' });
      await dealerZip.click();
      
      // Fill and press Enter
      await dealerZip.fill(dealer.dealerZip);
      await dealerZip.press('Enter');
      
      // Critical wait
      await this.browserManager.page.waitForTimeout(2000);
      
      // Click dealer name field
      const dealerName = this.browserManager.page.getByRole('combobox', { name: 'Dealer/Builder * (enter name' });
      await dealerName.click();
      
      // Fill dealer name
      await dealerName.fill(dealer.dealerName.toUpperCase());
      
      // Click outside
      await this.browserManager.page.locator('reg-layout').click();
      
      // Click address field
      const addressField = this.browserManager.page.getByRole('textbox', { name: 'Address' });
      await addressField.click();
      
      // Fill dealer address details
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.dealerAddress, dealer.dealerAddress.toUpperCase(), { verify: true });
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.dealerCity, dealer.dealerCity.toUpperCase(), { verify: true });
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.dealerState, dealer.dealerState.toUpperCase(), { verify: true });
      await this.formInteractions.typeIntoField(FIELD_SELECTORS.dealerPhone, dealer.dealerPhone, { verify: true });
      
    } catch (error) {
      logger.error('Failed to fill dealer information:', error);
      throw error;
    }
  }

  async completeRegistration() {
    logger.info('Completing registration...');
    
    try {
      // Click Register button and handle address validation
      await this.formInteractions.clickButton(FIELD_SELECTORS.register, {
        waitForNavigation: true
      });
      
      // Handle address validation if it appears
      const addressValidationShown = await this.formInteractions.handleDialog(
        'Please confirm the name/address information is correct',
        'confirm'
      );
      if (addressValidationShown) {
        logger.info('Address validation handled after Register');
      }
      
      // Click Affirm button
      await this.formInteractions.clickButton(FIELD_SELECTORS.affirm, {
        waitForNavigation: true
      });
      
      // Handle any additional address validation
      const additionalValidationShown = await this.formInteractions.handleDialog(
        'Please confirm the name/address information is correct',
        'confirm'
      );
      if (additionalValidationShown) {
        logger.info('Address validation handled after Affirm');
      }
      
      // Handle standard confirmation
      await this.formInteractions.clickButton(FIELD_SELECTORS.yes, {
        waitForNavigation: true
      });
      
      // Wait for the page load and network to settle
      await this.browserManager.page.waitForLoadState('networkidle');
      await this.browserManager.page.waitForLoadState('domcontentloaded');
      // Add a longer buffer for UI rendering and dialog initialization
      await this.browserManager.page.waitForTimeout(5000);
      
      // Take screenshot for verification
      await this.browserManager.takeScreenshot('after_confirmations');
      
      // Handle any Installing Contractor dialog with increased timeout
      const contractorDialogShown = await this.formInteractions.handleOverlay({
        role: 'button',
        name: /installing contractor/i
      }, 'close', 5000); // Increased timeout to 5 seconds
      if (contractorDialogShown) {
        logger.info('Installing Contractor dialog handled');
      }
      
      // Wait for network idle before download
      await this.browserManager.page.waitForLoadState('networkidle');
      
      // Set up download listener
      const downloadPromise = this.browserManager.page.waitForEvent('download');
      
      // Click download button
      await this.formInteractions.clickButton(FIELD_SELECTORS.downloadCertificate);
      
      // Wait for and save download
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      const downloadPath = require('path').join(require('os').homedir(), 'Downloads', filename);
      await download.saveAs(downloadPath);
      
      logger.info(`Certificate downloaded: ${filename}`);
      return { filename, downloadPath };
      
    } catch (error) {
      logger.error('Failed to complete registration:', error);
      throw error;
    }
  }

  async close() {
    logger.info('Closing automation...');
    await this.browserManager.close();
  }

  async runFirstPageAutomation() {
    try {
      // Navigate to form
      await this.navigateToForm();

      // Add all products
      await this.addAllProducts();

      // Fill installation date
      await this.fillInstallationDate();

      // Select residential option
      await this.selectResidentialOption();

      // Click next to proceed
      await this.clickNext();

      // Fill customer details
      await this.fillCustomerDetails(this.formData.customer);

      // Fill dealer information
      await this.fillDealerBuilderInfo();

      // Complete registration
      const downloadInfo = await this.completeRegistration();

      return {
        success: true,
        message: 'Registration completed successfully',
        timestamp: new Date().toISOString(),
        downloadInfo
      };

    } catch (error) {
      // Take error screenshot
      if (this.browserManager?.page) {
        await this.browserManager.takeScreenshot('error_state');
      }

      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
        error: {
          type: error.type || 'AUTOMATION_ERROR',
          details: error.message,
          stack: error.stack
        }
      };
    }
  }
}

module.exports = DaikinAutomation; 