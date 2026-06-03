// File upload functionality
const fileInputZone = document.querySelector('.fileInputZone');
const fileInput = document.querySelector('#fileUpload');

fileInputZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    const fileName = e.target.files[0].name;
    fileInputZone.querySelector('.title').innerHTML = fileName;
    fileInputZone.querySelector('.subtitle').classList.add('hidden');

    pushNotification('Successfully uploaded file', 'green');
  }
});

// Mark roll functionality
document.getElementById('markRollActionButton').addEventListener('click', async () => {
  const fileInput = document.querySelector('#fileUpload');

  // If no CSV was uploaded, stop
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a CSV file first!');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  // This fires once the file is fully read in the popup context
  reader.onload = async (e) => {
    // Get the key to compare against (ID, name, etc)
    const keyValue = document.querySelector('#rollKeySelector').value;

    // Text is the plain CSV string
    const text = e.target.result;
    const textSplitString = keyValue === 'name_lastfirst' ? /\r?\n/ : /[\n,\r]+/;

    // Convert CSV text into a clean array of string IDs
    // This splits by commas, newlines, or carriage returns and filters out empty values
    // This also makes all strings lower case
    let targetValues = text
      .split(textSplitString)
      .map((target) => target.trim())
      .map((target) => target.toLowerCase())
      .map((target) => target.replace(/"/g, '')) // Remove quotation marks if present
      .filter((target) => target.length > 0);

    if (targetValues.length === 0) {
      alert('No values found in the CSV file.');
      return;
    }

    // If the CSV is ordered <last>, <first> we need to reconstruct entries
    if (keyValue === 'name_lastfirst') {
      targetValues = targetValues.flatMap((target) => {
        const parts = target.split(',').map((part) => part.trim());
        if (parts.length === 2) {
          return `${parts[1]} ${parts[0]}`;
        }

        return target; // If the format is unexpected, return the original string for better error handling later
      });
    }

    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Execute the script on the page, passing targetValues via the 'args' array
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: checkAttendance,
      args: [targetValues, keyValue],
    });
  };

  reader.readAsText(file);

  pushNotification('Successfully marked the roll', 'green');
});

/**
 * The function to execute ticking as present all given targetValues
 * @param {array} targetValues the targets we want to mark as present
 * @param {string} keyValue the key we use to compare the targets against (ID, name, etc)
 */
function checkAttendance(targetValues, keyValue) {
  const dynamicTargetValues = targetValues;
  // Find all rows in the roll
  const rows = document.querySelectorAll('tr[ng-repeat*="item.Entries"]');

  // Loop through each row in the roll list
  rows.forEach((row) => {
    // Set the cell to compare against as the ID by default, override below based on key selector
    let masterKeyCell;

    // Set the specific cell to use as the comparator
    switch (keyValue) {
      case 'name_lastfirst':
      case 'name':
        masterKeyCell = row.querySelectorAll('td.all')[1];
        break;
      case 'id':
      default:
        masterKeyCell = row.querySelectorAll('td.tablet')[2];
        break;
    }

    if (masterKeyCell) {
      // Get the value of the cell in the row, trim whitespace, lowercase it
      const rowValue = masterKeyCell.textContent.trim().toLowerCase();

      // Find the button inside the 'td.all' cell of this exact row
      const button = row.querySelector('td.all button');

      if (!button) {
        console.info(
          `// CEA ASSIST: Could not find button for row with value ${rowValue}. Skipping attendance marking for this row.`
        );
      }

      const rowInCSVIndex = dynamicTargetValues.findIndex((targetValue) => {
        return rowValue.includes(targetValue.toLowerCase());
      });
      const rowInCSV = rowInCSVIndex !== -1;

      //dynamicTargetValues.splice(rowInCSVIndex, 1);

      if (!rowInCSV) {
        // Entry not in the CSV, therefore mark as absent (double click);
        button.click();
        button.click();
        return;
      }

      // Remove from the CSV entries array to track which entries we have found in the roll
      dynamicTargetValues.splice(rowInCSVIndex, 1);

      // Mark attended
      button.click();
      return;
    }
  });

  dynamicTargetValues.length > 0 &&
    console.error('// CEA ASSIST: Remaining values NOT MARKED/MATCHED:', dynamicTargetValues);
}
