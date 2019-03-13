const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Settings = WsMatrix.imports.Settings.Settings;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

var PrefsWidget = new GObject.Class({
   Name: 'Wsmatrix.PrefsWidget',
   GTypeName: 'PrefsWidget',
   Extends: Gtk.Box,

   _init: function(settings, params) {
      this.parent(params);

      this._buildable = new Gtk.Builder();
      this._buildable.add_from_file(WsMatrix.path + '/settings.ui');

      let prefsWidget = this._getWidget('prefs_widget');
      this.add(prefsWidget);

      this._settings = settings;
      // this._bindBooleans();
      // this._bindEnumerations();
      this._bindIntSpins();
      this._bindDblSpins();
   },

   _getWidget: function(name) {
      let wname = name.replace(/-/g, '_');
      return this._buildable.get_object(wname);
   },

   _getBooleans: function () {
      return [];
   },

   _bindBoolean: function (setting) {
      let widget = this._getWidget(setting);
      this._settings.bind(setting, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
   },

   _bindBooleans: function () {
      this._getBooleans().forEach(this._bindBoolean, this);
   },

   _getEnumerations: function () {
      return [];
   },

   _bindEnumeration: function (setting) {
      let widget = this._getWidget(setting);
      widget.set_active(this._settings.get_enum(setting));
      widget.connect('value-changed', (combobox) => {
         this._settings.set_enum(setting, combobox.get_active());
      });
   },

   _bindEnumerations: function () {
      this._getEnumerations().forEach(this._bindEnumeration, this);
   },

   _getIntSpins: function () {
      return [
         'num-rows',
         'num-columns',
      ];
   },

   _bindIntSpin: function (setting) {
      let widget = this._getWidget(setting);
      widget.set_value(this._settings.get_int(setting));
      widget.connect('value-changed', (spin) => {
         this._settings.set_int(setting, spin.get_value());
      });
   },

   _bindIntSpins: function () {
      this._getIntSpins().forEach(this._bindIntSpin, this);
   },

   _getDblSpins: function () {
      return [
         'scale',
      ];
   },

   _bindDblSpin: function (setting) {
      let widget = this._getWidget(setting);
      widget.set_value(this._settings.get_double(setting));
      widget.connect('value-changed', (spin) => {
         this._settings.set_double(setting, spin.get_value());
      });
   },

   _bindDblSpins: function () {
      this._getDblSpins().forEach(this._bindDblSpin, this);
   },
});

function init() {

}

function buildPrefsWidget() {
   let settings = new Settings(WsMatrix.metadata['settings-schema']);
   let widget = new PrefsWidget(settings);
   widget.show_all();

   return widget;
}
