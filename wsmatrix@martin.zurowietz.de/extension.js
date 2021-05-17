const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const WmOverride = Self.imports.workspacePopup.WmOverride.WmOverride;

class Extension {
    enable() {
        let settings = ExtensionUtils.getSettings(Self.metadata['settings-schema']);
        let keybindings = ExtensionUtils.getSettings(Self.metadata['keybindings-schema']);
        this.overrideWorkspace = new WmOverride(settings, keybindings);
    }

    disable() {
        this.overrideWorkspace.destroy();
    }
}

function init() {
    return new Extension();
}
