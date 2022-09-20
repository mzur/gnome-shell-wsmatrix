const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const PrefsWidget = GObject.registerClass({
    GTypeName: 'PrefsWidget',
    Template: Self.dir.get_child('settings.ui').get_uri(),
    InternalChildren: [
        'num_columns',
        'num_rows',
        'show_popup',
        'popup_timeout',
        'show_thumbnails',
        'enable_popup_workspace_hover',
        'scale',
        'show_overview_grid',
        'multi_monitor',
        'show_workspace_names',
        'wraparound_mode',
    ],
}, class PrefsWidget extends Gtk.Box {

    _init(params = {}) {
        super._init(params);
        this._settings = ExtensionUtils.getSettings(Self.metadata['settings-schema']);

        this._bind('num-columns', 'num_columns', 'value');
        this._bind('num-rows', 'num_rows', 'value');
        this._bind('show-popup', 'show_popup', 'active');
        this._bind('popup-timeout', 'popup_timeout', 'value');
        this._bind('show-thumbnails', 'show_thumbnails', 'active');
        this._bind('enable-popup-workspace-hover', 'enable_popup_workspace_hover', 'active');
        this._bind('scale', 'scale', 'value');
        this._bind('show-overview-grid', 'show_overview_grid', 'active');
        this._bind('multi-monitor', 'multi_monitor', 'active');
        this._bind('show-workspace-names', 'show_workspace_names', 'active');

        const wraparoundMode = this._widget('wraparound_mode');
        wraparoundMode.set_active(this._settings.get_enum('wraparound-mode'));
        wraparoundMode.connect('changed', (combobox) => {
            this._settings.set_enum('wraparound-mode', combobox.get_active());
        });
    }

    _widget(id) {
        const name = '_' + id;
        if (!this[name]) {
            throw `Unknown widget with ID "${id}"!`;
        }

        return this[name];
    }

    _bind(settingsKey, widgetId, widgetProperty, flag = Gio.SettingsBindFlags.DEFAULT) {
        const widget = this._widget(widgetId);
        this._settings.bind(settingsKey, widget, widgetProperty, flag);
        this._settings.bind_writable(settingsKey, widget, 'sensitive', false);
    }

    _bindWidgetSensitive(widgetId, settingsKey, invert = false) {
        this._settings.connect(
            'changed::' + settingsKey,
            () => this._updateWidgetSensitive(widgetId, settingsKey, invert),
        );
        this._updateWidgetSensitive(widgetId, settingsKey, invert);
    }

    _updateWidgetSensitive(widgetId, settingsKey, invert) {
        const active = this._settings.get_boolean(settingsKey);
        this._widget(widgetId).set_sensitive(invert ? !active : active);
    }
});

function init() {
    ExtensionUtils.initTranslations('wsmatrix');
}

function buildPrefsWidget() {
    return new PrefsWidget();
}
