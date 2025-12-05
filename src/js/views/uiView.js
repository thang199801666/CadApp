// uiView.js - UI (View) responsibilities: menus, panels, settings, console, splitters, tree
// Keep view code DOM-focused and call back into controller/scene via helpers.
import { initSettings } from './settingsView.js';
import { initMenus } from './menusView.js';
import { initContextMenu } from './contextMenuView.js';
import { TreeView } from './treeView.js';

export function initUI(helpers = {}) {
    // Initialize tree view
    const treeView = new TreeView({
        containerId: 'tree-panel',
        contentId: 'tree-content',
        onNodeSelect: (node) => {
            console.log('Tree node selected:', node);
            if (window.logMessage) {
                window.logMessage(`Selected: ${node.name}`);
            }
            
            // Highlight the model in the scene if it's the root node with model reference
            if (node.type === 'root' && node.object) {
                console.log('Highlighting model, node has object:', !!node.object);
                // Apply selected material
                if (window.highlightModel) {
                    window.highlightModel(true);
                } else {
                    console.log('window.highlightModel not available');
                }
            } else {
                console.log('Node is not root or has no object. Type:', node.type, 'Has object:', !!node.object);
                // Deselect if clicking on child nodes
                if (window.highlightModel) {
                    window.highlightModel(false);
                }
            }
        }
    });

    // Initialize with default "Model" root
    window.currentModelName = 'Model';
    treeView.loadModel({
        name: 'Model',
        type: 'root',
        children: []
    });
    
    // Update tree title when model name changes
    window.updateTreeTitle = (name) => {
        const titleElement = document.getElementById('tree-title');
        if (titleElement) {
            titleElement.textContent = name || 'Tree View';
        }
    };

    // Expose tree view globally
    window.treeView = treeView;
    
    // Helper to update tree from model
    window.updateTree = (model) => {
        if (treeView && model) {
            treeView.updateFromModel(model);
        }
    };

    // Console logging
    window.logMessage = function (text, isError = false) {
        const consoleDiv = document.getElementById('console-output');
        if (!consoleDiv) return;
        const span = document.createElement('div');
        span.style.color = isError ? '#ff5555' : '#000000';
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        span.textContent = `[${hh}:${mm}:${ss}] ${text}`;
        consoleDiv.appendChild(span);
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    };

    // Settings panel wiring
    (function settingsForm() {
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
                    if (window.setSceneBackground) window.setSceneBackground(saved.bgcolor);
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
                try { if (helpers.setMouseMapping && saved.mousemode) helpers.setMouseMapping(saved.mousemode); } catch(e){}
            } catch(e) { }
        }

        function applySettings() {
            try {
                const bg = document.getElementById('setting-bgcolor');
                const font = document.getElementById('setting-font');
                const fontsize = document.getElementById('setting-fontsize');
                const mousemode = document.getElementById('setting-mousemode');
                const cfg = {};
                if (bg) { 
                    cfg.bgcolor = bg.value;
                    if (window.setSceneBackground) window.setSceneBackground(bg.value);
                }
                if (font) { document.body.style.fontFamily = font.value; cfg.font = font.value; }
                if (fontsize) { document.documentElement.style.fontSize = fontsize.value + 'px'; cfg.fontsize = fontsize.value; }
                if (mousemode) { cfg.mousemode = mousemode.value; }
                try { localStorage.setItem('viewer.settings', JSON.stringify(cfg)); } catch(e){}
                try { if (helpers.setMouseMapping && cfg.mousemode) helpers.setMouseMapping(cfg.mousemode); } catch(e){}
                hidePanel();
                window.logMessage && window.logMessage('Settings applied.');
            } catch(e) { console.warn('Failed to apply settings', e); }
        }

        function resetSettings() {
            const defaults = { bgcolor: '#ffffff', font: "Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif", fontsize: 14, mousemode: 'Default' };
            const bg = document.getElementById('setting-bgcolor'); if (bg) bg.value = defaults.bgcolor;
            const font = document.getElementById('setting-font'); if (font) font.value = defaults.font;
            const fs = document.getElementById('setting-fontsize'); if (fs) fs.value = defaults.fontsize;
            const mm = document.getElementById('setting-mousemode'); if (mm) mm.value = defaults.mousemode;
            applySettings();
        }

        if (settingsBtn) settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); showPanel(); });
        if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); hidePanel(); });
        if (applyBtn) applyBtn.addEventListener('click', (e) => { e.stopPropagation(); applySettings(); });
        if (resetBtn) resetBtn.addEventListener('click', (e) => { e.stopPropagation(); resetSettings(); });

        document.addEventListener('click', (e) => { if (!panel) return; if (panel.contains(e.target) || (settingsBtn && settingsBtn.contains(e.target))) return; hidePanel(); });

        loadSettings(); hidePanel();
    })();

    // Initialize splitters
    (function setupSplitters(){
        const verticalSplitter = document.getElementById('vertical-splitter');
        const horizontalSplitter = document.getElementById('horizontal-splitter');
        const root = document.documentElement;

        // Vertical splitter (resizes tree panel width)
        if (verticalSplitter) {
            let isDragging = false;
            let startX = 0;
            let startWidth = 0;

            verticalSplitter.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.clientX;
                const treePanel = document.getElementById('tree-panel');
                startWidth = treePanel ? treePanel.offsetWidth : 260;
                verticalSplitter.classList.add('active');
                e.preventDefault();
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const delta = e.clientX - startX;
                const newWidth = Math.max(150, Math.min(600, startWidth + delta));
                root.style.setProperty('--left-width', `${newWidth}px`);
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    verticalSplitter.classList.remove('active');
                }
            });
        }

        // Horizontal splitter (resizes console height)
        if (horizontalSplitter) {
            let isDragging = false;
            let startY = 0;
            let startHeight = 0;

            horizontalSplitter.addEventListener('mousedown', (e) => {
                isDragging = true;
                startY = e.clientY;
                const consoleContainer = document.getElementById('console-container');
                startHeight = consoleContainer ? consoleContainer.offsetHeight : 84;
                horizontalSplitter.classList.add('active');
                e.preventDefault();
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const delta = startY - e.clientY;
                const newHeight = Math.max(60, Math.min(400, startHeight + delta));
                root.style.setProperty('--console-height', `${newHeight}px`);
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    horizontalSplitter.classList.remove('active');
                }
            });
        }
    })();

    // Initialize coordinate display
    (function initCoords(){
        function updateCoords(){ 
            const cx = document.getElementById('coord-x'); 
            const cy = document.getElementById('coord-y'); 
            const cz = document.getElementById('coord-z'); 
            if (!cx||!cy||!cz) return; 
            cx.textContent='0.00'; 
            cy.textContent='0.00'; 
            cz.textContent='0.00'; 
        }
        updateCoords();
    })();

    // File input (informational only; actual parsing remains in scene model)
    (function fileInput(){
        const fi = document.getElementById('file-input');
        if (!fi) return;
        fi.addEventListener('change', (ev) => { try { window.logMessage && window.logMessage('File selected.'); } catch(e){} });
    })();

    // Initialize sub-views
    initSettings(helpers);
    initMenus(helpers);
    initContextMenu(helpers);
}

