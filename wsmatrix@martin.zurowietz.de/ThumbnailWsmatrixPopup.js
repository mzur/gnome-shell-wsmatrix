const { Clutter, GObject, St } = imports.gi;
const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const DisplayWrapper = WsMatrix.imports.DisplayWrapper.DisplayWrapper;
const BaseWorkspaceSwitcherPopup = WsMatrix.imports.BaseWorkspaceSwitcherPopup.BaseWorkspaceSwitcherPopup;
const WorkspaceSwitcherPopupList = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopupList;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Main = imports.ui.main;

var ThumbnailWsmatrixPopupList = GObject.registerClass(
class ThumbnailWsmatrixPopupList extends WorkspaceSwitcherPopupList {
   _init(rows, columns, scale) {
      super._init();
      this._rows = rows;
      this._columns = columns;
      this._scale = scale;
      this._activeWorkspaceIndex = 0;
   }

   vfunc_get_preferred_height(forWidth) {
      let children = this.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
      let themeNode = this.get_theme_node();

      let availHeight = workArea.height;
      availHeight -= themeNode.get_vertical_padding();

      let height = this._rows * this._scale * children[0].get_height();
      let spacing = this._itemSpacing * (this._rows - 1);

      height += spacing;
      height = Math.round(Math.min(height, availHeight));

      this._childHeight = Math.round((height - spacing) / this._rows);

      return themeNode.adjust_preferred_height(height, height);
   }

   vfunc_get_preferred_width(forHeight) {
      let children = this.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
      let themeNode = this.get_theme_node();

      let availWidth = workArea.width;
      availWidth -= themeNode.get_horizontal_padding();

      let width = this._columns * this._scale * children[0].get_width();
      let spacing = this._itemSpacing * (this._columns - 1);

      width += spacing;
      width = Math.round(Math.min(width, availWidth));

      this._childWidth = Math.round((width - spacing) / this._columns);

      return themeNode.adjust_preferred_height(width, width);
   }

   vfunc_allocate(box, flags) {
      this.set_allocation(box, flags);

      let themeNode = this.get_theme_node();
      box = themeNode.get_content_box(box);

      let children = this.get_children();
      let childBox = new Clutter.ActorBox();

      let row = 0;
      let column = 0;
      let itemWidth = this._childWidth + this._itemSpacing;
      let itemHeight = this._childHeight + this._itemSpacing;
      let indicatorOffset = Math.round(this._itemSpacing / 2);
      let indicator = children.pop();

      for (let i = 0; i < children.length; i++) {
         row = Math.floor(i / this._columns);
         column = i % this._columns;

         childBox.x1 = Math.round(box.x1 + itemWidth * column);
         childBox.x2 = childBox.x1 + children[i].get_width();
         childBox.y1 = Math.round(box.y1 + itemHeight * row);
         childBox.y2 = childBox.y1 + children[i].get_height();
         children[i].allocate(childBox, flags);

         if (i === this._activeWorkspaceIndex) {
            childBox.x1 -= indicatorOffset;
            childBox.x2 = childBox.x1 + this._childWidth + indicatorOffset * 2;
            childBox.y1 -= indicatorOffset;
            childBox.y2 = childBox.y1 + this._childHeight + indicatorOffset * 2;
            indicator.allocate(childBox, flags);
         }
      }
   }

   getChildWidth() {
      return this._childWidth;
   }

   getChildHeight() {
      return this._childHeight;
   }

   setActiveWorkspaceIndex(index) {
      this._activeWorkspaceIndex = index;
   }
});

var ThumbnailWsmatrixPopup = GObject.registerClass(
class ThumbnailWsmatrixPopup extends BaseWorkspaceSwitcherPopup {
   _init(rows, columns, scale, popupTimeout) {
      super._init(popupTimeout);
      this._workspaceManager = DisplayWrapper.getWorkspaceManager();
      let oldList = this._list;
      this._list = new ThumbnailWsmatrixPopupList(rows, columns, scale);
      this._container.replace_child(oldList, this._list);
      this._redisplay();
      this.hide();

      // Fix popup jump issue (https://github.com/mzur/gnome-shell-wsmatrix/issues/14).
      this.connect('style-changed', () => {
         this._redisplay();
      });
   }

   _redisplay() {
      if (!(this._list instanceof ThumbnailWsmatrixPopupList)) {
         return;
      }

      let nThumbnails = this._list.get_n_children() - 1;
      let indicator = new St.Bin({style_class: 'workspace-thumbnail-indicator'});

      if (this._activeWorkspaceIndex !== undefined) {
         this._list.setActiveWorkspaceIndex(this._activeWorkspaceIndex);
      }

      if (nThumbnails !== this._workspaceManager.n_workspaces) {
         this._list.destroy_all_children();

         for (let i = 0; i < this._workspaceManager.n_workspaces; i++) {
            let workspace = this._workspaceManager.get_workspace_by_index(i);
            let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(workspace);
            this._list.add_actor(thumbnail.actor);
         }

         // The workspace indicator is always last.
         this._list.add_actor(indicator);

         let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
         let [containerMinHeight, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
         let [containerMinWidth, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
         this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) / 2);
         this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) / 2);

      } else {
         this._list.replace_child(this._list.get_last_child(), indicator);
      }

      for (let i = 0; i < nThumbnails; i++) {
         let actor = this._list.get_child_at_index(i);
         let hScale = this._list.getChildWidth() / actor.get_width();
         let vScale = this._list.getChildHeight() / actor.get_height();
         actor.set_scale(hScale, vScale);
      }
   }
});
