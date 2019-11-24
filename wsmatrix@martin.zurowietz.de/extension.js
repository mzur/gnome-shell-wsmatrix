const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Settings = WsMatrix.imports.Settings.Settings;
const WmOverride = WsMatrix.imports.WmOverride.WmOverride;
const OverviewOverride = WsMatrix.imports.OverviewOverride.OverviewOverride;
const WM = imports.ui.main.wm;

class WsMatrixExtension {
   constructor() {
      let settings = new Settings(WsMatrix.metadata['settings-schema']);
      let keybindings = new Settings(WsMatrix.metadata['keybindings-schema']);
      this.overrideWorkspace = new WmOverride(settings, keybindings);
      this.overrideOverview = new OverviewOverride(settings, keybindings);
   }

   destroy() {
      this.overrideWorkspace.destroy();
      this.overrideOverview.destroy();
   }
}

let wsMatrix;

function enable() {
   wsMatrix = new WsMatrixExtension();
   WM.wsmatrix = wsMatrix;
}

function disable() {
   wsMatrix.destroy();
   wsMatrix = null;
}
