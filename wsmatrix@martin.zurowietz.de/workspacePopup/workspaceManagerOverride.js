const Self = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceAnimation = Self.imports.workspacePopup.workspaceAnimation;
const Main = imports.ui.main;
const {Clutter, Gio, GLib, Shell, Meta} = imports.gi;
const WorkspaceSwitcherPopup = Self.imports.workspacePopup.workspaceSwitcherPopup;
var SCROLL_TIMEOUT_TIME = 150;

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
        this._handlePopupTimeoutChanged();
        this._handleScaleChanged();
        this._handleMultiMonitorChanged();
        this._handleShowThumbnailsChanged();
        this._handleShowWorkspaceNamesChanged();
        this._handleEnablePopupWorkspaceHover();
        this._handleWraparoundModeChanged();
        this._connectSettings();
        this._notify();
        this._addKeybindings();
        this._connectOverview();
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
        this._disconnectOverview();
        this._disconnectLayoutManager();
        this._removeWorkspaceSwitcherBindings();
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
            this._handlePopupTimeoutChanged.bind(this)
        );

        this.settingsHandlerScale = this.settings.connect(
            'changed::scale',
            this._handleScaleChanged.bind(this)
        );

        this.settingsHandlerMultiMonitor = this.settings.connect(
            'changed::multi-monitor',
            this._handleMultiMonitorChanged.bind(this)
        );

        this.settingsHandlerShowThumbnails = this.settings.connect(
            'changed::show-thumbnails',
            this._handleShowThumbnailsChanged.bind(this)
        );

        this.settingsHandlerWraparoundMode = this.settings.connect(
            'changed::wraparound-mode',
            this._handleWraparoundModeChanged.bind(this)
        );

        this.settingsHandlerShowWorkspaceNames = this.settings.connect(
            'changed::show-workspace-names',
            this._handleShowWorkspaceNamesChanged.bind(this)
        );

        this.settingsHandlerEnablePopupWorkspaceHover = this.settings.connect(
            'changed::enable-popup-workspace-hover',
            this._handleEnablePopupWorkspaceHover.bind(this)
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

    _connectOverview() {
        this.overviewHandlerShown = Main.overview.connect(
            'showing',
            this._destroyWorkspaceSwitcherPopup.bind(this)
        );
    }

    _disconnectOverview() {
        Main.overview.disconnect(this.overviewHandlerShown);
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
            () => this._showWorkspaceSwitcherPopup(true)
        );
    }

    _removeKeybindings() {
        this.wm.removeKeybinding('workspace-overview-toggle');
    }

    _handleNumberOfWorkspacesChanged() {
        this.rows = this.settings.get_int('num-rows');
        this.columns = this.settings.get_int('num-columns');
        this._overrideNumberOfWorkspaces();
        this._overrideLayout();
        this._destroyWorkspaceSwitcherPopup();
    }

    _handlePopupTimeoutChanged() {
        this.popupTimeout = this.settings.get_int('popup-timeout');
        this._destroyWorkspaceSwitcherPopup();
    }

    _handleScaleChanged() {
        this.scale = this.settings.get_double('scale');
        this._destroyWorkspaceSwitcherPopup();
    }

    _handleMultiMonitorChanged() {
        this.multiMonitor = this.settings.get_boolean('multi-monitor');
        this._updateMonitors();
        this._destroyWorkspaceSwitcherPopup();
    }

    _handleShowThumbnailsChanged() {
        this.showThumbnails = this.settings.get_boolean('show-thumbnails');
        this._destroyWorkspaceSwitcherPopup();
    }

    _handleWraparoundModeChanged() {
        this.wraparoundMode = this.settings.get_enum('wraparound-mode');
    }

    _handleShowWorkspaceNamesChanged() {
        this.showWorkspaceNames = this.settings.get_boolean('show-workspace-names');
        this._destroyWorkspaceSwitcherPopup();
    }

    _handleEnablePopupWorkspaceHover() {
        this.enablePopupWorkspaceClick = this.settings.get_boolean('enable-popup-workspace-hover');
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
        const activeWsIndex = workspaceManager.get_active_workspace_index();
        let newWsIndex;
        switch (direction) {
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.LEFT:
                newWsIndex = Math.max(activeWsIndex - 1, 0);
                break;
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.RIGHT:
                newWsIndex = Math.min(activeWsIndex + 1, workspaceManager.n_workspaces - 1);
                break;
            default:
                return Clutter.EVENT_STOP;
        }

        let newWs = workspaceManager.get_workspace_by_index(newWsIndex);
        this.actionMoveWorkspace(newWs);

        this._canScroll = false;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            SCROLL_TIMEOUT_TIME, () => {
                this._canScroll = true;
                return GLib.SOURCE_REMOVE;
            });

        return Clutter.EVENT_STOP;
    }

    _addWorkspaceSwitcherBindings() {
        this.wm.addKeybinding(
            'workspace-switcher-toggle',
            this._keybindings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            () => this._showWorkspaceSwitcherPopup(true)
        );
    }

    _removeWorkspaceSwitcherBindings() {
        this.wm.removeKeybinding('workspace-switcher-toggle');
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

        let [action, , , target] = binding.split('-');
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
        if (!Main.overview.visible) {
            this.monitors.forEach((monitor) => {
                let monitorIndex = monitor.index;

                if (!this.wm._wsPopupList[monitorIndex]) {
                    this.wm._workspaceTracker.blockUpdates();
                    this.wm._wsPopupList[monitorIndex] = this._createNewPopup({
                        monitorIndex: monitorIndex,
                    });
                    this.wm._wsPopupList[monitorIndex].connect('destroy', () => {
                        this.wm._workspaceTracker.unblockUpdates();
                        this.wm._wsPopupList[monitorIndex] = null;
                        if (monitorIndex === Main.layoutManager.primaryIndex) {
                            this.wm._workspaceSwitcherPopup = null;
                            this.wm._isWorkspacePrepended = false;
                        }
                    });

                    let event = Clutter.get_current_event();
                    let modifiers = event ? event.get_state() : 0;
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

            if (this.wraparoundMode === WraparoundMode.NEXT_PREV) {
                targetRow += offset;
                targetColumn += offset;
            } else if (this.wraparoundMode === WraparoundMode.NEXT_PREV_BORDER) {
                if (!(currentIndex === 0 && offset === -1) && !(currentIndex === this.rows * this.columns - 1 && offset === 1)) {
                    targetRow += offset;
                    targetColumn += offset;
                }
            } else if (this.wraparoundMode === WraparoundMode.ROW_COL) {
                if (direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.DOWN) {
                    targetRow += offset;
                } else if (direction === Meta.MotionDirection.LEFT || direction === Meta.MotionDirection.RIGHT) {
                    targetColumn += offset;
                }
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
        return new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup(
            this.rows,
            this.columns,
            this.scale,
            options.monitorIndex,
            this.showThumbnails,
            this.showWorkspaceNames,
            this.popupTimeout,
            this.enablePopupWorkspaceClick,
            this
        );
    }
}
