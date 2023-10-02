import {overrideProto} from '../util.js'
import {ControlsState, ControlsManagerLayout as GControlsManagerLayout} from 'resource:///org/gnome/shell/ui/overviewControls.js';

//const { SMALL_WORKSPACE_RATIO } = OverviewControls;
const SMALL_WORKSPACE_RATIO = 0.15;

export default class ControlsManagerLayout {
    constructor() {
        this.originalLayout = null;
        this._overrideProperties = {
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
            },
        }
    }

    destroy() {
        this.restoreOriginalProperties();
    }

    overrideOriginalProperties() {
        this.originalLayout = overrideProto(GControlsManagerLayout.prototype, this._overrideProperties);
    }

    restoreOriginalProperties() {
        overrideProto(GControlsManagerLayout.prototype, this.originalLayout);
    }
}
