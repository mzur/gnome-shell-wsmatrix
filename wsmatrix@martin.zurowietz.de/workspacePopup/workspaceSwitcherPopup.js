const {Clutter, GLib, GObject, Meta, St} = imports.gi;
const SwitcherPopup = imports.ui.switcherPopup;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const WorkspaceThumbnail = Self.imports.workspacePopup.workspaceThumbnail;
const WorkspaceSwitcherPopupList = Self.imports.workspacePopup.workspaceSwitcherPopupList;


var modals = [];

var WorkspaceSwitcherPopup = GObject.registerClass(
    class WorkspaceSwitcherPopup extends SwitcherPopup.SwitcherPopup {
        _init(rows, columns, scale, monitorIndex, showThumbnails, showWorkspaceName, popupTimeout, wm) {
            super._init();
            this._monitorIndex = monitorIndex;
            this._monitor = Main.layoutManager.monitors[this._monitorIndex];
            this._rows = rows;
            this._columns = columns;
            this._scale = scale;
            this._popupTimeout = popupTimeout;
            this._wm = wm;
            this._toggle = false;
            this._items = this._createThumbnails();
            this._switcherList = new WorkspaceSwitcherPopupList.WorkspaceSwitcherPopupList(this._items, this._createLabels(),
                rows, columns, scale, showThumbnails, showWorkspaceName);

            // Initially disable hover so we ignore the enter-event if
            // the switcher appears underneath the current pointer location
            this._disableHover();
        }

        _createThumbnails() {
            let thumbnails = [];
            let workspaceManager = global.workspace_manager;

            for (let i = 0; i < workspaceManager.n_workspaces; i++) {
                let workspace = workspaceManager.get_workspace_by_index(i);
                let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(workspace, this._monitorIndex)
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

        showToggle(backward, binding, mask, toggle) {
            if (this._noModsTimeoutId !== 0) {
                GLib.source_remove(this._noModsTimeoutId);
                this._noModsTimeoutId = 0;
            }

            if (this._popupTimeout > 0 && !this._toggle)
                this._noModsTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._popupTimeout + 150, this._finish.bind(this));

            this._toggle = toggle;
            if (this._popupTimeout > 0 || this._toggle) {
                mask = 0
            }

            if (super.show(backward, binding, mask))
                modals.push(this);
        }

        _resetNoModsTimeout() {
        }

        resetTimeout() {
            modals.filter(m => m).forEach(m => {
                if (m._noModsTimeoutId !== 0) {
                    GLib.source_remove(m._noModsTimeoutId);
                    m._noModsTimeoutId = 0;
                }
            });

            if (this._popupTimeout > 0 && !this._toggle) {
                this._noModsTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._popupTimeout, this._finish.bind(this));
            }
        }

        _keyPressHandler(_keysym, _action) {
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

                    this._wm._showWorkspaceSwitcher(global.display, global.display.focus_window, key);
                }
            }

            return Clutter.EVENT_PROPAGATE;
        }

        _finish(_timestamp) {
            while (modals.length > 0) {
                modals.pop().fadeAndDestroy();
            }
        }

        _onDestroy() {
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
