const Self = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceAnimation = Self.imports.workspacePopup.workspaceAnimation;
const Main = imports.ui.main;
const {Clutter, Gio, GLib, Shell, Meta} = imports.gi;
const WorkspaceSwitcherPopup = Self.imports.workspacePopup.workspaceSwitcherPopup;
const GWindowManager = imports.ui.windowManager;

const { SCROLL_TIMEOUT_TIME } = GWindowManager;

const WraparoundMode = {
    NONE: 0,
    NEXT_PREV: 1,
    ROW_COL: 2,
    NEXT_PREV_BORDER: 3,
};

var WorkspaceManagerOverride = class {
    constructor(settings, keybindings) {
        this.wm = Main.wm;
        this.wm._wsPopupList = [];
        this.settings = settings;
        this._mutterSettings = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this.wsManager = global.workspace_manager;
        this.originalDynamicWorkspaces = this._mutterSettings.get_boolean('dynamic-workspaces');
        this.originalAllowedKeybindings = {};
        this._keybindings = keybindings;
        this._overviewKeybindingActions = {};
        this.monitors = [];
        this._workspaceAnimation = new WorkspaceAnimation.WorkspaceAnimationController();
        this.overrideProperties = [
            '_workspaceAnimation',
            'handleWorkspaceScroll',
        ];
        this._overrideDynamicWorkspaces();
        this._overrideKeybindingHandlers();
        this._overrideOriginalProperties();
        this._handleNumberOfWorkspacesChanged();
        this._handleMultiMonitorChanged();
        this._handleWraparoundModeChanged();
        this._connectSettings();
        this._notify();
        this._addKeybindings();
        this._connectLayoutManager();
    }

    destroy() {
        this._destroyWorkspaceSwitcherPopup();
        this._restoreLayout();
        this._restoreKeybindingHandlers();
        this._restoreDynamicWorkspaces();
        this._restoreOriginalProperties();
        this._disconnectSettings();
        this._notify();
        this._removeKeybindings();
        this._disconnectLayoutManager();
    }

    _overrideOriginalProperties() {
        this.wm._overrideProperties = {};
        this.overrideProperties.forEach(function (prop) {
            if (this.wm[prop].bind) {
                this.wm._overrideProperties[prop] = this.wm[prop].bind(this.wm);
                this.wm[prop] = this[prop].bind(this.wm);
            } else {
                this.wm._overrideProperties[prop] = this.wm[prop];
                this.wm[prop] = this[prop];
            }
        }, this);
    }

    _restoreOriginalProperties() {
        this.overrideProperties.forEach(function (prop) {
            this.wm[prop] = this.wm._overrideProperties[prop];
        }, this);
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

        this.settingsHandlerPopupTimeout = this.settings.connect(
            'changed::popup-timeout',
            this._destroyWorkspaceSwitcherPopup.bind(this)
        );

        this.settingsHandlerScale = this.settings.connect(
            'changed::scale',
            this._destroyWorkspaceSwitcherPopup.bind(this)
        );

        this.settingsHandlerMultiMonitor = this.settings.connect(
            'changed::multi-monitor',
            this._handleMultiMonitorChanged.bind(this)
        );

        this.settingsHandlerShowThumbnails = this.settings.connect(
            'changed::show-thumbnails',
            this._destroyWorkspaceSwitcherPopup.bind(this)
        );

        this.settingsHandlerWraparoundMode = this.settings.connect(
            'changed::wraparound-mode',
            this._handleWraparoundModeChanged.bind(this)
        );

        this.settingsHandlerShowWorkspaceNames = this.settings.connect(
            'changed::show-workspace-names',
            this._destroyWorkspaceSwitcherPopup.bind(this)
        );

        this.settingsHandlerEnablePopupWorkspaceHover = this.settings.connect(
            'changed::enable-popup-workspace-hover',
            this._destroyWorkspaceSwitcherPopup.bind(this)
        );
    }

    _disconnectSettings() {
        this.settings.disconnect(this.settingsHandlerRows);
        this.settings.disconnect(this.settingsHandlerColumns);
        this.settings.disconnect(this.settingsHandlerPopupTimeout);
        this.settings.disconnect(this.settingsHandlerScale);
        this.settings.disconnect(this.settingsHandlerMultiMonitor);
        this.settings.disconnect(this.settingsHandlerShowThumbnails);
        this.settings.disconnect(this.settingsHandlerWraparoundMode);
        this.settings.disconnect(this.settingsHandlerShowWorkspaceNames);
        this.settings.disconnect(this.settingsHandlerEnablePopupWorkspaceHover);
    }

    _connectLayoutManager() {
        this.monitorsChanged = Main.layoutManager.connect(
            'monitors-changed',
            this._updateMonitors.bind(this)
        );
    }

    _disconnectLayoutManager() {
        Main.layoutManager.disconnect(this.monitorsChanged);
    }

    _addKeybindings() {
        this.wm.addKeybinding(
            'workspace-overview-toggle',
            this._keybindings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            this._showWorkspaceSwitcherPopup.bind(this, true)
        );
    }

    _addWorkspaceOverviewKeybindings() {
        this._overviewKeybindingActions.right = this.wm.addKeybinding(
            'workspace-overview-right',
            this._keybindings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.POPUP,
            () => null
        );

        this._overviewKeybindingActions.left = this.wm.addKeybinding(
            'workspace-overview-left',
            this._keybindings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.POPUP,
            () => null
        );

        this._overviewKeybindingActions.up = this.wm.addKeybinding(
            'workspace-overview-up',
            this._keybindings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.POPUP,
            () => null
        );

        this._overviewKeybindingActions.down = this.wm.addKeybinding(
            'workspace-overview-down',
            this._keybindings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.POPUP,
            () => null
        );

        this._overviewKeybindingActions.confirm = this.wm.addKeybinding(
            'workspace-overview-confirm',
            this._keybindings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.POPUP,
            () => null
        );
    }

    _removeKeybindings() {
        this.wm.removeKeybinding('workspace-overview-toggle');
    }

    _removeWorkspaceOverviewKeybindings() {
        this.wm.removeKeybinding('workspace-overview-right');
        this.wm.removeKeybinding('workspace-overview-left');
        this.wm.removeKeybinding('workspace-overview-up');
        this.wm.removeKeybinding('workspace-overview-down');
        this.wm.removeKeybinding('workspace-overview-confirm');
    }

    _handleNumberOfWorkspacesChanged() {
        this.rows = this.settings.get_int('num-rows');
        this.columns = this.settings.get_int('num-columns');
        this._overrideNumberOfWorkspaces();
        this._overrideLayout();
        this._destroyWorkspaceSwitcherPopup();
    }

    _handleMultiMonitorChanged() {
        this.multiMonitor = this.settings.get_boolean('multi-monitor');
        this._updateMonitors();
        this._destroyWorkspaceSwitcherPopup();
    }

    _handleWraparoundModeChanged() {
        this.wraparoundMode = this.settings.get_enum('wraparound-mode');
    }

    _overrideLayout() {
        this.wsManager.override_workspace_layout(
            Meta.DisplayCorner.TOPLEFT, // workspace 0
            false, // true == lay out in columns. false == lay out in rows
            this.rows,
            this.columns
        );
    }

    _restoreLayout() {
        this.wsManager.override_workspace_layout(
            Meta.DisplayCorner.TOPLEFT, // workspace 0
            false, // true == lay out in columns. false == lay out in rows
            1,
            -1
        );
    }

    _overrideKeybindingHandlers() {
        for (let key in this.wm._allowedKeybindings) {
            if (key.includes('workspace')) {
                this.originalAllowedKeybindings[key] = this.wm._allowedKeybindings[key];
                this.wm.setCustomKeybindingHandler(key,
                    Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                    this._showWorkspaceSwitcher.bind(this)
                );
            }
        }
    }

    _restoreKeybindingHandlers() {
        for (let key in this.originalAllowedKeybindings) {
            this.wm.setCustomKeybindingHandler(key,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                this.wm._showWorkspaceSwitcher.bind(this.wm)
            );
        }
    }

    _overrideNumberOfWorkspaces() {
        this._forceNumberOfWorkspaces(this.rows * this.columns);
    }

    _forceNumberOfWorkspaces(total) {
        while (this.wsManager.n_workspaces < total) {
            this.wsManager.append_new_workspace(false, global.get_current_time());
        }

        while (this.wsManager.n_workspaces > total) {
            this.wsManager.remove_workspace(
                this.wsManager.get_workspace_by_index(this.wsManager.n_workspaces - 1),
                global.get_current_time()
            );
        }
    }

    _overrideDynamicWorkspaces() {
        this._mutterSettings.set_boolean('dynamic-workspaces', false);
    }

    _restoreDynamicWorkspaces() {
        this._mutterSettings.set_boolean(
            'dynamic-workspaces',
            this.originalDynamicWorkspaces
        );
    }

    handleWorkspaceScroll(event) {
        if (!this._canScroll)
            return Clutter.EVENT_PROPAGATE;

        if (event.type() !== Clutter.EventType.SCROLL)
            return Clutter.EVENT_PROPAGATE;

        if (event.is_pointer_emulated())
            return Clutter.EVENT_PROPAGATE;

        let direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx < 0
                    ? Clutter.ScrollDirection.LEFT
                    : Clutter.ScrollDirection.RIGHT;
            } else if (Math.abs(dy) > Math.abs(dx)) {
                direction = dy < 0
                    ? Clutter.ScrollDirection.UP
                    : Clutter.ScrollDirection.DOWN;
            } else {
                return Clutter.EVENT_PROPAGATE;
            }
        }

        const workspaceManager = global.workspace_manager;
        const activeWs = workspaceManager.get_active_workspace();
        let ws;
        switch (direction) {
            case Clutter.ScrollDirection.UP:
                ws = activeWs.get_neighbor(Meta.MotionDirection.UP);
                break;
            case Clutter.ScrollDirection.LEFT:
                ws = activeWs.get_neighbor(Meta.MotionDirection.LEFT);
                break;
            case Clutter.ScrollDirection.DOWN:
                ws = activeWs.get_neighbor(Meta.MotionDirection.DOWN);
                break;
            case Clutter.ScrollDirection.RIGHT:
                ws = activeWs.get_neighbor(Meta.MotionDirection.RIGHT);
                break;
            default:
                return Clutter.EVENT_STOP;
        }

        this.actionMoveWorkspace(ws);

        this._canScroll = false;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            SCROLL_TIMEOUT_TIME, () => {
                this._canScroll = true;
                return GLib.SOURCE_REMOVE;
            });

        return Clutter.EVENT_STOP;
    }

    _updateMonitors() {
        this.monitors = this.multiMonitor ?
            Main.layoutManager.monitors :
            [Main.layoutManager.primaryMonitor];
    }

    _notify() {
        // Update the workspace display to match the number of workspaces.
        this.wsManager.notify('n-workspaces');
    }

    /*
     * This is Main.wm._showWorkspaceSwitcher but without ignoring the UP and DOWN
     * directions and using the WorkspaceSwitcherPopup (with constructor arguments)
     * provided by this extension.
     */
    _showWorkspaceSwitcher(display, window, binding) {
        let workspaceManager = this.wsManager;

        if (!Main.sessionMode.hasWorkspaces)
            return;

        if (workspaceManager.n_workspaces == 1)
            return;

        if (binding.get_name) {
            binding = binding.get_name();
        }

        let [action,,, target] = binding.split('-');
        let newWs;
        let direction;

        if (action == 'move') {
            // "Moving" a window to another workspace doesn't make sense when
            // it cannot be unstuck, and is potentially confusing if a new
            // workspaces is added at the start/end
            if (window.is_always_on_all_workspaces() ||
                (Meta.prefs_get_workspaces_only_on_primary() &&
                    window.get_monitor() != Main.layoutManager.primaryIndex))
                return;
        }

        if (target == 'last') {
            direction = Meta.MotionDirection.DOWN;
            newWs = workspaceManager.get_workspace_by_index(workspaceManager.n_workspaces - 1);
        } else if (target !== undefined && isNaN(target)) {
            direction = Meta.MotionDirection[target.toUpperCase()];
            newWs = this._getTargetWorkspace(direction);
        } else if ((target > 0) && (target <= workspaceManager.n_workspaces)) {
            target--;
            newWs = workspaceManager.get_workspace_by_index(target);

            if (workspaceManager.get_active_workspace().index() > target)
                direction = Meta.MotionDirection.UP;
            else
                direction = Meta.MotionDirection.DOWN;
        }

        if (newWs !== undefined) {
            if (action == 'switch')
                this.wm.actionMoveWorkspace(newWs);
            else
                this.wm.actionMoveWindow(window, newWs);
        }

        this._showWorkspaceSwitcherPopup(false);
    }

    _showWorkspaceSwitcherPopup(toggle) {
        if (Main.overview.visible) {
            return;
        }

        if (toggle) {
            this._addWorkspaceOverviewKeybindings();
        }

        this.monitors.forEach((monitor) => {
            let monitorIndex = monitor.index;

            if (!this.wm._wsPopupList[monitorIndex]) {
                this.wm._workspaceTracker.blockUpdates();
                this.wm._wsPopupList[monitorIndex] = this._createNewPopup({
                    monitorIndex: monitorIndex,
                    toggle: toggle,
                });
                this.wm._wsPopupList[monitorIndex].connect('destroy', () => {
                    this.wm._workspaceTracker.unblockUpdates();
                    this.wm._wsPopupList[monitorIndex] = null;
                    if (monitorIndex === Main.layoutManager.primaryIndex) {
                        this.wm._workspaceSwitcherPopup = null;
                        this.wm._isWorkspacePrepended = false;
                        if (toggle) {
                            this._removeWorkspaceOverviewKeybindings();
                        }
                    }
                });

                let event = Clutter.get_current_event();
                let modifiers = event ? event.get_state() & Clutter.ModifierType.MODIFIER_MASK : 0;
                this.wm._wsPopupList[monitorIndex].showToggle(false, null, modifiers, toggle);
                if (monitorIndex === Main.layoutManager.primaryIndex) {
                    this.wm._workspaceSwitcherPopup = this.wm._wsPopupList[monitorIndex];
                }
            } else {
                // reset  of popup
                if (monitorIndex === Main.layoutManager.primaryIndex) {
                    this.wm._wsPopupList[monitorIndex].resetTimeout();
                }
            }
        });
    }

    _destroyWorkspaceSwitcherPopup() {
        this.wm._wsPopupList.filter(p => p).forEach(p => p.destroy());
    }

    _getTargetWorkspace(direction) {
        let newWs = this.wsManager.get_active_workspace().get_neighbor(direction);
        let currentIndex = this.wsManager.get_active_workspace_index();
        if (this.wraparoundMode !== WraparoundMode.NONE && currentIndex === newWs.index()) {
            // Given a direction input the workspace has not changed, so do wraparound.
            let targetRow = Math.floor(currentIndex / this.columns);
            let targetColumn = currentIndex % this.columns;

            let offset = 0;
            if (direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.LEFT) {
                offset = -1;
            } else if (direction === Meta.MotionDirection.DOWN || direction === Meta.MotionDirection.RIGHT) {
                offset = 1;
            }

            switch (this.wraparoundMode) {
                case WraparoundMode.NEXT_PREV_BORDER:
                    if ((currentIndex === 0 && offset === -1) || (currentIndex === this.rows * this.columns - 1 && offset === 1)) {
                        break;
                    }
                case WraparoundMode.NEXT_PREV:
                    targetRow += offset;
                    targetColumn += offset;
                    break;
                case WraparoundMode.ROW_COL:
                    if (direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.DOWN) {
                        targetRow += offset;
                    } else if (direction === Meta.MotionDirection.LEFT || direction === Meta.MotionDirection.RIGHT) {
                        targetColumn += offset;
                    }
                default:
                    // Nothing.
            }

            // Handle negative targets.
            targetColumn = (targetColumn + this.columns) % this.columns;
            targetRow = (targetRow + this.rows) % this.rows;

            let target = targetRow * this.columns + targetColumn;
            newWs = this.wsManager.get_workspace_by_index(target);
        }

        return newWs;
    }

    _createNewPopup(options) {
        options = options || {};
        options.scale = this.settings.get_double('scale');
        options.showThumbnails = this.settings.get_boolean('show-thumbnails');
        options.showWorkspaceNames = this.settings.get_boolean('show-workspace-names');
        options.popupTimeout = this.settings.get_int('popup-timeout')
        options.enablePopupWorkspaceHover = this.settings.get_boolean('enable-popup-workspace-hover');
        options.overveiwKeybindingActions = this._overviewKeybindingActions;

        return new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup(options, this);
    }

    _moveToWorkspace(direction) {
      let workspace = this._getTargetWorkspace(direction);
      this.wm.actionMoveWorkspace(workspace);
   }

   _workspaceOverviewMoveRight() {
      this._moveToWorkspace(Meta.MotionDirection.RIGHT);
   }

   _workspaceOverviewMoveLeft() {
      this._moveToWorkspace(Meta.MotionDirection.LEFT);
   }

   _workspaceOverviewMoveUp() {
      this._moveToWorkspace(Meta.MotionDirection.UP);
   }

   _workspaceOverviewMoveDown() {
      this._moveToWorkspace(Meta.MotionDirection.DOWN);
   }
}
