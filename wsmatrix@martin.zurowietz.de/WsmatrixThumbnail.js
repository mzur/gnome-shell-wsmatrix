const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail.WorkspaceThumbnail;

var WsmatrixThumbnail = GObject.registerClass(
class WsmatrixThumbnail extends WorkspaceThumbnail {
    _init(metaWorkspace, monitorIndex) {
        let tempPrimaryIndex = Main.layoutManager.primaryIndex;
        Main.layoutManager.primaryIndex = monitorIndex;
        super._init(metaWorkspace);
        Main.layoutManager.primaryIndex = tempPrimaryIndex;
    }
});
