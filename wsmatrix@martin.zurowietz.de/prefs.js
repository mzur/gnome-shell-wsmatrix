import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class Prefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();

        const page = new Adw.PreferencesPage();

        let group = new Adw.PreferencesGroup({
            title: _('General Settings'),
        });
        page.add(group);

        group.add(this._createSpinRow('Number of columns', 'num-columns', {
            value: 2,
            lower: 1,
            upper: 36,
            step_increment: 1,
        }));

        group.add(this._createSpinRow('Number of rows', 'num-rows', {
            value: 2,
            lower: 1,
            upper: 36,
            step_increment: 1,
        }));

        group.add(this._createComboRow('Wraparound mode', 'wraparound-mode', [
            'None',
            'Next/Previous',
            'Rows/Columns',
            'Next/Previous Bordered',
        ]));

        group = new Adw.PreferencesGroup({
            title: _('Popup Settings'),
        });
        page.add(group);

        group.add(this._createSwitcherRow('Show popup', 'show-popup'));

        group.add(this._createSpinRow('Time to show the popup (ms)', 'popup-timeout', {
            value: 600,
            lower: 0,
            upper: 5000,
            step_increment: 10,
        }));

        group.add(this._createSwitcherRow('Show workspace thumbnails in popup', 'show-thumbnails'));

        group.add(this._createSwitcherRow('Show workspace names in popup', 'show-workspace-names'));

        group.add(this._createSwitcherRow('Select workspaces with mouse hover in popup', 'enable-popup-workspace-hover'));

        group.add(this._createSpinRow('Scale of workspace switcher popup', 'scale', {
            value: 0.5,
            lower: 0.01,
            upper: 1.0,
            step_increment: 0.01,
            digits: 2,
        }));

        group.add(this._createSwitcherRow('Show popup for all monitors', 'multi-monitor'));

        group = new Adw.PreferencesGroup({
            title: _('Overview Settings'),
        });
        page.add(group);

        group.add(this._createSwitcherRow('Show workspace grid in overview', 'show-overview-grid'));

        window.add(page);
    }

    _createSpinRow(title, settingsKey, options) {
        let digits = options.digits ?? 0;
        delete options.digits;
        const row = new Adw.SpinRow({
            title: _(title),
            // subtitle: _('Whether to show the panel indicator'),
            adjustment: new Gtk.Adjustment(options),
            digits: digits,
        });
        this._settings.bind(settingsKey, row, 'value', Gio.SettingsBindFlags.DEFAULT);

        return row;
    }

    _createComboRow(title, settingsKey, strings) {
        const row = new Adw.ComboRow({
            title: _(title),
        });
        row.set_model(new Gtk.StringList({strings}));
        row.connect('notify', (row) => {
            this._settings.set_enum(settingsKey, row.selected);
        });

        return row;
    }

    _createSwitcherRow(title, settingsKey) {
        const row = new Adw.SwitchRow({
            title: _(title),
        });
        this._settings.bind(settingsKey, row, 'active', Gio.SettingsBindFlags.DEFAULT);

        return row;
    }
}
