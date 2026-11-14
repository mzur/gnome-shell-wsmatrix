import GObject from 'gi://GObject';
import {BackgroundManager} from 'resource:///org/gnome/shell/ui/background.js';
import {WorkspaceThumbnail as GWorkspaceThumbnail} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

export default GObject.registerClass(
class WorkspaceThumbnail extends GWorkspaceThumbnail {
    _init(metaWorkspace, monitorIndex) {
        super._init(metaWorkspace, monitorIndex);

        // gnome 40 thumbnails don't show background wallpaper anymore
        this._createBackground();
    }

    // A click on a window preview activates the thumbnail. The popup sets
    // onActivate to handle that like a click on its cell; the Activities
    // overview keeps the stock behaviour.
    activate(time) {
        if (this.onActivate)
            this.onActivate();
        else
            super.activate(time);
    }

    _createBackground() {
        this._bgManager = new BackgroundManager({
            monitorIndex: this.monitorIndex,
            container: this._contents,
            vignette: false
        });
    }
});
