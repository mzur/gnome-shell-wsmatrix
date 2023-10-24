import Override from '../Override.js';
import {overview} from 'resource:///org/gnome/shell/ui/main.js';
// TODO: export SMALL_WORKSPACE_RATIO
import {SMALL_WORKSPACE_RATIO, ControlsState} from 'resource:///org/gnome/shell/ui/overviewControls.js';

const _computeWorkspacesBoxForState = function(state, box, searchHeight, dashHeight, thumbnailsHeight) {
    const workspaceBox = box.copy();
    const [width, height] = workspaceBox.get_size();
    const { y1: startY } = this._workAreaBox;
    const {spacing} = this;
    const {expandFraction} = this._workspacesThumbnails;

    const workspaceManager = global.workspace_manager;
    const rows = workspaceManager.layout_rows;

    switch (state) {
    case ControlsState.HIDDEN:
        workspaceBox.set_origin(...this._workAreaBox.get_origin());
        workspaceBox.set_size(...this._workAreaBox.get_size());
        break;
    case ControlsState.WINDOW_PICKER:
        workspaceBox.set_origin(0,
            startY + searchHeight + spacing +
            thumbnailsHeight * rows + spacing * expandFraction);
        workspaceBox.set_size(width,
            height -
            dashHeight - spacing -
            searchHeight - spacing -
            thumbnailsHeight * rows - spacing * expandFraction);
        break;
    case ControlsState.APP_GRID:
        workspaceBox.set_origin(0, startY + searchHeight + spacing);
        workspaceBox.set_size(
            width,
            Math.round(height * rows * SMALL_WORKSPACE_RATIO));
        break;
    }

    return workspaceBox;
}

export default class ControlsManagerLayout extends Override {
    enable() {
        const subject = overview._overview._controls.layout_manager;
        this._im.overrideMethod(subject, '_computeWorkspacesBoxForState', (original) => {
            return _computeWorkspacesBoxForState.bind(subject);
        });
    }
}
