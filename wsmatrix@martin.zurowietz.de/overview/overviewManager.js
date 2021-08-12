const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const WorkspacesView = Self.imports.overview.workspacesView;
const ThumbnailsBox = Self.imports.overview.thumbnailsBox;
const ControlsManagerLayout = Self.imports.overview.controlsManagerLayout;
const ControlsManager = Self.imports.overview.controlsManager;
const OverviewActor = Self.imports.overview.overviewActor;

var OverviewManager = class {
    constructor(settings, keybindins) {
        this._settings = settings;
        this._keybindins = keybindins;
        this._overrideProperties = {};
        this._workspacesViewOverride = new WorkspacesView.WorkspacesView(this._settings, this._keybindins);
        this._thumbnailsBoxOverride = new ThumbnailsBox.ThumbnailsBox(this._settings, this._keybindins);
        this._controlsManagerLayoutOverride = new ControlsManagerLayout.ControlsManagerLayout(this._settings, this._keybindins);

        // this._overrideProperties['_controls'] = this._controls;
        // this._controls = new ControlsManager.ControlsManager();
        // this._overrideProperties['_overviewActor'] = this._overviewActor;
        // this._overviewActor = new OverviewActor.OverviewActor();
        // this._overrideProperties['_layoutManager'] = this._layoutManager;
        // this._layoutManager = new ControlsManagerLayout.ControlsManagerLayout(this._layoutManager._searchEntry,
        //     this._layoutManager._appDisplay, this._layoutManager._workspacesDisplay, this._layoutManager._workspacesThumbnails,
        //     this._layoutManager._searchController, this._layoutManager._dash, this._layoutManager._stateAdjustment);
    }

    // get _layoutManager() {
    //     return Main.overview._overview._controls.layout_manager;
    // }
    //
    // set _layoutManager(value) {
    //     Main.overview._overview._controls.layout_manager = value;
    // }

    get _controls() {
        return Main.overview._overview._controls;
    }

    set _controls(value) {
        Main.overview._overview._controls = value;
    }

    get _overviewActor() {
        return Main.overview._overview;
    }

    set _overviewActor(value) {
        return Main.overview._overview = value;
    }

    destroy() {
        this._workspacesViewOverride.destroy();
        this._thumbnailsBoxOverride.destroy();
        this.this._controlsManagerLayoutOverride.destroy();
        // this._layoutManager.destroy();
        // this._layoutManager = this._overrideProperties['_layoutManager'];
        this._controls.destroy();
        this._controls = this._overrideProperties['_controls'];
    }
}
