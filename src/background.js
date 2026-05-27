"use strict";

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!chrome.sidePanel || !tab || !tab.id) return;

  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "popup.html",
    enabled: true
  });

  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.tabs.onActivated.addListener(() => {
  notifyPanelTabChanged();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.id === tabId) {
    notifyPanelTabChanged();
  }
});

function notifyPanelTabChanged() {
  chrome.runtime.sendMessage({ type: "tdimagedown:tabChanged" }).catch(() => {});
}
