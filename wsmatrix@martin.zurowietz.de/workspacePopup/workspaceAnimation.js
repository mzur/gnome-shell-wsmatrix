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

// Patch the grid-aware workspace switch animation into the existing controller of
// the shell instead of replacing the controller with a second instance. A second
// instance has its own swipe tracker, but the tracker of the original controller
// still receives (and consumes) all gestures. The original controller then activates
// the new workspace at the end of the gesture, and since the replacement controller
// knows nothing about the gesture, it plays the switch animation a second time.
//
// Returns a function that removes the patch again.
export function overrideWorkspaceAnimation(controller) {
    const original = controller._prepareWorkspaceSwitch;

    controller._prepareWorkspaceSwitch = function (workspaceIndices) {
        // Gestures (swipe, modifier + scroll) call this without indices and need the
        // linear layout of the original MonitorGroup that the swipe tracker expects.
        if (!workspaceIndices)
            return original.call(this);

        if (this._switchData)
            return;

        const switchData = {};

        this._switchData = switchData;
        switchData.monitors = [];

        switchData.gestureActivated = false;
        switchData.inProgress = false;

        const monitors = Meta.prefs_get_workspaces_only_on_primary()
            ? [Main.layoutManager.primaryMonitor] : Main.layoutManager.monitors;

        for (const monitor of monitors) {
            const group = new MonitorGroup(monitor, workspaceIndices, this.movingWindow);

            Main.uiGroup.insert_child_above(group, global.window_group);

            switchData.monitors.push(group);
        }

        global.compositor.disable_unredirect();
    };

    return () => {
        // Remove the instance property so the prototype method is used again.
        delete controller._prepareWorkspaceSwitch;
    };
}

// Two dimensional touchpad swipes for the grid: horizontal swipes move within
// the current row, vertical swipes within the current column, with the grid
// switch animation. Works on the shell's own animation controller: its
// horizontal swipe tracker keeps its normal enabled/disabled handling, but its
// stock handlers are blocked and grid aware ones are connected instead; a
// second tracker handles vertical swipes. The overview's own vertical swipe
// (which opens the Activities overview) is paused meanwhile.
export class GridSwipe {
    constructor(controller) {
        this._controller = controller;
        this._verticalTracker = null;
        this._handlerIds = [];
        this._lastIndex = -1;

        // Called with the index of the workspace the gesture would land on.
        this.onBegin = null;
        this.onUpdate = null;
        this.onEnd = null;
    }

    get enabled() {
        return this._verticalTracker !== null;
    }

    enable() {
        if (this.enabled)
            return;

        const horizontal = this._controller._swipeTracker;
        GObject.signal_handlers_block_matched(horizontal, {signalId: 'begin'});
        GObject.signal_handlers_block_matched(horizontal, {signalId: 'update'});
        GObject.signal_handlers_block_matched(horizontal, {signalId: 'end'});
        this._connect(horizontal);

        this._verticalTracker = new SwipeTracker.SwipeTracker(global.stage,
            Clutter.Orientation.VERTICAL,
            Shell.ActionMode.NORMAL,
            {
                allowDrag: false,
                phase: Clutter.EventPhase.CAPTURE,
                name: 'Workspace Matrix vertical swipe tracker',
            });
        global.display.bind_property('compositor-modifiers',
            this._verticalTracker, 'scroll-modifiers',
            GObject.BindingFlags.SYNC_CREATE);
        this._connect(this._verticalTracker);

        const overviewTracker = Main.overview._swipeTracker;
        if (overviewTracker) {
            this._overviewTrackerEnabled = overviewTracker.enabled;
            overviewTracker.enabled = false;
        }
    }

    disable() {
        if (!this.enabled)
            return;

        this.onBegin = null;
        this.onUpdate = null;
        this.onEnd = null;

        // A grid gesture still under the finger would never get its end once
        // the trackers are gone, so drop its animation now. One that is
        // already settling finishes on its own.
        const switchData = this._controller._switchData;
        if (switchData?.gridSwipe && !switchData.gestureActivated)
            this._controller._finishWorkspaceSwitch(switchData);

        // Disconnect ours first, so that only the stock handlers are left to
        // unblock.
        this._handlerIds.forEach(([tracker, id]) => tracker.disconnect(id));
        this._handlerIds = [];

        const horizontal = this._controller._swipeTracker;
        GObject.signal_handlers_unblock_matched(horizontal, {signalId: 'begin'});
        GObject.signal_handlers_unblock_matched(horizontal, {signalId: 'update'});
        GObject.signal_handlers_unblock_matched(horizontal, {signalId: 'end'});

        this._verticalTracker.destroy();
        this._verticalTracker = null;

        const overviewTracker = Main.overview._swipeTracker;
        if (overviewTracker && this._overviewTrackerEnabled !== undefined)
            overviewTracker.enabled = this._overviewTrackerEnabled;
        this._overviewTrackerEnabled = undefined;
    }

