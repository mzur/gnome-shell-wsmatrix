const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const WorkspaceSwitcherPopup = WsMatrix.imports.WorkspaceSwitcherPopup;


var WmOverride = class {
   constructor(rows, columns) {
      this.wm = Main.wm;
      this.rows = rows;
      this.columns = columns;
      this.originalNumberOfWorkspaces = Meta.prefs_get_num_workspaces();
      this.originalAllowedKeybindings = {};
      this._overrideLayout();
      this._overrideKeybindingHandlers();
   }

   destroy() {
      this._restoreKeybindingHandlers();
      this._restoreLayout();
   }

   _overrideLayout() {
      global.screen.override_workspace_layout(
         Meta.ScreenCorner.TOPLEFT, // workspace 0
         false, // true == lay out in columns. false == lay out in rows
         this.rows,
         this.columns
      );
   }

   _restoreLayout() {
      global.screen.override_workspace_layout(
         Meta.ScreenCorner.TOPLEFT, // workspace 0
         true, // true == lay out in columns. false == lay out in rows
         this.originalNumberOfWorkspaces,
         1
      );
   }

   _overrideKeybindingHandlers() {
      for (let key in this.wm._allowedKeybindings) {
         if (key.includes('workspace')) {
            this.originalAllowedKeybindings[key] = this.wm._allowedKeybindings[key];
            this.wm.setCustomKeybindingHandler(key,
               Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
               this._showWorkspaceSwitcher.bind(this)
            );
         }
      }
   }

   _restoreKeybindingHandlers() {
      for (let key in this.originalAllowedKeybindings) {
         this.wm.setCustomKeybindingHandler(key,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            this.wm._showWorkspaceSwitcher.bind(this.wm)
         );
      }
   }

   /*
    * This is Main.wm._showWorkspaceSwitcher but without ignoring the UP and DOWN
    * directions and using the WorkspaceSwitcherPopup (with constructor arguments)
    * provided by this extension.
    */
   _showWorkspaceSwitcher(display, screen, window, binding) {
      if (!Main.sessionMode.hasWorkspaces)
         return;

      if (screen.n_workspaces == 1)
         return;

      let [action,,,target] = binding.get_name().split('-');
      let newWs;
      let direction;

      if (action == 'move') {
         // "Moving" a window to another workspace doesn't make sense when
         // it cannot be unstuck, and is potentially confusing if a new
         // workspaces is added at the start/end
         if (window.is_always_on_all_workspaces() ||
             (Meta.prefs_get_workspaces_only_on_primary() &&
              window.get_monitor() != Main.layoutManager.primaryIndex))
           return;
      }

      if (target == 'last') {
         direction = Meta.MotionDirection.DOWN;
         newWs = screen.get_workspace_by_index(screen.n_workspaces - 1);
      } else if (isNaN(target)) {
         // Prepend a new workspace dynamically
         if (screen.get_active_workspace_index() == 0 &&
             action == 'move' && target == 'up' && this.wm._isWorkspacePrepended == false) {
             this.wm.insertWorkspace(0);
             this.wm._isWorkspacePrepended = true;
         }

         direction = Meta.MotionDirection[target.toUpperCase()];
         newWs = screen.get_active_workspace().get_neighbor(direction);
      } else if (target > 0) {
         target--;
         newWs = screen.get_workspace_by_index(target);

         if (screen.get_active_workspace().index() > target)
             direction = Meta.MotionDirection.UP;
         else
             direction = Meta.MotionDirection.DOWN;
      }

      if (action == 'switch')
         this.wm.actionMoveWorkspace(newWs);
      else
         this.wm.actionMoveWindow(window, newWs);

      if (!Main.overview.visible) {
         if (this.wm._workspaceSwitcherPopup == null) {
             this.wm._workspaceTracker.blockUpdates();
             this.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup(this.rows, this.columns);
             this.wm._workspaceSwitcherPopup.connect('destroy', () => {
                 this.wm._workspaceTracker.unblockUpdates();
                 this.wm._workspaceSwitcherPopup = null;
                 this.wm._isWorkspacePrepended = false;
             });
         }
         this.wm._workspaceSwitcherPopup.display(direction, newWs.index());
      }
   }
}
