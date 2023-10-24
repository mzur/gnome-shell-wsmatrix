import Override from '../Override.js';
import {ControlsState} from 'resource:///org/gnome/shell/ui/overviewControls.js';
import {SecondaryMonitorDisplay as GSecondaryMonitorDisplay} from 'resource:///org/gnome/shell/ui/workspacesView.js';

const _getWorkspacesBoxForState = function (state, box, padding, thumbnailsHeight, spacing) {
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
};

export default class SecondaryMonitorDisplay extends Override {
    enable() {
        const subject = GSecondaryMonitorDisplay.prototype;
        this._im.overrideMethod(subject, '_getWorkspacesBoxForState', (original) => {
            return function () {
                return _getWorkspacesBoxForState.call(this, ...arguments)
            };
        });
    }
}
