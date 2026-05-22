const { expect } = require('@playwright/test');

async function enterConsentAndInstructionsIfNeeded(page) {
  if (/pages\/instructions\.html/.test(page.url())) {
    return;
  }

  const consentAcceptBtn = page.locator('#consentAcceptBtn');
  const consentVisible = await consentAcceptBtn
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (consentVisible) {
    await consentAcceptBtn.click();
    await page.waitForLoadState('domcontentloaded');
  }

  await expect(page).toHaveURL(/pages\/instructions\.html/, {
    timeout: 30000,
  });
}

async function enterStudyIfNeeded(page) {
  await enterConsentAndInstructionsIfNeeded(page).catch(() => undefined);

  const continueBtn = page.locator('#continueBtn');
  const continueVisible = await continueBtn
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (continueVisible) {
    await continueBtn.click();
    await page.waitForLoadState('domcontentloaded');
  }

  await expect(page).toHaveURL(/index\.html/, {
    timeout: 30000,
  });
}

module.exports = {
  enterConsentAndInstructionsIfNeeded,
  enterStudyIfNeeded,
};
