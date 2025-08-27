const BrowserManager = require('./utils/browser');
const logger = require('./utils/logger');
const CertificateCleanup = require('./utils/certificateCleanup');
const { SELECTORS, WAIT, clickFirstVisible } = require('./utils/daikinUtils');

class DaikinAutomation {
  constructor(config, webhookData = null) {
    this.config = config;
    this.browserManager = new BrowserManager(config);
    this.webhookData = webhookData;
    this.certificateCleanup = new CertificateCleanup(config);
    this.formData = webhookData || config.form.data;
    
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
    return this;
  }

  async navigateToForm() {
    const directUrl = 'https://warranty.goodmanmfg.com/newregistration/#/reg-layout';
    logger.info(`Navigating to warranty form: ${directUrl}`);
    
    try {
      await this.browserManager.page.goto(directUrl, { waitUntil: 'networkidle' });
      
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
      await this.browserManager.page.waitForTimeout(2000);

      // Check for "already registered" error
      const alreadyRegisteredText = await this.browserManager.page.getByText('Error This unit has already been registered').isVisible();
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
      const invalidSerialText = await this.browserManager.page.getByText(/The Serial # is invalid/).isVisible();
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
      // Double click the date field and fill it
      await this.browserManager.page.getByRole('textbox', { name: 'Install Date/Date of Closing' }).dblclick();
      await this.browserManager.page.getByRole('textbox', { name: 'Install Date/Date of Closing' }).fill(this.formData.installationDate);
      
    } catch (error) {
      logger.error('Failed to fill installation date:', error);
      throw error;
    }
  }

  async selectResidentialOption() {
    logger.info('Selecting residential option...');
    
    try {
      // Click the residential option
      await this.browserManager.page.getByText('Residential(Owner Occupied').click();
      
      } catch (error) {
      logger.error('Failed to select residential option:', error);
      throw error;
    }
  }

  async clickNext() {
    logger.info('Clicking Next and Continue...');
    
    try {
      // Click Next button
      await this.browserManager.page.getByRole('button', { name: 'Next' }).click();
      
      // Click Continue button
      await this.browserManager.page.getByRole('button', { name: 'Continue' }).click();
      
        } catch (error) {
      logger.error('Failed to click Next/Continue:', error);
      throw error;
    }
  }

  async fillCustomerDetails(customerData) {
    logger.info('Filling customer details...');

    try {
      // Click and fill First Name
      await this.browserManager.page.getByRole('textbox', { name: 'First Name' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'First Name' }).fill(customerData.firstName);

      // Click and fill Last Name
      await this.browserManager.page.getByRole('textbox', { name: 'Last Name' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Last Name' }).fill(customerData.lastName);

      // Click and fill Phone
      await this.browserManager.page.getByRole('textbox', { name: 'Phone' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Phone' }).fill(customerData.phone);

      // Click and fill Email
      await this.browserManager.page.getByRole('textbox', { name: 'Email' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Email' }).fill(customerData.email);

      // Click and fill Address
      await this.browserManager.page.getByRole('textbox', { name: 'Address1' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Address1' }).fill(customerData.address1);

      // Click and fill Zip Code
      await this.browserManager.page.getByRole('textbox', { name: 'Zip/Postal Code' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Zip/Postal Code' }).fill(customerData.zipPostal);

      // Wait for potential auto-fill
      await this.browserManager.page.waitForTimeout(2000);

      // Click City and State fields to check auto-fill
      await this.browserManager.page.getByRole('textbox', { name: 'City' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'State/Province' }).click();

      // Fill City and State if not auto-filled
      const cityValue = await this.browserManager.page.getByRole('textbox', { name: 'City' }).inputValue();
      if (!cityValue) {
        await this.browserManager.page.getByRole('textbox', { name: 'City' }).fill(customerData.city);
      }

      const stateValue = await this.browserManager.page.getByRole('textbox', { name: 'State/Province' }).inputValue();
      if (!stateValue) {
        await this.browserManager.page.getByRole('textbox', { name: 'State/Province' }).fill(customerData.stateProvince);
      }

      // Click City again (as per sequence)
      await this.browserManager.page.getByRole('textbox', { name: 'City' }).click();

      // Click checkbox text and Next button using exact selectors
      await this.browserManager.page.locator('#mat-checkbox-4').getByText('By checking this box, you').click();
      await this.browserManager.page.getByRole('button', { name: 'Next' }).click();

      } catch (error) {
      logger.error('Failed to fill customer details:', error);
      throw error;
    }
  }

  async fillDealerBuilderInfo() {
    logger.info('Filling dealer information...');
    
    try {
      // Fill dealer zip code
      await this.browserManager.page.getByRole('textbox', { name: 'Dealer/Builder Zip code*' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Dealer/Builder Zip code*' }).fill('K2M 2G8');

      // Fill dealer name (already uppercase)
      await this.browserManager.page.getByRole('combobox', { name: 'Dealer/Builder * (enter name' }).fill('COMFORT HUB');

      // Fill dealer address
      await this.browserManager.page.getByRole('textbox', { name: 'Address' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Address' }).fill('65 DENZIL DOYLE CT');

      // Fill dealer city
      await this.browserManager.page.getByRole('textbox', { name: 'City' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'City' }).fill('OTTAWA');

      // Fill dealer state
      await this.browserManager.page.getByRole('textbox', { name: 'State' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'State' }).fill('ON');

      // Fill dealer phone
      await this.browserManager.page.getByRole('textbox', { name: 'Dealer/Builder Phone*' }).click();
      await this.browserManager.page.getByRole('textbox', { name: 'Dealer/Builder Phone*' }).fill('613-581-1770');

    } catch (error) {
      logger.error('Failed to fill dealer information:', error);
      throw error;
    }
  }

  async completeRegistration() {
    logger.info('Completing registration...');
    
    try {
      // Click Register button
      await this.browserManager.page.getByRole('button', { name: 'Register' }).click();
      
      // Check for address validation window after Register
      try {
        const addressConfirmText = await this.browserManager.page.getByText('Please confirm the name/address information is correct');
        if (await addressConfirmText.isVisible()) {
          logger.info('Address validation window detected after Register, clicking Yes');
          await this.browserManager.page.getByRole('button', { name: 'Yes' }).click();
          await this.browserManager.page.waitForTimeout(1000);
        }
      } catch (confirmError) {
        // No address validation needed, continue
        logger.info('No address validation needed after Register');
      }
      
      // Click Affirm button
      await this.browserManager.page.getByRole('button', { name: 'Affirm', exact: true }).click();
      
      // Check for address validation window after Affirm
      try {
        const addressConfirmText = await this.browserManager.page.getByText('Please confirm the name/address information is correct');
        if (await addressConfirmText.isVisible()) {
          logger.info('Address validation window detected after Affirm, clicking Yes');
          await this.browserManager.page.getByRole('button', { name: 'Yes' }).click();
          await this.browserManager.page.waitForTimeout(1000);
        }
      } catch (confirmError) {
        // No address validation needed, continue
        logger.info('No address validation needed after Affirm');
      }
      
      // Click Yes button for the standard confirmation
      await this.browserManager.page.getByRole('button', { name: 'Yes' }).click();
      
      // Take screenshot to see what appears
      await this.browserManager.takeScreenshot('after_yes_click');
      
      // Handle any dialogs that might appear
      await this.browserManager.takeScreenshot('before_dialog_check');
      
      // Try to handle dialogs multiple times to ensure all are cleared
      let dialogsHandled = true;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (dialogsHandled && attempts < maxAttempts) {
        dialogsHandled = await require('./utils/daikinUtils').handleDialogs(this.browserManager.page);
        attempts++;
        if (dialogsHandled) {
          logger.info(`Dialog handling attempt ${attempts}: dialogs were found and handled`);
          // Take a screenshot after each successful dialog handling
          await this.browserManager.takeScreenshot(`after_dialog_${attempts}`);
        }
      }
      
      // Take screenshot before download
      await this.browserManager.takeScreenshot('before_download');
      
      // Wait for network idle after email send (for jspdf libraries to load)
      await this.browserManager.page.waitForLoadState('networkidle');
      
      // Set up download listener
      const downloadPromise = this.browserManager.page.waitForEvent('download');
      
      // Click the download button directly since we know its exact role
      await this.browserManager.page.getByRole('button', { name: 'Download Certificate' }).click();
      
      // Wait for download
      const download = await downloadPromise;
      
      // Save the download
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
}

module.exports = DaikinAutomation; 