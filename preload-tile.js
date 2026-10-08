const { ipcRenderer } = require('electron');

let lastHoverReport = 0;

function reportActivity(type) {
    const now = Date.now();
    if (type === 'hover' && now - lastHoverReport < 15000) return;
    if (type === 'hover') lastHoverReport = now;
    ipcRenderer.send('tile-activity', type);
}

document.addEventListener('pointermove', () => reportActivity('hover'), { capture: true, passive: true });
document.addEventListener('pointerover', () => reportActivity('hover'), { capture: true, passive: true });
document.addEventListener('pointerdown', () => reportActivity('click'), { capture: true, passive: true });

document.addEventListener('hare-reader-mode-state', (event) => {
    if (event.detail === false) ipcRenderer.send('reader-mode-state-from-tile', false);
});
