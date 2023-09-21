import * as GWorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';

import GObject from 'gi://GObject';

var WorkspaceThumbnail = GObject.registerClass(
class WorkspaceThumbnail extends GWorkspaceThumbnail.WorkspaceThumbnail {
    _init(metaWorkspace, monitorIndex) {
        super._init(metaWorkspace, monitorIndex);

        // gnome 40 thumbnails don't show background wallpaper anymore
        this._createBackground();
    }

    _createBackground() {
        this._bgManager = new Background.BackgroundManager({
            monitorIndex: this.monitorIndex,
            container: this._contents,
            vignette: false
        });
    }
});
