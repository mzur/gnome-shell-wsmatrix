const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const Util = Self.imports.util;
const OverviewControls = imports.ui.overviewControls;

const { SMALL_WORKSPACE_RATIO } = OverviewControls;

var ControlsManagerLayout = class {
    constructor() {
        this.originalLayout = null;
        this._overrideProperties = {
            _computeWorkspacesBoxForState(state, workAreaBox, searchHeight, dashHeight, thumbnailsHeight) {
                const { ControlsState } = OverviewControls;
                const workspaceBox = workAreaBox.copy();
                const [startX, startY] = workAreaBox.get_origin();
                const [width, height] = workspaceBox.get_size();
                const {spacing} = this;
                const {expandFraction} = this._workspacesThumbnails;
                let workspaceManager = global.workspace_manager;
                let rows = workspaceManager.layout_rows;

                switch (state) {
                    case ControlsState.HIDDEN:
                        break;
                    case ControlsState.WINDOW_PICKER:
                        workspaceBox.set_origin(startX,
                            startY + searchHeight + spacing +
                            thumbnailsHeight * rows + spacing * expandFraction);
                        workspaceBox.set_size(width,
                            height -
                            dashHeight - spacing -
                            searchHeight - spacing -
                            thumbnailsHeight * rows - spacing * expandFraction);
                        break;
                    case ControlsState.APP_GRID:
                        workspaceBox.set_origin(startX, startY + searchHeight + spacing);
                        workspaceBox.set_size(
                            width,
                            Math.round(height * rows * SMALL_WORKSPACE_RATIO));
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
        this.originalLayout = Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, this._overrideProperties);
    }

    restoreOriginalProperties() {
        Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, this.originalLayout);
    }
}
