const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const Util = Self.imports.util;
const GOverviewControls = imports.ui.overviewControls;

const SMALL_WORKSPACE_RATIO = 0.15;

var ControlsState = {
    HIDDEN: 0,
    WINDOW_PICKER: 1,
    APP_GRID: 2,
};

var ControlsManagerLayout = class {
    constructor(settings, keybindings) {
        this._settings = settings;
        this._keybindings = keybindings;

        this._overrideProperties = {
            _computeWorkspacesBoxForState(state, workAreaBox, searchHeight, dashHeight, thumbnailsHeight) {
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


        this._overrideOriginalProperties();
    }

    destroy() {
        this._restoreOriginalProperties();
    }

    _overrideOriginalProperties() {
        global.wsmatrix.GSFunctions['ControlsManagerLayout'] = Util.overrideProto(GOverviewControls.ControlsManagerLayout.prototype, this._overrideProperties);
    }

    _restoreOriginalProperties() {
        Util.overrideProto(GOverviewControls.ControlsManagerLayout.prototype, global.wsmatrix.GSFunctions['ControlsManagerLayout']);
    }
}
