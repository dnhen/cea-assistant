// Tab Management
let activeTab = 'roll';

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
