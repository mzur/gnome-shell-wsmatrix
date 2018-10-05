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
      this._bindBooleans();
      this._bindEnumerations();
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
      widget.connect('changed', (combobox) => {
         this._settings.set_enum(setting, combobox.get_active());
      });
   },

   _bindEnumerations: function () {
      this._getEnumerations().forEach(this._bindEnumeration, this);
   },

   _getSpins: function () {
      return [
         'num-rows',
         'num-columns',
      ];
   },

   _bindSpin: function (setting) {
      let widget = this._getWidget(setting);
      widget.set_value(this._settings.get_int(setting));
      widget.connect('changed', (spin) => {
         this._settings.set_int(setting, spin.get_value());
      });
   },

   _bindEnumerations: function () {
      this._getSpins().forEach(this._bindSpin, this);
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
