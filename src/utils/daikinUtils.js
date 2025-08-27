const logger = require('./logger');

// Wait timeouts in milliseconds
const WAIT = {
  short: 500,
  normal: 1500,
  medium: 3000,
  long: 5000,
  xlong: 10000
};

// Centralized selector registry
const SELECTORS = {
  // Product entry selectors
  serial: {
    input: [
      '[role="textbox"][name="Serial number"]',
      'input:visible:nth-of-type(1)',
      'mat-form-field:nth-of-type(1) input',
      'input[type="text"]:nth-of-type(1)',
      'form input:nth-of-type(1)'
    ]
  },
  model: {
    input: [
      '[role="combobox"][name="Number"]',
      'input[role="combobox"][name="Number"]',
      'input:visible:nth-of-type(2)',
      'mat-form-field:nth-of-type(2) input',
      'input[type="text"]:nth-of-type(2)',
      'form input:nth-of-type(2)'
    ]
  },
  addSerial: {
    button: [
      'button[name="Add Serial"]',
      '[role="button"][name="Add Serial"]',
      '#cdk-step-content-1-0 > mat-card > form > section > div > div:nth-child(3) > button',
      'button:has-text("Add Serial")',
      'button:has-text("Add")',
      'button[type="button"]:visible',
      'mat-card button:visible:first-of-type',
      'form button:visible:first-of-type',
      'section button:visible:first-of-type',
      'button.mat-raised-button:visible',
      'button.btn-black:visible'
    ]
  },
  // Navigation buttons
  next: {
    button: [
      'button[name="Next"]',
      '[aria-label="Next"]',
      '#cdk-step-content-1-0 > mat-card > form > section > div > div:nth-child(7) > button',
      'button:has-text("Next")',
      'button[type="submit"]',
      'button:contains("Next")',
      'mat-card button:last-of-type',
      'form button:last-of-type'
    ]
  },
  continue: {
    button: [
      '[role="button"][name="Continue"]',
      'button:has-text("Continue")',
      'button .mat-button-wrapper:has-text("Continue")',
      'button[type="button"]:has-text("Continue")',
      '.mat-raised-button:has-text("Continue")',
      'button.btn-black:has-text("Continue")',
      'button[mat-raised-button]:has-text("Continue")'
    ]
  },
  register: {
    button: [
      '[role="button"][name="Register"]',
      '#cdk-step-content-1-2 > mat-card > form > div > button.mat-focus-indicator.btn-black.mat-button.mat-raised-button.mat-button-base.mat-primary',
      'button:has-text("Register")',
      '.btn-black:has-text("Register")',
      'button.mat-primary:has-text("Register")'
    ]
  },
  // Customer details fields
  customer: {
    firstName: {
      input: [
        '[role="textbox"][name="First Name"]',
        '#mat-input-26'
      ]
    },
    lastName: {
      input: [
        '[role="textbox"][name="Last Name"]',
        '#mat-input-27'
      ]
    },
    phone: {
      input: [
        '[role="textbox"][name="Phone"]',
        '#mat-input-15'
      ]
    },
    email: {
      input: [
        '[role="textbox"][name="Email"]',
        '#mat-input-16'
      ]
    },
    address1: {
      input: [
        '[role="textbox"][name="Address1"]',
        '#mat-input-17'
      ]
    },
    zipPostal: {
      input: [
        '[role="textbox"][name="Zip/Postal Code"]',
        '#mat-input-19'
      ]
    },
    city: {
      input: [
        '[role="textbox"][name="City"]',
        '#mat-input-20'
      ]
    },
    stateProvince: {
      input: [
        '[role="textbox"][name="State/Province"]',
        '#mat-input-21'
      ]
    }
  },
  // Dealer details fields
  dealer: {
    zip: {
      input: [
        '[role="textbox"][name="Dealer/Builder Zip code*"]',
        'mat-form-field:has([name="Dealer/Builder Zip code*"])',
        'mat-form-field:has(input[placeholder*="Zip"])'
      ]
    },
    name: {
      input: [
        '[role="combobox"][name="Dealer/Builder * (enter name"]',
        'mat-form-field:has([name="Dealer/Builder * (enter name"])',
        'mat-form-field:has(input[placeholder*="Dealer"])'
      ]
    },
    address: {
      input: [
        '[role="textbox"][name="Address"]',
        'mat-form-field:has([name="Address"])',
        'mat-form-field:has(input[placeholder*="Address"])'
      ]
    },
    city: {
      input: [
        '[role="textbox"][name="City"]',
        'mat-form-field:has([name="City"])',
        'mat-form-field:has(input[placeholder*="City"])'
      ]
    },
    state: {
      input: [
        '[role="textbox"][name="State"]',
        'mat-form-field:has([name="State"])',
        'mat-form-field:has(input[placeholder*="State"])'
      ]
    },
    phone: {
      input: [
        '[role="textbox"][name="Dealer/Builder Phone*"]',
        'mat-form-field:has([name="Dealer/Builder Phone*"])',
        'mat-form-field:has(input[placeholder*="Phone"])'
      ]
    }
  },
  // Dialog buttons
  enhancedWarranty: {
    affirm: [
      'reg-dailog-content-unitcoverage mat-dialog-actions button.btn-black:has-text("Affirm")',
      '[id*="mat-dialog"] reg-dailog-content-unitcoverage mat-dialog-actions button.btn-black',
      'mat-dialog-actions > button.btn-black:has-text("Affirm")',
      'mat-dialog-actions button.btn-black:has-text("Affirm")',
      'button:has-text("Affirm")',
      '[role="dialog"] button:has-text("Affirm")',
      'mat-dialog-container button:has-text("Affirm")',
      '.mat-dialog-container button:has-text("Affirm")',
      'reg-dailog-content-unitcoverage button:has-text("Affirm")',
      'mat-dialog-content:has-text("Congratulations") ~ mat-dialog-actions button:first-child'
    ]
  },
  confirmation: {
    yes: [
      '[id*="mat-dialog"] reg-dailog-content-confirmation mat-dialog-actions button.btn-black:has-text("Yes")',
      '#mat-dialog-7 > reg-dailog-content-confirmation > mat-dialog-actions > button.mat-focus-indicator.btn-black.mat-raised-button.mat-button-base',
      '#mat-dialog-1 > reg-dailog-content-confirmation > mat-dialog-actions > button.mat-focus-indicator.btn-black.mat-raised-button.mat-button-base',
      'reg-dailog-content-confirmation mat-dialog-actions button.btn-black:has-text("Yes")',
      'reg-dailog-content-confirmation mat-dialog-actions button:first-child',
      'mat-dialog-actions button.btn-black:has-text("Yes")',
      'mat-dialog-actions button:has-text("Yes")',
      'button:has-text("Yes")'
    ]
  },
  contractor: {
    button: [
      '[id*="mat-dialog"] reg-dailog-fit-survey-launch-confirmation mat-dialog-actions button.btn-danger:has-text("Installing Contractor")',
      '#mat-dialog-16 > reg-dailog-fit-survey-launch-confirmation > mat-dialog-actions > button.mat-focus-indicator.btn.btn-danger.mat-raised-button.mat-button-base',
      'reg-dailog-fit-survey-launch-confirmation mat-dialog-actions button.btn-danger:has-text("Installing Contractor")',
      'reg-dailog-fit-survey-launch-confirmation button:has-text("Installing Contractor")',
      'mat-dialog-actions button.btn-danger:has-text("Installing Contractor")',
      'mat-dialog-actions button:has-text("Installing Contractor")',
      'button:has-text("Installing Contractor")'
    ]
  },
  success: {
    ok: [
      'body > div.swal-overlay.swal-overlay--show-modal > div > div.swal-footer > div > button',
      'button.swal-button.swal-button--confirm',
      '.swal-button--confirm'
    ]
  },
  download: {
    button: [
      '[role="button"][name="Download Certificate"]',
      '#cdk-step-content-1-3 > div.action-buttons.ng-star-inserted > button:nth-child(1)',
      'div.action-buttons button:first-child',
      'div.action-buttons button',
      'button:has-text("Download")',
      'button[class*="download"]'
    ]
  },
  cookie: {
    close: [
      '#onetrust-close-btn-container > button',
      '#onetrust-reject-all-handler',
      '#onetrust-accept-btn-handler'
    ]
  }
};

