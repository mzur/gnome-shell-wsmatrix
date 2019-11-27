const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;

var Settings = GObject.registerClass(
class Settings extends Gio.Settings {
  _init(schema) {
    let schemaDir    = WsMatrix.dir.get_child('schemas');
    let schemaSource = null;

    if (schemaDir.query_exists(null)) {
      schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
    } else {
      schemaSource = GioSSS.get_default();
    }

    let schemaObj = schemaSource.lookup(schema, true);

    if (!schemaObj) {
      let message = 'Schema ' + schema + ' could not be found for extension ' + WsMatrix.metadata.uuid;
      throw new Error(message + '. Please check your installation.');
    }

    super._init({ settings_schema: schemaObj });
  }
});
