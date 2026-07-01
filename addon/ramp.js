// RAMP copy/paste functionality
const RAMP_STORAGE_KEY = 'savedRamp';

const savedRampDisplay = document.querySelector('#savedRampDisplay');
const copyRampButton = document.querySelector('#copyRampActionButton');
const pasteRampButton = document.querySelector('#pasteRampActionButton');

// Reflect whatever is currently saved in chrome.storage into the popup UI
function refreshSavedRampDisplay() {
  chrome.storage.local.get([RAMP_STORAGE_KEY], (result) => {
    const saved = result[RAMP_STORAGE_KEY];

    if (saved && saved.activityName) {
      savedRampDisplay.innerText = `${saved.activityName}`;
    } else {
      savedRampDisplay.innerText = 'No RAMP saved';
    }
  });
}

refreshSavedRampDisplay();

// Copy Ramp functionality
copyRampButton.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractRampData,
  });

  const result = injectionResults && injectionResults[0] ? injectionResults[0].result : null;

  if (!result || !result.success) {
    pushNotification(result?.error || 'Failed to copy RAMP', 'red');
    return;
  }

  chrome.storage.local.set({ [RAMP_STORAGE_KEY]: result.data }, () => {
    refreshSavedRampDisplay();
    pushNotification(`RAMP Saved (${result.data.activityName})`, 'green');
  });
});

// Paste Ramp functionality
pasteRampButton.addEventListener('click', () => {
  chrome.storage.local.get([RAMP_STORAGE_KEY], async (storageResult) => {
    const saved = storageResult[RAMP_STORAGE_KEY];

    if (!saved) {
      pushNotification('No RAMP saved to paste', 'red');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applyRampData,
      args: [saved],
    });

    const pasteResult = injectionResults && injectionResults[0] ? injectionResults[0].result : null;

    if (!pasteResult || !pasteResult.success) {
      pushNotification(pasteResult?.error || 'Failed to paste RAMP', 'red');
      return;
    }

    const categoryWord = pasteResult.categoriesApplied === 1 ? 'category' : 'categories';
    pushNotification(
      `Pasted ${pasteResult.hazardsApplied} hazard(s) across ${pasteResult.categoriesApplied} ${categoryWord}`,
      'green',
    );
  });
});

/**
 * Runs in the page context (injected via chrome.scripting.executeScript).
 * Walks every hazard category on the currently open RAMP and, for every
 * category/hazard that is ticked, records its Plan and Residual
 * likelihood/consequence values.
 */
function extractRampData() {
  try {
    // Pull the activity name, stripping the trailing "(date)" span
    const titleEl = document.querySelector('.activity-title-text');
    let activityName = 'Unknown Activity';

    if (titleEl) {
      const clone = titleEl.cloneNode(true);
      const dateSpan = clone.querySelector('.activity-date');
      if (dateSpan) dateSpan.remove();
      activityName = clone.textContent.replace(/\s+/g, ' ').trim();
    }

    const categoryEls = document.querySelectorAll('[ng-repeat="cat in hazardCategories"]');

    if (categoryEls.length === 0) {
      return {
        success: false,
        error: 'Could not find any RAMP hazard categories on this page. Are you on an activity RAMP page?',
      };
    }

    const categories = [];

    categoryEls.forEach((catEl) => {
      // NOTE: the category heading has TWO nested <a> tags - an outer
      // "accordion-toggle" anchor that wraps the entire heading (name +
      // hazard count + risk level), and an inner one that wraps only the
      // name itself. The name always sits inside a <td width="65%">, so we
      // scope the selector there to avoid picking up the outer wrapper.
      const nameEl = catEl.querySelector('td[width="65%"] a');
      if (!nameEl) return;

      const categoryName = nameEl.textContent.replace(/\s+/g, ' ').trim();

      const catCheckbox = catEl.querySelector('input[type="checkbox"][ng-model="cat.Enabled"]');
      // No checkbox present means this category is mandatory and always enabled
      const categoryEnabled = catCheckbox ? catCheckbox.checked : true;

      if (!categoryEnabled) return;

      const hazardEls = catEl.querySelectorAll('tbody[ng-repeat="haz in cat.Hazards track by $index"]');
      const hazards = [];

      hazardEls.forEach((hazEl) => {
        const hazNameEl = hazEl.querySelector('td b');
        if (!hazNameEl) return;

        const hazardName = hazNameEl.textContent.replace(/\s+/g, ' ').trim();

        const hazCheckbox = hazEl.querySelector('input[type="checkbox"][ng-model="haz.Enabled"]');
        // No checkbox present means this hazard is mandatory and always enabled
        const hazardEnabled = hazCheckbox ? hazCheckbox.checked : true;

        if (!hazardEnabled) return;

        const planEl = hazEl.querySelector('textarea[name="x_Controls"]');
        const resLikelihoodEl = hazEl.querySelector('select[name="x_ResidualLikelihoodId"]');
        const resConsequenceEl = hazEl.querySelector('select[name="x_ResidualConsequenceId"]');

        hazards.push({
          name: hazardName,
          plan: planEl ? planEl.value : '',
          residualLikelihood:
            resLikelihoodEl && resLikelihoodEl.selectedIndex >= 0
              ? resLikelihoodEl.options[resLikelihoodEl.selectedIndex].text
              : '',
          residualConsequence:
            resConsequenceEl && resConsequenceEl.selectedIndex >= 0
              ? resConsequenceEl.options[resConsequenceEl.selectedIndex].text
              : '',
        });
      });

      if (hazards.length > 0) {
        categories.push({ name: categoryName, hazards });
      }
    });

    if (categories.length === 0) {
      return { success: false, error: 'No ticked hazards were found to copy' };
    }

    return { success: true, data: { activityName, categories } };
  } catch (err) {
    return { success: false, error: `Unexpected error while copying: ${err.message}` };
  }
}

