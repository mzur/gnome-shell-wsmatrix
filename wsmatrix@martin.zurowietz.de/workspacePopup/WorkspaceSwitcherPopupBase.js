const {Clutter, GObject, Meta, St} = imports.gi;
const SwitcherPopup = imports.ui.switcherPopup;
const Main = imports.ui.main;

const WraparoundMode = {
   NONE: 0,
   NEXT_PREV: 1,
   ROW_COL: 2,
};

var modals = [];

var WorkspaceSwitcherPopupBase = GObject.registerClass(
   class WorkspaceSwitcherPopupBase extends SwitcherPopup.SwitcherPopup {
      _init(items, rows, columns, scale, monitorIndex) {
         super._init(items);
         this._monitorIndex = monitorIndex;
         this._monitor = Main.layoutManager.monitors[this._monitorIndex];
         this._rows = rows;
         this._columns = columns;
         this._scale = scale;
         print("created workspace switcher " + this._rows + ", " + this._columns);
      }

      _initialSelection(backward, _binding) {
         let workspaceManager = global.workspace_manager;
         this._switcherList.highlight(workspaceManager.get_active_workspace_index());
      }

      // handling key presses while the switcher popup is displayed
      _keyPressHandler(keysym, action) {
         let wm = Main.wm;

         // default keybindings with arrows
         if (action == Meta.KeyBindingAction.WORKSPACE_LEFT || keysym == Clutter.KEY_Left)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByDirection(Meta.MotionDirection.LEFT));
         else if (action == Meta.KeyBindingAction.WORKSPACE_RIGHT || keysym == Clutter.KEY_Right)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByDirection(Meta.MotionDirection.RIGHT));
         else if (action == Meta.KeyBindingAction.WORKSPACE_UP || keysym == Clutter.KEY_Up)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByDirection(Meta.MotionDirection.UP));
         else if (action == Meta.KeyBindingAction.WORKSPACE_DOWN || keysym == Clutter.KEY_Down)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByDirection(Meta.MotionDirection.DOWN));

         // default keybindings with keypads
         else if (keysym == Clutter.KEY_KP_7)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(0, 0));
         else if (keysym == Clutter.KEY_KP_8)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(0, 1));
         else if (keysym == Clutter.KEY_KP_9)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(0, 2));
         else if (keysym == Clutter.KEY_KP_4)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(1, 0));
         else if (keysym == Clutter.KEY_KP_5)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(1, 1));
         else if (keysym == Clutter.KEY_KP_6)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(1, 2));
         else if (keysym == Clutter.KEY_KP_1)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(2, 0));
         else if (keysym == Clutter.KEY_KP_2)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(2, 1));
         else if (keysym == Clutter.KEY_KP_3)
            wm.actionMoveWorkspace(this.getTargetWorkspaceByLocation(2, 2));
         // todo: maybe add more keybindings from preferences here, and make both arrows and keypads default configs but not hardcoded
         else
            return Clutter.EVENT_PROPAGATE;

         return Clutter.EVENT_STOP;
      }

      show(backward, binding, mask) {
         super.show(backward, binding, mask);
         modals.push(this);
      }

      _finish(_timestamp) {
         while (modals.length > 0) {
            modals.pop().fadeAndDestroy();
         }
      }

      // on workspace selected (in switcher popup)
      _select(num) {
         this.selectedIndex = num;
         this._switcherList.highlight(num);

         // on item selected, switch/move to the workspace
         let workspaceManager = global.workspace_manager;
         let wm = Main.wm;
         let newWs = workspaceManager.get_workspace_by_index(this.selectedIndex);
         wm.actionMoveWorkspace(newWs);
      }

      getTargetWorkspaceByDirection(direction) {
         let workspaceManager = global.workspace_manager;
         let currentIndex = workspaceManager.get_active_workspace_index();
         let newIndex = workspaceManager.get_active_workspace().get_neighbor(direction).index();

         if (this.wraparoundMode !== WraparoundMode.NONE && currentIndex === newIndex) {
            // given a direction input, if the workspace has not changed, then check wraparound mode.
            let targetRow = Math.floor(currentIndex / this._columns);
            let targetColumn = currentIndex % this._columns;

            let offset = 0;
            if (direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.LEFT) {
               offset = -1;
            } else if (direction === Meta.MotionDirection.DOWN || direction === Meta.MotionDirection.RIGHT) {
               offset = 1;
            }

            if (this.wraparoundMode === WraparoundMode.NEXT_PREV) {
               targetRow += offset;
               targetColumn += offset;
            } else if (this.wraparoundMode === WraparoundMode.ROW_COL) {
               if (direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.DOWN) {
                  targetRow += offset;
               } else if (direction === Meta.MotionDirection.LEFT || direction === Meta.MotionDirection.RIGHT) {
                  targetColumn += offset;
               }
            }

            // Handle negative targets with mod
            targetColumn = (targetColumn + this._columns) % this._columns;
            targetRow = (targetRow + this._rows) % this._rows;
            newIndex = targetRow * this._columns + targetColumn;
         }

         return workspaceManager.get_workspace_by_index(newIndex);
      }

      getTargetWorkspaceByLocation(row, column) {
         let workspaceManager = global.workspace_manager;

         // return current index if the target workspace is out of index
         if (row >= this._rows || column >= this._columns)
            return workspaceManager.get_active_workspace_index()

         return workspaceManager.get_workspace_by_index(row * this._columns + column);
      }

      vfunc_allocate(box) {
         this.set_allocation(box);
         let childBox = new Clutter.ActorBox();

         let leftPadding = this.get_theme_node().get_padding(St.Side.LEFT);
         let rightPadding = this.get_theme_node().get_padding(St.Side.RIGHT);
         let hPadding = leftPadding + rightPadding;

         // Allocate the switcherList
         // We select a size based on an icon size that does not overflow the screen
         let [, childNaturalHeight] = this._switcherList.get_preferred_height(this._monitor.width - hPadding);
         let [, childNaturalWidth] = this._switcherList.get_preferred_width(childNaturalHeight);
         childBox.x1 = Math.max(this._monitor.x + leftPadding, this._monitor.x + Math.floor((this._monitor.width - childNaturalWidth) / 2));
         childBox.x2 = Math.min(this._monitor.x + this._monitor.width - rightPadding, childBox.x1 + childNaturalWidth);
         childBox.y1 = this._monitor.y + Math.floor((this._monitor.height - childNaturalHeight) / 2);
         childBox.y2 = childBox.y1 + childNaturalHeight;
         this._switcherList.allocate(childBox);
      }
   });