    _connect(tracker) {
        this._handlerIds.push(
            [tracker, tracker.connect('begin', this._begin.bind(this))],
            [tracker, tracker.connect('update', this._update.bind(this))],
            [tracker, tracker.connect('end', this._end.bind(this))]);
    }

    // The workspaces of the active row (horizontal) or column (vertical).
    _workspaceIndices(horizontal) {
        const workspaceManager = global.workspace_manager;
        const columns = workspaceManager.layout_columns;
        const rows = workspaceManager.layout_rows;
        const active = workspaceManager.get_active_workspace_index();
        const row = Math.floor(active / columns);
        const column = active % columns;

        const indices = [];
        if (horizontal) {
            for (let c = 0; c < columns; c++)
                indices.push(row * columns + c);
        } else {
            for (let r = 0; r < rows; r++)
                indices.push(r * columns + column);
        }
        return indices.filter(i => i < workspaceManager.n_workspaces);
    }

    _begin(tracker, monitor) {
        const controller = this._controller;
        if (Meta.prefs_get_workspaces_only_on_primary() &&
            monitor !== Main.layoutManager.primaryIndex)
            return;

        const horizontal = tracker.orientation === Clutter.Orientation.HORIZONTAL;
        const indices = this._workspaceIndices(horizontal);
        if (indices.length < 2)
            return;

        // Returning without confirmSwipe() ignores the gesture. A running
        // animation is only taken over if it is one of ours in the same
        // direction that is settling after its gesture ended; not a keyboard
        // switch, and not a swipe along the other axis.
        const current = controller._switchData;
        if (current) {
            if (!current.gestureActivated || current.gridSwipe?.horizontal !== horizontal)
                return;
            // Stopping the settling animation does not run its completion;
            // the gesture is under the finger again.
            for (const group of current.monitors)
                group.remove_all_transitions();
            current.gestureActivated = false;
        } else {
            controller._prepareWorkspaceSwitch(indices);
            controller._switchData.gridSwipe = {horizontal};
        }

        const monitorGroup = controller._findMonitorGroup(monitor);
        const baseDistance = horizontal ? monitorGroup.baseDistanceX : monitorGroup.baseDistanceY;
        const progress = monitorGroup.progress;
        const closestWs = monitorGroup.findClosestWorkspace(progress);
        const cancelProgress = monitorGroup.getWorkspaceProgress(closestWs);

        controller._switchData.baseMonitorGroup = monitorGroup;
        tracker.confirmSwipe(baseDistance, monitorGroup.getSnapPoints(), progress, cancelProgress);

        this._lastIndex = closestWs.index();
        this.onBegin?.(this._lastIndex);
    }

    _update(tracker, progress) {
        const switchData = this._controller._switchData;
        if (!switchData?.gridSwipe)
            return;

        for (const monitorGroup of switchData.monitors)
            monitorGroup.updateSwipeForMonitor(progress, switchData.baseMonitorGroup);

        // Only report when the workspace the gesture would land on changes.
        const index = switchData.baseMonitorGroup.findClosestWorkspace(progress).index();
        if (index === this._lastIndex)
            return;
        this._lastIndex = index;
        this.onUpdate?.(index);
    }

    _end(tracker, duration, endProgress) {
        const controller = this._controller;
        const switchData = controller._switchData;
        if (!switchData?.gridSwipe)
            return;

        switchData.gestureActivated = true;

        const newWs = switchData.baseMonitorGroup.findClosestWorkspace(endProgress);
        const endTime = Clutter.get_current_event_time();
        let endReported = false;

        for (const monitorGroup of switchData.monitors) {
            const params = {
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            };

            if (monitorGroup.index === Main.layoutManager.primaryIndex) {
                endReported = true;
                params.onComplete = () => {
                    if (!newWs.active)
                        newWs.activate(endTime);
                    controller._finishWorkspaceSwitch(switchData);
                    // Also when the swipe returns to where it started.
                    this.onEnd?.(newWs.index());
                };
            }

            monitorGroup.ease_property('progress', monitorGroup.getWorkspaceProgress(newWs), params);
        }

        if (!endReported)
            this.onEnd?.(newWs.index());
    }
}
