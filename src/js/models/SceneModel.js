// SceneModel.js - thin wrapper around `scene.js` to provide a clean, defensive model API
// Keeps the same surface API used by controllers/views but guards against
// missing or not-yet-initialized `SceneObject` instances.
import SceneObject from '../scene.js';

/**
 * Initialize the scene manager. Returns a Promise when the underlying
 * SceneObject.init() returns a promise, otherwise returns synchronously.
 */
export async function init() {
    if (!SceneObject) return;
    try {
        const res = SceneObject.init && SceneObject.init();
        // If the init is async, await it, otherwise just return the value
        if (res && typeof res.then === 'function') await res;
        try { SceneObject.attachAppNamespace && SceneObject.attachAppNamespace(); } catch (e) {}
        return true;
    } catch (e) {
        console.warn('Scene init failed', e);
        return false;
    }
}

export function handleResize() {
    try { if (SceneObject && typeof SceneObject.handleResize === 'function') SceneObject.handleResize(); } catch (e) {}
}

export const setMouseMapping = (...args) => {
    try { return SceneObject && SceneObject.setMouseMapping && SceneObject.setMouseMapping(...args); } catch (e) {}
};
export const setTriadMode = (...args) => {
    try { return SceneObject && SceneObject.setTriadMode && SceneObject.setTriadMode(...args); } catch (e) {}
};
export const setTriadSize = (...args) => {
    try { return SceneObject && SceneObject.setTriadSize && SceneObject.setTriadSize(...args); } catch (e) {}
};

export const setVisualStyle = (...args) => {
    try { return SceneObject && SceneObject.setVisualStyle && SceneObject.setVisualStyle(...args); } catch (e) {}
};

export const getVisualStyle = (...args) => {
    try { return SceneObject && SceneObject.getVisualStyle && SceneObject.getVisualStyle(...args); } catch (e) { return 'shaded-edge'; }
};

export const setFeatureAngle = (...args) => {
    try { return SceneObject && SceneObject.setFeatureAngle && SceneObject.setFeatureAngle(...args); } catch (e) {}
};

export const getFeatureAngle = (...args) => {
    try { return SceneObject && SceneObject.getFeatureAngle && SceneObject.getFeatureAngle(...args); } catch (e) { return 30; }
};

export function setPresetView(id, duration = 600, object = null) {
    try { if (SceneObject && typeof SceneObject.setPresetView === 'function') SceneObject.setPresetView(id, object, duration); } catch (e) { console.warn('setPresetView failed', e); }
}

export function fitModelToView(obj) {
    try { if (SceneObject && typeof SceneObject.fitModelToView === 'function') SceneObject.fitModelToView(obj); } catch (e) {}
}

export function rotateModelByDegrees(degrees = 180, axis = 'y', duration = 600, space = 'world') {
    try { if (SceneObject && typeof SceneObject.rotateModelByDegrees === 'function') return SceneObject.rotateModelByDegrees(degrees, axis, duration, space); } catch (e) { console.warn('rotateModelByDegrees failed', e); }
}

export function getCore() {
    return (SceneObject && 'core' in SceneObject) ? SceneObject.core : null;
}

export function getScene() { return SceneObject && SceneObject.scene ? SceneObject.scene : null; }
export function getCamera() { return SceneObject && SceneObject.camera ? SceneObject.camera : null; }
export function getRenderer() { return SceneObject && SceneObject.renderer ? SceneObject.renderer : null; }
export function getControls() { return SceneObject && SceneObject.controls ? SceneObject.controls : null; }

export function openModel() {
    try { return SceneObject && typeof SceneObject.openModel === 'function' ? SceneObject.openModel() : false; } catch (e) { return false; }
}

// Backwards-compatible default export (optional)
const SceneModel = {
    init,
    handleResize,
    setMouseMapping,
    setTriadMode,
    setTriadSize,
    setVisualStyle,
    getVisualStyle,
    setFeatureAngle,
    getFeatureAngle,
    setPresetView,
    fitModelToView,
    rotateModelByDegrees,
    getCore,
    getScene,
    getCamera,
    getRenderer,
    getControls,
    openModel
};

export default SceneModel;