var SwitcherButton = GObject.registerClass(
   class SwitcherButton extends St.Button {
      _init(width, height) {
         super._init({style_class: 'item-box', reactive: true});
         this._width = width;
         this._height = height;
      }

      setSize(width, height) {
         this._width = width;
         this._height = height;
      }

      vfunc_get_preferred_width(forHeight) {
         return [this._width, this._width];
      }

      vfunc_get_preferred_height(forWidth) {
         return [this._height, this._height];
      }
   });

var WorkspaceSwitcherPopupListBase = GObject.registerClass({
   Signals: {
      'item-activated': {param_types: [GObject.TYPE_INT]},
      'item-entered': {param_types: [GObject.TYPE_INT]},
      'item-removed': {param_types: [GObject.TYPE_INT]}
   },
}, class WorkspaceSwitcherPopupListBase extends St.BoxLayout {
   _init(rows, columns, scale) {
      super._init({style_class: 'switcher-list', vertical: true});
      this._lists = [];
      this._rows = rows;
      this._columns = columns;
      this._scale = scale;

      for (let i = 0; i < this._rows; i++) {
         let workspacesRow = new St.BoxLayout({
            style_class: 'switcher-list-item-container',
         });

         workspacesRow.spacing = 0;
         workspacesRow.connect('style-changed', () => {
            workspacesRow.spacing = workspacesRow.get_theme_node().get_length('spacing');
            this.redisplay();
         });

         this.add_actor(workspacesRow);
         this._lists.push(workspacesRow);
      }

      this._items = [];

      let workspaceManager = global.workspace_manager;
      this._activeWorkspaceChangedId =
         workspaceManager.connect('active-workspace-changed',
            () => this.highlight(workspaceManager.get_active_workspace_index()));
   }

   addItem(thumbnail, label) {
      // create a switcher thumbnail button and add a thumbnail in it
      let list = this._lists[Math.floor(this._items.length / this._columns)];
      let bbox = new SwitcherButton(this._childWidth, this._childHeight);
      bbox.set_child(thumbnail);
      list.add_actor(bbox);

      bbox.connect('clicked', () => this._onItemClicked(bbox));
      bbox.connect('motion-event', () => this._onItemEnter(bbox));

      bbox.label_actor = label;
      this._items.push(bbox);
      return bbox;
   }

   // update width/height on spacing update
   redisplay() {
      // workaround to update width and height values
      this.vfunc_get_preferred_height();
      this.vfunc_get_preferred_width();

      for (let i = 0; i < this._items.length; i++) {
         let bbox = this._items[i];
         let thumbnail = bbox.get_child();
         bbox.setSize(this._childWidth, this._childHeight);

         let leftPadding = this.get_theme_node().get_padding(St.Side.LEFT);
         let rightPadding = this.get_theme_node().get_padding(St.Side.RIGHT);
         let topPadding = this.get_theme_node().get_padding(St.Side.TOP);
         let bottomPadding = this.get_theme_node().get_padding(St.Side.BOTTOM);
         let spacing = bbox.get_theme_node().get_length('spacing');

         thumbnail.setScale((bbox.get_width() - leftPadding - rightPadding) / thumbnail.get_width(), (bbox.get_height() - topPadding - bottomPadding) / thumbnail.get_height());
      }

      let workspaceManager = global.workspace_manager;
      this.highlight(workspaceManager.get_active_workspace_index());
   }

   _onItemClicked(item) {
      this._itemActivated(this._items.indexOf(item));
   }

   _onItemEnter(item) {
      // Avoid reentrancy
      if (item !== this._items[this._highlighted])
         this._itemEntered(this._items.indexOf(item));

      return Clutter.EVENT_PROPAGATE;
   }

   highlight(index, justOutline) {
      if (this._items[this._highlighted]) {
         this._items[this._highlighted].remove_style_pseudo_class('outlined');
         this._items[this._highlighted].remove_style_pseudo_class('selected');
      }

      if (this._items[index]) {
         if (justOutline)
            this._items[index].add_style_pseudo_class('outlined');
         else
            this._items[index].add_style_pseudo_class('selected');
      }

      this._highlighted = index;
   }

   _itemActivated(n) {
      this.emit('item-activated', n);
   }

   _itemEntered(n) {
      this.emit('item-entered', n);
   }

   vfunc_get_preferred_height(forWidth) {
      let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
      this._height = this._scale * workArea.height;
      this._childHeight = this._height / this._rows - this._lists[0].spacing;
      return [this._height, this._height];
   }

   vfunc_get_preferred_width(forHeight) {
      let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
      this._width = this._scale * workArea.width;
      this._childWidth = this._width / this._columns - this._lists[0].spacing;
      return [this._width, this._width];
   }

   destroy() {
      super.destroy();
      if (this._activeWorkspaceChangedId > 0) {
         let workspaceManager = global.workspace_manager;

         workspaceManager.disconnect(this._activeWorkspaceChangedId);
         this._activeWorkspaceChangedId = 0;
      }
   }
});
