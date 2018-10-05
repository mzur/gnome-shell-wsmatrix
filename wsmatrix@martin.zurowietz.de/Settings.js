const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;

var Settings = class Settings extends Gio.Settings {
  constructor(schema) {
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

    super({ settings_schema: schemaObj });
  }
};
