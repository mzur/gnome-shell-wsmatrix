const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const WorkspaceManagerOverride = Self.imports.workspacePopup.workspaceManagerOverride;

class Extension {
    enable() {
        let settings = ExtensionUtils.getSettings(Self.metadata['settings-schema']);
        let keybindings = ExtensionUtils.getSettings(Self.metadata['keybindings-schema']);
        this.overrideWorkspace = new WorkspaceManagerOverride.WorkspaceManagerOverride(settings, keybindings);
    }

    disable() {
        this.overrideWorkspace.destroy();
    }
}

function init() {
    return new Extension();
}
