const DefaultWorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const Meta  = imports.gi.Meta;

var WorkspaceSwitcherPopup = Lang.Class({
   Name: 'WsMatrixWorkspaceSwitcherPopup',
   Extends: DefaultWorkspaceSwitcherPopup.WorkspaceSwitcherPopup,

   _init: function (rows, columns) {
      // Set rows and columns before calling parent().
      this.rows = rows;
      this.columns = columns;
      this.parent();
   },

   _getPreferredHeight(actor, forWidth, alloc) {
      let children = this._list.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

      let availHeight = workArea.height;
      availHeight -= this.actor.get_theme_node().get_vertical_padding();
      availHeight -= this._container.get_theme_node().get_vertical_padding();
      availHeight -= this._list.get_theme_node().get_vertical_padding();

      let height = 0;
      for (let i = 0; i < children.length; i++) {
         let [childMinHeight, childNaturalHeight] = children[i].get_preferred_height(-1);
         // let [childMinWidth, childNaturalWidth] = children[i].get_preferred_width(childNaturalHeight);
         if (i % this.columns === 0) {
            height += childNaturalHeight * workArea.width / workArea.height;
         }
      }

      let spacing = this._itemSpacing * (this.rows - 1);
      height += spacing;
      height = Math.min(height, availHeight);

      this._childHeight = (height - spacing) / this.rows;

      alloc.min_size = height;
      alloc.natural_size = height;
    },

   _getPreferredWidth(actor, forHeight, alloc) {
      let children = this._list.get_children();
      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

      let availWidth = workArea.width;
      availWidth -= this.actor.get_theme_node().get_horizontal_padding();
      availWidth -= this._container.get_theme_node().get_horizontal_padding();
      availWidth -= this._list.get_theme_node().get_horizontal_padding();

      this._childWidth = Math.round(this._childHeight * workArea.width / workArea.height);

      let width = this._childWidth * this.columns;

      let spacing = this._itemSpacing * (this.columns - 1);
      width += spacing;
      width = Math.min(width, availWidth);

      this._childWidth = (width - spacing) / this.columns;

      alloc.min_size = width;
      alloc.natural_size = width;
    },

   _allocate(actor, box, flags) {
      let children = this._list.get_children();
      let childBox = new Clutter.ActorBox();

      let row = 0;
      let column = 0;

      for (let i = 0; i < children.length; i++) {
         row = Math.floor(i / this.columns);
         column = i % this.columns;

         childBox.x1 = box.x1 + this._childWidth * column + this._itemSpacing * column;
         childBox.x2 = childBox.x1 + this._childWidth;
         childBox.y1 = box.y1 + this._childHeight * row + this._itemSpacing * row;
         childBox.y2 = childBox.y1 + this._childHeight;
         children[i].allocate(childBox, flags);
      }
    },

   _redisplay() {
      this._list.destroy_all_children();

      for (let i = 0; i < global.screen.n_workspaces; i++) {
         let indicator = null;

         if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.UP)
            indicator = new St.Bin({ style_class: 'ws-switcher-active-up' });
         else if(i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.DOWN)
            indicator = new St.Bin({ style_class: 'ws-switcher-active-down' });
         else if(i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.LEFT)
            indicator = new St.Bin({ style_class: 'ws-switcher-active-up' });
         else if(i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.RIGHT)
            indicator = new St.Bin({ style_class: 'ws-switcher-active-down' });
         else
            indicator = new St.Bin({ style_class: 'ws-switcher-box' });

         this._list.add_actor(indicator);
      }

      let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
      let [containerMinHeight, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
      let [containerMinWidth, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
      this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) / 2);
      this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) / 2);
   },
});
