const { Clutter, Meta } = imports.gi;
const workspacesView = imports.ui.workspacesView;
const WorkspacesView = workspacesView.WorkspacesView;

var WorkspacesViewOverride = class {
   constructor(settings) {
      this.settings = settings;
      this.overrideOriginalProperties();
      this._connectSettings();
      this._handleNumberOfWorkspacesChanged();
   }

   destroy() {
      this._disconnectSettings();
      this.restoreOriginalProperties();
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
   }

   overrideOriginalProperties() {
      WorkspacesView.prototype._overrideProperties = {
         _updateScrollPosition: WorkspacesView.prototype._updateScrollPosition,
         _activeWorkspaceChanged: WorkspacesView.prototype._activeWorkspaceChanged,
      };
      WorkspacesView.prototype._updateScrollPosition = this._updateScrollPosition;
      WorkspacesView.prototype._activeWorkspaceChanged = this._activeWorkspaceChanged;
      WorkspacesView.prototype.getRows = this.getRows.bind(this);
      WorkspacesView.prototype.getColumns = this.getColumns.bind(this);
   }

   restoreOriginalProperties() {
      WorkspacesView.prototype._updateScrollPosition = WorkspacesView.prototype._overrideProperties._updateScrollPosition;
      WorkspacesView.prototype._activeWorkspaceChanged = WorkspacesView.prototype._overrideProperties._activeWorkspaceChanged;
      delete WorkspacesView.prototype._overrideProperties;
      delete WorkspacesView.prototype.getRows;
      delete WorkspacesView.prototype.getColumns;
   }

   getRows() {
      return this.rows;
   }

   getColumns() {
      return this.columns;
   }

   _activeWorkspaceChanged(_wm, _from, _to, _direction) {
      if (this._scrolling)
         return;

      this._wsmatrixDirection = _direction;

      this._scrollToActive();
    }

   _updateScrollPosition() {
      if (!this.has_allocation())
         return;

      const adj = this._scrollAdjustment;

      if (adj.upper == 1)
         return;

      const workspaceManager = global.workspace_manager;
      const vertical = this._wsmatrixDirection === Meta.MotionDirection.DOWN || this._wsmatrixDirection === Meta.MotionDirection.UP;
      const rtl = this.text_direction === Clutter.TextDirection.RTL;
      const progress = vertical || !rtl
         ? adj.value : adj.upper - adj.value - 1;

      for (const ws of this._workspaces) {
         if (vertical)
            ws.translation_y = -progress * this.height;
         else
            ws.translation_x = -progress * this.width;
      }
   }
}
