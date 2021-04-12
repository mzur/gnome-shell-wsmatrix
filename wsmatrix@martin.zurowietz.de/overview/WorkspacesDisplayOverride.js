const Main = imports.ui.main;
const { Clutter } = imports.gi;
const WorkspacesView = imports.ui.workspacesView;

var WorkspacesDisplayOverride = class {
   constructor(workspacesDisplay) {
      this.overrideProperties = [
         '_onScrollEvent',
         '_onKeyPressEvent',
         '_activeWorkspaceChanged',
      ];
      this.workspacesDisplay = workspacesDisplay;
      this.overrideOriginalProperties();
   }

   destroy() {
      this.restoreOriginalProperties();
   }

   overrideOriginalProperties() {
      this.workspacesDisplay._overrideProperties = {};
      this.overrideProperties.forEach(function (prop) {
         this.workspacesDisplay._overrideProperties[prop] = this.workspacesDisplay[prop].bind(this.workspacesDisplay);
         this.workspacesDisplay[prop] = this[prop].bind(this.workspacesDisplay);
      }, this);

      this.originalWorkspaceSwitchTime = WorkspacesView.WORKSPACE_SWITCH_TIME;
      WorkspacesView.WORKSPACE_SWITCH_TIME = 0;
   }

   restoreOriginalProperties() {
      this.overrideProperties.forEach(function (prop) {
         this.workspacesDisplay[prop] = this.workspacesDisplay._overrideProperties[prop];
      }, this);

      WorkspacesView.WORKSPACE_SWITCH_TIME = this.originalWorkspaceSwitchTime;

      delete this.workspacesDisplay._overrideProperties;
   }

   // Allow scrolling workspaces in overview to go through rows and columns
   // original code goes only through rows.
   _onScrollEvent(actor, event) {
      if (this._swipeTracker.canHandleScrollEvent(event)) {
         return Clutter.EVENT_PROPAGATE;
      }

      if (!this.mapped) {
         return Clutter.EVENT_PROPAGATE;
      }

      if (this._workspacesOnlyOnPrimary &&
         this._getMonitorIndexForEvent(event) != this._primaryIndex) {
         return Clutter.EVENT_PROPAGATE;
      }

      if (!this._canScroll) {
         return Clutter.EVENT_PROPAGATE;
      }

      let workspaceManager = global.workspace_manager;
      let targetIndex = workspaceManager.get_active_workspace_index();

      switch (event.get_scroll_direction()) {
         case Clutter.ScrollDirection.UP:
         case Clutter.ScrollDirection.LEFT:
            targetIndex = Math.max(targetIndex - 1, 0);
            break;
         case Clutter.ScrollDirection.DOWN:
         case Clutter.ScrollDirection.RIGHT:
            targetIndex = Math.min(targetIndex + 1, workspaceManager.n_workspaces - 1);
            break;
         default:
            return Clutter.EVENT_PROPAGATE;
      }

      Main.wm.actionMoveWorkspace(workspaceManager.get_workspace_by_index(targetIndex));
      return Clutter.EVENT_STOP;
   }

   _onKeyPressEvent(actor, event) {
      if (!this.mapped) {
         return Clutter.EVENT_PROPAGATE;
      }

      let workspaceManager = global.workspace_manager;
      let targetIndex = workspaceManager.get_active_workspace_index();

      let activeWs = workspaceManager.get_active_workspace();
      let ws;
      switch (event.get_key_symbol()) {
         case Clutter.KEY_Page_Up:
            targetIndex = Math.max(targetIndex - 1, 0);
            break;
         case Clutter.KEY_Page_Down:
            targetIndex = Math.min(targetIndex + 1, workspaceManager.n_workspaces - 1);
            break;
         default:
            return Clutter.EVENT_PROPAGATE;
      }

      Main.wm.actionMoveWorkspace(workspaceManager.get_workspace_by_index(targetIndex));
      return Clutter.EVENT_STOP;
   }

   _activeWorkspaceChanged(_wm, _from, to, _direction) {
        if (this._gestureActive)
            return;

        this._scrollAdjustment.ease(to, {
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            duration: 1,
        });
    }
}
