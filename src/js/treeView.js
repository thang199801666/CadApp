// treeView.js - Model tree view component for displaying scene hierarchy

export class TreeView {
    constructor(options = {}) {
        this.containerId = options.containerId || 'tree-panel';
        this.contentId = options.contentId || 'tree-content';
        this.container = null;
        this.content = null;
        this.treeData = null;
        this.selectedNode = null;
        this.onNodeSelect = options.onNodeSelect || null;
        this.onNodeContextMenu = options.onNodeContextMenu || null;
        
        this._init();
    }
    
    _init() {
        this.container = document.getElementById(this.containerId);
        this.content = document.getElementById(this.contentId);
        
        if (!this.container || !this.content) {
            console.warn('TreeView: Container or content element not found');
            return;
        }
        
        // Setup event delegation for tree items
        this.content.addEventListener('click', this._handleClick.bind(this));
        this.content.addEventListener('contextmenu', this._handleContextMenu.bind(this));
    }
    
    _handleClick(event) {
        const item = event.target.closest('.tree-item');
        if (!item) return;
        
        const nodeId = item.dataset.nodeId;
        if (!nodeId) return;
        
        // Clear previous selection
        this.content.querySelectorAll('.tree-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select clicked item
        item.classList.add('selected');
        this.selectedNode = nodeId;
        
        // Callback
        if (this.onNodeSelect && typeof this.onNodeSelect === 'function') {
            this.onNodeSelect(nodeId, item);
        }
    }
    
    _handleContextMenu(event) {
        const item = event.target.closest('.tree-item');
        if (!item) return;
        
        event.preventDefault();
        const nodeId = item.dataset.nodeId;
        
        if (this.onNodeContextMenu && typeof this.onNodeContextMenu === 'function') {
            this.onNodeContextMenu(nodeId, item, event);
        }
    }
    
    /**
     * Set tree data and render
     * @param {Object} data - Tree data structure
     */
    setData(data) {
        this.treeData = data;
        this.render();
    }
    
    /**
     * Build tree from scene object (Three.js Object3D)
     * @param {THREE.Object3D} rootObject - Root scene object
     */
    buildFromScene(rootObject) {
        if (!rootObject) {
            this.clear();
            return;
        }
        
        const buildNode = (obj, depth = 0) => {
            const node = {
                id: obj.uuid,
                name: obj.name || obj.type || 'Object',
                type: obj.type,
                visible: obj.visible,
                depth: depth,
                children: []
            };
            
            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => {
                    node.children.push(buildNode(child, depth + 1));
                });
            }
            
            return node;
        };
        
