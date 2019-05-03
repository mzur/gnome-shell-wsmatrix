const { Clutter, GObject, Meta, St } = imports.gi;
const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const DisplayWrapper = WsMatrix.imports.DisplayWrapper.DisplayWrapper;
const BaseWorkspaceSwitcherPopup = WsMatrix.imports.BaseWorkspaceSwitcherPopup.BaseWorkspaceSwitcherPopup;
const WorkspaceSwitcherPopupList = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopupList;
const Main = imports.ui.main;

var IndicatorWsmatrixPopupList = GObject.registerClass(
class IndicatorWsmatrixPopupList extends WorkspaceSwitcherPopupList {
   _init(rows, columns) {
      super._init();
      this._rows = rows;
      this._columns = columns;
   }

   vfunc_get_preferred_height(forWidth) {
      let children = this.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
      let themeNode = this.get_theme_node();
      if (!children || children.length == 0) {
         return themeNode.adjust_preferred_height(0, 0);
      }

      let availHeight = workArea.height;
      availHeight -= themeNode.get_vertical_padding();

      let height = 0;
      let [, childNaturalHeight] = children[0].get_preferred_height(-1);
      if (children.length > 1) {
         // Workaround for varying values returned for childNaturalHeight.
         // See: https://github.com/mzur/gnome-shell-wsmatrix/pull/20#discussion_r280046613
         let [, childNaturalHeight2] = children[1].get_preferred_height(-1);
         childNaturalHeight = Math.max(childNaturalHeight, childNaturalHeight2);
      }
      height = childNaturalHeight * workArea.width / workArea.height * this._rows;

      let spacing = this._itemSpacing * (this._rows - 1);
      height += spacing;
      height = Math.min(height, availHeight);

      this._childHeight = (height - spacing) / this._rows;

      return themeNode.adjust_preferred_height(height, height);
   }

   vfunc_get_preferred_width(forHeight) {
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
      let themeNode = this.get_theme_node();

      let availWidth = workArea.width;
      availWidth -= themeNode.get_horizontal_padding();

      let width = Math.round(this._childHeight * workArea.width / workArea.height) * this._columns;

      let spacing = this._itemSpacing * (this._columns - 1);
      width += spacing;
      width = Math.min(width, availWidth);

      this._childWidth = (width - spacing) / this._columns;

      return themeNode.adjust_preferred_width(width, width);
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

      for (let i = 0; i < children.length; i++) {
         row = Math.floor(i / this._columns);
         column = i % this._columns;

         childBox.x1 = Math.round(box.x1 + itemWidth * column);
         childBox.x2 = childBox.x1 + this._childWidth;
         childBox.y1 = Math.round(box.y1 + itemHeight * row);
         childBox.y2 = childBox.y1 + this._childHeight;
         children[i].allocate(childBox, flags);
      }
   }
});

var IndicatorWsmatrixPopup = GObject.registerClass(
class IndicatorWsmatrixPopup extends BaseWorkspaceSwitcherPopup {
   _init(rows, columns, popupTimeout, showWorkspaceNames, cacheSwitcher) {
      super._init(popupTimeout, cacheSwitcher);
      this._workspaceManager = DisplayWrapper.getWorkspaceManager();
      this.showWorkspaceNames = showWorkspaceNames;
      let oldList = this._list;
      this._list = new IndicatorWsmatrixPopupList(rows, columns);
      this._container.replace_child(oldList, this._list);
      this._redisplay();
      this.hide();
   }

   _redisplay(rerender=false) {
      let _debugStart = new Date();

      if (!this._cacheSwitcher || rerender || !this._workspaceManager || this._list.get_children().length != this._workspaceManager.n_workspaces) {
         super._redisplay();
         let indicators = this._list.get_children();
         for (let i = 0; i < indicators.length; i++) {
            if (this.showWorkspaceNames) {
               let workspaceName = Meta.prefs_get_workspace_name(i);
               indicators[i].child = new St.Label({
                  text: workspaceName,
                  style_class: "ws-switcher-label"
               });
            }
            if (i === this._activeWorkspaceIndex && (this._direction == Meta.MotionDirection.UP || this._direction == Meta.MotionDirection.LEFT)) {
               indicators[i].style_class = 'wsmatrix ws-switcher-active-up';
            } else if (i === this._activeWorkspaceIndex && (this._direction == Meta.MotionDirection.DOWN || this._direction == Meta.MotionDirection.RIGHT)) {
               indicators[i].style_class = 'wsmatrix ws-switcher-active-down';
            }
         }
      } else {
         // Update active workspace in switcher
         let indicators = this._list.get_children();
         for (let i = 0; i < indicators.length; i++) {
            if (i === this._activeWorkspaceIndex && (this._direction == Meta.MotionDirection.UP || this._direction == Meta.MotionDirection.LEFT)) {
               indicators[i].style_class = 'wsmatrix ws-switcher-active-up';
            } else if (i === this._activeWorkspaceIndex && (this._direction == Meta.MotionDirection.DOWN || this._direction == Meta.MotionDirection.RIGHT)) {
               indicators[i].style_class = 'wsmatrix ws-switcher-active-down';
            } else {
               indicators[i].style_class = 'ws-switcher-box';
            }
         }
      }

      log("time taken to display switcher " + (new Date() - _debugStart) + " ms");
   }
});
