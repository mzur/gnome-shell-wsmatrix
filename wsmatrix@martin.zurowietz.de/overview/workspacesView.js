const Self = imports.misc.extensionUtils.getCurrentExtension();
const {Clutter} = imports.gi;

const GWorkspacesView = imports.ui.workspacesView;
const Util = Self.imports.util;
const Main = imports.ui.main;

var FitMode = {
    SINGLE: 0,
    ALL: 1,
};

var WorkspacesView = class {
    constructor(settings, keybindings) {
        this._settings = settings;
        this._keybindings = keybindings;

        this._overrideProperties = {
            _getFirstFitAllWorkspaceBox(box, spacing, vertical) {
                const { nWorkspaces } = global.workspaceManager;
                const [width, height] = box.get_size();
                const [workspace] = this._workspaces;
                let workspaceManager = global.workspace_manager;
                let rows = workspaceManager.layout_rows;
                let columns = workspaceManager.layout_columns;

                const fitAllBox = new Clutter.ActorBox();

                let [x1, y1] = box.get_origin();

                // Spacing here is not only the space between workspaces, but also the
                // space before the first workspace, and after the last one. This prevents
                // workspaces from touching the edges of the allocation box.
                const availableWidth = width / rows;
                let workspaceWidth = availableWidth  / columns;
                let [, workspaceHeight] = workspace.get_preferred_height(workspaceWidth);

                x1 = (workspaceWidth * columns);
                y1 = spacing;
                if (workspaceHeight > height) {
                    [, workspaceWidth] = workspace.get_preferred_width(height);
                    x1 += Math.max((availableWidth - workspaceWidth * nWorkspaces) / 2, 0);
                }

                fitAllBox.set_size(workspaceWidth, height);

                const availableHeight = height - spacing * (nWorkspaces + 1);
                y1 = spacing;
                if (workspaceWidth > width) {
                    [, workspaceHeight] = workspace.get_preferred_height(width);
                    y1 += Math.max((availableHeight - workspaceHeight * nWorkspaces) / 2, 0);
                }

                fitAllBox.set_origin(x1, -rows / 2 * workspaceHeight);

                return fitAllBox;
            },

            vfunc_allocate(box) {
                this.set_allocation(box);
                let workspaceManager = global.workspace_manager;
                let rows = workspaceManager.layout_rows;
                let columns = workspaceManager.layout_columns;

                if (this.get_n_children() === 0)
                    return;

                const vertical = global.workspaceManager.layout_rows === -1;
                const rtl = this.text_direction === Clutter.TextDirection.RTL;

                const fitMode = this._fitModeAdjustment.value;

                let [fitSingleBox, fitAllBox] = this._getInitialBoxes(box);
                const fitSingleSpacing =
                    this._getSpacing(fitSingleBox, FitMode.SINGLE, vertical);
                fitSingleBox =
                    this._getFirstFitSingleWorkspaceBox(fitSingleBox, fitSingleSpacing, vertical);

                const fitAllSpacing =
                    this._getSpacing(fitAllBox, FitMode.ALL, vertical);
                fitAllBox =
                    this._getFirstFitAllWorkspaceBox(fitAllBox, fitAllSpacing, vertical);

                // Account for RTL locales by reversing the list
                const workspaces = this._workspaces.slice();
                if (rtl)
                    workspaces.reverse();

                const [fitSingleX1, fitSingleY1] = fitSingleBox.get_origin();
                const [fitSingleWidth, fitSingleHeight] = fitSingleBox.get_size();
                const [fitAllX1, fitAllY1] = fitAllBox.get_origin();
                const [fitAllWidth, fitAllHeight] = fitAllBox.get_size();

                workspaces.forEach((ws, i) => {
                    if (fitMode === FitMode.SINGLE)
                        box = fitSingleBox;
                    else if (fitMode === FitMode.ALL)
                        box = fitAllBox;
                    else
                        box = fitSingleBox.interpolate(fitAllBox, fitMode);

                    ws.allocate_align_fill(box, 0.5, 0.5, false, false);

                    let targetRow = Math.floor((1+i) / columns);
                    let targetColumn = (1+i) % columns;

                    // todo
                    fitSingleBox.set_origin(
                        fitSingleBox.x1 + fitSingleWidth + fitSingleSpacing,
                        fitSingleY1);
                    // fitSingleBox.set_origin(
                    //     fitSingleX1 + (fitSingleWidth + fitSingleSpacing) * targetColumn,
                    //     fitSingleY1 + (fitSingleHeight + fitSingleSpacing) * targetRow);

                    let [, h] = ws.get_preferred_height(fitAllWidth)
                    fitAllBox.set_origin(
                        fitAllX1 + (fitAllWidth + fitAllSpacing) * targetColumn,
                        fitAllY1 + (h + fitAllSpacing) * targetRow);
                });
            },
        }

        this._overrideOriginalProperties();
    }

    destroy() {
        this._restoreOriginalProperties();
    }

    _overrideOriginalProperties() {
        global.wsmatrix.GSFunctions['WorkspacesView'] = Util.overrideProto(GWorkspacesView.WorkspacesView.prototype, this._overrideProperties);
    }

    _restoreOriginalProperties() {
        Util.overrideProto(GWorkspacesView.WorkspacesView.prototype, global.wsmatrix.GSFunctions['WorkspacesView']);
    }
}
