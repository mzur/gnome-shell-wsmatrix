import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {PACKAGE_VERSION} from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';

// From js/misc/utils.js which can't be imported.
function _GNOMEversionToNumber(version) {
    let ret = Number(version);
    if (!isNaN(ret))
        return ret;
    if (version === 'alpha')
        return -2;
    if (version === 'beta')
        return -1;
    return ret;
}

function GNOMEversionCompare(version1, version2) {
    const v1Array = version1.split('.');
    const v2Array = version2.split('.');

    for (let i = 0; i < Math.max(v1Array.length, v2Array.length); i++) {
        let elemV1 = _GNOMEversionToNumber(v1Array[i] || '0');
        let elemV2 = _GNOMEversionToNumber(v2Array[i] || '0');
        if (elemV1 < elemV2)
            return -1;
        if (elemV1 > elemV2)
            return 1;
    }

    return 0;
}

export default class Prefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        let settings = this.getSettings();
        // Avoid garbage collection before window close.
        window._settings = settings;

        const page = new Adw.PreferencesPage();

        if (GNOMEversionCompare(PACKAGE_VERSION, '45.1') < 0) {
            // window.add_toast(new Adw.Toast({title: 'Test'}));
            let group = new Adw.PreferencesGroup();
            let banner = new Adw.Banner({
                title: _('Some features of the extension are disabled until GNOME Shell 45.1.'),
                revealed: true,
            });
            group.add(banner);
            page.add(group);
        }

        let group = new Adw.PreferencesGroup({
            title: _('General Settings'),
        });
        page.add(group);

        group.add(this._createSpinRow('Number of columns', 'num-columns', {
            value: 2,
            lower: 1,
            upper: 36,
            step_increment: 1,
        }, settings));

        group.add(this._createSpinRow('Number of rows', 'num-rows', {
            value: 2,
            lower: 1,
            upper: 36,
            step_increment: 1,
        }, settings));

        group.add(this._createComboRow('Wraparound mode', 'wraparound-mode', [
            'None',
            'Next/Previous',
            'Rows/Columns',
            'Next/Previous Bordered',
        ], settings));

        group = new Adw.PreferencesGroup({
            title: _('Popup Settings'),
        });
        page.add(group);

        group.add(this._createSwitcherRow('Show popup', 'show-popup', settings));

        group.add(this._createSpinRow('Time to show the popup (ms)', 'popup-timeout', {
            value: 600,
            lower: 0,
            upper: 5000,
            step_increment: 10,
        }, settings));

        group.add(this._createSwitcherRow('Show workspace thumbnails in popup', 'show-thumbnails', settings));

        group.add(this._createSwitcherRow('Show workspace names in popup', 'show-workspace-names', settings));

        group.add(this._createSwitcherRow('Select workspaces with mouse hover in popup', 'enable-popup-workspace-hover', settings));

        group.add(this._createSpinRow('Scale of workspace switcher popup', 'scale', {
            value: 0.5,
            lower: 0.01,
            upper: 1.0,
            step_increment: 0.01,
            digits: 2,
        }, settings));

        group.add(this._createSwitcherRow('Show popup for all monitors', 'multi-monitor', settings));

        group = new Adw.PreferencesGroup({
            title: _('Overview Settings'),
        });
        page.add(group);

        group.add(this._createSwitcherRow('Show workspace grid in overview', 'show-overview-grid', settings));

        window.add(page);
    }

    _createSpinRow(title, settingsKey, options, settings) {
        let digits = options.digits ?? 0;
        delete options.digits;
        const row = new Adw.SpinRow({
            title: _(title),
            // subtitle: _('Whether to show the panel indicator'),
            adjustment: new Gtk.Adjustment(options),
            digits: digits,
        });
        settings.bind(settingsKey, row, 'value', Gio.SettingsBindFlags.DEFAULT);

        return row;
    }

    _createComboRow(title, settingsKey, strings, settings) {
        const row = new Adw.ComboRow({
            title: _(title),
        });
        row.set_model(new Gtk.StringList({strings}));
        row.connect('notify::selected', (row) => {
            settings.set_enum(settingsKey, row.selected);
        });

        return row;
    }

    _createSwitcherRow(title, settingsKey, settings) {
        const row = new Adw.SwitchRow({
            title: _(title),
        });
        settings.bind(settingsKey, row, 'active', Gio.SettingsBindFlags.DEFAULT);

        return row;
    }
}
