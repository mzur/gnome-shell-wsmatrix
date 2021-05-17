const {GObject, Meta, St} = imports.gi;

const Main = imports.ui.main;
const GWorkspaceAnimation = imports.ui.workspaceAnimation;

const WORKSPACE_SPACING = 100;

const MonitorGroup = GObject.registerClass(
   class MonitorGroup extends GWorkspaceAnimation.MonitorGroup {
      _init(monitor, workspaceIndices, movingWindow) {
         super._init(monitor, workspaceIndices, movingWindow);

         this.activeWorkspace = workspaceIndices[0];
         this.targetWorkspace = workspaceIndices[workspaceIndices.length - 1];

         let x = 0;
         let y = 0;
         let workspaceManager = global.workspace_manager;
         this._workspaceGroups = [];

         for (const i of workspaceIndices) {
            let fromRow = Math.floor(this.activeWorkspace / this.columns);
            let fromColumn = this.activeWorkspace % this.columns;

            let targetRow = Math.floor(this.targetWorkspace / this.columns);
            let targetColumn = this.targetWorkspace % this.columns;
            let vertical = targetRow !== fromRow && targetColumn === fromColumn;

            let ws = workspaceManager.get_workspace_by_index(i);
            let fullscreen = ws.list_windows().some(w => w.get_monitor() === monitor.index && w.is_fullscreen());

            if (i > 0 && vertical && !fullscreen && monitor.index === Main.layoutManager.primaryIndex) {
               // We have to shift windows up or down by the height of the panel to prevent having a
               // visible gap between the windows while switching workspaces. Since fullscreen windows
               // hide the panel, they don't need to be shifted up or down.
               y -= Main.panel.height;
            }

            const group = new GWorkspaceAnimation.WorkspaceGroup(ws, monitor, movingWindow);
            // avoid warnings
            group._syncStacking = () => {};

            this._workspaceGroups.push(group);
            this._container.add_child(group);
            group.set_position(x, y);

            if (targetRow > fromRow)
               y += this.baseDistanceY;
            else if (targetRow < fromRow)
               y -= this.baseDistanceY;

            if (targetColumn > fromColumn)
               x += this.baseDistanceX;
            else if (targetColumn < fromColumn)
               x -= this.baseDistanceX;
         }

      }

      get rows() {
         const workspaceManager = global.workspace_manager;
         return workspaceManager.layout_rows;
      }

      get columns() {
         const workspaceManager = global.workspace_manager;
         return workspaceManager.layout_columns;
      }

      get baseDistanceX() {
         const spacing = WORKSPACE_SPACING * St.ThemeContext.get_for_stage(global.stage).scale_factor;
         return this._monitor.width + spacing;
      }

      get baseDistanceY() {
         const spacing = WORKSPACE_SPACING * St.ThemeContext.get_for_stage(global.stage).scale_factor;
         return this._monitor.height + spacing;
      }

      get progress() {
         let fromRow = Math.floor(this.activeWorkspace / this.columns);
         let fromColumn = this.activeWorkspace % this.columns;

         let targetRow = Math.floor(this.targetWorkspace / this.columns);
         let targetColumn = this.targetWorkspace % this.columns;

         if (targetRow > fromRow)
            return -this._container.y / this.baseDistanceY;
         else if (targetRow < fromRow)
            return this._container.y / this.baseDistanceY;

         if (targetColumn > fromColumn)
            return -this._container.x / this.baseDistanceX;
         else if (targetColumn < fromColumn)
            return this._container.x / this.baseDistanceX;
      }

      set progress(p) {
         let fromRow = Math.floor(this.activeWorkspace / this.columns);
         let fromColumn = this.activeWorkspace % this.columns;

         let targetRow = Math.floor(this.targetWorkspace / this.columns);
         let targetColumn = this.targetWorkspace % this.columns;

         if (targetRow > fromRow)
            this._container.y = -Math.round(p * this.baseDistanceY);
         else if (targetRow < fromRow)
            this._container.y = Math.round(p * this.baseDistanceY);

         if (targetColumn > fromColumn)
            this._container.x = -Math.round(p * this.baseDistanceX);
         else if (targetColumn < fromColumn)
            this._container.x = Math.round(p * this.baseDistanceX);
      }

      _getWorkspaceGroupProgress(group) {
         let fromRow = Math.floor(this.activeWorkspace / this.columns);
         let fromColumn = this.activeWorkspace % this.columns;

         let targetRow = Math.floor(this.targetWorkspace / this.columns);
         let targetColumn = this.targetWorkspace % this.columns;

         if (targetRow > fromRow)
            return group.y / this.baseDistanceY;
         else if (targetRow < fromRow)
            return -group.y / this.baseDistanceY;

         if (targetColumn > fromColumn)
            return group.x / this.baseDistanceX;
         else if (targetColumn < fromColumn)
            return -group.x / this.baseDistanceX;
      }
   });

class WorkspaceAnimationController extends GWorkspaceAnimation.WorkspaceAnimationController {
   _prepareWorkspaceSwitch(workspaceIndices) {
      if (this._switchData)
         return;

      const workspaceManager = global.workspace_manager;
      const nWorkspaces = workspaceManager.get_n_workspaces();

      const switchData = {};

      this._switchData = switchData;
      switchData.monitors = [];

      switchData.gestureActivated = false;
      switchData.inProgress = false;

      if (!workspaceIndices)
         workspaceIndices = [...Array(nWorkspaces).keys()];

      const monitors = Meta.prefs_get_workspaces_only_on_primary()
         ? [Main.layoutManager.primaryMonitor] : Main.layoutManager.monitors;

      for (const monitor of monitors) {
         if (Meta.prefs_get_workspaces_only_on_primary() &&
            monitor.index !== Main.layoutManager.primaryIndex)
            continue;

         const group = new MonitorGroup(monitor, workspaceIndices, this.movingWindow);

         Main.uiGroup.insert_child_above(group, global.window_group);

         switchData.monitors.push(group);
      }

      Meta.disable_unredirect_for_display(global.display);
   }
}
