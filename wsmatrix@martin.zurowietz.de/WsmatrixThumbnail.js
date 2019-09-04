const Main = imports.ui.main;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail.WorkspaceThumbnail;

var WsmatrixThumbnail = class WsmatrixThumbnail extends WorkspaceThumbnail {
    constructor(metaWorkspace, monitorIndex) {
        let tempPrimaryIndex = Main.layoutManager.primaryIndex;
        Main.layoutManager.primaryIndex = monitorIndex;
        super(metaWorkspace);
        Main.layoutManager.primaryIndex = tempPrimaryIndex;
    }
}
