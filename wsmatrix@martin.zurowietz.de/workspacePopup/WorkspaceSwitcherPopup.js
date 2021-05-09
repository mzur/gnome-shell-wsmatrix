const {Clutter, GLib, GObject, Meta, St} = imports.gi;
const SwitcherPopup = imports.ui.switcherPopup;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceThumbnail = Self.imports.workspacePopup.workspaceThumbnail;
const WorkspaceSwitcherPopupList = Self.imports.workspacePopup.WorkspaceSwitcherPopupList;

const WraparoundMode = {
   NONE: 0,
   NEXT_PREV: 1,
   ROW_COL: 2,
   NEXT_PREV_BORDER: 3,
};

var modals = [];

var WorkspaceSwitcherPopup = GObject.registerClass(
   class WorkspaceSwitcherPopup extends SwitcherPopup.SwitcherPopup {
      _init(rows, columns, scale, monitorIndex, wraparoundMode, showThumbnails, showWorkspaceName, popupTimeout) {
         super._init();
         this._monitorIndex = monitorIndex;
         this._monitor = Main.layoutManager.monitors[this._monitorIndex];
         this._rows = rows;
         this._columns = columns;
         this._scale = scale;
         this._wraparoundMode = wraparoundMode;
         this._moveWindows = false;
         this._popupTimeout = popupTimeout;
         this._items = this._createThumbnails();
         this._switcherList = new WorkspaceSwitcherPopupList.WorkspaceSwitcherPopupList(this._items, this._createLabels(),
            rows, columns, scale, showThumbnails, showWorkspaceName);

         // Initially disable hover so we ignore the enter-event if
         // the switcher appears underneath the current pointer location
         this._disableHover();
      }

      _initialSelection(backward, _binding) {
         let workspaceManager = global.workspace_manager;
         this._switcherList.highlight(workspaceManager.get_active_workspace_index());
      }

      // handling key presses while the switcher popup is displayed
      _keyPressHandler(keysym, action) {
         let wm = Main.wm;
         let target = null;

         if (keysym == Clutter.KEY_Shift_L)
            this._moveWindows = true;

         // default keybindings with arrows
         if (keysym == Clutter.KEY_Left)
            target = this.getTargetWorkspaceByDirection(Meta.MotionDirection.LEFT);
         else if (keysym == Clutter.KEY_Right)
            target = this.getTargetWorkspaceByDirection(Meta.MotionDirection.RIGHT);
         else if (keysym == Clutter.KEY_Up)
            target = this.getTargetWorkspaceByDirection(Meta.MotionDirection.UP);
         else if (keysym == Clutter.KEY_Down)
            target = this.getTargetWorkspaceByDirection(Meta.MotionDirection.DOWN);

         // default keybindings with keypads
         else if (keysym == Clutter.KEY_KP_7)
            target = this.getTargetWorkspaceByLocation(0, 0);
         else if (keysym == Clutter.KEY_KP_8)
            target = this.getTargetWorkspaceByLocation(0, 1);
         else if (keysym == Clutter.KEY_KP_9)
            target = this.getTargetWorkspaceByLocation(0, 2);
         else if (keysym == Clutter.KEY_KP_4)
            target = this.getTargetWorkspaceByLocation(1, 0);
         else if (keysym == Clutter.KEY_KP_5)
            target = this.getTargetWorkspaceByLocation(1, 1);
         else if (keysym == Clutter.KEY_KP_6)
            target = this.getTargetWorkspaceByLocation(1, 2);
         else if (keysym == Clutter.KEY_KP_1)
            target = this.getTargetWorkspaceByLocation(2, 0);
         else if (keysym == Clutter.KEY_KP_2)
            target = this.getTargetWorkspaceByLocation(2, 1);
         else if (keysym == Clutter.KEY_KP_3)
            target = this.getTargetWorkspaceByLocation(2, 2);
         // todo: maybe add more keybindings from preferences here, and make both arrows and keypads default configs but not hardcoded
         else
            return Clutter.EVENT_PROPAGATE;

         if (target != null) {
            if (this._noModsTimeoutId != 0)
               GLib.source_remove(this._noModsTimeoutId);

            if (this._popupTimeout > 0)
               this._noModsTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._popupTimeout, this._finish.bind(this));

            let focusWindow = global.display.focus_window;
            if (this._moveWindows)
               wm.actionMoveWindow(focusWindow, target);
            else
               wm.actionMoveWorkspace(target);
         }

         return Clutter.EVENT_STOP;
      }

      vfunc_key_release_event(keyEvent) {
         let keysym = keyEvent.keyval;
         if (keysym == Clutter.KEY_Shift_L)
            this._moveWindows = false;

         super.vfunc_key_release_event(keyEvent);
      }

      show(backward, binding, mask) {
         if (this._noModsTimeoutId != 0)
            GLib.source_remove(this._noModsTimeoutId);

         if (this._popupTimeout > 0) {
            super.show(backward, binding, 0);
         } else {
            super.show(backward, binding, mask);
         }
         modals.push(this);
      }

      _resetNoModsTimeout() {
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

         if (this._wraparoundMode !== WraparoundMode.NONE && currentIndex === newIndex) {
            // given a direction input, if the workspace has not changed, then check wraparound mode.
            let targetRow = Math.floor(currentIndex / this._columns);
            let targetColumn = currentIndex % this._columns;

            let offset = 0;
            if (direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.LEFT) {
               offset = -1;
            } else if (direction === Meta.MotionDirection.DOWN || direction === Meta.MotionDirection.RIGHT) {
               offset = 1;
            }

            if (this._wraparoundMode === WraparoundMode.NEXT_PREV) {
               targetRow += offset;
               targetColumn += offset;
            } else if (this._wraparoundMode === WraparoundMode.NEXT_PREV_BORDER) {
               if (!(currentIndex === 0 && offset === -1) && !(currentIndex === this._rows * this._columns - 1 && offset === 1)) {
                  targetRow += offset;
                  targetColumn += offset;
               }
            } else if (this._wraparoundMode === WraparoundMode.ROW_COL) {
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

      _createLabels() {
         let labels = [];
         let workspaceManager = global.workspace_manager;

         for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            let label = Meta.prefs_get_workspace_name(i);
            labels.push(label);
         }

         return labels;
      }
   });
