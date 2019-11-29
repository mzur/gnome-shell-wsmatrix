const { Clutter } = imports.gi;
const workspacesView = imports.ui.workspacesView;
const WorkspacesView = workspacesView.WorkspacesView;
const Tweener = imports.ui.tweener;

var WorkspacesViewOverride = class {
   constructor(settings) {
      this.settings = settings;
      this.overrideOriginalProperties();
   }

   destroy() {
      this.restoreOriginalProperties();
   }

   overrideOriginalProperties() {
      WorkspacesView.prototype._overrideProperties = {
         _updateWorkspaceActors: WorkspacesView.prototype._updateWorkspaceActors,
      };
      WorkspacesView.prototype._updateWorkspaceActors = this._updateWorkspaceActors;
   }

   restoreOriginalProperties() {
      WorkspacesView.prototype._updateWorkspaceActors = WorkspacesView.prototype._overrideProperties._updateWorkspaceActors;
      delete WorkspacesView.prototype._overrideProperties;
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

         workspace.actor.remove_all_transitions();


         let params = {};
         if (this.actor.text_direction == Clutter.TextDirection.RTL) {
            params.x = (activeColumn - workspaceColumn) * this._fullGeometry.width;
         } else {
            params.x = (workspaceColumn - activeColumn) * this._fullGeometry.width;
         }
         params.y = (workspaceRow - activeRow) * this._fullGeometry.height;

         if (showAnimation) {
            let easeParams = Object.assign(params);
            
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

            if (workspace.actor.ease === undefined) {
               //maintain compatibility with gnome prior to 3.34
               easeParams = Object.assign(params, {
                  time: workspacesView.WORKSPACE_SWITCH_TIME,
                  transition: 'easeOutQuad'
               });
               Tweener.addTween(workspace.actor, easeParams);
            }
            else {
               easeParams = Object.assign(params, {
                  duration: workspacesView.WORKSPACE_SWITCH_TIME,
                  mode: Clutter.AnimationMode.EASE_OUT_QUAD
               });
               workspace.actor.ease(easeParams);
            }
         } else {
            workspace.actor.set(params);
            if (w == 0) {
               this._updateVisibility();
            }
         }
      }
   }
}
