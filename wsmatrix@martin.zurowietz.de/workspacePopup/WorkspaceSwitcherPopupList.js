const {Clutter, GObject, St} = imports.gi;
const Main = imports.ui.main;
const GWorkspaceThumbnail = imports.ui.workspaceThumbnail;


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

var WorkspaceSwitcherPopupList = GObject.registerClass({
    Signals: {
        'item-activated': {param_types: [GObject.TYPE_INT]},
        'item-entered': {param_types: [GObject.TYPE_INT]},
        'item-removed': {param_types: [GObject.TYPE_INT]}
    },
}, class WorkspaceSwitcherPopupList extends St.BoxLayout {
    _init(thumbnails, workspaceName, rows, columns, scale, showThumbnails, showWorkspaceName) {
        super._init({style_class: 'switcher-list', vertical: true});
        this._lists = [];
        this._thumbnails = thumbnails;
        this._workspaceName = workspaceName;
        this._rows = rows;
        this._columns = columns;
        this._scale = scale;
        this._showThumbnails = showThumbnails;
        this._showWorkspaceName = showWorkspaceName;

        for (let i = 0; i < this._rows; i++) {
            let workspacesRow = new St.BoxLayout({
                style_class: 'switcher-list-item-container',
            });

            workspacesRow.spacing = 0;
            workspacesRow.connect('style-changed', () => {
                workspacesRow.spacing = workspacesRow.get_theme_node().get_length('spacing');
                this.redisplay();
            });

            this.add_actor(workspacesRow);
            this._lists.push(workspacesRow);
        }

        this._items = [];

        let workspaceManager = global.workspace_manager;
        this._activeWorkspaceChangedId =
            workspaceManager.connect('active-workspace-changed',
                () => this.highlight(workspaceManager.get_active_workspace_index()));

        for (let i = 0; i < thumbnails.length; i++)
            this.addItem(this._thumbnails[i], this._workspaceName[i]);
    }

    addItem(thumbnail, workspaceName) {
        // create a switcher thumbnail button and add a thumbnail in it
        let list = this._lists[Math.floor(this._items.length / this._columns)];
        let bbox = new SwitcherButton(this._childWidth, this._childHeight);
        let container = new St.Widget();

        if (this._showThumbnails)
            container.add_child(thumbnail);

        if (this._showWorkspaceName) {
            let labelBox = new SwitcherButton(this._childWidth, this._childHeight);
            labelBox.set_child(new St.Label({
                style_class: "ws-switcher-label",
                text: workspaceName,
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            }));
            container.add_child(labelBox);
        }

        bbox.set_child(container);
        list.add_actor(bbox);

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

            let leftPadding = this.get_theme_node().get_padding(St.Side.LEFT);
            let rightPadding = this.get_theme_node().get_padding(St.Side.RIGHT);
            let topPadding = this.get_theme_node().get_padding(St.Side.TOP);
            let bottomPadding = this.get_theme_node().get_padding(St.Side.BOTTOM);

            for (let i = 0; i < bbox.get_child().get_children().length; i++) {
                let item = bbox.get_child().get_children()[i];
                if (item instanceof GWorkspaceThumbnail.WorkspaceThumbnail)
                    item.setScale((bbox.get_width() - leftPadding - rightPadding) / item.get_width(), (bbox.get_height() - topPadding - bottomPadding) / item.get_height());
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
        if (item !== this._items[this._highlighted])
            this._itemEntered(this._items.indexOf(item));

        return Clutter.EVENT_PROPAGATE;
    }

    highlight(index, justOutline) {
        if (this._items[this._highlighted]) {
            this._items[this._highlighted].remove_style_pseudo_class('outlined');
            this._items[this._highlighted].remove_style_pseudo_class('selected');
        }

        if (this._items[index]) {
            if (justOutline)
                this._items[index].add_style_pseudo_class('outlined');
            else
                this._items[index].add_style_pseudo_class('selected');
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
        let bottomPadding = this.get_theme_node().get_padding(St.Side.BOTTOM);

        this._height = (this.get_preferred_child_size().height + this._lists[0].spacing) * this._rows;
        return [this._height - bottomPadding, this._height - bottomPadding];
    }

    vfunc_get_preferred_width(forHeight) {
        let rightPadding = this.get_theme_node().get_padding(St.Side.RIGHT);

        this._width = (this.get_preferred_child_size().width + this._lists[0].spacing) * this._columns;
        return [this._width + rightPadding, this._width + rightPadding];
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
