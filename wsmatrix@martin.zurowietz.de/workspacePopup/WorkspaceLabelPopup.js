const { Clutter, GObject, Meta, St } = imports.gi;
const Self = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceSwitcherPopupBase = Self.imports.workspacePopup.WorkspaceSwitcherPopupBase.WorkspaceSwitcherPopupBase;
const WorkspaceSwitcherPopupList = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopupList;
const Main = imports.ui.main;

var WorkspaceLabelPopupList = GObject.registerClass(
class WorkspaceLabelPopupList extends WorkspaceSwitcherPopupList {
   _init(rows, columns, monitorIndex) {
      super._init();
      this._rows = rows;
      this._columns = columns;
      this._monitorIndex = monitorIndex;
   }

   _getPreferredSizeForOrientation(_forSize) {
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
      let themeNode = this.get_theme_node();

      let availSize;
      if (this._orientation == Clutter.Orientation.HORIZONTAL)
         availSize = workArea.width - themeNode.get_horizontal_padding();
      else
         availSize = workArea.height - themeNode.get_vertical_padding();

      let size = 0;
      for (let child of this.get_children()) {
         let [, childNaturalHeight] = child.get_preferred_height(-1);
         let height = childNaturalHeight * workArea.width / workArea.height;

         if (this._orientation == Clutter.Orientation.HORIZONTAL)
            size += height * workArea.width / workArea.height;
         else
            size += height;
      }

      let workspaceManager = global.workspace_manager;
      let spacing = this._itemSpacing * (workspaceManager.n_workspaces - 1);
      size += spacing;
      size = Math.min(size, availSize);

      if (this._orientation == Clutter.Orientation.HORIZONTAL) {
         this._childWidth = (size - spacing) / workspaceManager.n_workspaces;
         return themeNode.adjust_preferred_width(size, size);
      } else {
         this._childHeight = (size - spacing) / workspaceManager.n_workspaces;
         return themeNode.adjust_preferred_height(size, size);
      }
   }

   _getSizeForOppositeOrientation() {
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

      if (this._orientation == Clutter.Orientation.HORIZONTAL) {
         this._childHeight = Math.round(this._childWidth * workArea.height / workArea.width);
         return [this._childHeight, this._childHeight];
      } else {
         this._childWidth = Math.round(this._childHeight * workArea.width / workArea.height);
         return [this._childWidth, this._childWidth];
      }
   }

   vfunc_get_preferred_height(forWidth) {
      let children = this.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
      let themeNode = this.get_theme_node();

      let availHeight = workArea.height - themeNode.get_vertical_padding();

      let height = 0;
      let childNaturalHeight = 0;
      // Workaround for varying values returned for childNaturalHeight.
      // See: https://github.com/mzur/gnome-shell-wsmatrix/pull/20#discussion_r280046613
      for (let child of this.get_children()) {
         if (child.style_class === 'ws-switcher-box') {
            [, childNaturalHeight] = child.get_preferred_height(-1);
            break;
         }
      }
      height = childNaturalHeight * workArea.width / workArea.height * this._rows;

      let spacing = this._itemSpacing * (this._rows - 1);
      height += spacing;
      height = Math.min(height, availHeight);

      this._childHeight = (height - spacing) / this._rows;

      return themeNode.adjust_preferred_height(height, height);
   }

   vfunc_get_preferred_width(forHeight) {
      let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
      let themeNode = this.get_theme_node();

      let availWidth = workArea.width - themeNode.get_horizontal_padding();

      let width = Math.round(this._childHeight * workArea.width / workArea.height) * this._columns;

      let spacing = this._itemSpacing * (this._columns - 1);
      width += spacing;
      width = Math.min(width, availWidth);

      this._childWidth = (width - spacing) / this._columns;

      return [width, width];
   }

   vfunc_allocate(box) {
      this.set_allocation(box);

      let themeNode = this.get_theme_node();
      box = themeNode.get_content_box(box);

      let children = this.get_children();
      let childBox = new Clutter.ActorBox();

      let row = 0;
      let column = 0;
      let rtl = this.text_direction == Clutter.TextDirection.RTL;
      let x = rtl ? box.x2 - this._childWidth : box.x1;
      let y = box.y1;
      let itemWidth = this._childWidth + this._itemSpacing;
      let itemHeight = this._childHeight + this._itemSpacing;

      for (let i = 0; i < children.length; i++) {
         childBox.x1 = Math.round(box.x1 + itemWidth * column);
         childBox.x2 = childBox.x1 + this._childWidth;
         childBox.y1 = Math.round(box.y1 + itemHeight * row);
         childBox.y2 = childBox.y1 + this._childHeight;

         if (this._orientation == Clutter.Orientation.HORIZONTAL) {
            if (rtl)
               x -= this._childWidth + this._itemSpacing;
            else
               x += this._childWidth + this._itemSpacing;
         } else {
            y += this._childHeight + this._itemSpacing;
         }
         children[i].allocate(childBox);
      }
   }
});

var WorkspaceLabelPopup = GObject.registerClass(
class WorkspaceLabelPopup extends WorkspaceSwitcherPopupBase {
   _init(rows, columns, popupTimeout, showWorkspaceNames, hideOnly, monitorIndex) {
      this._monitorIndex = monitorIndex;
      this._hideOnly = hideOnly;
      super._init(popupTimeout);
      this.showWorkspaceNames = showWorkspaceNames;
      let oldList = this._list;
      this._list = new WorkspaceLabelPopupList(rows, columns, this._monitorIndex);
      this._container.replace_child(oldList, this._list);
      this._redisplay();
      this.hide();

      // Fix popup jump issue (https://github.com/mzur/gnome-shell-wsmatrix/issues/14).
      this.connect('style-changed', () => {
         this._redisplay();
      });
   }

   _redisplay() {
      if (!(this._list instanceof WorkspaceLabelPopupList)) {
         return;
      }

      super._redisplay();

      let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
      let [, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
      let [, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
      this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) / 2);
      this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) / 2);

      if (this.showWorkspaceNames) {
         this._list.get_children().forEach(function (indicator, index) {
            indicator.child = new St.Label({
               text: Meta.prefs_get_workspace_name(index),
               style_class: "ws-switcher-label"
            });
         });
      }
   }

   destroy(force = false) {
      if (this._hideOnly && !force) {
         this.hide();
      } else {
         super.destroy();
      }
   }
});
