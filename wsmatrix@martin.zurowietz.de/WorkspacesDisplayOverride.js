const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const { Clutter } = imports.gi;
// const WorkspacesView = imports.ui.workspacesView;
const ExtraWorkspaceView = imports.ui.workspacesView.ExtraWorkspaceView;
const WorkspacesView = WsMatrix.imports.WorkspacesView.WorkspacesView;

var WorkspacesDisplayOverride = class {
   constructor(workspacesDisplay, rows, columns) {
      this.rows = rows;
      this.columns = columns;
      this.overrideProperties = [
         '_onScrollEvent',
         '_onKeyPressEvent',
         '_activeWorkspaceChanged',
         '_updateWorkspacesViews',
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

      this.workspacesDisplay.getRows = this.getRows.bind(this);
      this.workspacesDisplay.getColumns = this.getColumns.bind(this);
   }

   restoreOriginalProperties() {
      this.overrideProperties.forEach(function (prop) {
         this.workspacesDisplay[prop] = this.workspacesDisplay._overrideProperties[prop];
      }, this);
      delete this.workspacesDisplay._overrideProperties;
      delete this.workspacesDisplay.getRows;
      delete this.workspacesDisplay.getColumns;
   }

   setRows(rows) {
      this.rows = rows;
   }

   getRows() {
      return this.rows;
   }

   setColumns(columns) {
      this.columns = columns;
   }

   getColumns() {
      return this.columns;
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

    _updateWorkspacesViews() {
        for (let i = 0; i < this._workspacesViews.length; i++)
            this._workspacesViews[i].destroy();

        this._primaryIndex = Main.layoutManager.primaryIndex;
        this._workspacesViews = [];
        let monitors = Main.layoutManager.monitors;
        for (let i = 0; i < monitors.length; i++) {
            let view;
            if (this._workspacesOnlyOnPrimary && i != this._primaryIndex)
                view = new ExtraWorkspaceView(i);
            else
                view = new WorkspacesView(i, this._scrollAdjustment, this.getRows(), this.getColumns());

            this._workspacesViews.push(view);
            Main.layoutManager.overviewGroup.add_actor(view);
        }
    }
}