        this.treeData = buildNode(rootObject);
        this.render();
    }
    
    /**
     * Render the tree
     */
    render() {
        if (!this.content) return;
        
        if (!this.treeData) {
            this.content.innerHTML = '<div style="color: rgba(0, 0, 0, 0.6); font-size: 0.65rem;">Load a model to view structure</div>';
            return;
        }
        
        this.content.innerHTML = '';
        this._renderNode(this.treeData, this.content);
    }
    
    _renderNode(node, parentElement) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.nodeId = node.id;
        item.style.paddingLeft = `${node.depth * 12 + 4}px`;
        
        // Expandable indicator
        if (node.children && node.children.length > 0) {
            const expander = document.createElement('span');
            expander.className = 'tree-expander';
            expander.textContent = '▼';
            expander.style.marginRight = '4px';
            expander.style.cursor = 'pointer';
            expander.style.userSelect = 'none';
            expander.style.display = 'inline-block';
            expander.style.width = '12px';
            expander.style.fontSize = '10px';
            item.appendChild(expander);
        } else {
            const spacer = document.createElement('span');
            spacer.style.display = 'inline-block';
            spacer.style.width = '16px';
            item.appendChild(spacer);
        }
        
        // Icon based on type
        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.style.marginRight = '6px';
        icon.textContent = this._getIconForType(node.type);
        item.appendChild(icon);
        
        // Label
        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = node.name;
        label.style.fontSize = '0.75rem';
        if (!node.visible) {
            label.style.opacity = '0.5';
            label.style.fontStyle = 'italic';
        }
        item.appendChild(label);
        
        parentElement.appendChild(item);
        
        // Render children
        if (node.children && node.children.length > 0) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            childContainer.dataset.parentId = node.id;
            
            node.children.forEach(child => {
                this._renderNode(child, childContainer);
            });
            
            parentElement.appendChild(childContainer);
            
            // Toggle expand/collapse
            const expander = item.querySelector('.tree-expander');
            if (expander) {
                expander.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = childContainer.style.display !== 'none';
                    childContainer.style.display = isExpanded ? 'none' : 'block';
                    expander.textContent = isExpanded ? '▶' : '▼';
                });
            }
        }
    }
    
    _getIconForType(type) {
        const iconMap = {
            'Scene': '🌍',
            'Group': '📁',
            'Mesh': '🔷',
            'Light': '💡',
            'Camera': '📷',
            'Line': '📏',
            'Points': '⚫',
            'Sprite': '🏷️',
            'Object3D': '📦'
        };
        return iconMap[type] || '📄';
    }
    
    /**
     * Clear the tree
     */
    clear() {
        if (this.content) {
            this.content.innerHTML = '<div style="color: rgba(0, 0, 0, 0.6); font-size: 0.65rem;">No objects in scene</div>';
        }
        this.treeData = null;
        this.selectedNode = null;
    }
    
    /**
     * Update a specific node
     */
    updateNode(nodeId, updates) {
        if (!this.treeData) return;
        
        const findAndUpdate = (node) => {
            if (node.id === nodeId) {
                Object.assign(node, updates);
                return true;
            }
            if (node.children) {
                for (const child of node.children) {
                    if (findAndUpdate(child)) return true;
                }
            }
            return false;
        };
        
        if (findAndUpdate(this.treeData)) {
            this.render();
        }
    }
    
    /**
     * Get selected node ID
     */
    getSelectedNode() {
        return this.selectedNode;
    }
    
    /**
     * Select a node programmatically
     */
    selectNode(nodeId) {
        if (!this.content) return;
        
        // Clear previous selection
        this.content.querySelectorAll('.tree-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Find and select new node
        const item = this.content.querySelector(`[data-node-id="${nodeId}"]`);
        if (item) {
            item.classList.add('selected');
            this.selectedNode = nodeId;
            
            // Ensure parent nodes are expanded
            let parent = item.parentElement;
            while (parent && parent !== this.content) {
                if (parent.classList.contains('tree-children')) {
                    parent.style.display = 'block';
                    const parentItem = parent.previousElementSibling;
                    if (parentItem) {
                        const expander = parentItem.querySelector('.tree-expander');
                        if (expander) expander.textContent = '▼';
                    }
                }
                parent = parent.parentElement;
            }
            
            // Scroll into view
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    /**
     * Refresh tree from scene
     */
    refresh(rootObject) {
        if (rootObject) {
            this.buildFromScene(rootObject);
        } else {
            this.render();
        }
    }
    
    /**
     * Expand all nodes
     */
    expandAll() {
        if (!this.content) return;
        
        this.content.querySelectorAll('.tree-children').forEach(container => {
            container.style.display = 'block';
        });
        
        this.content.querySelectorAll('.tree-expander').forEach(expander => {
            expander.textContent = '▼';
        });
    }
    
    /**
     * Collapse all nodes
     */
    collapseAll() {
        if (!this.content) return;
        
        this.content.querySelectorAll('.tree-children').forEach(container => {
            container.style.display = 'none';
        });
        
        this.content.querySelectorAll('.tree-expander').forEach(expander => {
            expander.textContent = '▶';
        });
    }
}
