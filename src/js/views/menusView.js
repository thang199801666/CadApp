// menusView.js - Handles top menu dropdowns (File/View/others)
export function initMenus(helpers = {}) {
    // Track axes visibility state
    let axesVisible = true;
    let submenuVisible = null;
    
    function buildMenu(items) {
        const ul = document.createElement('div');
        ul.className = 'menu-dropdown';
        ul.style.position = 'absolute'; ul.style.zIndex = 9999; ul.style.minWidth = '140px';
        ul.style.background = '#fff'; ul.style.border = '1px solid rgba(0,0,0,0.12)'; ul.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
        ul.style.padding = '4px 0'; ul.style.fontSize = '13px'; ul.style.borderRadius = '4px';
        items.forEach(it => {
            const li = document.createElement('div'); 
            li.className = 'menu-item'; 
            li.style.padding = '6px 12px'; 
            li.style.cursor = 'pointer';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.gap = '8px';
            li.style.position = 'relative';
            
            // Add checkbox if item has checked property
            if ('checked' in it) {
                const checkbox = document.createElement('span');
                checkbox.textContent = it.checked ? '✓' : '';
                checkbox.style.width = '14px';
                checkbox.style.textAlign = 'center';
                checkbox.style.fontWeight = 'bold';
                li.appendChild(checkbox);
            }
            
            const label = document.createElement('span');
            label.textContent = it.label;
            label.style.flex = '1';
            li.appendChild(label);
            
            // Add arrow for submenu
            if (it.submenu) {
                const arrow = document.createElement('span');
                arrow.textContent = '▶';
                arrow.style.fontSize = '10px';
                arrow.style.marginLeft = 'auto';
                arrow.style.color = 'rgba(0,0,0,0.5)';
                li.appendChild(arrow);
            }
            
            li.addEventListener('mouseenter', (e) => {
                li.style.background = 'rgba(0,0,0,0.04)';
                
                // Show submenu if exists
                if (it.submenu) {
                    if (submenuVisible) {
                        submenuVisible.remove();
                    }
                    const submenu = buildMenu(it.submenu);
                    submenu.style.zIndex = '10000';
                    const rect = li.getBoundingClientRect();
                    submenu.style.left = `${rect.right}px`;
                    submenu.style.top = `${rect.top}px`;
                    submenuVisible = submenu;
                    
                    // Prevent submenu from disappearing when moving to it
                    submenu.addEventListener('mouseenter', () => {
                        clearTimeout(submenu._hideTimer);
                    });
                    
                    submenu.addEventListener('mouseleave', () => {
                        submenu._hideTimer = setTimeout(() => {
                            if (submenu.parentNode) {
                                submenu.remove();
                            }
                            if (submenuVisible === submenu) {
                                submenuVisible = null;
                            }
                        }, 100);
                    });
                }
            });
            
            li.addEventListener('mouseleave', (e) => {
                li.style.background = '';
                
                // Delay hiding submenu to allow mouse to move to it
                if (it.submenu && submenuVisible) {
                    submenuVisible._hideTimer = setTimeout(() => {
                        // Check if mouse is over the submenu
                        const submenuRect = submenuVisible.getBoundingClientRect();
                        const mouseX = e.clientX;
                        const mouseY = e.clientY;
                        const isOverSubmenu = mouseX >= submenuRect.left && mouseX <= submenuRect.right &&
                                              mouseY >= submenuRect.top && mouseY <= submenuRect.bottom;
                        
                        if (!isOverSubmenu && submenuVisible && submenuVisible.parentNode) {
                            submenuVisible.remove();
                            submenuVisible = null;
                        }
                    }, 100);
                }
            });
            
            if (!it.submenu) {
                li.addEventListener('click', (e) => { 
                    e.stopPropagation();
                    try { it.action(e); } catch (err) { console.error('menu action failed', err); } 
                    hideMenus(); 
                });
            }
            
            ul.appendChild(li);
        });
        
        document.body.appendChild(ul);
        return ul;
    }

    function positionMenu(el, menu) { const r = el.getBoundingClientRect(); menu.style.left = `${Math.round(r.left)}px`; menu.style.top = `${Math.round(r.bottom + 4)}px`; }
    let activeMenu = null;
    function hideMenus() { if (activeMenu && activeMenu.parentNode) activeMenu.parentNode.removeChild(activeMenu); activeMenu = null; const cm = document.getElementById('custom-context-menu'); if (cm) cm.style.display = 'none'; }

    try {
        const fileMenuEl = document.querySelector('.menu[data-menu="file"]');
        if (fileMenuEl) fileMenuEl.addEventListener('click', (e) => {
            hideMenus();
            const items = [
                { label: 'Open (Ctrl+O)', action: () => { try { helpers.openModel && helpers.openModel(); } catch(e){} } },
                { label: 'Reset', action: () => location.reload() }
            ];
            activeMenu = buildMenu(items);
            positionMenu(fileMenuEl, activeMenu);
        });
    } catch (e) {}

    try {
        const viewMenuEl = document.querySelector('.menu[data-menu="view"]');
        if (viewMenuEl) viewMenuEl.addEventListener('click', (e) => {
            hideMenus();
            let currentStyle = (helpers.getVisualStyle && typeof helpers.getVisualStyle === 'function') ? helpers.getVisualStyle() : 'shaded';
            const items = [ 
                { label: 'Show Axes', 
                    checked: axesVisible,
                    action: () => { 
                        axesVisible = !axesVisible;
                        if (window.toggleAxes) window.toggleAxes(axesVisible); 
                    } 
                },
                {
                    label: 'Visual Style',
                    submenu: [
                        { label: 'Shaded', action: () => { if (helpers.setVisualStyle) helpers.setVisualStyle('shaded'); }, checked: currentStyle === 'shaded' },
                        { label: 'Shaded with edge', action: () => { if (helpers.setVisualStyle) helpers.setVisualStyle('shaded-edge'); }, checked: currentStyle === 'shaded-edge' },
                        { label: 'Shaded with hidden edge', action: () => { if (helpers.setVisualStyle) helpers.setVisualStyle('shaded-hidden'); }, checked: currentStyle === 'shaded-hidden' },
                        { label: 'Wireframe', action: () => { if (helpers.setVisualStyle) helpers.setVisualStyle('wireframe'); }, checked: currentStyle === 'wireframe' }
                    ]
                },
                { 
                    label: 'Views',
                    submenu: [
                        { label: 'Isometric', action: () => { if (helpers.setPresetView) helpers.setPresetView('isometric'); } },
                        { label: 'Front', action: () => { if (helpers.setPresetView) helpers.setPresetView('front'); } },
                        { label: 'Back', action: () => { if (helpers.setPresetView) helpers.setPresetView('back'); } },
                        { label: 'Left', action: () => { if (helpers.setPresetView) helpers.setPresetView('left'); } },
                        { label: 'Right', action: () => { if (helpers.setPresetView) helpers.setPresetView('right'); } },
                        { label: 'Top', action: () => { if (helpers.setPresetView) helpers.setPresetView('top'); } },
                        { label: 'Bottom', action: () => { if (helpers.setPresetView) helpers.setPresetView('bottom'); } }
                    ]
                }
            ];
            activeMenu = buildMenu(items);
            positionMenu(viewMenuEl, activeMenu);
        });
    } catch (e) {}

    document.addEventListener('click', (e) => { const isMenu = e.target.closest && e.target.closest('.menu-dropdown'); const isMenuBtn = e.target.closest && e.target.closest('.menu'); if (!isMenu && !isMenuBtn) hideMenus(); });
}
