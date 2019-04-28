const { Clutter, GObject, Meta, St } = imports.gi;
const Main = imports.ui.main;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail.WorkspaceThumbnail;
const ThumbnailState = imports.ui.workspaceThumbnail.ThumbnailState;

class WsmatrixThumbnail extends WorkspaceThumbnail {
    constructor(metaWorkspace, monitorIndex) {
        let tempPrimaryIndex = Main.layoutManager.primaryIndex;
        Main.layoutManager.primaryIndex = monitorIndex;
        super(metaWorkspace);
        Main.layoutManager.primaryIndex = tempPrimaryIndex;
    }
}
