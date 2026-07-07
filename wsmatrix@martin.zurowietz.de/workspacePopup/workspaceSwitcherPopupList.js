import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import {WorkspaceThumbnail} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

var ITEM_SPACING = '12px';
var ROW_HEADER_RATIO = 0.6;
var COL_HEADER_RATIO = 0.3;

var SwitcherButton = GObject.registerClass(
class SwitcherButton extends St.Button {
    _init(width, height) {
        super._init({style_class: 'item-box', reactive: true});
        this._width = width;
        this._height = height;
    }

    setSize(width, height) {
        this._width = width;
        this._height = height;
    }

    vfunc_get_preferred_width(forHeight) {
        return [this._width, this._width];
    }

    vfunc_get_preferred_height(forWidth) {
        return [this._height, this._height];
    }
});

export default GObject.registerClass({
    Signals: {
        'item-activated': {param_types: [GObject.TYPE_INT]},
        'item-entered': {param_types: [GObject.TYPE_INT]},
        'item-removed': {param_types: [GObject.TYPE_INT]},
        'item-closed': {param_types: [GObject.TYPE_INT]}
    },
}, class WorkspaceSwitcherPopupList extends St.BoxLayout {
    _init(thumbnails, workspaceName, options) {
        super._init({
            style_class: 'switcher-list wsmatrix-switcher-list',
            vertical: true,
            style: `spacing: ${ITEM_SPACING}`,
        });
        this._lists = [];
        this._scale = options.scale;
        this._showThumbnails = options.showThumbnails;
        this._showWorkspaceName = options.showWorkspaceNames;
        this._monitorIndex = options.monitorIndex;
        this._groupAxis = options.groupAxis || 'row';
        this._groupNames = options.groupNames || [];
        this._showHeaders = !!options.showGroupHeaders;
        this._rowHeaders = [];
        this._colHeaders = [];

        // Column headers: one leading row of labels above the grid.
        if (this._showHeaders && this._groupAxis === 'column') {
            this._headerRow = new St.BoxLayout({
                style_class: 'switcher-list-item-container',
                style: `spacing: ${ITEM_SPACING}`,
            });
            this.add_child(this._headerRow);
            for (let c = 0; c < this._columns; c++) {
                let header = this._makeHeader(this._groupText(c));
                this._colHeaders.push(header);
                this._headerRow.add_child(header);
            }
        }

        for (let i = 0; i < this._rows; i++) {
            let workspacesRow = new St.BoxLayout({
                style_class: 'switcher-list-item-container',
                style: `spacing: ${ITEM_SPACING}`,
            });

            this.spacing = 0;
            workspacesRow.spacing = 0;
            workspacesRow.connect('style-changed', () => {
                this.spacing = this.get_theme_node().get_length('spacing');
                workspacesRow.spacing = workspacesRow.get_theme_node().get_length('spacing');
                this.redisplay();
            });

            // Row headers: a leading label per row.
            if (this._showHeaders && this._groupAxis === 'row') {
                let header = this._makeHeader(this._groupText(i));
                this._rowHeaders.push(header);
                workspacesRow.add_child(header);
            }

            this.add_child(workspacesRow);
            this._lists.push(workspacesRow);
        }

        this._items = [];

        let workspaceManager = global.workspace_manager;
        this._activeWorkspaceChangedId =
            workspaceManager.connect('active-workspace-changed',
                () => this.highlight(workspaceManager.get_active_workspace_index()));

        for (let i = 0; i < thumbnails.length; i++) {
            this.addItem(thumbnails[i], workspaceName[i]);
        }
    }

    _groupText(groupIndex) {
        const name = this._groupNames[groupIndex];
        return (name && name !== '') ? name : String(groupIndex + 1);
    }

    _makeHeader(text) {
        const container = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
        });
        const label = new St.Label({
            style_class: 'wsmatrix-group-header',
            text,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        container.add_child(label);
        container._label = label;
        return container;
    }

    get _rows() {
        const workspaceManager = global.workspace_manager;
        return workspaceManager.layout_rows;
    }

    get _columns() {
        const workspaceManager = global.workspace_manager;
        return workspaceManager.layout_columns;
    }

    addItem(thumbnail, workspaceName) {
        // create a switcher thumbnail button and add a thumbnail in it
        let list = this._lists[Math.floor(this._items.length / this._columns)];
        let bbox = new SwitcherButton(this._childWidth, this._childHeight);
        let container = new St.Widget();

        if (this._showThumbnails) {
            container.add_child(thumbnail);
        }

        if (this._showWorkspaceName) {
            let labelBox = new SwitcherButton(this._childWidth, this._childHeight);
            let nameLabel = new St.Label({
                style_class: "ws-switcher-label",
                text: workspaceName,
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            labelBox.set_child(nameLabel);
            container.add_child(labelBox);
            bbox._nameLabel = nameLabel;
        }

        bbox.set_child(container);
        list.add_child(bbox);

        bbox.connect('button-press-event', (actor, event) => {
            bbox._lastClickCount = event.get_click_count();
            return Clutter.EVENT_PROPAGATE;
        });
        bbox.connect('clicked', () => this._onItemClicked(bbox));
        bbox.connect('motion-event', () => this._onItemEnter(bbox));

        this._items.push(bbox);
        return bbox;
    }

    // update width/height on spacing update
    redisplay() {
        // workaround to update width and height values
        this.vfunc_get_preferred_height();

        for (let i = 0; i < this._items.length; i++) {
            let bbox = this._items[i];
            bbox.setSize(this._childWidth, this._childHeight);

            let leftPadding = bbox.get_theme_node().get_padding(St.Side.LEFT);
            let rightPadding = bbox.get_theme_node().get_padding(St.Side.RIGHT);
            let topPadding = bbox.get_theme_node().get_padding(St.Side.TOP);
            let bottomPadding = bbox.get_theme_node().get_padding(St.Side.BOTTOM);

            for (let i = 0; i < bbox.get_child().get_children().length; i++) {
                let item = bbox.get_child().get_children()[i];
                if (item instanceof WorkspaceThumbnail) {
                    // 2 is magic number. Can not find the reason for it.
                    item.setScale((bbox.get_width() - leftPadding - rightPadding - 2) / item.get_width(), (bbox.get_height() - topPadding - bottomPadding - 2) / item.get_height());
                }
                if (item instanceof SwitcherButton) {
                    item.setSize(this._childWidth - leftPadding - rightPadding, this._childHeight - topPadding - bottomPadding);
                    let label = item.get_child();
                    label.style = 'font-size: ' + Math.min(this._childHeight, this._childWidth) / 8 + 'px;';
                }
            }
        }

        if (this._showHeaders) {
            const headers = this._groupAxis === 'row' ? this._rowHeaders : this._colHeaders;
            headers.forEach(h => {
                if (this._groupAxis === 'row')
                    h.set_size(Math.round(this._childWidth * ROW_HEADER_RATIO), this._childHeight);
                else
                    h.set_size(this._childWidth, Math.round(this._childHeight * COL_HEADER_RATIO));
                h._label.style = 'font-size: ' + Math.min(this._childHeight, this._childWidth) / 8 + 'px;';
            });
        }

        let workspaceManager = global.workspace_manager;
        this.highlight(workspaceManager.get_active_workspace_index());
    }

    _onItemClicked(item) {
        const index = this._items.indexOf(item);
        const doubleClick = (item._lastClickCount || 1) >= 2;
        if (doubleClick || index === this._highlighted)
            this.emit('item-closed', index);
        else
            this._itemActivated(index);
    }

    _onItemEnter(item) {
        // Avoid reentrancy
        if (item !== this._items[this._highlighted]) {
            this._itemEntered(this._items.indexOf(item));
        }

        return Clutter.EVENT_PROPAGATE;
    }

    // Overlay an editable entry on top of a container (a switcher item or a
    // group header), grab key focus, and wire commit/cancel. onCommit receives
    // the entered text; onCancel receives nothing.
    _overlayEntry(container, text, onCommit, onCancel) {
        const entry = new St.Entry({
            style_class: 'wsmatrix-rename-entry',
            text,
        });
        entry.set_size(container.width, container.height);
        container.add_child(entry);

        const clutterText = entry.clutter_text;
        clutterText.set_selection(0, text.length);
        global.stage.set_key_focus(clutterText);

        let done = false;
        const finish = (commit) => {
            if (done)
                return;
            done = true;
            const value = entry.get_text();
            if (container.contains(entry))
                container.remove_child(entry);
            entry.destroy();
            if (commit)
                onCommit(value);
            else
                onCancel();
        };

        clutterText.connect('activate', () => finish(true));
        clutterText.connect('key-focus-out', () => finish(true));
        entry.connect('key-press-event', (actor, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                finish(false);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    editWorkspace(index, text, onCommit, onCancel) {
        const item = this._items[index];
        if (!item) {
            onCancel();
            return;
        }
        this._overlayEntry(item.get_child(), text, onCommit, onCancel);
    }

    editGroup(groupIndex, text, onCommit, onCancel) {
        const headers = this._groupAxis === 'row' ? this._rowHeaders : this._colHeaders;
        const header = headers[groupIndex];
        if (!header) {
            onCancel();
            return;
        }
        this._overlayEntry(header, text, onCommit, onCancel);
    }

    updateWorkspaceText(index, text) {
        const bbox = this._items[index];
        if (bbox && bbox._nameLabel)
            bbox._nameLabel.text = (text && text !== '') ? text : String(index + 1);
    }

    updateGroupText(groupIndex, text) {
        const headers = this._groupAxis === 'row' ? this._rowHeaders : this._colHeaders;
        const header = headers[groupIndex];
        if (header && header._label)
            header._label.text = (text && text !== '') ? text : String(groupIndex + 1);
    }

    highlight(index, justOutline) {
        if (this._items[this._highlighted]) {
            this._items[this._highlighted].remove_style_pseudo_class('highlighted');
            this._items[this._highlighted].remove_style_pseudo_class('selected');
        }

        if (this._items[index]) {
            this._items[index].add_style_pseudo_class(justOutline ? 'highlighted' : 'selected');
        }

        this._highlighted = index;
    }

    _itemActivated(n) {
        this.emit('item-activated', n);
    }

    _itemEntered(n) {
        this.emit('item-entered', n);
    }

    get_preferred_child_size() {
        let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex);
        let ratio = workArea.width / workArea.height;

        if (this._rows > this._columns) {
            this._childHeight = this._scale * workArea.height / this._rows;
            this._childWidth = this._childHeight * ratio;
        } else {
            this._childWidth = this._scale * workArea.width / this._columns;
            this._childHeight = this._childWidth / ratio;
        }

        return {width: this._childWidth, height: this._childHeight};
    }

    vfunc_get_preferred_height(forWidth) {
        let padding = this.get_theme_node().get_padding(St.Side.TOP) + this.get_theme_node().get_padding(St.Side.BOTTOM);

        this._height = (this.get_preferred_child_size().height + this.spacing) * this._rows - this.spacing;
        if (this._showHeaders && this._groupAxis === 'column')
            this._height += Math.round(this._childHeight * COL_HEADER_RATIO) + this.spacing;
        return [this._height + padding, this._height + padding];
    }

    vfunc_get_preferred_width(forHeight) {
        let padding = this.get_theme_node().get_padding(St.Side.RIGHT) + this.get_theme_node().get_padding(St.Side.LEFT);

        this._width = (this.get_preferred_child_size().width + this._lists[0].spacing) * this._columns - this._lists[0].spacing;
        if (this._showHeaders && this._groupAxis === 'row')
            this._width += Math.round(this._childWidth * ROW_HEADER_RATIO) + this._lists[0].spacing;
        return [this._width + padding, this._width + padding];
    }

    destroy() {
        super.destroy();
        if (this._activeWorkspaceChangedId > 0) {
            let workspaceManager = global.workspace_manager;

            workspaceManager.disconnect(this._activeWorkspaceChangedId);
            this._activeWorkspaceChangedId = 0;
        }
    }
});
