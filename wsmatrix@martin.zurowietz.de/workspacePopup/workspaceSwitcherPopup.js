import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';
import WorkspaceSwitcherPopupList from "./workspaceSwitcherPopupList.js";
import WorkspaceThumbnail from "./workspaceThumbnail.js";
import {SwitcherPopup} from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import WorkspaceNames from "../workspaceNames.js";

var modals = [];
const SWIPE_POPUP_FALLBACK_TIMEOUT = 500;

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
        this._names = new WorkspaceNames(wm.settings);
        this._editing = false;
        this._toggle = options.toggle || false;
        this._items = this._createThumbnails();

        options.groupAxis = this._names.axis();
        options.groupNames = this._names.groupNamesArray();
        options.showGroupHeaders = this._names.groupCount() > 1;

        this._switcherList = new WorkspaceSwitcherPopupList(this._items, this._createLabels(), options);
        this._overviewKeybindingActions = options.overveiwKeybindingActions;
        this._noModsTimeoutId = 0;
        this._nonModal = false;

        // Initially disable hover so we ignore the enter-event if
        // the switcher appears underneath the current pointer location
        this._disableHover();
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
        this.selectedIndex = num;
        this._switcherList.highlight(num);

        // on item selected, switch/move to the workspace
        let workspaceManager = global.workspace_manager;
        let wm = Main.wm;
        let newWs = workspaceManager.get_workspace_by_index(this.selectedIndex);
        wm.actionMoveWorkspace(newWs);
    }

    _beginRename(kind) {
        if (this._editing)
            return;

        const index = this._switcherList._highlighted;
        if (index === undefined || index < 0)
            return;

        this._editing = true;
        const done = () => {
            this._editing = false;
            global.stage.set_key_focus(this);
        };

        if (kind === 'workspace') {
            const text = this._names.rawWorkspaceName(index);
            this._switcherList.editWorkspace(index, text,
                (value) => {
                    this._names.setWorkspaceName(index, value);
                    done();
                },
                () => done());
        } else {
            const groupIndex = this._names.groupIndexOf(index);
            const text = this._names.groupName(groupIndex);
            this._switcherList.editGroup(groupIndex, text,
                (value) => {
                    this._names.setGroupName(groupIndex, value);
                    done();
                },
                () => done());
        }
    }

    _itemEnteredHandler(n) {
        if (this._enablePopupWorkspaceHover) {
            this._select(n);
        }
    }

    showToggle(backward, binding, mask, toggle) {
        this.resetTimeout();

        this._toggle = toggle;
        if (this._popupTimeout > 0 || this._toggle) {
            mask = 0
        }

        if (this.show(backward, binding, mask)) {
            this._showImmediately();
            this.opacity = 255;
            modals.push(this);
        }
    }

    // Show the popup as a passive, non-reactive overlay without grabbing a
    // modal. Used for touchpad-swipe navigation: a modal would swallow the
    // swipe before it reaches the tracker on global.stage. Skipping pushModal
    // keeps `_haveModal` false, so teardown stays a no-op.
    showNonModal() {
        if (this._items.length === 0)
            return false;

        this.reactive = false;

        this.add_child(this._switcherList);

        this.visible = true;
        this.opacity = 255;

        this.get_allocation_box();
        this._initialSelection(false, null);

        this._nonModal = true;
        this.resetTimeout();
        modals.push(this);
        return true;
    }

    updateHighlight() {
        this._switcherList.highlight(global.workspace_manager.get_active_workspace_index());
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

        if (this._toggle)
            return;

        // A non-modal swipe popup has no key/modifier-release path to close it,
        // so it must always auto-dismiss. If the user's popup timeout is 0
        // (valid for the modal keyboard popup, which closes on key release),
        // fall back to a finite timeout so the popup and the blocked workspace
        // tracker cannot get stuck.
        let timeout = this._popupTimeout;
        if (timeout <= 0 && this._nonModal)
            timeout = SWIPE_POPUP_FALLBACK_TIMEOUT;

        if (timeout > 0) {
            this._noModsTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                timeout,
                () => {
                    this._finish(global.display.get_current_time_roundtrip());
                    this._noModsTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                });
        }
    }

    _keyPressHandler(_keysym, _action) {
        if (this._editing)
            return Clutter.EVENT_STOP;

        if (this._toggle) {
            if (_keysym === Clutter.KEY_r || _keysym === Clutter.KEY_R) {
                this._beginRename('workspace');
                return Clutter.EVENT_STOP;
            }
            if (_keysym === Clutter.KEY_g || _keysym === Clutter.KEY_G) {
                this._beginRename('group');
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
        if (this._names) {
            this._names.destroy();
            this._names = null;
        }

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
    }
});
