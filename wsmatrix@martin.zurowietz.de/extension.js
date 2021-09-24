const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const WorkspaceManagerOverride = Self.imports.workspacePopup.workspaceManagerOverride;
const OverviewManager = Self.imports.overview.overviewManager;

class Extension {
    enable() {
        let settings = ExtensionUtils.getSettings(Self.metadata['settings-schema']);
        let keybindings = ExtensionUtils.getSettings(Self.metadata['keybindings-schema']);
        this.overrideWorkspace = new WorkspaceManagerOverride.WorkspaceManagerOverride(settings, keybindings);
        this.overrideOverview = new OverviewManager.OverviewManager(settings);
    }

    disable() {
        this.overrideWorkspace.destroy();
        this.overrideOverview.destroy();
    }
}

function init() {
    return new Extension();
}
