const {GObject} = imports.gi;
const Self = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceSwitcherPopupBase = Self.imports.workspacePopup.WorkspaceSwitcherPopupBase;
const WorkspaceThumbnail = Self.imports.workspacePopup.workspaceThumbnail;

var WorkspaceThumbnailPopupList = GObject.registerClass(
   class WorkspaceThumbnailPopupList extends WorkspaceSwitcherPopupBase.WorkspaceSwitcherPopupListBase {
      _init(thumbnails, monitorIndex, rows, columns, scale) {
         super._init(rows, columns, scale);
         this._monitorIndex = monitorIndex;

         for (let i = 0; i < thumbnails.length; i++)
            this._addThumbnail(thumbnails[i]);
      }

      _addThumbnail(thumbnail) {
         // thumbnails can be customized further here to display more information like labels
         this.addItem(thumbnail, null);
      }
   });

var WorkspaceThumbnailPopup = GObject.registerClass(
   class WorkspaceThumbnailPopup extends WorkspaceSwitcherPopupBase.WorkspaceSwitcherPopupBase {
      _init(rows, columns, scale, popupTimeout, monitorIndex, wraparoundMode) {
         super._init(null, rows, columns, scale, monitorIndex, wraparoundMode);
         this._items = this._createThumbnails();
         this._switcherList = new WorkspaceThumbnailPopupList(this._items, monitorIndex, rows, columns, scale);
      }

      _createThumbnails() {
         let thumbnails = [];
         let workspaceManager = global.workspace_manager;

         for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            let workspace = workspaceManager.get_workspace_by_index(i);
            let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(workspace, this._monitorIndex)
            thumbnails.push(thumbnail);
         }

         return thumbnails;
      }
   });
