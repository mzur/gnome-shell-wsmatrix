import Gio from 'gi://Gio';
import Gettext from 'gettext';

// Workspace names live in GNOME's shared org.gnome.desktop.wm.preferences
// workspace-names list, so a name set here is the one the rest of the shell
// shows as well. An empty entry means the workspace uses its default name.
export default class WorkspaceNames {
    constructor() {
        this._wmPrefs = new Gio.Settings({
            schema_id: 'org.gnome.desktop.wm.preferences',
        });
    }

    destroy() {
        this._wmPrefs = null;
    }

    // The default name GNOME gives an unnamed workspace, in the user's
    // language (the same string Meta.prefs_get_workspace_name falls back to).
    defaultWorkspaceName(index) {
        return Gettext.dgettext('mutter', 'Workspace %d').replace('%d', String(index + 1));
    }

    // The custom name stored for a workspace, or '' if it has none.
    customWorkspaceName(index) {
        const names = this._wmPrefs.get_strv('workspace-names');
        return index < names.length ? names[index] : '';
    }

    // The name to display for a workspace.
    workspaceName(index) {
        return this.customWorkspaceName(index) || this.defaultWorkspaceName(index);
    }

    connectChanged(callback) {
        return this._wmPrefs.connect('changed::workspace-names', callback);
    }

    disconnect(id) {
        this._wmPrefs.disconnect(id);
    }

    setWorkspaceName(index, text) {
        const names = this._wmPrefs.get_strv('workspace-names');
        while (names.length <= index)
            names.push('');

        // An empty name, or the default name typed back in, clears the custom
        // name instead of storing the default as a literal.
        text = text.trim();
        if (text === this.defaultWorkspaceName(index))
            text = '';

        names[index] = text;
        this._wmPrefs.set_strv('workspace-names', names);
    }
}
