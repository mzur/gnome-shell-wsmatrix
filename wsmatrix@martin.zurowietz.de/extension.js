const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const WmOverride = Self.imports.WmOverride.WmOverride;
const OverviewOverride = Self.imports.OverviewOverride.OverviewOverride;

class Extension {
   constructor() {
      //
   }

   enable() {
      let settings = ExtensionUtils.getSettings(Self.metadata['settings-schema']);
      let keybindings = ExtensionUtils.getSettings(Self.metadata['keybindings-schema']);
      this.overrideWorkspace = new WmOverride(settings, keybindings);
      if (Main.overview._overview) {
         this.overrideOverview = new OverviewOverride(settings, keybindings);
      }
   }

   disable() {
      this.overrideWorkspace.destroy();
      if (this.overrideOverview) {
         this.overrideOverview.destroy();
      }
   }
}

function init() {
   return new Extension();
}
