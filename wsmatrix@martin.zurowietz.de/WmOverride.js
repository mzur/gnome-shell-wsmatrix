const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceSwitcherPopup = WsMatrix.imports.WorkspaceSwitcherPopup;
const DisplayWrapper = WsMatrix.imports.DisplayWrapper.DisplayWrapper;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;

var WmOverride = class {
   constructor(settings, keybindings) {
      this.wm = Main.wm;
      this.settings = settings;
      this._mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
      this.wsManager = DisplayWrapper.getWorkspaceManager();
      this.originalNumberOfWorkspaces = this.wsManager.n_workspaces;
      this.originalDynamicWorkspaces = this._mutterSettings.get_boolean('dynamic-workspaces');
      this.originalAllowedKeybindings = {};
      this._keybindings = keybindings;

      this._overrideDynamicWorkspaces();
      this._overrideKeybindingHandlers();
      this._handleNumberOfWorkspacesChanged();
      this._handleScaleChanged();
      this._connectSettings();
      this._notify();
      this._addKeybindings();
      this._connectOverview();
   }

   destroy() {
      this._disconnectSettings();
      this._restoreKeybindingHandlers();
      this._restoreLayout();
      this._restoreNumberOfWorkspaces();
      this._restoreDynamicWorkspaces();
      this._notify();
      this._removeKeybindings();
      this._disconnectOverview();
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

      this.settingsHandlerScale = this.settings.connect(
         'changed::scale',
         this._handleScaleChanged.bind(this)
      );
   }

   _disconnectSettings() {
      this.settings.disconnect(this.settingsHandlerRows);
      this.settings.disconnect(this.settingsHandlerColumns);
      this.settings.disconnect(this.settingsHandlerScale);
   }

   _connectOverview() {
      this.overviewHandlerShown = Main.overview.connect(
         'showing',
         this._destroyWorkspaceSwitcherPopup.bind(this)
      );
   }

   _disconnectOverview() {
      Main.overview.disconnect(this.overviewHandlerShown);
   }

   _addKeybindings() {
      this.wm.addKeybinding(
         'workspace-overview-toggle',
         this._keybindings,
         Meta.KeyBindingFlags.NONE,
         Shell.ActionMode.NORMAL,
         this._toggleWorkspaceOverview.bind(this)
      );
   }

   _removeKeybindings() {
      this.wm.removeKeybinding('workspace-overview-toggle');
   }

   _addWsOverviewKeybindings(keybindings) {
      this.wm.addKeybinding(
         'workspace-overview-right',
         this._keybindings,
         Meta.KeyBindingFlags.NONE,
         Shell.ActionMode.NORMAL,
         this._workspaceOverviewMoveRight.bind(this)
      );

      this.wm.addKeybinding(
         'workspace-overview-left',
         this._keybindings,
         Meta.KeyBindingFlags.NONE,
         Shell.ActionMode.NORMAL,
         this._workspaceOverviewMoveLeft.bind(this)
      );

      this.wm.addKeybinding(
         'workspace-overview-up',
         this._keybindings,
         Meta.KeyBindingFlags.NONE,
         Shell.ActionMode.NORMAL,
         this._workspaceOverviewMoveUp.bind(this)
      );

      this.wm.addKeybinding(
         'workspace-overview-down',
         this._keybindings,
         Meta.KeyBindingFlags.NONE,
         Shell.ActionMode.NORMAL,
         this._workspaceOverviewMoveDown.bind(this)
      );

      this.wm.addKeybinding(
         'workspace-overview-confirm',
         this._keybindings,
         Meta.KeyBindingFlags.NONE,
         Shell.ActionMode.NORMAL,
         this._workspaceOverviewConfirm.bind(this)
      );
   }

   _removeWsOverviewKeybindings() {
      this.wm.removeKeybinding('workspace-overview-right');
      this.wm.removeKeybinding('workspace-overview-left');
      this.wm.removeKeybinding('workspace-overview-up');
      this.wm.removeKeybinding('workspace-overview-down');
      this.wm.removeKeybinding('workspace-overview-confirm');
   }

   _handleNumberOfWorkspacesChanged() {
      this.rows = this.settings.get_int('num-rows');
      this.columns = this.settings.get_int('num-columns');
      this._overrideNumberOfWorkspaces();
      this._overrideLayout();
   }

   _handleScaleChanged() {
      this.scale = this.settings.get_double('scale');
   }

   _overrideLayout() {
      this.wsManager.override_workspace_layout(
         DisplayWrapper.getDisplayCorner().TOPLEFT, // workspace 0
         false, // true == lay out in columns. false == lay out in rows
         this.rows,
         this.columns
      );
   }

   _restoreLayout() {
      this.wsManager.override_workspace_layout(
         DisplayWrapper.getDisplayCorner().TOPLEFT, // workspace 0
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
      while (this.wsManager.n_workspaces < total) {
         this.wsManager.append_new_workspace(false, global.get_current_time());
      }

      while (this.wsManager.n_workspaces > total) {
         this.wsManager.remove_workspace(
            this.wsManager.get_workspace_by_index(this.wsManager.n_workspaces - 1),
            global.get_current_time()
         );
      }
   }

   _overrideDynamicWorkspaces() {
      this._mutterSettings.set_boolean('dynamic-workspaces', false);
   }

   _restoreDynamicWorkspaces() {
      this._mutterSettings.set_boolean(
         'dynamic-workspaces',
         this.originalDynamicWorkspaces
      );
   }

   _notify() {
      // Update the workspace display to match the number of workspaces.
      this.wsManager.notify('n-workspaces');
   }

   /*
    * This is Main.wm._showWorkspaceSwitcher but without ignoring the UP and DOWN
    * directions and using the WorkspaceSwitcherPopup (with constructor arguments)
    * provided by this extension.
    */
   _showWorkspaceSwitcher(display, window, binding) {
      // Implement this for compatibility with 3.28.
      if (arguments.length === 4) {
        var [display, , window, binding] = arguments;
      }
      let workspaceManager = this.wsManager;

      if (!Main.sessionMode.hasWorkspaces)
         return;

      if (workspaceManager.n_workspaces == 1)
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
         newWs = workspaceManager.get_workspace_by_index(workspaceManager.n_workspaces - 1);
      } else if (isNaN(target)) {
         // Prepend a new workspace dynamically
         if (workspaceManager.get_active_workspace_index() == 0 &&
             action == 'move' && target == 'up' && this.wm._isWorkspacePrepended == false) {
             this.wm.insertWorkspace(0);
             this.wm._isWorkspacePrepended = true;
         }

         direction = Meta.MotionDirection[target.toUpperCase()];
         newWs = this._getTargetWorkspace(direction);
      } else if (target > 0) {
         target--;
         newWs = workspaceManager.get_workspace_by_index(target);

         if (workspaceManager.get_active_workspace().index() > target)
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
             this.wm._workspaceSwitcherPopup = this._createNewPopup();
             this.wm._workspaceSwitcherPopup.connect('destroy', () => {
                 this.wm._workspaceTracker.unblockUpdates();
                 this.wm._workspaceSwitcherPopup = null;
                 this.wm._isWorkspacePrepended = false;
             });
         }
         this.wm._workspaceSwitcherPopup.display(direction, newWs.index());
      }
   }

   _destroyWorkspaceSwitcherPopup() {
      if (this.wm._workspaceSwitcherPopup) {
         this.wm._workspaceSwitcherPopup.destroy();
      }
   }

   _getTargetWorkspace(direction) {
      return this.wsManager.get_active_workspace().get_neighbor(direction);
   }

   _createNewPopup(shouldTimeout) {
      shouldTimeout = shouldTimeout === undefined ? true : shouldTimeout;

      return new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup(
         this.rows,
         this.columns,
         this.scale,
         shouldTimeout
      );
   }

   _toggleWorkspaceOverview() {
      if (this.wm._workspaceSwitcherPopup === null) {
         this.wm._workspaceSwitcherPopup = this._createNewPopup(false);
         this.wm._workspaceSwitcherPopup.connect('destroy', () => {
            this.wm._workspaceTracker.unblockUpdates();
            this.wm._workspaceSwitcherPopup = null;
            this.wm._isWorkspacePrepended = false;
            this._removeWsOverviewKeybindings();
         });
         this.wm._workspaceSwitcherPopup.display(null, this.wsManager.get_active_workspace_index());
         this._addWsOverviewKeybindings();
      } else {
         this._destroyWorkspaceSwitcherPopup();
      }
   }

   _moveToWorkspace(direction) {
      let workspace = this._getTargetWorkspace(direction);
      this.wm.actionMoveWorkspace(workspace);
      if (this.wm._workspaceSwitcherPopup) {
         this.wm._workspaceSwitcherPopup.display(direction, workspace.index());
      }
   }

   _workspaceOverviewMoveRight() {
      this._moveToWorkspace(Meta.MotionDirection.RIGHT);
   }

   _workspaceOverviewMoveLeft() {
      this._moveToWorkspace(Meta.MotionDirection.LEFT);
   }

   _workspaceOverviewMoveUp() {
      this._moveToWorkspace(Meta.MotionDirection.UP);
   }

   _workspaceOverviewMoveDown() {
      this._moveToWorkspace(Meta.MotionDirection.DOWN);
   }

   _workspaceOverviewConfirm() {
      this._destroyWorkspaceSwitcherPopup();
   }
}