/**
 * Runs in the page context (injected via chrome.scripting.executeScript).
 * Applies previously saved RAMP data (category/hazard ticks, Plan text,
 * Residual likelihood/consequence) onto the currently open RAMP.
 */
async function applyRampData(saved) {
  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (setter) {
      setter.call(element, value);
    } else {
      element.value = value;
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalize(text) {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function selectOptionByText(selectEl, text) {
    if (!selectEl || !text) return false;

    const target = normalize(text);
    const option = Array.from(selectEl.options).find((opt) => normalize(opt.text) === target);

    if (!option) return false;

    setNativeValue(selectEl, option.value);
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  try {
    const categoryEls = Array.from(document.querySelectorAll('[ng-repeat="cat in hazardCategories"]'));

    if (categoryEls.length === 0) {
      return {
        success: false,
        error: 'Could not find any RAMP hazard categories on this page. Are you on an activity RAMP page?',
      };
    }

    let categoriesApplied = 0;
    let hazardsApplied = 0;

    for (const savedCat of saved.categories) {
      const targetCatName = normalize(savedCat.name);
      const catEl = categoryEls.find((el) => {
        const nameEl = el.querySelector('td[width="65%"] a');
        return nameEl && normalize(nameEl.textContent) === targetCatName;
      });

      // Skip categories that don't exist on this activity's RAMP
      if (!catEl) continue;

      const catCheckbox = catEl.querySelector('input[type="checkbox"][ng-model="cat.Enabled"]');

      if (catCheckbox && !catCheckbox.checked) {
        catCheckbox.click();
        // Give Angular's digest cycle a moment to render the hazard checkboxes,
        // which only appear in the DOM once the category is enabled
        await wait(75);
      }

      let categoryHadHazardApplied = false;

      for (const savedHaz of savedCat.hazards) {
        const targetHazName = normalize(savedHaz.name);
        const hazardEls = Array.from(catEl.querySelectorAll('tbody[ng-repeat="haz in cat.Hazards track by $index"]'));
        const hazEl = hazardEls.find((el) => {
          const nameEl = el.querySelector('td b');
          return nameEl && normalize(nameEl.textContent) === targetHazName;
        });

        // Skip hazards that don't exist under this category on this activity
        if (!hazEl) continue;

        const hazCheckbox = hazEl.querySelector('input[type="checkbox"][ng-model="haz.Enabled"]');

        if (hazCheckbox && !hazCheckbox.checked) {
          hazCheckbox.click();
          await wait(25);
        }

        const planEl = hazEl.querySelector('textarea[name="x_Controls"]');
        if (planEl && savedHaz.plan) {
          setNativeValue(planEl, savedHaz.plan);
          planEl.dispatchEvent(new Event('input', { bubbles: true }));
          planEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const resLikelihoodEl = hazEl.querySelector('select[name="x_ResidualLikelihoodId"]');
        selectOptionByText(resLikelihoodEl, savedHaz.residualLikelihood);

        const resConsequenceEl = hazEl.querySelector('select[name="x_ResidualConsequenceId"]');
        selectOptionByText(resConsequenceEl, savedHaz.residualConsequence);

        hazardsApplied += 1;
        categoryHadHazardApplied = true;
      }

      if (categoryHadHazardApplied) categoriesApplied += 1;
    }

    if (hazardsApplied === 0) {
      return {
        success: false,
        error: 'None of the saved categories/hazards were found on this RAMP',
      };
    }

    return { success: true, categoriesApplied, hazardsApplied };
  } catch (err) {
    return { success: false, error: `Unexpected error while pasting: ${err.message}` };
  }
}
