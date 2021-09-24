const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const Util = Self.imports.util;
const GWorkspacesView = imports.ui.workspacesView;
const OverviewControls = imports.ui.overviewControls;

var SecondaryMonitorDisplay = class {
    constructor() {
        this.originalDisplay = null;
        this._overrideProperties = {
            _getWorkspacesBoxForState(state, box, padding, thumbnailsHeight, spacing) {
                const { ControlsState } = OverviewControls;
                const workspaceBox = box.copy();
                const [width, height] = workspaceBox.get_size();
                let workspaceManager = global.workspace_manager;
                let rows = workspaceManager.layout_rows;

                switch (state) {
                    case ControlsState.HIDDEN:
                        break;
                    case ControlsState.WINDOW_PICKER:
                        workspaceBox.set_origin(0, padding + thumbnailsHeight * rows + spacing);
                        workspaceBox.set_size(
                            width,
                            height - 2 * padding - thumbnailsHeight * rows - spacing);
                        break;
                    case ControlsState.APP_GRID:
                        workspaceBox.set_origin(0, padding);
                        workspaceBox.set_size(
                            width,
                            height - 2 * padding);
                        break;
                }

                return workspaceBox;
            },
        }
    }

    destroy() {
        this.restoreOriginalProperties();
    }

    overrideOriginalProperties() {
        this.originalDisplay = Util.overrideProto(GWorkspacesView.SecondaryMonitorDisplay.prototype, this._overrideProperties);
    }

    restoreOriginalProperties() {
        Util.overrideProto(GWorkspacesView.SecondaryMonitorDisplay.prototype, this.originalDisplay);
    }
}