/**
 * Attempts to click the first visible and enabled element matching any of the provided selectors
 * @param {Frame} frame - Playwright Frame object
 * @param {string[]} selectors - Array of selectors to try
 * @param {Object} options - Click options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @param {boolean} options.ensureEnabled - Check if element is enabled (default: true)
 * @param {boolean} options.forceFallback - Try force click if normal click fails (default: true)
 * @returns {Promise<{selector: string, clicked: boolean}>}
 */
async function clickFirstVisible(frame, selectors, { timeout = 5000, ensureEnabled = true, forceFallback = true } = {}) {
  for (const selector of selectors) {
    try {
      const element = await frame.waitForSelector(selector, { timeout });
      if (!element) continue;

      const isVisible = await element.isVisible();
      const isEnabled = !ensureEnabled || await element.isEnabled();

      if (isVisible && isEnabled) {
        try {
          await element.click();
          return { selector, clicked: true };
        } catch (clickError) {
          if (forceFallback && (clickError.message.includes('viewport') || clickError.message.includes('intercepts'))) {
            // Try force click
            const clicked = await frame.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) {
                el.click();
                return true;
              }
              return false;
            }, selector);
            if (clicked) {
              return { selector, clicked: true };
            }
          }
        }
      }
    } catch (error) {
      logger.debug(`Selector failed: ${selector} - ${error.message}`);
    }
  }
  throw new Error(`Could not click any element with selectors: ${selectors.join(', ')}`);
}

