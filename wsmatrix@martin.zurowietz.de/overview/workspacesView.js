const Self = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const {Clutter, Gio, GLib, Shell, Meta} = imports.gi;
const GWorkspacesView = imports.ui.workspacesView;

var WorkspacesView = class {
    constructor(settings, keybindings) {
        this._settings = settings;
        this._keybindings = keybindings;
        this._connectSettings();
        this._handleNumberOfWorkspacesChanged();

        this._workspacesDisplay = Main.overview._overview.controls.layoutManager._workspacesDisplay._workspacesViews

        this.overrideProperties = [
            // '_getFirstFitAllWorkspaceBox',
            // '_getFirstFitSingleWorkspaceBox',
            // 'allocate',
        ];
        this._overrideOriginalProperties();
    }

    destroy() {
        this._disconnectSettings();
        this._restoreOriginalProperties();
    }

    _connectSettings() {
        this.settingsHandlerRows = this._settings.connect(
            'changed::num-rows',
            this._handleNumberOfWorkspacesChanged.bind(this)
        );

        this.settingsHandlerColumns = this._settings.connect(
            'changed::num-columns',
            this._handleNumberOfWorkspacesChanged.bind(this)
        );
    }

    _disconnectSettings() {
        this._settings.disconnect(this.settingsHandlerRows);
        this._settings.disconnect(this.settingsHandlerColumns);
    }

    _handleNumberOfWorkspacesChanged() {
        this.rows = this._settings.get_int('num-rows');
        this.columns = this._settings.get_int('num-columns');
    }

    _overrideOriginalProperties() {
        this._overrideProperties = {};
        this.overrideProperties.forEach(function (prop) {
            this._overrideProperties[prop] = GWorkspacesView.WorkspacesView.prototype[prop];
            GWorkspacesView.WorkspacesView.prototype[prop] = this[prop];
        }, this);
        GWorkspacesView.WorkspacesView.prototype.getRows = this.getRows.bind(this);
        GWorkspacesView.WorkspacesView.prototype.getColumns = this.getColumns.bind(this);
    }

    _restoreOriginalProperties() {
        this.overrideProperties.forEach(function (prop) {
            GWorkspacesView.WorkspacesView.prototype[prop] = this._overrideProperties[prop];
        }, this);
        delete WorkspacesView.prototype.getRows;
        delete WorkspacesView.prototype.getColumns;
    }

    getRows() {
        return this.rows;
    }

    getColumns() {
        return this.columns;
    }

    _getFirstFitAllWorkspaceBox(box, spacing, vertical) {
        const {nWorkspaces} = global.workspaceManager;
        const [width, height] = box.get_size();
        const [workspace] = this._workspaces;

        const fitAllBox = new Clutter.ActorBox();

        let [x1, y1] = box.get_origin();

        // Spacing here is not only the space between workspaces, but also the
        // space before the first workspace, and after the last one. This prevents
        // workspaces from touching the edges of the allocation box.
        if (vertical) {
            const availableHeight = height - spacing * (nWorkspaces + 1);
            let workspaceHeight = availableHeight / nWorkspaces;
            let [, workspaceWidth] =
                workspace.get_preferred_width(workspaceHeight);

            y1 = spacing;
            if (workspaceWidth > width) {
                [, workspaceHeight] = workspace.get_preferred_height(width);
                y1 += Math.max((availableHeight - workspaceHeight * nWorkspaces) / 2, 0);
            }

            fitAllBox.set_size(width, workspaceHeight);
        } else {
            const availableWidth = width - spacing * (nWorkspaces + 1);
            let workspaceWidth = availableWidth / nWorkspaces;
            let [, workspaceHeight] =
                workspace.get_preferred_height(workspaceWidth);

            x1 = spacing;
            if (workspaceHeight > height) {
                [, workspaceWidth] = workspace.get_preferred_width(height);
                x1 += Math.max((availableWidth - workspaceWidth * nWorkspaces) / 2, 0);
            }

            fitAllBox.set_size(workspaceWidth, height);
        }

        fitAllBox.set_origin(x1, y1);

        return fitAllBox;
    }

    _getFirstFitSingleWorkspaceBox(box, spacing, vertical) {
        let workspaceManager = global.workspace_manager;
        const [width, height] = box.get_size();
        const [workspace] = this._workspaces;

        const rtl = this.text_direction === Clutter.TextDirection.RTL;
        const adj = this._scrollAdjustment;
        const currentWorkspace = vertical || !rtl
            ? adj.value : adj.upper - adj.value - 1;

        let targetIndex = workspaceManager.get_active_workspace_index();
        let currentWsIndex = currentWorkspace < targetIndex ? Math.floor(currentWorkspace) : Math.ceil(currentWorkspace);

        let fromRow = Math.floor(currentWsIndex / this.getColumns());
        let fromColumn = currentWsIndex % this.getColumns();

        let targetRow = Math.floor(targetIndex / this.getColumns());
        let targetColumn = targetIndex % this.getColumns();

        var currentWorkspaceVertical = currentWorkspace;
        var currentWorkspaceHorizontal = currentWorkspace;

        if (fromRow !== targetRow) {
            // currentWorkspaceVertical = fromRow + (() * (targetRow - fromRow));
        }
        if (fromColumn !== targetColumn) {
            // currentWorkspaceHorizontal = fromColumn + (Math.min(currentWorkspace /, Math.max(targetIndex, 0.0005) / currentWorkspace) * (targetColumn - fromColumn));
        }
        print("fromColumn=" + fromColumn + ", currentWorkspace=" + currentWorkspace + ", targetIndex=" + targetIndex + ", targetColumn=" + targetColumn + ", fromColumn=" + fromColumn);
        print("targetIndex=" + targetIndex + ", currentWsIndex=" + currentWsIndex + ", currentWorkspace=" + currentWorkspace + ", currentWorkspaceHorizontal=" + currentWorkspaceHorizontal + ", currentWorkspaceVertical=" + currentWorkspaceVertical);

        // Single fit mode implies centered too
        let [x1, y1] = box.get_origin();
        const [, workspaceHeight] = workspace.get_preferred_height(width);
        y1 += (height - workspaceHeight) / 2;
        y1 -= currentWorkspaceVertical * (workspaceHeight + spacing);
        const [, workspaceWidth] = workspace.get_preferred_width(height);
        x1 += (width - workspaceWidth) / 2;
        x1 -= currentWorkspaceHorizontal * (workspaceWidth + spacing);

        const fitSingleBox = new Clutter.ActorBox({x1, y1});

        fitSingleBox.set_size(workspaceWidth, workspaceHeight);
        return fitSingleBox;
    }

    allocate(box) {
        print("allocate");
        this.set_allocation(box);
        //
        // if (this.get_n_children() === 0)
        //     return;
        //
        // const vertical = global.workspaceManager.layout_rows === -1;
        // const rtl = this.text_direction === Clutter.TextDirection.RTL;
        //
        // const fitMode = this._fitModeAdjustment.value;
        //
        // let [fitSingleBox, fitAllBox] = this._getInitialBoxes(box);
        // const fitSingleSpacing =
        //     this._getSpacing(fitSingleBox, FitMode.SINGLE, vertical);
        // fitSingleBox =
        //     this._getFirstFitSingleWorkspaceBox(fitSingleBox, fitSingleSpacing, vertical);
        //
        // const fitAllSpacing =
        //     this._getSpacing(fitAllBox, FitMode.ALL, vertical);
        // fitAllBox =
        //     this._getFirstFitAllWorkspaceBox(fitAllBox, fitAllSpacing, vertical);
        //
        // // Account for RTL locales by reversing the list
        // const workspaces = this._workspaces.slice();
        // if (rtl)
        //     workspaces.reverse();
        //
        // const [fitSingleX1, fitSingleY1] = fitSingleBox.get_origin();
        // const [fitSingleWidth, fitSingleHeight] = fitSingleBox.get_size();
        // const [fitAllX1, fitAllY1] = fitAllBox.get_origin();
        // const [fitAllWidth, fitAllHeight] = fitAllBox.get_size();
        //
        // for (var i = 0; i < workspaces.length; i++) {
        //     if (fitMode === FitMode.SINGLE)
        //         box = fitSingleBox;
        //     else if (fitMode === FitMode.ALL)
        //         box = fitAllBox;
        //     else
        //         box = fitSingleBox.interpolate(fitAllBox, fitMode);
        //
        //     workspaces[i].allocate_align_fill(box, 0.5, 0.5, false, false);
        //
        //     fitSingleBox.set_origin(
        //         fitSingleBox.x1 + fitSingleWidth + fitSingleSpacing,
        //         fitSingleBox.y1 + fitSingleHeight + fitSingleSpacing);
        //     fitAllBox.set_origin(
        //         fitAllBox.x1 + fitAllWidth + fitAllSpacing,
        //         fitAllBox.y1 + fitAllHeight + fitAllSpacing);
        // }
    }
}


