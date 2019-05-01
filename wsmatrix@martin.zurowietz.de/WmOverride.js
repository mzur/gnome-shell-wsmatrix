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
   constructor(settings) {
      this.wm = Main.wm;
      this.settings = settings;
      this._mutterSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
      this.wsManager = DisplayWrapper.getWorkspaceManager();
      this.originalNumberOfWorkspaces = this.wsManager.n_workspaces;
      this.originalDynamicWorkspaces = this._mutterSettings.get_boolean('dynamic-workspaces');
      this.originalAllowedKeybindings = {};

      this._overrideDynamicWorkspaces();
      this._overrideKeybindingHandlers();
      this._handleNumberOfWorkspacesChanged();
      this._handlePopupTimeoutChanged();
      this._handleScaleChanged();
      this._handleShowThumbnailsChanged();
      this._handleWraparoundModeChanged();
      this._connectSettings();
      this._notify();
   }

   destroy() {
      this._disconnectSettings();
      this._restoreKeybindingHandlers();
      this._restoreLayout();
      this._restoreNumberOfWorkspaces();
      this._restoreDynamicWorkspaces();
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

      this.settingsHandlerPopupTimeout = this.settings.connect(
         'changed::popup-timeout',
         this._handlePopupTimeoutChanged.bind(this)
      );

      this.settingsHandlerScale = this.settings.connect(
         'changed::scale',
         this._handleScaleChanged.bind(this)
      );

      this.settingsHandlerShowThumbnails = this.settings.connect(
         'changed::show-thumbnails',
         this._handleShowThumbnailsChanged.bind(this)
      );

      this.settingsHandlerWraparoundMode = this.settings.connect(
         'changed::wraparound-mode',
         this._handleWraparoundModeChanged.bind(this)
      );
   }

   _disconnectSettings() {
      this.settings.disconnect(this.settingsHandlerRows);
      this.settings.disconnect(this.settingsHandlerColumns);
      this.settings.disconnect(this.settingsHandlerPopupTimeout);
      this.settings.disconnect(this.settingsHandlerScale);
      this.settings.disconnect(this.settingsHandlerShowThumbnails);
      this.settings.disconnect(this.settingsHandlerWrapAroundMode);
   }

   _handleNumberOfWorkspacesChanged() {
      this.rows = this.settings.get_int('num-rows');
      this.columns = this.settings.get_int('num-columns');
      this._overrideNumberOfWorkspaces();
      this._overrideLayout();
   }

   _handlePopupTimeoutChanged() {
     this.popupTimeout = this.settings.get_int('popup-timeout');
   }

   _handleScaleChanged() {
      this.scale = this.settings.get_double('scale');
   }

   _handleShowThumbnailsChanged() {
      this.showThumbnails = this.settings.get_boolean('show-thumbnails');
   }

   _handleWraparoundModeChanged() {
      this.wraparoundMode = this.settings.get_enum('wraparound-mode');
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
         newWs = workspaceManager.get_active_workspace().get_neighbor(direction);

         let currentIndex = workspaceManager.get_active_workspace_index();
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

             target = targetRow * this.columns + targetColumn;
             newWs = workspaceManager.get_workspace_by_index(target);
         }
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
         if (this.wm._workspaceSwitcherPopup == null) {
             this.wm._workspaceTracker.blockUpdates();
             if (this.showThumbnails) {
                this.wm._workspaceSwitcherPopup = new ThumbnailWsmatrixPopup(
                  this.rows,
                  this.columns,
                  this.scale,
                  this.popupTimeout
                );
             } else {
               this.wm._workspaceSwitcherPopup = new IndicatorWsmatrixPopup(
                  this.rows,
                  this.columns,
                  this.popupTimeout
                );
             }
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
