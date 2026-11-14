import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';
import WorkspaceSwitcherPopupList from "./workspaceSwitcherPopupList.js";
import WorkspaceThumbnail from "./workspaceThumbnail.js";
import {SwitcherPopup} from 'resource:///org/gnome/shell/ui/switcherPopup.js';

var modals = [];

export default GObject.registerClass(
class WorkspaceSwitcherPopup extends SwitcherPopup {
    _init(options, wm) {
        super._init();
        this._monitorIndex = options.monitorIndex;
        this._monitor = Main.layoutManager.monitors[this._monitorIndex];
        this._scale = options.scale;
        this._popupTimeout = options.popupTimeout;
        this._enablePopupWorkspaceHover = options.enablePopupWorkspaceHover;
        this._wm = wm;
        this._moving = false;
        this._moveOrigin = -1;
        this._moveCursor = -1;
        // Every monitor has its own popup, so all of them follow the actual
        // workspace order, not just the one the move was made in.
        this._reorderedId = global.workspace_manager.connect('workspaces-reordered', () => {
            this._switcherList.reorderItems();
            this._refreshLabels();
            this._switcherList.highlight(this._moving
                ? this._moveCursor
                : global.workspace_manager.get_active_workspace_index());
        });
        this._toggle = options.toggle || false;
        this._items = this._createThumbnails();
        this._switcherList = new WorkspaceSwitcherPopupList(this._items, this._createLabels(), options);
        this._overviewKeybindingActions = options.overveiwKeybindingActions;
        this._noModsTimeoutId = 0;

        // Initially disable hover so we ignore the enter-event if
        // the switcher appears underneath the current pointer location
        this._disableHover();

        this._hintLabel = new St.Label({
            style_class: 'wsmatrix-hint',
            visible: this._toggle,
        });
        this._updateHint();
        this.add_child(this._hintLabel);
    }

    _createThumbnails() {
        let thumbnails = [];
        let workspaceManager = global.workspace_manager;

        for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            let workspace = workspaceManager.get_workspace_by_index(i);
            let thumbnail = new WorkspaceThumbnail(workspace, this._monitorIndex)
            thumbnails.push(thumbnail);
        }

        return thumbnails;
    }

    _createLabels() {
        let labels = [];
        let workspaceManager = global.workspace_manager;

        for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            let label = Meta.prefs_get_workspace_name(i);
            labels.push(label);
        }

        return labels;
    }

    // initial selection of workspace in the popup, if not implemented, a movement to current workspace will occur everytime the popup shows up
    _initialSelection(backward, _binding) {
        let workspaceManager = global.workspace_manager;
        this._switcherList.highlight(workspaceManager.get_active_workspace_index());
    }

    // select next workspace (used while scrolling the switcher popup with the mouse wheel)
    _next() {
        let workspaceManager = global.workspace_manager;
        return Math.min(workspaceManager.get_active_workspace_index() + 1, workspaceManager.n_workspaces - 1);
    }

    // select previous workspace (used while scrolling the switcher popup with the mouse wheel)
    _previous() {
        let workspaceManager = global.workspace_manager;
        return Math.max(workspaceManager.get_active_workspace_index() - 1, 0);
    }

    // on workspace selected (in switcher popup)
    _select(num) {
        // While a workspace is being moved, clicks and hover must not change
        // the selection; the arrow keys drive the move instead.
        if (this._moving)
            return;

        this.selectedIndex = num;
        this._switcherList.highlight(num);

        // on item selected, switch/move to the workspace
        let workspaceManager = global.workspace_manager;
        let wm = Main.wm;
        let newWs = workspaceManager.get_workspace_by_index(this.selectedIndex);
        wm.actionMoveWorkspace(newWs);
    }

    _itemEnteredHandler(n) {
        if (this._enablePopupWorkspaceHover) {
            this._select(n);
        }
    }

    showToggle(backward, binding, mask, toggle) {
        this.resetTimeout();

        this._toggle = toggle;
        this._hintLabel.visible = toggle;
        if (this._popupTimeout > 0 || this._toggle) {
            mask = 0
        }

        if (this.show(backward, binding, mask)) {
            this._showImmediately();
            this.opacity = 255;
            modals.push(this);
        }
    }

    _resetNoModsTimeout() {
        // Disable this function so the custom timeout works.
    }

    resetTimeout() {
        modals.filter(m => m).forEach(m => {
            if (m._noModsTimeoutId !== 0) {
                GLib.source_remove(m._noModsTimeoutId);
                m._noModsTimeoutId = 0;
            }
        });

        if (this._popupTimeout > 0 && !this._toggle) {
            this._noModsTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._popupTimeout,
                () => {
                    this._finish(global.display.get_current_time_roundtrip());
                    this._noModsTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                });
        }
    }

    _itemActivated(switcher, n) {
        // A click while a workspace is being moved must not close the
        // overview (the stock handler always finishes the popup).
        if (this._moving)
            return;

        super._itemActivated(switcher, n);
    }

    _updateHint() {
        this._hintLabel.text = this._moving
            ? 'Arrow keys: move    Enter: keep    Esc: cancel'
            : 'Press m to move the selected workspace';
    }

    _beginMove() {
        const index = this._switcherList._highlighted;
        if (this._moving || index === undefined || index < 0 ||
            global.workspace_manager.n_workspaces < 2)
            return;

        this._moving = true;
        this._moveOrigin = index;
        this._moveCursor = index;
        this._switcherList.setHolding(index);
        this._updateHint();
    }

    // Move the held workspace one cell. Only the preview changes; workspaces
    // and names are left alone until the move is confirmed.
    _moveHeld(direction) {
        const wsm = global.workspace_manager;
        const columns = wsm.layout_columns;
        const rows = wsm.layout_rows;
        const from = this._moveCursor;
        const row = Math.floor(from / columns);
        const col = from % columns;

        let to = -1;
        if (direction === 'left' && col > 0)
            to = from - 1;
        else if (direction === 'right' && col < columns - 1)
            to = from + 1;
        else if (direction === 'up' && row > 0)
            to = from - columns;
        else if (direction === 'down' && row < rows - 1)
            to = from + columns;

        if (to < 0 || to >= wsm.n_workspaces)
            return;

        this._moveCursor = to;
        this._switcherList.previewExchange(this._moveOrigin, to);
        this._switcherList.highlight(to);
    }

    _endMove(keep) {
        if (!this._moving)
            return;

        const target = keep ? this._moveCursor : this._moveOrigin;
        this._moving = false;
        if (keep && this._moveCursor !== this._moveOrigin)
            this._wm.swapWorkspaces(this._moveOrigin, this._moveCursor);

        this._switcherList.reorderItems();
        this._switcherList.highlight(target);
        this._switcherList.clearHolding();
        this._moveOrigin = -1;
        this._moveCursor = -1;
        this._updateHint();
    }

    // Names are stored by position, so after a swap each cell shows the name
    // now stored for its position.
    _refreshLabels() {
        for (let i = 0; i < global.workspace_manager.n_workspaces; i++)
            this._switcherList.updateWorkspaceText(i, Meta.prefs_get_workspace_name(i));
    }

    _keyPressHandler(_keysym, _action) {
        if (this._toggle && this._moving) {
            if (_keysym === Clutter.KEY_Escape) {
                this._endMove(false);
                return Clutter.EVENT_STOP;
            }
            if (_keysym === Clutter.KEY_m || _keysym === Clutter.KEY_M ||
                _keysym === Clutter.KEY_Return || _keysym === Clutter.KEY_KP_Enter ||
                _keysym === Clutter.KEY_ISO_Enter) {
                this._endMove(true);
                return Clutter.EVENT_STOP;
            }
            for (const key in this._overviewKeybindingActions) {
                if (this._overviewKeybindingActions[key] !== _action)
                    continue;
                if (key === 'confirm')
                    this._endMove(true);
                else
                    this._moveHeld(key);
                break;
            }
            // Other keys are ignored while moving.
            return Clutter.EVENT_STOP;
        }

        if (this._toggle) {
            if (_keysym === Clutter.KEY_m || _keysym === Clutter.KEY_M) {
                this._beginMove();
                return Clutter.EVENT_STOP;
            }

            for (var key in this._overviewKeybindingActions) {
                if (this._overviewKeybindingActions[key] === _action) {
                    switch (key) {
                        case 'right':
                            this._wm._workspaceOverviewMoveRight();
                            break;
                        case 'left':
                            this._wm._workspaceOverviewMoveLeft();
                            break;
                        case 'up':
                            this._wm._workspaceOverviewMoveUp();
                            break;
                        case 'down':
                            this._wm._workspaceOverviewMoveDown();
                            break;
                        case 'confirm':
                            this.fadeAndDestroy();
                            break;
                    }

                    return Clutter.EVENT_STOP;
                }
            }
        }

        for (var key in Meta.KeyBindingAction) {
            let value = Meta.KeyBindingAction[key];
            if (value == _action) {
                key = key.toLowerCase();
                if (key.startsWith('workspace_')) {
                    key = 'switch-to-workspace-' + key.replace('workspace_', '');
                }

                if (key.startsWith('move_to_workspace_')) {
                    key = 'move-to-workspace-' + key.replace('move_to_workspace_', '');
                }

                this._wm._showWorkspaceSwitcher(global.display, global.display.focus_window, null, key);
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _finish(_timestamp) {
        this._disableHover();
        while (modals.length > 0) {
            modals.pop().fadeAndDestroy();
        }
    }

    _onDestroy() {
        global.workspace_manager.disconnect(this._reorderedId);

        if (this._noModsTimeoutId != 0) {
            GLib.source_remove(this._noModsTimeoutId);
            this._noModsTimeoutId = 0;
        }

        this._items.forEach((x) => x.destroy());
        this._items = [];

        super._onDestroy();

        while (modals.length > 0) {
            modals.pop().destroy();
        }

    }

    vfunc_allocate(box) {
        this.set_allocation(box);
        let childBox = new Clutter.ActorBox();

        let leftPadding = this.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.get_theme_node().get_padding(St.Side.RIGHT);
        let hPadding = leftPadding + rightPadding;

        // Allocate the switcherList
        // We select a size based on an icon size that does not overflow the screen
        let [, childNaturalHeight] = this._switcherList.get_preferred_height(this._monitor.width - hPadding);
        let [, childNaturalWidth] = this._switcherList.get_preferred_width(childNaturalHeight);
        childBox.x1 = Math.max(this._monitor.x + leftPadding, this._monitor.x + Math.floor((this._monitor.width - childNaturalWidth) / 2));
        childBox.x2 = Math.min(this._monitor.x + this._monitor.width - rightPadding, childBox.x1 + childNaturalWidth);
        childBox.y1 = this._monitor.y + Math.floor((this._monitor.height - childNaturalHeight) / 2);
        childBox.y2 = childBox.y1 + childNaturalHeight;
        this._switcherList.allocate(childBox);

        if (this._hintLabel.visible) {
            const [, hintHeight] = this._hintLabel.get_preferred_height(-1);
            const [, hintWidth] = this._hintLabel.get_preferred_width(-1);
            const hintBox = new Clutter.ActorBox();
            hintBox.x1 = this._monitor.x + Math.floor((this._monitor.width - hintWidth) / 2);
            hintBox.x2 = hintBox.x1 + hintWidth;
            // Below the grid, but never off the bottom of the monitor.
            hintBox.y1 = Math.min(childBox.y2 + 12, this._monitor.y + this._monitor.height - hintHeight);
            hintBox.y2 = hintBox.y1 + hintHeight;
            this._hintLabel.allocate(hintBox);
        }
    }
});
