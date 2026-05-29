document.addEventListener('DOMContentLoaded', async () => {
  const activityIdDisplay = document.querySelector('#activityIdDisplay');
  //const copyRampActionButton = document.querySelector('#copyRampActionButton');
  //const pasteRampActionButton = document.querySelector('#pasteRampActionButton');

  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get the status of the RAMP, and enable copy button if RAMP is completed
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (activityIdDisplayX) => {
      const activityId = document
        .querySelector('.activity-title-text.ng-binding')
        .innerHTML.replaceAll('&nbsp;', '')
        .split(':')[0];

      activityIdDisplayX.innerHTML = activityId;
      console.log(activityIdDisplayX);
    },
    args: [activityIdDisplay],
  });
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
