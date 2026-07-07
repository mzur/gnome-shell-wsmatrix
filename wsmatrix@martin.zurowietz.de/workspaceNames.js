import Gio from 'gi://Gio';

const AXES = ['row', 'column'];

// Single source of truth for workspace/group naming and grid geometry.
// Reads the live workspace manager and the extension settings; workspace
// names live in GNOME's shared org.gnome.desktop.wm.preferences.
export default class WorkspaceNames {
    constructor(settings) {
        this._settings = settings;
        this._wmPrefs = new Gio.Settings({
            schema_id: 'org.gnome.desktop.wm.preferences',
        });
    }

    destroy() {
        this._wmPrefs = null;
        this._settings = null;
    }

    get rows() {
        return this._settings.get_int('num-rows');
    }

    get columns() {
        return this._settings.get_int('num-columns');
    }

    axis() {
        return AXES[this._settings.get_enum('group-axis')];
    }

    positionOf(index) {
        const columns = this.columns;
        return {
            row: Math.floor(index / columns),
            column: index % columns,
        };
    }

    groupCount() {
        return this.axis() === 'row' ? this.rows : this.columns;
    }

    groupIndexOf(index) {
        const {row, column} = this.positionOf(index);
        return this.axis() === 'row' ? row : column;
    }

    rawWorkspaceName(index) {
        const names = this._wmPrefs.get_strv('workspace-names');
        return index < names.length ? names[index] : '';
    }

    workspaceName(index) {
        const raw = this.rawWorkspaceName(index);
        return raw !== '' ? raw : String(index + 1);
    }

    _groupNamesKey() {
        return this.axis() === 'row' ? 'group-names-row' : 'group-names-column';
    }

    groupNamesArray() {
        return this._settings.get_strv(this._groupNamesKey());
    }

    groupName(groupIndex) {
        const names = this.groupNamesArray();
        return groupIndex < names.length ? names[groupIndex] : '';
    }

    indicatorLabel(index) {
        const ws = this.workspaceName(index);
        const group = this.groupName(this.groupIndexOf(index));
        return group !== '' ? `${group} · ${ws}` : ws;
    }

    setWorkspaceName(index, text) {
        const names = this._wmPrefs.get_strv('workspace-names');
        while (names.length <= index)
            names.push('');
        names[index] = text;
        this._wmPrefs.set_strv('workspace-names', names);
    }

    setGroupName(groupIndex, text) {
        const key = this._groupNamesKey();
        const names = this._settings.get_strv(key);
        while (names.length <= groupIndex)
            names.push('');
        names[groupIndex] = text;
        this._settings.set_strv(key, names);
    }
}
