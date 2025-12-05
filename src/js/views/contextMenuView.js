// contextMenuView.js - Handles custom right-click context menu inside main view
export function initContextMenu(helpers = {}) {
    const ctxMenu = document.createElement('div'); 
    ctxMenu.id = 'custom-context-menu';
    ctxMenu.className = 'context-menu';
    ctxMenu.style.display = 'none'; 
    document.body.appendChild(ctxMenu);

    // Submenu for views
    const viewsSubmenu = document.createElement('div');
    viewsSubmenu.className = 'context-menu submenu';
    document.body.appendChild(viewsSubmenu);

    function createMenuItem(label, action, hasSubmenu = false, submenu = null) {
        const el = document.createElement('div');
        el.className = 'item' + (hasSubmenu ? ' has-submenu' : '');
        el.textContent = label;
        
        if (hasSubmenu && submenu) {
            const arrow = document.createElement('span');
            arrow.className = 'arrow';
            arrow.textContent = '▶';
            el.appendChild(arrow);
            
            el.addEventListener('mouseenter', () => {
                submenu.style.display = 'block';
                const rect = el.getBoundingClientRect();
                const submenuRect = submenu.getBoundingClientRect();
                submenu.style.left = `${rect.right}px`;
                submenu.style.top = `${rect.top}px`;
                
                // Adjust if submenu goes off-screen
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                if (rect.right + submenuRect.width > vw) {
                    submenu.style.left = `${rect.left - submenuRect.width}px`;
                }
                if (rect.top + submenuRect.height > vh) {
                    submenu.style.top = `${vh - submenuRect.height - 8}px`;
                }
            });
            el.addEventListener('mouseleave', (e) => {
                const toElement = e.relatedTarget;
                if (!submenu.contains(toElement)) {
                    setTimeout(() => {
                        if (!submenu.matches(':hover') && !el.matches(':hover')) {
                            submenu.style.display = 'none';
                        }
                    }, 100);
                }
            });
        } else if (action) {
            el.addEventListener('click', () => { 
                try { action(); } catch(e){ console.error(e); } 
                hideMenus(); 
            });
        }
        
        return el;
    }

    function createSeparator() {
        const sep = document.createElement('div');
        sep.className = 'separator';
        return sep;
    }

    function setContextItems(items) { 
        ctxMenu.innerHTML = '';
        items.forEach(it => {
            if (it.separator) {
                ctxMenu.appendChild(createSeparator());
            } else {
                ctxMenu.appendChild(createMenuItem(it.label, it.action, it.hasSubmenu, it.submenu));
            }
        });
    }

    function hideMenus() { 
        if (ctxMenu) ctxMenu.style.display = 'none';
        if (viewsSubmenu) viewsSubmenu.style.display = 'none';
    }

    // Setup view submenu items
    const viewItems = [
        { label: 'Isometric', action: () => { try { if (helpers.setPresetView) helpers.setPresetView('isometric', helpers.getCore ? helpers.getCore() : null); } catch(e){} } },
        { label: 'Front', action: () => { try { if (helpers.setPresetView) helpers.setPresetView('front', helpers.getCore ? helpers.getCore() : null); } catch(e){} } },
        { label: 'Back', action: () => { try { if (helpers.setPresetView) helpers.setPresetView('back', helpers.getCore ? helpers.getCore() : null); } catch(e){} } },
        { label: 'Left', action: () => { try { if (helpers.setPresetView) helpers.setPresetView('left', helpers.getCore ? helpers.getCore() : null); } catch(e){} } },
        { label: 'Right', action: () => { try { if (helpers.setPresetView) helpers.setPresetView('right', helpers.getCore ? helpers.getCore() : null); } catch(e){} } },
        { label: 'Top', action: () => { try { if (helpers.setPresetView) helpers.setPresetView('top', helpers.getCore ? helpers.getCore() : null); } catch(e){} } },
        { label: 'Bottom', action: () => { try { if (helpers.setPresetView) helpers.setPresetView('bottom', helpers.getCore ? helpers.getCore() : null); } catch(e){} } }
    ];

    viewItems.forEach(viewItem => {
        viewsSubmenu.appendChild(createMenuItem(viewItem.label, viewItem.action));
    });

    viewsSubmenu.addEventListener('mouseleave', () => {
        setTimeout(() => {
            if (!viewsSubmenu.matches(':hover')) {
                viewsSubmenu.style.display = 'none';
            }
        }, 100);
    });

    setContextItems([
        { label: 'Fit View', action: () => { try { if (helpers.fitModelToView && typeof helpers.getCore === 'function') helpers.fitModelToView(helpers.getCore()); } catch(e){} } },
        { separator: true },
        { label: 'Views', hasSubmenu: true, submenu: viewsSubmenu },
    ]);

    const mainView = document.getElementById('main-view');
    if (mainView) {
        mainView.addEventListener('contextmenu', (ev) => {
            ev.preventDefault(); hideMenus(); ctxMenu.style.display = 'block'; const x = ev.clientX; const y = ev.clientY; const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0); const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0); const rect = ctxMenu.getBoundingClientRect(); let left = x; let top = y; if (left + rect.width > vw) left = vw - rect.width - 8; if (top + rect.height > vh) top = vh - rect.height - 8; ctxMenu.style.left = `${Math.max(4, left)}px`; ctxMenu.style.top = `${Math.max(4, top)}px`; });
    }

    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenus(); });
}