/**
 * Returns the first visible element matching any of the provided selectors
 * @param {Frame} frame - Playwright Frame object
 * @param {string[]} selectors - Array of selectors to try
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @returns {Promise<ElementHandle|null>}
 */
async function getFirstVisible(frame, selectors, { timeout = 5000 } = {}) {
  for (const selector of selectors) {
    try {
      const element = await frame.waitForSelector(selector, { timeout });
      if (element && await element.isVisible()) {
        return element;
      }
    } catch (error) {
      logger.debug(`Selector failed: ${selector} - ${error.message}`);
    }
  }
  return null;
}

/**
 * Fills an input field with verification
 * @param {Frame} frame - Playwright Frame object
 * @param {string[]} selectors - Array of selectors to try
 * @param {string} value - Value to fill
 * @param {Object} options - Options
 * @param {boolean} options.verify - Verify value after fill (default: false)
 * @returns {Promise<void>}
 */
async function fillInput(frame, selectors, value, { verify = false } = {}) {
  const element = await getFirstVisible(frame, selectors);
  if (!element) {
    throw new Error(`Could not find input with selectors: ${selectors.join(', ')}`);
  }

  await element.click();
  await element.selectText();
  await element.fill(value);

  if (verify) {
    const currentValue = await element.inputValue();
    if (currentValue !== value) {
      logger.warn(`Input value mismatch. Expected: "${value}", Got: "${currentValue}". Re-entering...`);
      await element.click();
      await element.selectText();
      await element.fill(value);
      await frame.waitForTimeout(WAIT.short);
    }
  }
}

/**
 * Handles any dialogs that might appear during registration
 * @param {Frame} frame - Playwright Frame object
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms (default: 2000)
 * @param {boolean} options.ignoreErrors - Whether to ignore errors when dialogs are not found (default: true)
 * @returns {Promise<void>}
 */
async function handleDialogs(frame, { timeout = 2000, ignoreErrors = true } = {}) {
  const dialogHandlers = [
    // Installing Contractor dialog
    async () => {
      const contractorButton = await frame.getByRole('button', { name: 'Installing Contractor' });
      if (await contractorButton.isVisible()) {
        logger.info('Found Installing Contractor dialog, clicking button');
        await contractorButton.click();
        // Ignore any new windows that might open
        frame.page().once('popup', async popup => {
          logger.info('New window opened after contractor dialog, ignoring');
          await popup.close();
        });
        return true;
      }
      return false;
    },
    // OK dialog
    async () => {
      const okButton = await frame.getByRole('button', { name: 'OK' });
      if (await okButton.isVisible()) {
        logger.info('Found OK dialog, clicking button');
        await okButton.click();
        return true;
      }
      return false;
    }
  ];

  try {
    let dialogFound = false;
    for (const handler of dialogHandlers) {
      try {
        const handled = await handler();
        if (handled) {
          dialogFound = true;
          // Wait a moment for any animations
          await frame.waitForTimeout(500);
        }
      } catch (error) {
        if (!ignoreErrors) {
          throw error;
        }
      }
    }
    return dialogFound;
  } catch (error) {
    if (!ignoreErrors) {
      throw error;
    }
    logger.warn('Error handling dialogs:', error);
    return false;
  }
}

module.exports = {
  WAIT,
  SELECTORS,
  clickFirstVisible,
  getFirstVisible,
  fillInput,
  handleDialogs
};
