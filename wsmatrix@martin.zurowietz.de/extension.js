const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Settings = WsMatrix.imports.preferences.Settings.Settings;
const WmOverride = WsMatrix.imports.overview.WmOverride.WmOverride;
const OverviewOverride = WsMatrix.imports.overview.OverviewOverride.OverviewOverride;
const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();

class WsmatrixExtension {
   constructor() {
      let settings = ExtensionUtils.getSettings(Self.metadata['settings-schema']);
      let keybindings = ExtensionUtils.getSettings(Self.metadata['keybindings-schema']);
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
   wsMatrix = new WsmatrixExtension();
}

function disable() {
   wsMatrix.destroy();
   wsMatrix = null;
}
