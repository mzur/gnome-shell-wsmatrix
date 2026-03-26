import OverviewManager from "./overview/overviewManager.js";
import WorkspaceManagerOverride from "./workspacePopup/workspaceManagerOverride.js";
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class WsmatrixExtension extends Extension {
    enable() {
        let settings = this.getSettings();
        let keybindings = this.getSettings(this.metadata['keybindings-schema']);
        this.overrideWorkspace = new WorkspaceManagerOverride(settings, keybindings);
        this.overrideWorkspace.enable();
        this.overrideOverview = new OverviewManager(settings);
        this.overrideOverview.enable();
    }

    disable() {
        this.overrideWorkspace.disable();
        this.overrideWorkspace = null;

        this.overrideOverview.disable();
        this.overrideOverview = null;
    }
}
