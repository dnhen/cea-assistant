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

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a CSV file first!');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  // This fires once the file is fully read in the popup context
  reader.onload = async (e) => {
    const text = e.target.result;

    // Convert CSV text into a clean array of string IDs
    // This splits by commas, newlines, or carriage returns and filters out empty values
    const targetIds = text
      .split(/[\n,\r]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (targetIds.length === 0) {
      alert('No IDs found in the CSV file.');
      return;
    }

    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get the key to compare against
    const keyValue = document.querySelector('#rollKeySelector').value;

    // Execute the script on the page, passing targetIds via the 'args' array
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: checkAttendance,
      args: [targetIds, keyValue],
    });
  };

  // Read the file as plain text
  reader.readAsText(file);

  pushNotification('Successfully marked the roll', 'green');
});

function checkAttendance(targetIds, keyValue) {
  // Find all rows in the roll
  const rows = document.querySelectorAll('tr[ng-repeat*="item.Entries"]');

  rows.forEach((row) => {
    // Set the cell to compare against as the ID by default, override below based on key selector
    let idCell = row.querySelectorAll('td.tablet')[2];

    console.log(keyValue);

    switch (keyValue) {
      case 'name':
        idCell = row.querySelectorAll('td.all')[1];
        break;
    }

    if (idCell) {
      const rowId = idCell.textContent.trim();

      // Check if the current row's ID exists in the target array
      if (targetIds.some((item) => rowId.includes(item))) {
        // Find the button inside the 'td.all' cell of this exact row
        const button = row.querySelector('td.all button');

        if (button) {
          button.click();
          console.log(`Successfully clicked button for ID: ${rowId}`);
        } else {
          console.log(`Found matching ID ${rowId}, but couldn't find the button in td.all`);
        }
      }
    }
  });
}
