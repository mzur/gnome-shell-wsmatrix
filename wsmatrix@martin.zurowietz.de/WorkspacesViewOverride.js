const { Clutter } = imports.gi;
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
         _updateWorkspaceActors: WorkspacesView.prototype._updateWorkspaceActors,
      };
      WorkspacesView.prototype._updateWorkspaceActors = this._updateWorkspaceActors;
      WorkspacesView.prototype.getRows = this.getRows.bind(this);
      WorkspacesView.prototype.getColumns = this.getColumns.bind(this);
   }

   restoreOriginalProperties() {
      WorkspacesView.prototype._updateWorkspaceActors = WorkspacesView.prototype._overrideProperties._updateWorkspaceActors;
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

   // Update workspace actors parameters
   // @showAnimation: iff %true, transition between states
   _updateWorkspaceActors(showAnimation) {
      let workspaceManager = global.workspace_manager;
      let active = workspaceManager.get_active_workspace_index();
      let activeRow = Math.floor(active / this.getColumns());
      let activeColumn = active % this.getColumns();
      this._animating = showAnimation;

      for (let w = 0; w < this._workspaces.length; w++) {
         let workspace = this._workspaces[w];
         let workspaceRow = Math.floor(w / this.getColumns());
         let workspaceColumn = w % this.getColumns();

         workspace.remove_all_transitions();

         let params = {};
         if (this.text_direction == Clutter.TextDirection.RTL) {
            params.x = (activeColumn - workspaceColumn) * this._fullGeometry.width;
         } else {
            params.x = (workspaceColumn - activeColumn) * this._fullGeometry.width;
         }
         params.y = (workspaceRow - activeRow) * this._fullGeometry.height;

         if (showAnimation) {
            let easeParams = Object.assign(params, {
               duration: workspacesView.WORKSPACE_SWITCH_TIME,
               mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            });
            // we have to call _updateVisibility() once before the
            // animation and once afterwards - it does not really
            // matter which tween we use, so we pick the first one ...
            if (w == 0) {
               this._updateVisibility();
               easeParams.onComplete = () => {
                  this._animating = false;
                  this._updateVisibility();
               };
            }
            workspace.ease(easeParams);
         } else {
            workspace.set(params);
            if (w == 0) {
               this._updateVisibility();
            }
         }
      }
   }
}
