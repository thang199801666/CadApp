// treeView.js - Model tree panel view component
export class TreeView {
    constructor(options = {}) {
        this.containerId = options.containerId || 'tree-panel';
        this.contentId = options.contentId || 'tree-content';
        this.container = null;
        this.contentElement = null;
        this.treeData = null;
        this.selectedNode = null;
        this.onNodeSelect = options.onNodeSelect || null;
        
        this._init();
    }
    
    _init() {
        this.container = document.getElementById(this.containerId);
        this.contentElement = document.getElementById(this.contentId);
        
        if (!this.container || !this.contentElement) {
            console.warn('TreeView: container elements not found');
            return;
        }
        
        // Set initial empty state
        this._showEmptyState();
    }
    
    _showEmptyState() {
        if (!this.contentElement) return;
        this.contentElement.innerHTML = '<div style="color: rgba(0, 0, 0, 0.6); font-size: 0.65rem;">Load a model to view structure</div>';
    }
    
    /**
     * Load model data into tree
     * @param {Object} modelData - model structure data
     */
    loadModel(modelData) {
        if (!this.contentElement) return;
        
        this.treeData = modelData;
        this.contentElement.innerHTML = '';
        
        if (!modelData) {
            this._showEmptyState();
            return;
        }
        
        // Build tree structure
        this._buildTree(modelData, this.contentElement, 0);
    }
    
    /**
     * Build tree structure recursively
     */
    _buildTree(node, parentElement, level) {
        if (!node) return;
        
        const nodeElement = document.createElement('div');
        nodeElement.className = 'tree-item';
        nodeElement.style.paddingLeft = `${level * 12 + 4}px`;
        
        // Create node label
        const label = document.createElement('span');
        label.textContent = node.name || 'Unnamed';
        label.style.cursor = 'pointer';
        
        // Add icon if node has children
        if (node.children && node.children.length > 0) {
            const icon = document.createElement('span');
            icon.textContent = '▶ ';
            icon.style.fontSize = '0.7rem';
            icon.style.display = 'inline-block';
            icon.style.width = '12px';
            icon.style.transition = 'transform 0.2s';
            label.insertBefore(icon, label.firstChild);
            
            // Toggle expand/collapse
            let expanded = true;
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                expanded = !expanded;
                icon.style.transform = expanded ? 'rotate(90deg)' : 'rotate(0deg)';
                childrenContainer.style.display = expanded ? 'block' : 'none';
            });
            icon.style.transform = 'rotate(90deg)';
        }
        
        // Node selection
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(node, nodeElement);
        });
        
        nodeElement.appendChild(label);
        parentElement.appendChild(nodeElement);
        
        // Add children
        if (node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            childrenContainer.style.display = 'block';
            
            node.children.forEach(child => {
                this._buildTree(child, childrenContainer, level + 1);
            });
            
            parentElement.appendChild(childrenContainer);
        }
    }
    
    /**
     * Select a tree node
     */
    selectNode(node, element) {
        // Clear previous selection
        if (this.contentElement) {
            const allItems = this.contentElement.querySelectorAll('.tree-item');
            allItems.forEach(item => item.classList.remove('selected'));
        }
        
        // Set new selection
        if (element) {
            element.classList.add('selected');
        }
        
        this.selectedNode = node;
        
        // Trigger callback
        if (this.onNodeSelect && typeof this.onNodeSelect === 'function') {
            this.onNodeSelect(node);
        }
    }
    
    /**
     * Clear tree content
     */
    clear() {
        this.treeData = null;
        this.selectedNode = null;
        this._showEmptyState();
    }
    
    /**
     * Update tree with current model info
     */
    updateFromModel(model) {
        if (!model) {
            this.clear();
            return;
        }
        
        // Create tree structure from model
        const modelName = window.currentModelName || model.name || 'Model';
        const treeData = {
            name: modelName,
            type: 'root',
            object: model,  // Store reference to the actual model
            children: []
        };
        
        // Add geometry info
        if (model.geometry) {
            treeData.children.push({
                name: 'Geometry',
                type: 'geometry',
                children: [
                    { name: `Vertices: ${model.geometry.attributes.position ? model.geometry.attributes.position.count : 0}`, type: 'info' },
                    { name: `Faces: ${model.geometry.index ? model.geometry.index.count / 3 : 0}`, type: 'info' }
                ]
            });
        }
        
        // Add material info
        if (model.material) {
            const materialNode = {
                name: 'Material',
                type: 'material',
                children: []
            };
            
            if (model.material.color) {
                materialNode.children.push({
                    name: `Color: #${model.material.color.getHexString()}`,
                    type: 'info'
                });
            }
            
            treeData.children.push(materialNode);
        }
        
        // Add transform info
        treeData.children.push({
            name: 'Transform',
            type: 'transform',
            children: [
                { name: `Position: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`, type: 'info' },
                { name: `Rotation: (${model.rotation.x.toFixed(2)}, ${model.rotation.y.toFixed(2)}, ${model.rotation.z.toFixed(2)})`, type: 'info' },
                { name: `Scale: (${model.scale.x.toFixed(2)}, ${model.scale.y.toFixed(2)}, ${model.scale.z.toFixed(2)})`, type: 'info' }
            ]
        });
        
        this.loadModel(treeData);
    }
    
    /**
     * Set node selection callback
     */
    setOnNodeSelect(callback) {
        this.onNodeSelect = callback;
    }
    
    /**
     * Dispose and cleanup
     */
    dispose() {
        this.clear();
        this.container = null;
        this.contentElement = null;
        this.onNodeSelect = null;
    }
}
