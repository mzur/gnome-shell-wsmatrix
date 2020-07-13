const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Settings = WsMatrix.imports.Settings.Settings;
const WmOverride = WsMatrix.imports.WmOverride.WmOverride;
const OverviewOverride = WsMatrix.imports.OverviewOverride.OverviewOverride;

class WsMatrixExtension {
   constructor() {
      let settings = new Settings(WsMatrix.metadata['settings-schema']);
      let keybindings = new Settings(WsMatrix.metadata['keybindings-schema']);
      this.overrideWorkspace = new WmOverride(settings, keybindings);
      if (Main.overview._overview) {
         this.overrideOverview = new OverviewOverride(settings, keybindings);
      }
   }

   destroy() {
      this.overrideWorkspace.destroy();
      if (this.overrideOverview) {
         this.overrideOverview.destroy();
      }
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
