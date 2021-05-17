const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const WorkspaceManager = Self.imports.workspacePopup.workspaceManager.WorkspaceManager;

class Extension {
    enable() {
        let settings = ExtensionUtils.getSettings(Self.metadata['settings-schema']);
        let keybindings = ExtensionUtils.getSettings(Self.metadata['keybindings-schema']);
        this.overrideWorkspace = new WorkspaceManager(settings, keybindings);
    }

    disable() {
        this.overrideWorkspace.destroy();
    }
}

function init() {
    return new Extension();
}
