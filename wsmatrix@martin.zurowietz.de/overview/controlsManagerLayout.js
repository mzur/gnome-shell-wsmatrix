import Override from '../Override.js';
import {overview} from 'resource:///org/gnome/shell/ui/main.js';
// TODO: export SMALL_WORKSPACE_RATIO
import {SMALL_WORKSPACE_RATIO, ControlsState} from 'resource:///org/gnome/shell/ui/overviewControls.js';

export default class ControlsManagerLayout extends Override {
    enable() {
        let subject = overview._overview._controls.layout_manager;
        this._im.overrideMethod(subject, '_computeWorkspacesBoxForState', (original) => {
            return this._computeWorkspacesBoxForState.bind(subject);
        });
    }

    _computeWorkspacesBoxForState() {
        let state, box, workAreaBox, searchHeight, dashHeight, thumbnailsHeight;
        if (arguments.length === 5) {
            [state, box, searchHeight, dashHeight, thumbnailsHeight] = arguments;
            workAreaBox = this._workAreaBox;
        } else {
            [state, box, workAreaBox, searchHeight, dashHeight, thumbnailsHeight] = arguments;
        }

        const workspaceBox = box.copy();
        const [width, height] = workspaceBox.get_size();
        const { y1: startY } = workAreaBox;
        const {spacing} = this;
        const {expandFraction} = this._workspacesThumbnails;
        let workspaceManager = global.workspace_manager;
        let rows = workspaceManager.layout_rows;

        switch (state) {
            case ControlsState.HIDDEN:
                workspaceBox.set_origin(...workAreaBox.get_origin());
                workspaceBox.set_size(...workAreaBox.get_size());
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
}
