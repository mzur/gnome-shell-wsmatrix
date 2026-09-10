import Clutter from 'gi://Clutter';
import Override from '../Override.js';
import {FitMode, WorkspacesView as GWorkspacesView} from 'resource:///org/gnome/shell/ui/workspacesView.js';

const _getFirstFitAllWorkspaceBox = function (box, spacing, vertical) {
    const workspaceManager = global.workspace_manager;
    const rows = workspaceManager.layout_rows;
    const columns = workspaceManager.layout_columns;

    const [width, height] = box.get_size();
    const [workspace] = this._workspaces;

    const fitAllBox = new Clutter.ActorBox();

    let [x1, y1] = box.get_origin();

    // Spacing here is not only the space between workspaces, but also the
    // space before the first workspace, and after the last one. This prevents
    // workspaces from touching the edges of the allocation box.
    const availableWidth = width - spacing * (columns + 1);
    const availableHeight = height - spacing * (rows + 1);
    let workspaceWidth = availableWidth / columns;
    let workspaceHeight = availableHeight / rows;
    let [, wh] = workspace.get_preferred_height(workspaceWidth);
    let [, ww] = workspace.get_preferred_width(workspaceHeight);
    if (wh < workspaceHeight) {
        workspaceHeight = wh;
    } else {
        workspaceWidth = ww;
    }

    fitAllBox.set_size(workspaceWidth, height);
    fitAllBox.set_origin(width / 2 - (workspaceWidth + spacing) * columns / 2, -rows / 2 * workspaceHeight);

    return fitAllBox;
}

// Position of the "current" (centered) cell in SINGLE mode.
// During a switch we interpolate DIRECTLY between the source and target cells
// instead of following the index linearly: otherwise a 1 -> 3 switch (adjacent
// in the grid) travels through the cell of index 2.
const _currentCell = function (columns) {
    const adj = this._scrollAdjustment;
    const from = this._wsmFrom;
    const to = this._wsmTo;

    const inTransition =
        adj.get_transition('value') !== null &&
        !this._gestureActive &&
        from !== undefined && to !== undefined && from !== to;

    if (inTransition) {
        const p = Math.max(0, Math.min(1, (adj.value - from) / (to - from)));
        const fromCol = from % columns, fromRow = Math.floor(from / columns);
        const toCol = to % columns, toRow = Math.floor(to / columns);
        return [
            fromCol + (toCol - fromCol) * p,
            fromRow + (toRow - fromRow) * p,
        ];
    }

    // At rest the eased value can end a hair away from an integer (e.g. 5.9999);
    // with the modular grid mapping that would point at a non-existent cell
    // (column 2.9999 of row 1 instead of column 0 of row 2) and show an empty
    // view. Snap to the nearest index first.
    const value = adj.value;
    const nearest = Math.round(value);
    if (Math.abs(value - nearest) < 1e-3)
        return [nearest % columns, Math.floor(nearest / columns)];

    // Gesture scrolling: interpolate between the two neighbouring cells in 2D.
    const lower = Math.floor(value);
    const upper = Math.ceil(value);
    const f = value - lower;
    return [
        (lower % columns) + ((upper % columns) - (lower % columns)) * f,
        Math.floor(lower / columns) + (Math.floor(upper / columns) - Math.floor(lower / columns)) * f,
    ];
}

const _getFirstFitSingleWorkspaceBox = function (box, spacing, vertical) {
    const workspaceManager = global.workspace_manager;
    const columns = workspaceManager.layout_columns;

    const [width, height] = box.get_size();
    const [workspace] = this._workspaces;

    const [currentColumn, currentRow] = _currentCell.call(this, columns);

    const [, workspaceWidth] = workspace.get_preferred_width(height);

    // Place workspace 0 so that the current cell is centered. Columns are spaced
    // by (workspaceWidth + spacing), rows by a viewport height (height + spacing).
    let [x1, y1] = box.get_origin();
    x1 += (width - workspaceWidth) / 2;
    x1 -= currentColumn * (workspaceWidth + spacing);
    y1 -= currentRow * (height + spacing);

    const fitSingleBox = new Clutter.ActorBox({x1, y1});
    fitSingleBox.set_size(workspaceWidth, height);

    return fitSingleBox;
}

const vfunc_allocate = function (box) {
    this.set_allocation(box);
    const workspaceManager = global.workspace_manager;
    const rows = workspaceManager.layout_rows;
    const columns = workspaceManager.layout_columns;

    if (this._workspaces.length === 0)
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

    workspaces.forEach((child, i) => {
        const row = Math.floor(i / columns);
        const column = i % columns;

        // SINGLE: absolute 2D position (each workspace at its grid cell). The
        // current cell (centered by _getFirstFitSingleWorkspaceBox) follows a direct
        // source -> target path, so the transition no longer travels through an
        // intermediate workspace.
        const singleBox = new Clutter.ActorBox();
        singleBox.set_size(fitSingleWidth, fitSingleHeight);
        singleBox.set_origin(
            fitSingleX1 + (fitSingleWidth + fitSingleSpacing) * column,
            fitSingleY1 + (fitSingleHeight + fitSingleSpacing) * row);

        if (fitMode === FitMode.SINGLE)
            box = singleBox;
        else if (fitMode === FitMode.ALL)
            box = fitAllBox;
        else
            box = singleBox.interpolate(fitAllBox, fitMode);

        child.allocate_align_fill(box, 0.5, 0.5, false, false);

        // ALL mode (the overview "all thumbnails" grid): unchanged.
        const targetRow = Math.floor((1 + i) / columns);
        const targetColumn = (1 + i) % columns;

        let [, h] = child.get_preferred_height(fitAllWidth);
        fitAllBox.set_origin(
            fitAllX1 + (fitAllWidth + fitAllSpacing) * targetColumn,
            fitAllY1 + (h + fitAllSpacing) * targetRow);
    });
}


export default class WorkspacesView extends Override {
    enable() {
        const subject = GWorkspacesView.prototype;

        // Capture the switch source/target cell for a direct transition.
        this._im.overrideMethod(subject, '_activeWorkspaceChanged', (original) => {
            return function (wm, from, to, direction) {
                if (!this._gestureActive) {
                    this._wsmFrom = from;
                    this._wsmTo = to;
                }
                return original.call(this, wm, from, to, direction);
            };
        });

        this._im.overrideMethod(subject, '_getFirstFitSingleWorkspaceBox', (original) => {
            return function () {
                return _getFirstFitSingleWorkspaceBox.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, '_getFirstFitAllWorkspaceBox', (original) => {
            return function () {
                return _getFirstFitAllWorkspaceBox.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, 'vfunc_allocate', (original) => {
            return function () {
                return vfunc_allocate.call(this, ...arguments);
            };
        });
    }
}
