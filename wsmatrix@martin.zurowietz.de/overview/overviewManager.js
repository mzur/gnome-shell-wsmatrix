const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const ThumbnailsBox = Self.imports.overview.thumbnailsBox;
const ControlsManagerLayout = Self.imports.overview.controlsManagerLayout;
const SecondaryMonitorDisplay = Self.imports.overview.secondaryMonitorDisplay;
const WorkspacesView = Self.imports.overview.workspacesView;

var OverviewManager = class {
    constructor(settings, keybindins) {
        this._settings = settings;
        this._keybindins = keybindins;

        this._thumbnailsBoxOverride = new ThumbnailsBox.ThumbnailsBox(this._settings, this._keybindins);
        this._workspacesViewOverride = new WorkspacesView.WorkspacesView(this._settings, this._keybindins);
        this._controlsManagerLayoutOverride = new ControlsManagerLayout.ControlsManagerLayout(this._settings, this._keybindins);
        this._secondaryMonitorDisplayOverride = new SecondaryMonitorDisplay.SecondaryMonitorDisplay(this._settings, this._keybindins);

        this._handleShowOverviewGridChanged();
        this._connectSettings();
    }

    _connectSettings() {
        this.settingsHandlerShowOverviewGrid = this._settings.connect(
            'changed::show-overview-grid',
            this._handleShowOverviewGridChanged.bind(this)
        );
    }

    _disconnectSettings() {
        this._settings.disconnect(this.settingsHandlerShowOverviewGrid);
    }

    _handleShowOverviewGridChanged() {
        this.showOvervieGrid = this._settings.get_boolean('show-overview-grid');
        if (this.showOvervieGrid)
            this.override();
        else
            this.restore();
    }

    override() {
        this._thumbnailsBoxOverride.overrideOriginalProperties();
        this._workspacesViewOverride.overrideOriginalProperties();
        this._controlsManagerLayoutOverride.overrideOriginalProperties();
        this._secondaryMonitorDisplayOverride.overrideOriginalProperties();
    }

    restore() {
        this._thumbnailsBoxOverride.restoreOriginalProperties();
        this._workspacesViewOverride.restoreOriginalProperties();
        this._controlsManagerLayoutOverride.restoreOriginalProperties();
        this._secondaryMonitorDisplayOverride.restoreOriginalProperties();
    }

    destroy() {
        this._disconnectSettings();
    }
}
