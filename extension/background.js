// The public extension is self-contained: no local bridge, polling or credentials.
chrome.sidePanel.setOptions({path: 'sidepanel.html', enabled: true}).catch(() => {});
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch(() => {});
