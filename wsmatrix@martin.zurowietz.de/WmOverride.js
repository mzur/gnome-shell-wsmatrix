const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceSwitcherPopup = WsMatrix.imports.WorkspaceSwitcherPopup;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;

var WmOverride = class {
   constructor(settings) {
      this.wm = Main.wm;
      this.settings = settings;
      this.originalNumberOfWorkspaces = global.screen.n_workspaces;
      // this.originalDynamicWorkspaces = global.get_overrides_settings().get_boolean('dynamic-workspaces');
      this.originalAllowedKeybindings = {};

      this._overrideKeybindingHandlers();
      this._handleNumberOfWorkspacesChanged();
      // this._overrideDynamicWorkspaces();
      this._connectSettings();
      this._notify();
   }

   destroy() {
      this._disconnectSettings();
      this._restoreKeybindingHandlers();
      this._restoreLayout();
      this._restoreNumberOfWorkspaces();
      // this._restoreDynamicWorkspaces();
      this._notify();
   }

   _connectSettings() {
      this.settingsHandlerRows = this.settings.connect(
         'changed::num-rows',
         this._handleNumberOfWorkspacesChanged.bind(this)
      );

      this.settingsHandlerColumns = this.settings.connect(
         'changed::num-columns',
         this._handleNumberOfWorkspacesChanged.bind(this)
      );
   }

   _disconnectSettings() {
      this.settings.disconnect(this.settingsHandlerRows);
      this.settings.disconnect(this.settingsHandlerColumns);
   }

   _handleNumberOfWorkspacesChanged() {
      this.rows = this.settings.get_int('num-rows');
      this.columns = this.settings.get_int('num-columns');
      this._overrideNumberOfWorkspaces();
      this._overrideLayout();
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

   _overrideNumberOfWorkspaces() {
      this._forceNumberOfWorkspaces(this.rows * this.columns);
   }

   _restoreNumberOfWorkspaces() {
      this._forceNumberOfWorkspaces(this.originalNumberOfWorkspaces);
   }

   _forceNumberOfWorkspaces(total) {
      while (global.screen.n_workspaces < total) {
         global.screen.append_new_workspace(false, global.get_current_time());
      }

      while (global.screen.n_workspaces > total) {
         global.screen.remove_workspace(
            global.screen.get_workspace_by_index(global.screen.n_workspaces - 1),
            global.get_current_time()
         );
      }
   }

   _overrideDynamicWorkspaces() {
      global.get_overrides_settings().set_boolean('dynamic-workspaces', false);
   }

   _restoreDynamicWorkspaces() {
      global.get_overrides_settings().set_boolean(
         'dynamic-workspaces',
         this.originalDynamicWorkspaces
      );
   }

   _notify() {
      // Update the workspace display to match the number of workspaces.
      global.screen.notify('n-workspaces');
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
