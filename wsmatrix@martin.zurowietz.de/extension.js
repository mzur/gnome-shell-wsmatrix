import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {OverviewManager} from "./overview/overviewManager.js";
import {WorkspaceManagerOverride} from "./workspacePopup/workspaceManagerOverride.js";

export default class WExtension extends Extension {
    enable() {
        let settings = this.getSettings('settings-schema');
        let keybindings = this.getSettings('keybindings-schema');
        this.overrideWorkspace = new WorkspaceManagerOverride(settings, keybindings);
        this.overrideOverview = new OverviewManager(settings);
    }

    disable() {
        this.overrideWorkspace.destroy();
        this.overrideOverview.destroy();
    }
}
