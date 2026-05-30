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
    // Text is the plain CSV string
    const text = e.target.result;

    // Convert CSV text into a clean array of string IDs
    // This splits by commas, newlines, or carriage returns and filters out empty values
    // This also makes all strings lower case
    const targetValues = text
      .split(/[\n,\r]+/)
      .map((target) => target.trim())
      .map((target) => target.toLowerCase())
      .filter((target) => target.length > 0);

    if (targetValues.length === 0) {
      alert('No values found in the CSV file.');
      return;
    }

    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get the key to compare against (ID, name, etc)
    const keyValue = document.querySelector('#rollKeySelector').value;

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
  // Find all rows in the roll
  const rows = document.querySelectorAll('tr[ng-repeat*="item.Entries"]');

  // Loop through each row in the roll list
  rows.forEach((row) => {
    // Set the cell to compare against as the ID by default, override below based on key selector
    let masterKeyCell;

    // Set the specific cell to use as the comparator
    switch (keyValue) {
      case 'name':
        masterKeyCell = row.querySelectorAll('td.all')[1];
        break;
      case 'id':
      default:
        masterKeyCell = row.querySelectorAll('td.tablet')[2];
        break;
    }

    if (masterKeyCell) {
      const rowValue = masterKeyCell.textContent.trim().toLowerCase();

      // Check if the current row's ID exists in the target array
      if (
        targetValues.some((targetValue) => {
          return rowValue.includes(targetValue.toLowerCase());
        })
      ) {
        // Find the button inside the 'td.all' cell of this exact row
        const button = row.querySelector('td.all button');

        if (button) {
          button.click();
          console.log(`Successfully clicked button for key: ${rowValue}`);
        } else {
          console.log(`Found matching key ${rowValue}, but couldn't find the button in td.all`);
        }
      }
    }
  });
}
