const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const ThumbnailsBox = Self.imports.overview.thumbnailsBox;
const ControlsManagerLayout = Self.imports.overview.controlsManagerLayout;

var OverviewManager = class {
    constructor(settings, keybindins) {
        this._settings = settings;
        this._keybindins = keybindins;
        this._overrideProperties = {};
        this._thumbnailsBoxOverride = new ThumbnailsBox.ThumbnailsBox(this._settings, this._keybindins);
        this._controlsManagerLayoutOverride = new ControlsManagerLayout.ControlsManagerLayout(this._settings, this._keybindins);
    }

    destroy() {
        this._thumbnailsBoxOverride.destroy();
        this._controlsManagerLayoutOverride.destroy();
    }
}
