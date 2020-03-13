const { Clutter, GObject, St } = imports.gi;
const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const DisplayWrapper = WsMatrix.imports.DisplayWrapper.DisplayWrapper;
const BaseWorkspaceSwitcherPopup = WsMatrix.imports.BaseWorkspaceSwitcherPopup.BaseWorkspaceSwitcherPopup;
const WorkspaceSwitcherPopupList = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopupList;
const WorkspaceThumbnail = WsMatrix.imports.WsmatrixThumbnail.WsmatrixThumbnail;
const Main = imports.ui.main;

var ThumbnailWsmatrixPopupList = GObject.registerClass(
class ThumbnailWsmatrixPopupList extends WorkspaceSwitcherPopupList {
   _init(rows, columns, scale, monitorIndex) {
      super._init();
      this._rows = rows;
      this._columns = columns;
      this._scale = scale;
      this._activeWorkspaceIndex = 0;
      this._monitorIndex = monitorIndex;
   }

   vfunc_get_preferred_height(forWidth) {
      let children = this.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
      let themeNode = this.get_theme_node();
      let spacing = themeNode.get_length('spacing');

      let availHeight = workArea.height - themeNode.get_vertical_padding();

      let height = this._rows * this._scale * children[0].get_height();
      let totalSpacing = spacing * (this._rows - 1);

      height += totalSpacing;
      height = Math.round(Math.min(height, availHeight));

      this._childHeight = Math.round((height - totalSpacing) / this._rows);

      return themeNode.adjust_preferred_height(height, height);
   }

   vfunc_get_preferred_width(forHeight) {
      let children = this.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
      let themeNode = this.get_theme_node();
      let spacing = themeNode.get_length('spacing');

      let availWidth = workArea.width - themeNode.get_horizontal_padding();

      let width = this._columns * this._scale * children[0].get_width();
      let totalSpacing = spacing * (this._columns - 1);

      width += totalSpacing;
      width = Math.round(Math.min(width, availWidth));

      this._childWidth = Math.round((width - totalSpacing) / this._columns);

      return [width, width];
   }

   vfunc_allocate(box, flags) {
      this.set_allocation(box, flags);

      let themeNode = this.get_theme_node();
      box = themeNode.get_content_box(box);
      let spacing = themeNode.get_length('spacing');

      let children = this.get_children();
      let childBox = new Clutter.ActorBox();

      let row = 0;
      let column = 0;
      let itemWidth = this._childWidth + spacing;
      let itemHeight = this._childHeight + spacing;
      let indicator = children.pop();

      let indicatorThemeNode = indicator.get_theme_node();

      let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
      let indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
      let indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
      let indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

      for (let i = 0; i < children.length; i++) {
         row = Math.floor(i / this._columns);
         column = i % this._columns;

         childBox.x1 = Math.round(box.x1 + itemWidth * column);
         childBox.x2 = childBox.x1 + children[i].get_width();
         childBox.y1 = Math.round(box.y1 + itemHeight * row);
         childBox.y2 = childBox.y1 + children[i].get_height();
         children[i].allocate(childBox, flags);

         if (i === this._activeWorkspaceIndex) {
            childBox.x2 = childBox.x1 + this._childWidth + indicatorRightFullBorder;
            childBox.x1 -= indicatorLeftFullBorder;
            childBox.y2 = childBox.y1 + this._childHeight + indicatorBottomFullBorder;
            childBox.y1 -= indicatorTopFullBorder;
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
   _init(rows, columns, scale, popupTimeout, hideOnly, monitorIndex) {
      super._init(popupTimeout);
      this._hideOnly = hideOnly;
      this._monitorIndex = monitorIndex;
      this._workspaceManager = DisplayWrapper.getWorkspaceManager();
      let oldList = this._list;
      this._list = new ThumbnailWsmatrixPopupList(rows, columns, scale, this._monitorIndex);
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
            let thumbnail = new WorkspaceThumbnail(workspace, this._monitorIndex);
            this._list.add_actor(thumbnail);
         }

         // The workspace indicator is always last.
         this._list.add_actor(indicator);

         let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
         let [, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
         let [, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
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

   destroy(force = false) {
      if (this._hideOnly && !force) {
         this.hide();
      } else {
         super.destroy();
      }
   }
});
