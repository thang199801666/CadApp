// scene.js
// Encapsulates Three.js scene, camera, renderer and helpers as a single SceneManager
/* global THREE */
// Delay loading `triad.js` to avoid a circular import (triad imports scene.js)
// Triad functions will be dynamically imported during init and stored on
// `this._triad` so we can call them at runtime without module-load races.

import { AxesActor } from './axesActor.js';

// Backward-compatible named exports (live bindings will be updated by init)
export let scene = null;
export let camera = null;
export let renderer = null;
export let controls = null;
export let artifactGroup = null;
export let core = null;
export let defaultMaterial = null;
export let selectedMaterial = null;
export let frustumSize = 10;

class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.artifactGroup = null;
        this.core = null;
        this.defaultMaterial = null;
        this.selectedMaterial = null;
        this.frustumSize = 10;
        this._triad = null;
        this.axesActor = null;

        // Sensitivity globals (tweak these at runtime via SceneObject or window.viewer)
        // Rotation (quaternion) sensitivity
        this.rotationBaseSpeed = 0.008; // base multiplier for rotation per pixel
        this.rotationGain = 1.0;        // additional gain applied proportional to pointer speed
        this.rotationMinMult = 0.3;     // minimum speed multiplier
        this.rotationMaxMult = 3.0;     // maximum speed multiplier

        // Panning sensitivity
        this.panBase = 0.65;            // baseline pan multiplier
        this.panGain = 0.25;            // gain per pointer speed
        this.panMinMult = 0.35;         // min pan multiplier
        this.panMaxMult = 1.6;          // max pan multiplier

        // Camera-orbit sensitivity (trackball/orbit)
        this.orbitGain = 1.0;           // orbit gain per pointer speed
        this.orbitMinMult = 0.3;
        this.orbitMaxMult = 3.0;
        this._visualStyle = 'shaded-edge';
        this._featureAngle = 30; // degrees: threshold for feature edge detection

        // Bound methods where required
        this.handleResize = this.handleResize.bind(this);
    }

    setIsometricView(distance = 10) {
        if (!this.camera) return;
        const isoDir = new THREE.Vector3(1, 1, 1).normalize();
        this.camera.position.copy(isoDir.multiplyScalar(distance));
        this.camera.up.set(0, 1, 0);
        if (typeof this.camera.lookAt === 'function') this.camera.lookAt(0, 0, 0);
        if (this.controls && typeof this.controls.update === 'function') this.controls.update();
    }

    fitModelToView(object, padding = 1.2) {
        if (!object || !this.camera) return;
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        this.frustumSize = Math.max(1e-6, maxDim * padding);
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -this.frustumSize * aspect / 2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = -this.frustumSize / 2;
        this.camera.updateProjectionMatrix();

        const isoDir = new THREE.Vector3(1, 1, 1).normalize();
        const distance = maxDim * 2.5 + 1.0;
        this.camera.position.copy(center.clone().add(isoDir.multiplyScalar(distance)));
        this.camera.up.set(0, 1, 0);

        if (this.controls) {
            this.controls.target.copy(center);
            if (typeof this.controls.update === 'function') this.controls.update();
        }
    }

    async init() {
        // Scene
        this.scene = new THREE.Scene();

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(
            this.frustumSize * aspect / -2,
            this.frustumSize * aspect / 2,
            this.frustumSize / 2,
            this.frustumSize / -2,
            0.1,
            1000
        );
        this.setIsometricView(10);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
        const mainView = document.getElementById('main-view') || document.body;
        this.renderer.setSize(mainView.clientWidth || window.innerWidth, mainView.clientHeight || window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setClearColor(0xffffff, 1);
        this.renderer.domElement.style.background = 'transparent';
        mainView.appendChild(this.renderer.domElement);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';

        // Prevent browser context menu inside the 3D canvas
        this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('contextmenu', (e) => {
            if (this.renderer && (e.target === this.renderer.domElement || this.renderer.domElement.contains(e.target))) {
                e.preventDefault();
            }
        });

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enablePan = false;
        this.controls.enableZoom = true;
        this.controls.enableRotate = false;
        this.controls.enableDamping = false;
        this.controls.dampingFactor = 0.0;
        this.controls.minDistance = 3;
        this.controls.maxDistance = 100;
        const EPS = 0.0001;
        this.controls.minPolarAngle = 0 + EPS;
        this.controls.maxPolarAngle = Math.PI - EPS;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.DOLLY
        };

        // Capture pointerdown to implement Shift+Middle -> Pan and disable right-button actions.
        // Use capture so we intercept events before OrbitControls.
        const canvasCaptureHandler = (ev) => {
            try {
                // Right button: swallow the event so OrbitControls doesn't act on it
                if (ev.button === 2) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    return;
                }

                // Middle button: if Shift held at pointerdown, map middle to PAN for this interaction
                if (ev.button === 1) {
                    if (ev.shiftKey) {
                        this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
                    } else {
                        this.controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
                    }
                }
            } catch (e) {
                // ignore
            }
        };
        const canvasCaptureUp = (ev) => {
            try {
                if (ev.button === 1) {
                    // restore default mapping after interaction
                    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
                }
                if (ev.button === 2) {
                    ev.preventDefault();
                    ev.stopPropagation();
                }
            } catch (e) {}
        };
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.addEventListener('pointerdown', canvasCaptureHandler, { capture: true });
            window.addEventListener('pointerup', canvasCaptureUp, { capture: true });
        }

        // Artifact container
        this.artifactGroup = new THREE.Group();
        this.scene.add(this.artifactGroup);

        // Materials
        this.defaultMaterial = new THREE.MeshPhongMaterial({ color: new THREE.Color(0x00ffff).getHex(), emissive: 0x001111, shininess: 80 });
        this.selectedMaterial = new THREE.MeshPhongMaterial({ color: 0xff9999, emissive: 0x002222, shininess: 100 });

        // Triad (dynamically import to avoid circular dependency)
        try {
            this._triad = await import('./triad.js');
            if (this._triad && typeof this._triad.initTriad === 'function') {
                try { this._triad.initTriad(); } catch (e) { console.warn('initTriad failed', e); }
            }
        } catch (e) {
            console.warn('Failed to load triad module', e);
            this._triad = null;
        }

        // Short name for other modules
        this.scene.app = this.scene.app || {};
        this.scene.app.artifactGroup = this.artifactGroup;

        // Lighting
        this.scene.add(new THREE.AmbientLight(0x404040));
        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight1.position.set(10, 10, 5);
        this.scene.add(dirLight1);
        const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.7);
        dirLight2.position.set(-10, -10, -5);
        this.scene.add(dirLight2);

        // AI Mood Light
        window._aiMoodLight = new THREE.PointLight(0xff0055, 0.5, 50);
        window._aiMoodLight.position.set(-5, -5, 5);
        this.scene.add(window._aiMoodLight);

        // VTK-style Axes Actor (bottom-left corner widget)
        this.axesActor = new AxesActor({ size: 100, padding: 10 });
        const axesContainer = document.getElementById('main-view');
        if (axesContainer) {
            this.axesActor.attachTo(axesContainer);
        }

        // Setup handlers
        this._setupQuaternionRotation();
        this._setupModelLoading();
        this._setupSelectionAndLoop();
        this._setupCameraQuaternionOrbit();

        // Update module-level live bindings for compatibility
        this._syncExports();
    }

    _syncExports() {
        // Update exported live bindings so other modules see the instances
        try {
            scene = this.scene;
            camera = this.camera;
            renderer = this.renderer;
            controls = this.controls;
            artifactGroup = this.artifactGroup;
            core = this.core;
            defaultMaterial = this.defaultMaterial;
            selectedMaterial = this.selectedMaterial;
            frustumSize = this.frustumSize;
        } catch (e) {
            // ignore
        }
    }

    _setupQuaternionRotation() {
        const canvas = this.renderer ? this.renderer.domElement : null;
        if (!canvas) return;
        let rotating = false;
        let lastX = 0, lastY = 0;
        let mode = null; // 'rotate' or 'pan'
        let activePointerId = null;
        const rotSpeed = this.rotationBaseSpeed;
        let lastPointerTime = null;

        const getCameraRight = (out) => {
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            // Use up x forward to compute the camera's right vector (consistent
            // with the usual right = up cross forward). The previous order
            // produced a reversed/right-handed mismatch which made the
            // axes widget appear incorrect when rotating the model with
            // the middle mouse.
            out.crossVectors(this.camera.up, forward).normalize();
            return out;
        };

        const onPointerDown = (ev) => {
            // Only handle middle-button panning here. We no longer handle
            // middle-button camera rotation in this quaternion-based handler
            // so that middle acts like left-button rotate (handled elsewhere).
            if (ev.button !== 1) return;
            if (!ev.shiftKey) return; // ignore non-shift middle (rotate) here
            if (this.controls && this.controls.enableRotate) return;
            ev.preventDefault();
            // Only pan mode is supported for middle-button here
            mode = 'pan';
            rotating = true; lastX = ev.clientX; lastY = ev.clientY;
            activePointerId = ev.pointerId;
            lastPointerTime = ev.timeStamp || performance.now();
            try { canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId); } catch (e) {}
        };

        const onPointerMove = (ev) => {
            if (!rotating) return;
            if (activePointerId !== null && ev.pointerId !== activePointerId) return;
            ev.preventDefault();
            const dx = ev.clientX - lastX; const dy = ev.clientY - lastY;
            const now = ev.timeStamp || performance.now();
            const dt = Math.max(1.0, (lastPointerTime !== null) ? (now - lastPointerTime) : 16.0); // ms
            lastPointerTime = now;
            lastX = ev.clientX; lastY = ev.clientY;

            if (mode === 'rotate') {
                const rightAxis = new THREE.Vector3(); getCameraRight(rightAxis);
                const upAxis = this.camera.up.clone().normalize();

                // Reverted rotation direction: invert the previous sign so drag direction reverses
                // Scale rotation by pointer speed so quick swipes rotate more
                const speed = Math.sqrt(dx * dx + dy * dy) / dt; // pixels per ms
                // Rotation: use configured gain and clamps
                const speedMult = Math.min(this.rotationMaxMult, Math.max(this.rotationMinMult, 1.0 + speed * this.rotationGain));
                const yawAngle = dx * rotSpeed * speedMult;
                const pitchAngle = dy * rotSpeed * speedMult;

                const yawQ = new THREE.Quaternion().setFromAxisAngle(upAxis, yawAngle);
                const pitchQ = new THREE.Quaternion().setFromAxisAngle(rightAxis, pitchAngle);

                // Compose rotations: pitch * yaw (apply yaw first in world space, then pitch)
                const q = new THREE.Quaternion().multiplyQuaternions(pitchQ, yawQ);
                if (this.artifactGroup) this.artifactGroup.quaternion.premultiply(q);
            } else if (mode === 'pan') {
                // Pan the camera/controls target based on pixel deltas. Works with OrthographicCamera.
                const rect = canvas.getBoundingClientRect();
                const w = rect.width; const h = rect.height;
                const aspect = w / h;
                const worldPerPixelY = (this.frustumSize) / h; // vertical world units per pixel
                const worldPerPixelX = (this.frustumSize * aspect) / w; // horizontal world units per pixel

                const right = new THREE.Vector3(); getCameraRight(right);
                const up = this.camera.up.clone().normalize();

                // With corrected camera right-vector (up x forward), use
                // a positive X delta so dragging right pans right visually.
                // Scale panning by pointer speed to match perceived movement
                const speed = Math.sqrt(dx * dx + dy * dy) / dt;
                // Panning: use configurable panBase/panGain and clamps
                const panMult = Math.min(this.panMaxMult, Math.max(this.panMinMult, this.panBase + speed * this.panGain));
                const moveX = dx * worldPerPixelX * panMult;
                const moveY = dy * worldPerPixelY * panMult;

                const panOffset = new THREE.Vector3();
                panOffset.copy(right).multiplyScalar(moveX).addScaledVector(up, moveY);

                if (this.controls) {
                    this.controls.target.add(panOffset);
                    this.camera.position.add(panOffset);
                    if (typeof this.controls.update === 'function') this.controls.update();
                } else {
                    this.camera.position.add(panOffset);
                }
            }
        };

        const onPointerUp = (ev) => { 
            if (ev.button !== 1) return; 
            if (activePointerId !== null && ev.pointerId !== activePointerId) return;
            rotating = false; 
            try { canvas.releasePointerCapture && canvas.releasePointerCapture(ev.pointerId); } catch(e){}
            activePointerId = null;
        };

        const onPointerCancel = (ev) => {
            if (activePointerId !== null && ev.pointerId === activePointerId) {
                rotating = false;
                try { canvas.releasePointerCapture && canvas.releasePointerCapture(ev.pointerId); } catch(e){}
                activePointerId = null;
            }
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
    }

    _setupModelLoading() {
        const stlLoader = new THREE.STLLoader();
        const fileInput = document.getElementById('file-input');
        if (!fileInput) return;
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            try { window.logMessage && window.logMessage(`Loading: ${file.name}`); } catch(e){}
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const geometry = stlLoader.parse(e.target.result);
                    geometry.computeBoundingBox();
                    const box = geometry.boundingBox;
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());
                    geometry.translate(-center.x, -center.y, -center.z);
                    const maxDim = Math.max(size.x, size.y, size.z) || 1;
                    const scaleFactor = 5 / maxDim;
                    geometry.scale(scaleFactor, scaleFactor, scaleFactor);

                    if (this.core) {
                        try { this.core.geometry.dispose(); } catch (e){}
                        try { this.artifactGroup.remove(this.core); } catch (e){}
                        this.core = null;
                    }

                    this.core = new THREE.Mesh(geometry, this.defaultMaterial);
                    try { this.core.name = (file.name || 'model').replace(/\.[^/.]+$/, ''); } catch (e) { this.core.name = 'model'; }
                    // Store filename globally for tree view
                    window.currentModelName = this.core.name;
                    // Update tree title with filename
                    if (window.updateTreeTitle) window.updateTreeTitle(this.core.name);
                    if (this.artifactGroup) this.artifactGroup.add(this.core);
                    // Rebuild edge overlays for the new model
                    try { this._rebuildEdges(); } catch(e) { console.warn('rebuild edges failed', e); }
                    // Apply current visual style to the newly loaded model
                    try { this.setVisualStyle && this.setVisualStyle(this._visualStyle); } catch(e) {}
                    try { this.fitModelToView(this.core); } catch(e){}
                    if (this.controls) this.controls.update();
                    try { window.logMessage && window.logMessage('Model loaded.'); } catch(e){}
                } catch (err) {
                    console.error(err);
                    try { window.logMessage && window.logMessage('Failed to load model', true); } catch(e){}
                }
            };
            reader.readAsArrayBuffer(file);
        });

        // Expose openModel helper
        window.openModel = () => {
            const fi = document.getElementById('file-input');
            if (!fi) return false;
            fi.click(); return true;
        };
        
        // Expose highlight helper for tree selection
        window.highlightModel = (highlight) => {
            if (!this.core) {
                console.log('No core model to highlight');
                return;
            }
            if (!this.selectedMaterial || !this.defaultMaterial) {
                console.log('Materials not initialized');
                return;
            }
            if (highlight) {
                this.core.material = this.selectedMaterial;
                try { window.__coreSelected = true; } catch(e){}
                try { window.logMessage && window.logMessage('Model highlighted'); } catch(e){}
            } else {
                this.core.material = this.defaultMaterial;
                try { window.__coreSelected = false; } catch(e){}
                try { window.logMessage && window.logMessage('Model unhighlighted'); } catch(e){}
            }
        };
        
        // Expose axes visibility toggle
        window.toggleAxes = (visible) => {
            if (!this.axesActor) return;
            if (visible === undefined) {
                // Toggle
                this.axesActor.visible = !this.axesActor.visible;
            } else {
                this.axesActor.visible = visible;
            }
            if (this.axesActor.canvas) {
                this.axesActor.canvas.style.display = this.axesActor.visible ? 'block' : 'none';
            }
        };
        
        // Expose scene background color change
        window.setSceneBackground = (color) => {
            if (!this.renderer || !this.scene) return;
            try {
                // Parse color string (hex format #RRGGBB)
                const hexColor = parseInt(color.replace('#', '0x'));
                this.renderer.setClearColor(hexColor, 1);
                // Also update the main-view background
                const mainView = document.getElementById('main-view');
                if (mainView) {
                    mainView.style.background = color;
                }
            } catch(e) {
                console.error('Failed to set scene background:', e);
            }
        };
    }

    // Build or rebuild the edges overlay for the current core mesh
    _rebuildEdges() {
        try {
            if (this._edgesGroup && this.artifactGroup) {
                try { this.artifactGroup.remove(this._edgesGroup); } catch(e){}
                this._edgesGroup = null;
            }
            if (!this.core || !this.core.geometry) return;
            const geom = this.core.geometry;
            // Use the feature angle (in degrees) to control edge extraction.
            // EdgesGeometry expects the second argument as radians.
            const thresholdRad = typeof this._featureAngle === 'number' ? THREE.Math.degToRad(this._featureAngle) : 0;
            const edges = new THREE.EdgesGeometry(geom, thresholdRad);

            // Visible (front) edges
            const visibleMat = new THREE.LineBasicMaterial({ color: 0x000000, depthTest: true, depthWrite: false, transparent: false });
            const visibleLines = new THREE.LineSegments(edges, visibleMat);
            visibleLines.renderOrder = 2;

            // Hidden edges (lighter, drawn without depth test so we can show them)
            const hiddenMat = new THREE.LineBasicMaterial({ color: 0x999999, depthTest: false, transparent: true, opacity: 0.55 });
            const hiddenLines = new THREE.LineSegments(edges, hiddenMat);
            hiddenLines.renderOrder = 1;

            const g = new THREE.Group();
            g.add(hiddenLines);
            g.add(visibleLines);
            g.visible = false; // default off
            this._edgesGroup = g;
            if (this.artifactGroup) this.artifactGroup.add(this._edgesGroup);
            // store refs for toggling
            this._visibleEdgeLines = visibleLines;
            this._hiddenEdgeLines = hiddenLines;
        } catch (e) { console.warn('Error building edges overlay', e); }
    }

    setVisualStyle(style) {
        try {
            this._visualStyle = style || 'shaded';
            if (!this.core) return;
            switch (this._visualStyle) {
                case 'wireframe':
                    if (this._edgesGroup) this._edgesGroup.visible = false;
                    if (this.core.material) this.core.material.wireframe = true;
                    break;
                case 'shaded-edge':
                    if (this.core.material) this.core.material.wireframe = false;
                    if (this._edgesGroup) {
                        this._edgesGroup.visible = true;
                        if (this._hiddenEdgeLines) this._hiddenEdgeLines.visible = false;
                        if (this._visibleEdgeLines) this._visibleEdgeLines.visible = true;
                    }
                    break;
                case 'shaded-hidden':
                    if (this.core.material) this.core.material.wireframe = false;
                    if (this._edgesGroup) {
                        this._edgesGroup.visible = true;
                        if (this._hiddenEdgeLines) this._hiddenEdgeLines.visible = true;
                        if (this._visibleEdgeLines) this._visibleEdgeLines.visible = true;
                    }
                    break;
                case 'shaded':
                default:
                    if (this._edgesGroup) this._edgesGroup.visible = false;
                    if (this.core.material) this.core.material.wireframe = false;
                    break;
            }
        } catch (e) { console.warn('setVisualStyle failed', e); }
    }

    getVisualStyle() { return this._visualStyle || 'shaded'; }

    setFeatureAngle(deg) {
        try {
            const angle = Number(deg) || 0;
            this._featureAngle = angle;
            // Rebuild edge overlays to apply new threshold
            if (this.core) {
                try { this._rebuildEdges(); } catch(e){}
                // Re-apply visual style so edges visibility matches
                try { this.setVisualStyle && this.setVisualStyle(this._visualStyle); } catch(e){}
            }
        } catch (e) { console.warn('setFeatureAngle failed', e); }
    }

    getFeatureAngle() { return this._featureAngle || 0; }

    // Sensitivity configuration APIs
    setRotationSensitivity({ baseSpeed, gain, minMult, maxMult } = {}) {
        if (typeof baseSpeed === 'number') this.rotationBaseSpeed = baseSpeed;
        if (typeof gain === 'number') this.rotationGain = gain;
        if (typeof minMult === 'number') this.rotationMinMult = minMult;
        if (typeof maxMult === 'number') this.rotationMaxMult = maxMult;
    }

    setPanSensitivity({ panBase, panGain, panMinMult, panMaxMult } = {}) {
        if (typeof panBase === 'number') this.panBase = panBase;
        if (typeof panGain === 'number') this.panGain = panGain;
        if (typeof panMinMult === 'number') this.panMinMult = panMinMult;
        if (typeof panMaxMult === 'number') this.panMaxMult = panMaxMult;
    }

    setOrbitSensitivity({ gain, minMult, maxMult } = {}) {
        if (typeof gain === 'number') this.orbitGain = gain;
        if (typeof minMult === 'number') this.orbitMinMult = minMult;
        if (typeof maxMult === 'number') this.orbitMaxMult = maxMult;
    }

    setSensitivities(cfg = {}) {
        try {
            if (cfg.rotation) this.setRotationSensitivity(cfg.rotation);
            if (cfg.pan) this.setPanSensitivity(cfg.pan);
            if (cfg.orbit) this.setOrbitSensitivity(cfg.orbit);
        } catch (e) { /* ignore */ }
    }

    getSensitivities() {
        return {
            rotation: { baseSpeed: this.rotationBaseSpeed, gain: this.rotationGain, minMult: this.rotationMinMult, maxMult: this.rotationMaxMult },
            pan: { panBase: this.panBase, panGain: this.panGain, panMinMult: this.panMinMult, panMaxMult: this.panMaxMult },
            orbit: { gain: this.orbitGain, minMult: this.orbitMinMult, maxMult: this.orbitMaxMult }
        };
    }

    _setupSelectionAndLoop() {
        if (!this.renderer || !this.renderer.domElement) return;
        const canvas = this.renderer.domElement;
        canvas.addEventListener('pointerup', (ev) => {
            if (!this.core) return;
            if (ev.button !== 0) return;
            const rect = canvas.getBoundingClientRect();
            const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
            const ray = new THREE.Raycaster();
            ray.setFromCamera(new THREE.Vector2(x, y), this.camera);
            const hits = ray.intersectObject(this.core, true);
            if (hits && hits.length) {
                this.core.material = this.selectedMaterial;
                try { window.__coreSelected = true; } catch(e){}
            } else {
                this.core.material = this.defaultMaterial;
                try { window.__coreSelected = false; } catch(e){}
            }
        });

        const animate = () => {
            requestAnimationFrame(animate);
            if (this.controls) this.controls.update();
            try { this.renderer.render(this.scene, this.camera); } catch (e) { console.warn('Render failed', e); }
            try { if (this._triad && typeof this._triad.drawTriad === 'function') this._triad.drawTriad(this.core); } catch (e) { /* ignore */ }
            
            // Update axes actor to match main camera orientation
            if (this.axesActor && this.camera) {
                const target = this.controls ? this.controls.target : new THREE.Vector3(0, 0, 0);
                this.axesActor.syncWithCamera(this.camera, target);
                this.axesActor.render();
            }
        };
        animate();
    }

    _setupCameraQuaternionOrbit() {
        const canvas = this.renderer ? this.renderer.domElement : null;
        if (!canvas) return;
        let rotating = false;
        let lastX = 0, lastY = 0;
        let activePointerId = null;
        let lastPointerTime = null;

        const onPointerDown = (ev) => {
            // Only allow middle-button (1) to start camera rotation here.
            // Left-button rotation is disabled so left can be used for
            // selection or other UI without rotating the camera.
            if (ev.button !== 1) return;
            // If Shift+Middle, the quaternion pan handler will handle it.
            if (ev.shiftKey) return;
            if (ev.target !== canvas && !canvas.contains(ev.target)) return;
            if (ev.ctrlKey || ev.altKey) return;
            ev.preventDefault();
            rotating = true;
            lastX = ev.clientX;
            lastY = ev.clientY;
            activePointerId = ev.pointerId;
            lastPointerTime = ev.timeStamp || performance.now();
            try { canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId); } catch(e){}
        };

        const onPointerMove = (ev) => {
            if (!rotating) return; 
            if (activePointerId !== null && ev.pointerId !== activePointerId) return;
            try {
                ev.preventDefault();
                const dx = ev.clientX - lastX;
                const dy = ev.clientY - lastY;
                const now = ev.timeStamp || performance.now();
                const dt = Math.max(1.0, (lastPointerTime !== null) ? (now - lastPointerTime) : 16.0);
                lastPointerTime = now;
                lastX = ev.clientX;
                lastY = ev.clientY;
                
                const rect = canvas.getBoundingClientRect();
                const w = rect.width;
                const h = rect.height;
                
                // VTK-style trackball: normalize to [-1, 1] range based on canvas size
                // Scale azimuth/elevation based on pointer speed so quick
                // swipes rotate more while slow movements give fine control.
                const baseAzimuth = -100.0 * (dx / w);   // horizontal rotation in degrees
                const baseElevation = -100.0 * (dy / h); // vertical rotation in degrees
                const speed = Math.sqrt(dx * dx + dy * dy) / dt; // pixels per ms
                // Make orbit rotation more responsive to speed
                const mult = Math.min(this.orbitMaxMult, Math.max(this.orbitMinMult, 1.0 + speed * this.orbitGain));
                const deltaAzimuth = baseAzimuth * mult;
                const deltaElevation = baseElevation * mult;
                
                const target = this.controls ? this.controls.target.clone() : new THREE.Vector3(0,0,0);
                const position = this.camera.position.clone();
                const offset = position.sub(target);
                const distance = offset.length();
                
                // Get view up and compute right vector
                const viewUp = this.camera.up.clone().normalize();
                const forward = new THREE.Vector3().copy(offset).normalize();
                
                // Azimuth rotation around view up (world Y typically)
                const azimuthQuat = new THREE.Quaternion().setFromAxisAngle(
                    viewUp, 
                    deltaAzimuth * Math.PI / 180.0
                );
                
                // Elevation rotation around the cross product (right vector)
                const right = new THREE.Vector3().crossVectors(viewUp, forward).normalize();
                const elevationQuat = new THREE.Quaternion().setFromAxisAngle(
                    right, 
                    deltaElevation * Math.PI / 180.0
                );
                
                // Apply azimuth then elevation (order matters for trackball feel)
                const combinedQuat = new THREE.Quaternion().multiplyQuaternions(elevationQuat, azimuthQuat);
                offset.applyQuaternion(combinedQuat);
                
                // Update view up vector to follow elevation rotation (for proper tumbling)
                viewUp.applyQuaternion(elevationQuat);
                this.camera.up.copy(viewUp);
                
                // Restore distance and update camera
                offset.setLength(distance);
                this.camera.position.copy(target.clone().add(offset));
                
                if (typeof this.camera.lookAt === 'function') this.camera.lookAt(target);
                if (this.controls && typeof this.controls.update === 'function') this.controls.update();
            } catch (err) {
                console.error('Orbit pointer-move error', err);
            }
        };

        const onPointerUp = (ev) => { 
            if (ev.button !== 1) return; 
            if (activePointerId !== null && ev.pointerId !== activePointerId) return; 
            rotating = false;
            try { canvas.releasePointerCapture && canvas.releasePointerCapture(ev.pointerId); } catch(e){} 
            activePointerId = null; 
        };

        const onPointerCancel = (ev) => { 
            if (activePointerId !== null && ev.pointerId === activePointerId) { 
                rotating = false;
                try { canvas.releasePointerCapture && canvas.releasePointerCapture(ev.pointerId); } catch(e){} 
                activePointerId = null; 
            } 
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
    }

    attachAppNamespace() {
        try {
            if (typeof window !== 'undefined') {
                window._three_scene = this.scene;
                window._three_camera = this.camera;
                window._three_renderer = this.renderer;
                window._three_controls = this.controls;
                window._three_artifactGroup = this.artifactGroup;
                // Expose sensitivity controls and helpers on window.viewer
                window.viewer = window.viewer || {};
                const that = this;
                window.viewer.getSensitivities = function() { return that.getSensitivities(); };
                window.viewer.setSensitivities = function(cfg) { try { that.setSensitivities(cfg); window.viewer.sensitivities = that.getSensitivities(); } catch(e){} };
                window.viewer.setRotationSensitivity = function(cfg) { try { that.setRotationSensitivity(cfg); window.viewer.sensitivities = that.getSensitivities(); } catch(e){} };
                window.viewer.setPanSensitivity = function(cfg) { try { that.setPanSensitivity(cfg); window.viewer.sensitivities = that.getSensitivities(); } catch(e){} };
                window.viewer.setOrbitSensitivity = function(cfg) { try { that.setOrbitSensitivity(cfg); window.viewer.sensitivities = that.getSensitivities(); } catch(e){} };
                window.viewer.sensitivities = this.getSensitivities();
            }
        } catch (e) {}
    }

    handleResize() {
        if (!this.camera || !this.renderer) return;
        const mainView = document.getElementById('main-view') || document.body;
        const w = mainView.clientWidth || window.innerWidth;
        const h = mainView.clientHeight || window.innerHeight;
        const aspect = w / h;
        this.camera.left = this.frustumSize * aspect / -2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = this.frustumSize / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        if (this.controls && typeof this.controls.update === 'function') this.controls.update();
    }

    setPresetView(id, object = null, duration = 600) {
        try {
            if (typeof window !== 'undefined' && typeof window.setPresetViewQuaternion === 'function') {
                window.setPresetViewQuaternion(id, object, duration); return;
            }
        } catch (e) {}
        if (!this.camera) return;
        let center = this.controls ? this.controls.target.clone() : new THREE.Vector3(0,0,0);
        if (object) {
            try { const box = new THREE.Box3().setFromObject(object); center = box.getCenter(new THREE.Vector3()); } catch(e){}
        }
        const dist = 10; let pos;
        switch (id) {
            case 'isometric': pos = new THREE.Vector3(1,1,1).normalize().multiplyScalar(dist); break;
            case 'front': pos = new THREE.Vector3(0,0,1).multiplyScalar(dist); break;
            case 'back': pos = new THREE.Vector3(0,0,-1).multiplyScalar(dist); break;
            case 'left': pos = new THREE.Vector3(-1,0,0).multiplyScalar(dist); break;
            case 'right': pos = new THREE.Vector3(1,0,0).multiplyScalar(dist); break;
            case 'top': pos = new THREE.Vector3(0,1,0).multiplyScalar(dist); break;
            case 'bottom': pos = new THREE.Vector3(0,-1,0).multiplyScalar(dist); break;
            default: return;
        }
        this.camera.position.copy(center.clone().add(pos));
        this.camera.up.set(0,1,0);
        if (this.controls) { this.controls.target.copy(center); this.controls.update(); }
    }

    setMouseMapping(mapping) {
        if (!this.controls) return;
        const m = (mapping || '').toString().toLowerCase();
        this.controls.enablePan = true;
        this.controls.enableZoom = true;
        this.controls.enableDamping = false;
        switch (m) {
            case 'inventor':
                this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.DOLLY };
                break;
            case 'blender':
                this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
                break;
            default:
                this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
                break;
        }
    }

    // Triad control proxies (forward to loaded triad module when available)
    setTriadMode(mode) {
        try { if (this._triad && typeof this._triad.setTriadMode === 'function') return this._triad.setTriadMode(mode); } catch (e) {}
    }

    setTriadSize(px) {
        try { if (this._triad && typeof this._triad.setTriadSize === 'function') return this._triad.setTriadSize(px); } catch (e) {}
    }

    /**
     * Rotate the current `artifactGroup` (model) by a given number of degrees
     * around the given axis. Animation is performed by slerping quaternions.
     *
     * @param {number} degrees - rotation in degrees (positive = right-hand rule)
     * @param {'x'|'y'|'z'|THREE.Vector3} axis - axis name or a Vector3
     * @param {number} duration - animation duration in ms (0 = immediate)
     * @param {'local'|'world'} space - whether to rotate in local or world space
     */
    rotateModelByDegrees(degrees = 180, axis = 'y', duration = 600, space = 'world') {
        if (!this.artifactGroup) return;
        // Cancel any in-progress rotation
        if (this._rotationAnimating) {
            this._rotationCancelToken = true;
        }
        this._rotationAnimating = true;
        this._rotationCancelToken = false;

        // Resolve axis vector depending on requested input
        let axisLocal = null; // axis expressed in local/model coordinates (for local space)
        let axisWorld = null; // axis expressed in world coordinates
        if (axis instanceof THREE.Vector3) {
            axisLocal = axis.clone().normalize();
        } else {
            switch ((axis || 'y').toString().toLowerCase()) {
                case 'x': axisLocal = new THREE.Vector3(1,0,0); break;
                case 'z': axisLocal = new THREE.Vector3(0,0,1); break;
                default: axisLocal = new THREE.Vector3(0,1,0); break;
            }
        }

        // Compute axisWorld depending on requested space
        if (space === 'view' && this.camera) {
            try {
                if (axis instanceof THREE.Vector3) {
                    axisWorld = axis.clone().normalize();
                } else {
                    if ((axis || 'y').toString().toLowerCase() === 'x') {
                        const forward = new THREE.Vector3();
                        this.camera.getWorldDirection(forward);
                        axisWorld = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
                    } else if ((axis || 'y').toString().toLowerCase() === 'z') {
                        axisWorld = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
                    } else {
                        axisWorld = this.camera.up.clone().normalize();
                    }
                }
            } catch (e) { axisWorld = axisLocal.clone().normalize(); }
        } else if (space === 'world') {
            axisWorld = axisLocal.clone().normalize();
        } else if (space === 'local') {
            // For local, compute axis in world based on the current model orientation at start
            axisWorld = axisLocal.clone().applyQuaternion(this.artifactGroup ? this.artifactGroup.quaternion : new THREE.Quaternion()).normalize();
        } else {
            axisWorld = axisLocal.clone().normalize();
        }

        const totalAngle = (degrees * Math.PI) / 180;

        if (!duration || duration <= 0) {
            const rotQ = new THREE.Quaternion().setFromAxisAngle(axisWorld, totalAngle);
            if (space === 'local') {
                // Local space: rotation is applied in object's local frame
                this.artifactGroup.quaternion.multiply(rotQ);
            } else {
                // World space: rotation is applied in world frame
                this.artifactGroup.quaternion.premultiply(rotQ);
            }
            this._rotationAnimating = false;
            return;
        }

        // For animated rotations, compute target quaternion and use slerp
        const startQ = this.artifactGroup.quaternion.clone();
        const rotQForEnd = new THREE.Quaternion().setFromAxisAngle(axisWorld.clone(), totalAngle);
        const endQ = (space === 'local') ? startQ.clone().multiply(rotQForEnd) : rotQForEnd.clone().multiply(startQ);

        // Use slerp for smooth interpolation
        const startTime = performance.now();
        const that = this;

        function step(now) {
            if (that._rotationCancelToken) {
                that._rotationAnimating = false;
                that._rotationCancelToken = false;
                return;
            }
            const elapsed = now - startTime;
            let t = Math.min(1.0, elapsed / duration);
            
            // Apply easing for smoother animation (ease-in-out)
            t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            
            // Slerp between start and end quaternions
            THREE.Quaternion.slerp(startQ, endQ, that.artifactGroup.quaternion, t);
            
            if (elapsed < duration) {
                requestAnimationFrame(step);
            } else {
                // Snap to exact final quaternion
                that.artifactGroup.quaternion.copy(endQ);
                that._rotationAnimating = false;
            }
        }
        requestAnimationFrame(step);
    }

    // Convenience wrapper for legacy openModel on window
    openModel() { try { if (typeof window !== 'undefined' && typeof window.openModel === 'function') return window.openModel(); } catch(e){} return false; }
}

// Create singleton and expose as SceneObject (default) while preserving named exports
const SceneObject = new SceneManager();
export { SceneObject };
export default SceneObject;

// Preserve named triad forwarding exports for backward compatibility.
export const setTriadMode = (...args) => { try { return SceneObject.setTriadMode(...args); } catch (e) {} };
export const setTriadSize = (...args) => { try { return SceneObject.setTriadSize(...args); } catch (e) {} };

