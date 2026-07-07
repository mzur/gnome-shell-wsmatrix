import OverviewManager from "./overview/overviewManager.js";
import WorkspaceManagerOverride from "./workspacePopup/workspaceManagerOverride.js";
import WorkspaceIndicator from "./panel/workspaceIndicator.js";
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class WsmatrixExtension extends Extension {
    enable() {
        let settings = this.getSettings();
        let keybindings = this.getSettings(this.metadata['keybindings-schema']);
        this.overrideWorkspace = new WorkspaceManagerOverride(settings, keybindings);
        this.overrideWorkspace.enable();
        this.overrideOverview = new OverviewManager(settings);
        this.overrideOverview.enable();
        this.indicator = new WorkspaceIndicator(settings, {
            toggleOverview: () => this.overrideWorkspace.toggleOverview(),
            scroll: (direction) => this.overrideWorkspace.moveToWorkspace(direction),
        });
        this.indicator.enable();
    }

    disable() {
        this.indicator.disable();
        this.indicator = null;

        this.overrideWorkspace.disable();
        this.overrideWorkspace = null;

        this.overrideOverview.disable();
        this.overrideOverview = null;
    }
}
