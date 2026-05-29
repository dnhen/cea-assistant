// Notification Management
const NOTIFICATION_DURATION_SECONDS = 5;

const notificationElement = document.querySelector('.notification');
const notificationIndicatorElement = notificationElement.querySelector('.activeIndicator');

function pushNotification(text, type) {
  // Reset classList
  notificationElement.className = 'container notification hidden';

  // Update notification text
  notificationElement.querySelector('p').innerText = text;

  // Add notification type indicator
  switch (type) {
    case 'green':
      notificationIndicatorElement.classList.add('green');
      break;
    case 'red':
      notificationIndicatorElement.classList.add('red');
      break;
    default:
      notificationIndicatorElement.classList.add('green');
      break;
  }

  // Show the notification element
  notificationElement.classList.remove('hidden');

  // Set timer to make it hide after X seconds
  setTimeout(hideNotification, NOTIFICATION_DURATION_SECONDS * 1000);
}

const hideNotification = () => {
  notificationElement.classList.add('hidden');
};

// Tab Management
let activeTab = 'ramp';

const allTabs = ['roll', 'ramp'];

allTabs.forEach((tab) => {
  const tabButton = document.querySelector(`#${tab}TabButton`);

  // Ignore disabled tabs
  if (tabButton.classList.contains('disabled')) return;

  const tabBody = document.querySelector(`#${tab}TabBody`);

  // Ignore tabs with no button or body
  if (!tabButton || !tabBody) return;

  tabButton.addEventListener('click', () => {
    // If the clicked tab is the active, end
    if (tab === activeTab) return;

    // Change active class to new tab for button
    document.querySelector(`#${activeTab}TabButton`).classList.remove('active');
    tabButton.classList.add('active');

    // Change active class to new tab for body
    document.querySelector(`#${activeTab}TabBody`).classList.add('hidden');
    tabBody.classList.remove('hidden');

    // Set the active tab
    activeTab = tab;
  });
});
