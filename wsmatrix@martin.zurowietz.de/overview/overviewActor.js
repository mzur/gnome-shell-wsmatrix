const { GObject } = imports.gi;

const GOverview = imports.ui.overview;

const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const ControlsManager = Self.imports.overview.controlsManager;

const OverviewActor = GObject.registerClass(
    class OverviewActor extends GOverview.OverviewActor {
        _init() {
            super._init();
            // this._controls.destroy();
            //
            // this._controls = new ControlsManager.ControlsManager();
            // this.add_child(this._controls);
        }
    });
