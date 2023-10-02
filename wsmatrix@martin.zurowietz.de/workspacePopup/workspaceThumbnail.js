import GObject from 'gi://GObject';
import {BackgroundManager} from 'resource:///org/gnome/shell/ui/background.js';
import {WorkspaceThumbnail as GWorkspaceThumbnail} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

export default let WorkspaceThumbnail = GObject.registerClass(
class WorkspaceThumbnail extends GWorkspaceThumbnail {
    _init(metaWorkspace, monitorIndex) {
        super._init(metaWorkspace, monitorIndex);

        // gnome 40 thumbnails don't show background wallpaper anymore
        this._createBackground();
    }

    _createBackground() {
        this._bgManager = new BackgroundManager({
            monitorIndex: this.monitorIndex,
            container: this._contents,
            vignette: false
        });
    }
});
