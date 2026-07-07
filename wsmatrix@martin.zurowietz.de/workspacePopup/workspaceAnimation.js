import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {MonitorConstraint} from 'resource:///org/gnome/shell/ui/layout.js';
import * as SwipeTracker from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {
    WORKSPACE_SPACING,
    WorkspaceGroup,
    WorkspaceAnimationController as GWorkspaceAnimationController,
    // MonitorGroup as GMonitorGroup
} from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';

// I didn't fine a way to extend the native MonitorGroup so this is a modified full copy
// of the class.
const MonitorGroup = GObject.registerClass({
    Properties: {
        'progress': GObject.ParamSpec.double(
            'progress', 'progress', 'progress',
            GObject.ParamFlags.READWRITE,
            -Infinity, Infinity, 0),
    },
}, class MonitorGroup extends St.Widget {
    get baseDistance() {
        const spacing = WORKSPACE_SPACING * St.ThemeContext.get_for_stage(global.stage).scale_factor;

        if (global.workspace_manager.layout_rows === -1)
            return this._monitor.height + spacing;
        else
            return this._monitor.width + spacing;
    }

    get index() {
        return this._monitor.index;
    }

    getWorkspaceProgress(workspace) {
        const group = this._workspaceGroups.find(g =>
            g.workspace.index() === workspace.index());
        return this._getWorkspaceGroupProgress(group);
    }

    getSnapPoints() {
        return this._workspaceGroups.map(g =>
            this._getWorkspaceGroupProgress(g));
    }

    findClosestWorkspace(progress) {
        const distances = this.getSnapPoints().map(p =>
            Math.abs(p - progress));
        const index = distances.indexOf(Math.min(...distances));
        return this._workspaceGroups[index].workspace;
    }

    _interpolateProgress(progress, monitorGroup) {
        if (this.index === monitorGroup.index)
            return progress;

        const points1 = monitorGroup.getSnapPoints();
        const points2 = this.getSnapPoints();

        const upper = points1.indexOf(points1.find(p => p >= progress));
        const lower = points1.indexOf(points1.slice().reverse().find(p => p <= progress));

        if (points1[upper] === points1[lower])
            return points2[upper];

        const t = (progress - points1[lower]) / (points1[upper] - points1[lower]);

        return points2[lower] + (points2[upper] - points2[lower]) * t;
    }

    updateSwipeForMonitor(progress, monitorGroup) {
        this.progress = this._interpolateProgress(progress, monitorGroup);
    }

    _init(monitor, workspaceIndices, movingWindow) {
        super._init({
            clip_to_allocation: true,
            style_class: 'workspace-animation',
        });

        this._monitor = monitor;

        const constraint = new MonitorConstraint({index: monitor.index});
        this.add_constraint(constraint);

        this._container = new Clutter.Actor();
        this.add_child(this._container);

        const stickyGroup = new WorkspaceGroup(null, monitor, movingWindow);
        this.add_child(stickyGroup);

        this._workspaceGroups = [];

        const workspaceManager = global.workspace_manager;
        const activeWorkspace = workspaceManager.get_active_workspace();

        this.activeWorkspace = workspaceIndices[0];
        this.targetWorkspace = workspaceIndices[workspaceIndices.length - 1];

        let x = 0;
        let y = 0;

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

            const group = new WorkspaceGroup(ws, monitor, movingWindow);

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

        this.progress = this.getWorkspaceProgress(activeWorkspace);
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

        this.notify('progress');
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

export class WorkspaceAnimationController extends GWorkspaceAnimationController {
    constructor() {
        super();
        this._swipeOverrideEnabled = false;
        this._verticalSwipeTracker = null;
        this.onSwipeComplete = null;
    }

    enableSwipeOverride() {
        if (this._swipeOverrideEnabled)
            return;

        this._swipeOverrideEnabled = true;

        const tracker = new SwipeTracker.SwipeTracker(global.stage,
            Clutter.Orientation.VERTICAL,
            Shell.ActionMode.NORMAL,
            {
                allowDrag: false,
                phase: Clutter.EventPhase.CAPTURE,
                name: 'wsmatrix vertical workspace swipe tracker',
            });
        tracker.connect('begin', this._switchWorkspaceBegin.bind(this));
        tracker.connect('update', this._switchWorkspaceUpdate.bind(this));
        tracker.connect('end', this._switchWorkspaceEnd.bind(this));
        global.display.bind_property('compositor-modifiers', tracker,
            'scroll-modifiers', GObject.BindingFlags.SYNC_CREATE);
        this._verticalSwipeTracker = tracker;
    }

    disableSwipeOverride() {
        if (!this._swipeOverrideEnabled)
            return;

        this._swipeOverrideEnabled = false;

        if (this._verticalSwipeTracker) {
            this._verticalSwipeTracker.destroy();
            this._verticalSwipeTracker = null;
        }
    }

    destroy() {
        this.disableSwipeOverride();
        if (this._swipeTracker) {
            this._swipeTracker.destroy();
            this._swipeTracker = null;
        }
    }

    _getSwipeWorkspaceIndices(horizontal) {
        const workspaceManager = global.workspace_manager;
        const columns = workspaceManager.layout_columns;
        const rows = workspaceManager.layout_rows;
        const activeIndex = workspaceManager.get_active_workspace_index();
        const row = Math.floor(activeIndex / columns);
        const column = activeIndex % columns;

        const indices = [];
        if (horizontal) {
            for (let c = 0; c < columns; c++)
                indices.push(row * columns + c);
        } else {
            for (let r = 0; r < rows; r++)
                indices.push(r * columns + column);
        }
        return indices;
    }

    _switchWorkspaceBegin(tracker, monitor) {
        if (!this._swipeOverrideEnabled) {
            super._switchWorkspaceBegin(tracker, monitor);
            return;
        }

        if (Meta.prefs_get_workspaces_only_on_primary() &&
            monitor !== Main.layoutManager.primaryIndex)
            return;

        const horizontal = tracker.orientation === Clutter.Orientation.HORIZONTAL;
        const workspaceIndices = this._getSwipeWorkspaceIndices(horizontal);

        if (workspaceIndices.length < 2)
            return;

        if (this._switchData && this._switchData.gestureActivated) {
            for (const group of this._switchData.monitors)
                group.remove_all_transitions();
        } else {
            this._prepareWorkspaceSwitch(workspaceIndices);
        }

        const monitorGroup = this._findMonitorGroup(monitor);
        const baseDistance = horizontal
            ? monitorGroup.baseDistanceX
            : monitorGroup.baseDistanceY;
        const progress = monitorGroup.progress;

        const closestWs = monitorGroup.findClosestWorkspace(progress);
        const cancelProgress = monitorGroup.getWorkspaceProgress(closestWs);
        const points = monitorGroup.getSnapPoints();

        this._switchData.baseMonitorGroup = monitorGroup;

        tracker.confirmSwipe(baseDistance, points, progress, cancelProgress);
    }

    _switchWorkspaceEnd(tracker, duration, endProgress) {
        if (!this._switchData)
            return;

        if (!this._swipeOverrideEnabled) {
            super._switchWorkspaceEnd(tracker, duration, endProgress);
            return;
        }

        const switchData = this._switchData;
        switchData.gestureActivated = true;

        const newWs = switchData.baseMonitorGroup.findClosestWorkspace(endProgress);
        const changed = !newWs.active;
        const endTime = Clutter.get_current_event_time();

        for (const monitorGroup of this._switchData.monitors) {
            const progress = monitorGroup.getWorkspaceProgress(newWs);

            const params = {
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            };

            if (monitorGroup.index === Main.layoutManager.primaryIndex) {
                params.onComplete = () => {
                    if (!newWs.active)
                        newWs.activate(endTime);
                    this._finishWorkspaceSwitch(switchData);
                    if (changed && this.onSwipeComplete)
                        this.onSwipeComplete();
                };
            }

            monitorGroup.ease_property('progress', progress, params);
        }
    }

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

        global.compositor.disable_unredirect();
    }
}
