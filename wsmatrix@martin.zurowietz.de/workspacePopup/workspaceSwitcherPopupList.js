import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import {WorkspaceThumbnail} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

var ITEM_SPACING = '12px';

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
        'item-removed': {param_types: [GObject.TYPE_INT]}
    },
}, class WorkspaceSwitcherPopupList extends St.BoxLayout {
    _init(thumbnails, workspaceName, options) {
        super._init({
            style_class: 'switcher-list',
            orientation: Clutter.Orientation.VERTICAL,
            style: `spacing: ${ITEM_SPACING}`,
        });
        this._lists = [];
        this._scale = options.scale;
        this._showThumbnails = options.showThumbnails;
        this._showWorkspaceName = options.showWorkspaceNames;
        this._monitorIndex = options.monitorIndex;

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
        bbox._metaWorkspace = thumbnail.metaWorkspace;
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

        let workspaceManager = global.workspace_manager;
        this.highlight(workspaceManager.get_active_workspace_index());
    }

    _onItemClicked(item) {
        this._itemActivated(this._items.indexOf(item));
    }

    _onItemEnter(item) {
        // Avoid reentrancy
        if (item !== this._items[this._highlighted]) {
            this._itemEntered(this._items.indexOf(item));
        }

        return Clutter.EVENT_PROPAGATE;
    }

    // Re-insert the existing cells in the given order (re-parenting instead of
    // recreating them, so live previews do not flicker).
    _applyVisualOrder(order) {
        for (const bbox of this._items)
            bbox.get_parent()?.remove_child(bbox);

        this._items = order;
        for (let i = 0; i < order.length; i++)
            this._lists[Math.floor(i / this._columns)].add_child(order[i]);

        this.redisplay();
    }

    _orderByWorkspace() {
        return [...this._items].sort((a, b) =>
            a._metaWorkspace.index() - b._metaWorkspace.index());
    }

    // Show the cells in the actual workspace order.
    reorderItems() {
        this._applyVisualOrder(this._orderByWorkspace());
    }

    // Preview a pending move: the actual order with only the cells at the two
    // positions exchanged. Purely visual, no workspace is moved.
    previewExchange(indexA, indexB) {
        const order = this._orderByWorkspace();
        [order[indexA], order[indexB]] = [order[indexB], order[indexA]];
        this._applyVisualOrder(order);
    }

    setHolding(index) {
        this._items[index]?.add_style_class_name('wsmatrix-holding');
    }

    clearHolding() {
        for (const bbox of this._items)
            bbox.remove_style_class_name('wsmatrix-holding');
    }

    updateWorkspaceText(index, text) {
        const bbox = this._items[index];
        if (bbox && bbox._nameLabel)
            bbox._nameLabel.text = text;
    }

    highlight(index, justOutline) {
        // Track the highlighted cell itself rather than its index: a preview
        // re-orders this._items, and an index would then point at another cell.
        if (this._highlightedItem) {
            this._highlightedItem.remove_style_pseudo_class('highlighted');
            this._highlightedItem.remove_style_pseudo_class('selected');
        }

        const item = this._items[index];
        if (item)
            item.add_style_pseudo_class(justOutline ? 'highlighted' : 'selected');

        this._highlightedItem = item ?? null;
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
        return [this._height + padding, this._height + padding];
    }

    vfunc_get_preferred_width(forHeight) {
        let padding = this.get_theme_node().get_padding(St.Side.RIGHT) + this.get_theme_node().get_padding(St.Side.LEFT);

        this._width = (this.get_preferred_child_size().width + this._lists[0].spacing) * this._columns - this._lists[0].spacing;
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
