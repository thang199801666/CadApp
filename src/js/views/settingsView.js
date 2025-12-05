// settingsView.js - Handles settings panel UI
export function initSettings(helpers = {}) {
    const settingsBtn = document.getElementById('settings-btn');
    const panel = document.getElementById('settings-panel');
    const closeBtn = document.getElementById('settings-close');
    const form = document.getElementById('settings-form');
    const applyBtn = document.getElementById('settings-apply');
    const resetBtn = document.getElementById('settings-reset');
    if (!panel || !form) return;

    function showPanel() { panel.style.display = 'block'; panel.setAttribute('aria-hidden', 'false'); }
    function hidePanel() { panel.style.display = 'none'; panel.setAttribute('aria-hidden', 'true'); }

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('viewer.settings') || '{}');
            if (saved.bgcolor) {
                const bg = document.getElementById('setting-bgcolor'); if (bg) bg.value = saved.bgcolor;
                document.body.style.backgroundColor = saved.bgcolor;
            }
            if (saved.font) {
                const f = document.getElementById('setting-font'); if (f) f.value = saved.font;
                document.body.style.fontFamily = saved.font;
            }
            if (saved.fontsize) {
                const fs = document.getElementById('setting-fontsize'); if (fs) fs.value = saved.fontsize;
                document.documentElement.style.fontSize = `${saved.fontsize}px`;
            }
            if (saved.mousemode) {
                const mm = document.getElementById('setting-mousemode'); if (mm) mm.value = saved.mousemode;
            }
            if (saved.featureAngle !== undefined) {
                const fa = document.getElementById('setting-featureangle'); if (fa) fa.value = saved.featureAngle;
                try { if (helpers.setFeatureAngle) helpers.setFeatureAngle(saved.featureAngle); } catch(e){}
            }
            try { if (helpers.setMouseMapping && saved.mousemode) helpers.setMouseMapping(saved.mousemode); } catch(e){}
        } catch(e) { }
    }

    function applySettings() {
        try {
            const bg = document.getElementById('setting-bgcolor');
            const font = document.getElementById('setting-font');
            const fontsize = document.getElementById('setting-fontsize');
            const mousemode = document.getElementById('setting-mousemode');
            const featureangle = document.getElementById('setting-featureangle');
            const cfg = {};
            if (bg) { document.body.style.backgroundColor = bg.value; cfg.bgcolor = bg.value; }
            if (font) { document.body.style.fontFamily = font.value; cfg.font = font.value; }
            if (fontsize) { document.documentElement.style.fontSize = fontsize.value + 'px'; cfg.fontsize = fontsize.value; }
            if (mousemode) { cfg.mousemode = mousemode.value; }
            if (featureangle) { cfg.featureAngle = Number(featureangle.value || 0); }
            try { localStorage.setItem('viewer.settings', JSON.stringify(cfg)); } catch(e){}
            try { if (helpers.setMouseMapping && cfg.mousemode) helpers.setMouseMapping(cfg.mousemode); } catch(e){}
            try { if (helpers.setFeatureAngle && cfg.featureAngle !== undefined) helpers.setFeatureAngle(cfg.featureAngle); } catch(e){}
            hidePanel();
            window.logMessage && window.logMessage('Settings applied.');
        } catch(e) { console.warn('Failed to apply settings', e); }
    }

    function resetSettings() {
        const defaults = { bgcolor: '#8a8888', font: "Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif", fontsize: 14, mousemode: 'Default', featureAngle: 30 };
        const bg = document.getElementById('setting-bgcolor'); if (bg) bg.value = defaults.bgcolor;
        const font = document.getElementById('setting-font'); if (font) font.value = defaults.font;
        const fs = document.getElementById('setting-fontsize'); if (fs) fs.value = defaults.fontsize;
        const mm = document.getElementById('setting-mousemode'); if (mm) mm.value = defaults.mousemode;
        const fa = document.getElementById('setting-featureangle'); if (fa) fa.value = defaults.featureAngle;
        applySettings();
    }

    if (settingsBtn) settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); showPanel(); });
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); hidePanel(); });
    if (applyBtn) applyBtn.addEventListener('click', (e) => { e.stopPropagation(); applySettings(); });
    if (resetBtn) resetBtn.addEventListener('click', (e) => { e.stopPropagation(); resetSettings(); });

    document.addEventListener('click', (e) => { if (!panel) return; if (panel.contains(e.target) || (settingsBtn && settingsBtn.contains(e.target))) return; hidePanel(); });

    loadSettings(); hidePanel();
}
