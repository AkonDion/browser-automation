const logger = require('./logger');

// Centralized selector map with robust, accessibility-first selectors
const FIELD_SELECTORS = {
  // Product fields
  serialNumber: {
    role: 'textbox',
    name: 'Serial number'
  },
  
  // Installation fields
  installDate: {
    role: 'textbox',
    name: 'Install Date/Date of Closing'
  },
  
  // Customer fields
  firstName: {
    role: 'textbox',
    name: 'First Name'
  },
  lastName: {
    role: 'textbox',
    name: 'Last Name'
  },
  phone: {
    role: 'textbox',
    name: 'Phone'
  },
  email: {
    role: 'textbox',
    name: 'Email'
  },
  address1: {
    role: 'textbox',
    name: 'Address1'
  },
  zipPostal: {
    role: 'textbox',
    name: 'Zip/Postal Code'
  },
  city: {
    role: 'textbox',
    name: 'City'
  },
  stateProvince: {
    role: 'textbox',
    name: 'State/Province'
  },
  
  // Dealer fields
  dealerZip: {
    role: 'textbox',
    name: 'Dealer/Builder Zip code*'
  },
  dealerName: {
    role: 'combobox',
    name: 'Dealer/Builder * (enter name'
  },
  dealerAddress: {
    role: 'textbox',
    name: 'Address'
  },
  dealerCity: {
    role: 'textbox',
    name: 'City'
  },
  dealerState: {
    role: 'textbox',
    name: 'State'
  },
  dealerPhone: {
    role: 'textbox',
    name: 'Dealer/Builder Phone*'
  },
  
  // Buttons
  next: {
    role: 'button',
    name: 'Next'
  },
  continue: {
    role: 'button',
    name: 'Continue'
  },
  register: {
    role: 'button',
    name: 'Register'
  },
  affirm: {
    role: 'button',
    name: 'Affirm',
    exact: true
  },
  yes: {
    role: 'button',
    name: 'Yes'
  },
  downloadCertificate: {
    role: 'button',
    name: 'Download Certificate'
  }
};

class FormInteractions {
  constructor(page, config) {
    this.page = page;
    this.config = config;
  }

  /**
   * Types text into a form field with proper waits and verification
   */
  async typeIntoField(selector, value, options = {}) {
    logger.info(`Typing "${value}" into ${selector.role} field with name "${selector.name}"`);
    
    const field = this.page.getByRole(selector.role, { name: selector.name });
    await field.waitFor();
    await field.waitFor({ state: 'visible' });
    
    if (options.clear) {
      await field.clear();
    }
    
    await field.fill(value);
    await this.page.waitForLoadState('networkidle');
    
    // Verify value if requested
    if (options.verify) {
      const actualValue = await field.inputValue();
      if (actualValue !== value) {
        logger.warn(`Value mismatch. Expected: "${value}", Got: "${actualValue}". Retrying...`);
        await field.clear();
        await field.fill(value);
        await this.page.waitForLoadState('networkidle');
      }
    }
  }

  /**
   * Special handler for dealer name field - no Enter press or dropdown selection
   */
  async fillDealerName(value) {
    logger.info(`Filling dealer name: "${value}"`);
    
    const dealerCombobox = this.page.getByRole('combobox', { name: 'Dealer/Builder * (enter name' });
    await dealerCombobox.click();
    await dealerCombobox.fill(value);
    
    // Wait for service call to complete
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
    
    // Click somewhere neutral on the page
    await this.page.locator('body').click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Clicks a button with proper waits and verification
   */
  async clickButton(selector, options = {}) {
    logger.info(`Clicking button with name "${selector.name}"`);
    
    const button = this.page.getByRole('button', { 
      name: selector.name,
      exact: selector.exact
    });
    
    await button.waitFor();
    await button.waitFor({ state: 'visible' });
    
    // Scroll into view if needed
    await button.scrollIntoViewIfNeeded();
    
    await button.click();
    
    // Wait for navigation or network idle if specified
    if (options.waitForNavigation) {
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Handles modal dialogs with proper waits
   */
  async handleDialog(expectedText, action = 'confirm', timeout = 2000) {
    try {
      const dialog = await this.page.waitForEvent('dialog', { timeout });
      
      if (dialog.message().includes(expectedText)) {
        logger.info(`Handling dialog with message containing "${expectedText}"`);
        action === 'confirm' ? await dialog.accept() : await dialog.dismiss();
        return true;
      }
      
      return false;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        logger.debug(`No dialog appeared within ${timeout}ms`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Waits for and handles conditional overlays/popups
   */
  async handleOverlay(selector, action = 'close', timeout = 2000) {
    try {
      // First check for Installing Contractor dialog
      const contractorButton = this.page.getByRole('button', { name: 'Installing Contractor' });
      if (await contractorButton.isVisible({ timeout: 7000 })) {
        logger.info('Found Installing Contractor dialog, clicking button');
        await contractorButton.click();
        
        // Handle any popups that might open
        this.page.once('popup', async popup => {
          logger.info('New window opened after contractor dialog, ignoring');
          await popup.close();
        });
        
        await this.page.waitForLoadState('networkidle');
      }

      // Then check for OK dialog
      const okButton = this.page.getByRole('button', { name: 'OK' });
      if (await okButton.isVisible({ timeout: 1000 })) {
        logger.info('Found OK dialog, clicking button');
        await okButton.click();
        await this.page.waitForLoadState('networkidle');
      }

      // Finally check for the original selector if provided
      if (selector) {
        const overlay = this.page.getByRole(selector.role, { name: selector.name });
        const isVisible = await overlay.isVisible({ timeout });
        
        if (isVisible) {
          logger.info(`Handling overlay: ${action}`);
          if (action === 'close') {
            await overlay.click();
          }
          await this.page.waitForLoadState('networkidle');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        logger.debug(`No overlay found within ${timeout}ms`);
        return false;
      }
      throw error;
    }
  }
}

module.exports = {
  FIELD_SELECTORS,
  FormInteractions
};
