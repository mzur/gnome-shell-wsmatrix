const { Clutter, GLib, GObject, Meta, St } = imports.gi;
const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const DisplayWrapper = WsMatrix.imports.DisplayWrapper.DisplayWrapper;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopup;
const WorkspaceSwitcherPopupList = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopupList;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

var WsmatrixPopupList = GObject.registerClass(
class WsmatrixPopupList extends WorkspaceSwitcherPopupList {
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

var WsmatrixPopup = GObject.registerClass(
class WsmatrixPopup extends WorkspaceSwitcherPopup {
   _init(rows, columns, scale, popupTimeout, showThumbnails) {
      super._init();
      this._popupTimeout = popupTimeout;
      this._showThumbnails = showThumbnails;
      this._workspaceManager = DisplayWrapper.getWorkspaceManager();
      let oldList = this._list;
      this._list = new WsmatrixPopupList(rows, columns, scale);
      this._container.replace_child(oldList, this._list);
      this._redisplay();
      this.hide();

      // Fix popup jump issue (https://github.com/mzur/gnome-shell-wsmatrix/issues/14).
      this.connect('style-changed', () => {
         this._redisplay();
      });
   }

   _redisplay() {
      if (!(this._list instanceof WsmatrixPopupList)) {
         return;
      }

      this._list.destroy_all_children();
      if (this._activeWorkspaceIndex !== undefined) {
         this._list.setActiveWorkspaceIndex(this._activeWorkspaceIndex);
      }

      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
      for (let i = 0; i < this._workspaceManager.n_workspaces; i++) {
         if (this._showThumbnails) {
            let workspace = this._workspaceManager.get_workspace_by_index(i);
            let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(workspace);
            let hScale = this._list.getChildWidth() / thumbnail.actor.get_width();
            let vScale = this._list.getChildHeight() / thumbnail.actor.get_height();
            thumbnail.actor.set_scale(hScale, vScale);
            this._list.add_actor(thumbnail.actor);
         } else {
            let workspaceName = Meta.prefs_get_workspace_name(i);
            let indicator = new St.Bin({
               style_class: "ws-switcher-box",
               width: workArea.width,
               height: workArea.height
            });
            indicator.child = new St.Label({
               text: workspaceName,
               style_class: "ws-switcher-label"
            });

            let hScale = this._list.getChildWidth() / indicator.get_width();
            let vScale = this._list.getChildHeight() / indicator.get_height();
            indicator.set_scale(hScale, vScale);
            this._list.add_actor(indicator);
         }
      }

      // The workspace indicator is always last.
      this._list.add_actor(new St.Bin({style_class: 'workspace-thumbnail-indicator'}));

      let [containerMinHeight, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
      let [containerMinWidth, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
      this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) / 2);
      this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) / 2);
   }

   display(direction, activeWorkspaceIndex) {
      super.display(direction, activeWorkspaceIndex);

      Mainloop.source_remove(this._timeoutId);
      this._timeoutId = Mainloop.timeout_add(this._popupTimeout, this._onTimeout.bind(this));
      GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');
   }
});
