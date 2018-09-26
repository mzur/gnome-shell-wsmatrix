const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Settings = WsMatrix.imports.Settings.Settings;
const WmOverride = WsMatrix.imports.WmOverride.WmOverride;

class WsMatrixExtension {
   constructor() {
      let settings = new Settings(WsMatrix.metadata['settings-schema']);
      this.override = new WmOverride(settings);
   }
   destroy() {
      this.override.destroy();
   }
}

let wsMatrix;

function enable() {
   wsMatrix = new WsMatrixExtension();
}

function disable() {
   wsMatrix.destroy();
   wsMatrix = null;
}
