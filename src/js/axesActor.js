// axesActor.js - VTK-style axes actor widget
/* global THREE */

export class AxesActor {
    constructor(options = {}) {
        this.size = options.size || 100; // size in pixels
        this.padding = options.padding || 10; // padding from edges
        this.axisLength = options.axisLength || 1.0;
        this.shaftRadius = options.shaftRadius || 0.0625;
        this.coneHeight = options.coneHeight || 0.35;
        this.coneRadius = options.coneRadius || 0.125;
        
        this.container = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.canvas = null;
        this.axesGroup = null;
        this.parentCamera = null;
        this.visible = true;
        
        this._init();
    }
    
    _init() {
        // Create dedicated scene for axes
        this.scene = new THREE.Scene();
        
        // Create orthographic camera with larger view frustum
        this.camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
        this.camera.position.set(2, 2, 2);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.size, this.size);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.bottom = `${this.padding}px`;
        this.renderer.domElement.style.left = `${this.padding}px`;
        this.renderer.domElement.style.pointerEvents = 'none';
        this.renderer.domElement.style.zIndex = '1000';
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(1, 1, 1);
        this.scene.add(dirLight);
        
        // Create axes
        this._createAxes();
    }
    
    _createAxes() {
        this.axesGroup = new THREE.Group();
        
        // Helper to create one axis with shaft, cone, and label
        const createAxis = (color, direction, label) => {
            const axisGroup = new THREE.Group();
            
            // Shaft (cylinder)
            const shaftGeometry = new THREE.CylinderGeometry(
                this.shaftRadius, 
                this.shaftRadius, 
                this.axisLength - this.coneHeight, 
                16
            );
            const shaftMaterial = new THREE.MeshPhongMaterial({ 
                color: color, 
                shininess: 60 
            });
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            
            // Cone (arrowhead)
            const coneGeometry = new THREE.ConeGeometry(this.coneRadius, this.coneHeight, 16);
            const coneMaterial = new THREE.MeshPhongMaterial({ 
                color: color, 
                shininess: 60 
            });
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            
            // Position shaft and cone based on direction
            if (direction === 'x') {
                shaft.rotation.z = -Math.PI / 2;
                shaft.position.x = (this.axisLength - this.coneHeight) / 2;
                cone.rotation.z = -Math.PI / 2;
                cone.position.x = this.axisLength - this.coneHeight / 2;
            } else if (direction === 'y') {
                shaft.position.y = (this.axisLength - this.coneHeight) / 2;
                cone.position.y = this.axisLength - this.coneHeight / 2;
            } else if (direction === 'z') {
                shaft.rotation.x = Math.PI / 2;
                shaft.position.z = (this.axisLength - this.coneHeight) / 2;
                cone.rotation.x = Math.PI / 2;
                cone.position.z = this.axisLength - this.coneHeight / 2;
            }
            
            axisGroup.add(shaft);
            axisGroup.add(cone);
            
            // Add text label using canvas texture
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = this._colorToHex(color);
            ctx.font = 'bold 88px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 32, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const labelMaterial = new THREE.SpriteMaterial({ 
                map: texture, 
                depthTest: false,
                depthWrite: false
            });
            const labelSprite = new THREE.Sprite(labelMaterial);
            labelSprite.scale.set(0.25, 0.25, 1);
            
            if (direction === 'x') {
                labelSprite.position.set(this.axisLength + 0.15, 0, 0);
            } else if (direction === 'y') {
                labelSprite.position.set(0, this.axisLength + 0.15, 0);
            } else if (direction === 'z') {
                labelSprite.position.set(0, 0, this.axisLength + 0.15);
            }
            
            axisGroup.add(labelSprite);
            return axisGroup;
        };
        
        // Create X (red), Y (green), Z (blue) axes
        this.axesGroup.add(createAxis(0xff0000, 'x', 'X'));
        this.axesGroup.add(createAxis(0x00ff00, 'y', 'Y'));
        this.axesGroup.add(createAxis(0x0000ff, 'z', 'Z'));
        
        this.scene.add(this.axesGroup);
    }
    
    _colorToHex(color) {
        if (typeof color === 'number') {
            return '#' + ('000000' + color.toString(16)).slice(-6);
        }
        return color;
    }
    
    /**
     * Attach to a DOM container
     */
    attachTo(container) {
        if (this.container) {
            this.container.removeChild(this.renderer.domElement);
        }
        this.container = container;
        this.canvas = this.renderer.domElement;
        container.appendChild(this.canvas);
    }
    
    /**
     * Sync axes orientation with main camera
     */
    syncWithCamera(camera, target) {
        if (!camera) return;
        this.parentCamera = camera;

        // If `target` is an Object3D (model/group), orient the axes to match the
        // model's world quaternion so the widget shows the model's local axes.
        if (target && target.isObject3D) {
            try {
                // Compute model world quaternion and camera world quaternion
                const qModel = new THREE.Quaternion();
                target.getWorldQuaternion(qModel);

                const qCamera = new THREE.Quaternion();
                camera.getWorldQuaternion(qCamera);

                // We want the axes widget to show the model's local axes as
                // they appear in the main camera. Transforming a world vector
                // into camera space is equivalent to applying the inverse of
                // the camera quaternion. Therefore the quaternion to apply to
                // the axesGroup is: q_axes = qCamera^{-1} * qModel
                const qAxes = qCamera.clone().invert().multiply(qModel);
                this.axesGroup.quaternion.copy(qAxes);
            } catch (e) {
                // fall back to identity if anything goes wrong
                this.axesGroup.quaternion.set(0, 0, 0, 1);
            }

            // Keep the axes camera in a fixed corner position so the widget
            // remains readable regardless of the model's orientation.
            this.camera.position.set(2, 2, 2);
            if (camera.up) this.camera.up.copy(camera.up);
            this.camera.lookAt(0, 0, 0);
            return;
        }

        // Legacy behavior: sync camera orientation relative to a look target
        const lookTarget = target || new THREE.Vector3(0, 0, 0);
        const direction = new THREE.Vector3().subVectors(camera.position, lookTarget).normalize();

        // Position axes camera based on direction only
        this.camera.position.copy(direction).multiplyScalar(3);
        this.camera.up.copy(camera.up);
        this.camera.lookAt(0, 0, 0);
        // Reset axes rotation so it shows world axes relative to the camera
        this.axesGroup.quaternion.set(0, 0, 0, 1);
    }
    
    /**
     * Render the axes
     */
    render() {
        if (!this.renderer || !this.scene || !this.camera) return;
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Update size
     */
    setSize(size) {
        this.size = size;
        if (this.renderer) {
            this.renderer.setSize(size, size);
        }
    }
    
    /**
     * Set visibility
     */
    setVisible(visible) {
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.display = visible ? 'block' : 'none';
        }
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        if (this.container && this.renderer) {
            this.container.removeChild(this.renderer.domElement);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => mat.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
    }
}
