const Main = imports.ui.main;
const { Clutter } = imports.gi;

var WorkspacesDisplayOverride = class {
   constructor(workspacesDisplay) {
      this.workspacesDisplay = workspacesDisplay;
      this.overrideOriginalProperties();
   }

   destroy() {
      this.restoreOriginalProperties();
   }

   overrideOriginalProperties() {
      this.workspacesDisplay._overrideProperties = {
         _onScrollEvent: this.workspacesDisplay._onScrollEvent,
         _onKeyPressEvent: this.workspacesDisplay._onKeyPressEvent,
      };
      this.workspacesDisplay._onScrollEvent = this._onScrollEvent.bind(this.workspacesDisplay);
      this.workspacesDisplay._onKeyPressEvent = this._onKeyPressEvent.bind(this.workspacesDisplay);
   }

   restoreOriginalProperties() {
      this.workspacesDisplay._onScrollEvent = this.workspacesDisplay._overrideProperties._onScrollEvent;
      this.workspacesDisplay._onKeyPressEvent = this.workspacesDisplay._overrideProperties._onKeyPressEvent;
      delete this.workspacesDisplay._overrideProperties;
   }

   // Allow scrolling workspaces in overview to go through rows and columns
   // original code goes only through rows.
   _onScrollEvent(actor, event) {
      if (!this.actor.mapped)
         return Clutter.EVENT_PROPAGATE;

      if (this._workspacesOnlyOnPrimary &&
         this._getMonitorIndexForEvent(event) != this._primaryIndex)
         return Clutter.EVENT_PROPAGATE;

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
      if (!this.actor.mapped)
         return Clutter.EVENT_PROPAGATE;
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
}
