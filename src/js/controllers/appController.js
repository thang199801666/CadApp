// appController.js - Controller wiring for MVC-style app
import * as SceneModel from '../models/SceneModel.js';
import * as uiView from '../views/uiView.js';

// Bootstrap the app: initialize the model first, then wire up UI.
(async function bootstrap() {
    try {
        const ok = await SceneModel.init();
        if (!ok) console.warn('SceneModel.init reported failure');
    } catch (e) {
        console.warn('SceneModel.init threw an error', e);
    }

    // Wire resize handling
    window.addEventListener('resize', () => {
        try { SceneModel.handleResize(); } catch (e) { console.warn('Resize handler failed', e); }
    });

    // Provide a small facade of helpers we pass to the view layer
    const helpers = {
        setMouseMapping: SceneModel.setMouseMapping,
        setTriadMode: SceneModel.setTriadMode,
        setTriadSize: SceneModel.setTriadSize,
        setPresetView: (id, object = null, duration = 600) => SceneModel.setPresetView(id, duration, object),
        fitModelToView: (obj) => SceneModel.fitModelToView(obj),
        openModel: () => {
            SceneModel.openModel();
            // Update tree after model loads
            setTimeout(() => {
                const core = SceneModel.getCore();
                if (core && core.scene && window.updateTree) {
                    window.updateTree(core.scene);
                }
            }, 100);
        },
        getCore: () => SceneModel.getCore()
    };
    // Visual style helpers
    helpers.setVisualStyle = SceneModel.setVisualStyle;
    helpers.getVisualStyle = SceneModel.getVisualStyle;
    // Feature angle helpers
    helpers.setFeatureAngle = SceneModel.setFeatureAngle;
    helpers.getFeatureAngle = SceneModel.getFeatureAngle;

    // Initialize UI view with scene/controller helpers
    try { uiView.initUI(helpers); } catch (e) { console.warn('uiView.initUI failed', e); }

    // Expose a small API for debugging/legacy code
    window.viewer = window.viewer || {};
    window.viewer.setPresetView = helpers.setPresetView;
    window.viewer.setTriadMode = helpers.setTriadMode;
    window.viewer.setTriadSize = helpers.setTriadSize;

    // Log a startup message
    if (window.logMessage) window.logMessage('Application initialized.');
})();


