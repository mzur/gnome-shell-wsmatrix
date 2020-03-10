const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const ThumbnailWsmatrixPopup = WsMatrix.imports.ThumbnailWsmatrixPopup.ThumbnailWsmatrixPopup;
const IndicatorWsmatrixPopup = WsMatrix.imports.IndicatorWsmatrixPopup.IndicatorWsmatrixPopup;
const DisplayWrapper = WsMatrix.imports.DisplayWrapper.DisplayWrapper;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;

const WraparoundMode = {
    NONE: 0,
    NEXT_PREV: 1,
    ROW_COL: 2,
};

var WmOverride = class {
   constructor(settings, keybindings) {
      this.wm = Main.wm;
      this.wm._wsPopupList = [];
      this.settings = settings;
      this._mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
      this.wsManager = DisplayWrapper.getWorkspaceManager();
      this.originalDynamicWorkspaces = this._mutterSettings.get_boolean('dynamic-workspaces');
      this.originalAllowedKeybindings = {};
      this._keybindings = keybindings;
      this.monitors = [];

      this._overrideDynamicWorkspaces();
      this._overrideKeybindingHandlers();
      this._handleNumberOfWorkspacesChanged();
      this._handlePopupTimeoutChanged();
      this._handleScaleChanged();
      this._handleMultiMonitorChanged();
      this._handleShowThumbnailsChanged();
      this._handleShowWorkspaceNamesChanged();
      this._handleCachePopupChanged();
      this._handleWraparoundModeChanged();
      this._connectSettings();
      this._notify();
      this._addKeybindings();
      this._connectOverview();
      this._connectLayoutManager();
   }

   destroy() {
      this._destroyWorkspaceSwitcherPopup();
      this._restoreLayout();
      this._restoreKeybindingHandlers();
      this._restoreDynamicWorkspaces();
      this._disconnectSettings();
      this._notify();
      this._removeKeybindings();
      this._disconnectOverview();
      this._disconnectLayoutManager();
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

      this.settingsHandlerPopupTimeout = this.settings.connect(
         'changed::popup-timeout',
         this._handlePopupTimeoutChanged.bind(this)
      );

      this.settingsHandlerScale = this.settings.connect(
         'changed::scale',
         this._handleScaleChanged.bind(this)
      );

      this.settingsHandlerMultiMonitor = this.settings.connect(
         'changed::multi-monitor',
         this._handleMultiMonitorChanged.bind(this)
      );

      this.settingsHandlerShowThumbnails = this.settings.connect(
         'changed::show-thumbnails',
         this._handleShowThumbnailsChanged.bind(this)
      );

      this.settingsHandlerWraparoundMode = this.settings.connect(
         'changed::wraparound-mode',
         this._handleWraparoundModeChanged.bind(this)
      );

      this.settingsHandlerShowWorkspaceNames = this.settings.connect(
         'changed::show-workspace-names',
         this._handleShowWorkspaceNamesChanged.bind(this)
      );

      this.settingsHandlerCachePopup = this.settings.connect(
         'changed::cache-popup',
         this._handleCachePopupChanged.bind(this)
      );
   }

   _disconnectSettings() {
      this.settings.disconnect(this.settingsHandlerRows);
      this.settings.disconnect(this.settingsHandlerColumns);
      this.settings.disconnect(this.settingsHandlerPopupTimeout);
      this.settings.disconnect(this.settingsHandlerScale);
      this.settings.disconnect(this.settingsHandlerMultiMonitor);
      this.settings.disconnect(this.settingsHandlerShowThumbnails);
      this.settings.disconnect(this.settingsHandlerWraparoundMode);
      this.settings.disconnect(this.settingsHandlerShowWorkspaceNames);
      this.settings.disconnect(this.settingsHandlerCachePopup);
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

   _connectLayoutManager() {
      this.monitorsChanged = Main.layoutManager.connect(
         'monitors-changed',
         this._updateMonitors.bind(this)
      );
   }

   _disconnectLayoutManager() {
      Main.layoutManager.disconnect(this.monitorsChanged);
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
      this._destroyWorkspaceSwitcherPopup();
   }

   _handlePopupTimeoutChanged() {
     this.popupTimeout = this.settings.get_int('popup-timeout');
     this._destroyWorkspaceSwitcherPopup();
   }

   _handleScaleChanged() {
      this.scale = this.settings.get_double('scale');
      this._destroyWorkspaceSwitcherPopup();
   }

   _handleMultiMonitorChanged() {
      this.multiMonitor = this.settings.get_boolean('multi-monitor');
      this._updateMonitors();
      this._destroyWorkspaceSwitcherPopup();
   }

   _handleShowThumbnailsChanged() {
      this.showThumbnails = this.settings.get_boolean('show-thumbnails');
      this._destroyWorkspaceSwitcherPopup();
   }

   _handleWraparoundModeChanged() {
      this.wraparoundMode = this.settings.get_enum('wraparound-mode');
   }

   _handleShowWorkspaceNamesChanged() {
      this.showWorkspaceNames = this.settings.get_boolean('show-workspace-names');
      this._destroyWorkspaceSwitcherPopup();
   }

   _handleCachePopupChanged() {
      this.cachePopup = this.settings.get_boolean('cache-popup');
      this._destroyWorkspaceSwitcherPopup();
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
         false, // true == lay out in columns. false == lay out in rows
         -1,
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

   _updateMonitors() {
      this.monitors = this.multiMonitor ?
         Main.layoutManager.monitors :
         [Main.layoutManager.primaryMonitor];
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

      if (!Main.overview.visible && this.popupTimeout > 0) {
         this.monitors.forEach((monitor) => {
            let monitorIndex = monitor.index;

            if (!this.wm._wsPopupList[monitorIndex]) {
                this.wm._workspaceTracker.blockUpdates();
                this.wm._wsPopupList[monitorIndex] = this._createNewPopup({
                  monitorIndex: monitorIndex,
               });
               this.wm._wsPopupList[monitorIndex].connect('destroy', () => {
                  this.wm._workspaceTracker.unblockUpdates();
                  this.wm._wsPopupList[monitorIndex] = null;
                  if (monitorIndex === Main.layoutManager.primaryIndex) {
                     this.wm._workspaceSwitcherPopup = null;
                     this.wm._isWorkspacePrepended = false;
                  }
               });
            }

            this.wm._wsPopupList[monitorIndex].display(direction, newWs.index());
            if (monitorIndex === Main.layoutManager.primaryIndex) {
               this.wm._workspaceSwitcherPopup = this.wm._wsPopupList[monitorIndex];
            }
         });
      }
   }

   _destroyWorkspaceSwitcherPopup() {
      this.monitors.forEach((monitor) => {
         let monitorIndex = monitor.index;
         if (this.wm._wsPopupList[monitorIndex]) {
            if (this.wm._wsPopupList[monitorIndex] instanceof ThumbnailWsmatrixPopup) {
               this.wm._wsPopupList[monitorIndex].destroy(true);
            } else {
               this.wm._wsPopupList[monitorIndex].destroy();
            }
         }
      });
   }

   _getTargetWorkspace(direction) {
      let newWs = this.wsManager.get_active_workspace().get_neighbor(direction);
      let currentIndex = this.wsManager.get_active_workspace_index();
      if (this.wraparoundMode !== WraparoundMode.NONE && currentIndex === newWs.index()) {
          // Given a direction input the workspace has not changed, so do wraparound.
          let targetRow = Math.floor(currentIndex / this.columns);
          let targetColumn = currentIndex % this.columns;

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

          // Handle negative targets.
          targetColumn = (targetColumn + this.columns) % this.columns;
          targetRow = (targetRow + this.rows) % this.rows;

          let target = targetRow * this.columns + targetColumn;
          newWs = this.wsManager.get_workspace_by_index(target);
      }

      return newWs;
   }

   _createNewPopup(options) {
      let timeout = options.timeout === undefined ?
         this.popupTimeout :
         options.timeout;

      if (this.showThumbnails) {
         return new ThumbnailWsmatrixPopup(
            this.rows,
            this.columns,
            this.scale,
            timeout,
            this.cachePopup,
            options.monitorIndex
         );
      }

      return new IndicatorWsmatrixPopup(
         this.rows,
         this.columns,
         timeout,
         this.showWorkspaceNames,
         options.monitorIndex
      );
   }

   _toggleWorkspaceOverview() {
      if (this.wm._workspaceSwitcherPopup === null) {
         this.monitors.forEach((monitor) => {
            let monitorIndex = monitor.index;
            this.wm._wsPopupList[monitorIndex] = this._createNewPopup({
               timeout: 0,
               monitorIndex: monitorIndex,
            });
            this.wm._wsPopupList[monitorIndex].display(null, this.wsManager.get_active_workspace_index());

            this.wm._wsPopupList[monitorIndex].connect('destroy', () => {
               this.wm._workspaceTracker.unblockUpdates();
               this.wm._wsPopupList[monitorIndex] = null;

               if (monitorIndex === Main.layoutManager.primaryIndex){
                  this.wm._workspaceSwitcherPopup = null;
                  this.wm._isWorkspacePrepended = false;
                  this._removeWsOverviewKeybindings();
               }
            });
         });

         this.wm._workspaceSwitcherPopup = this.wm._wsPopupList[Main.layoutManager.primaryIndex];
         this._addWsOverviewKeybindings();

      } else {
         this._destroyWorkspaceSwitcherPopup();
      }
   }

   _moveToWorkspace(direction) {
      let workspace = this._getTargetWorkspace(direction);
      this.wm.actionMoveWorkspace(workspace);
      this.monitors.forEach((monitor) => {
         let monitorIndex = monitor.index;
         if (this.wm._wsPopupList[monitorIndex]) {
            this.wm._wsPopupList[monitorIndex].display(direction, workspace.index());
         }
      });
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
