import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {WorkspaceManagerOverride} from "./workspacePopup/workspaceManagerOverride.js";
import {OverviewManager} from "./overview/overviewManager.js";

class WExtension extends Extension {
    enable() {
        let settings = this.getSettings('settings-schema');
        let keybindings = this.getSettings('keybindings-schema');
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
