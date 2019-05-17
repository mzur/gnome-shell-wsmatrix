const Main = imports.ui.main;
const {Meta, Shell} = imports.gi;

var WorkspaceOverview = class {
   constructor(keybindings) {
      this._addKeybindings(keybindings);
   }

   _addKeybindings(keybindings) {
      Main.wm.addKeybinding(
         'toggle-workspace-overview',
         keybindings,
         Meta.KeyBindingFlags.NONE,
         Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
         this.toggle.bind(this)
      );
   }

   toggle() {
      log('TOGGLE');
   }

   destroy() {
      Main.wm.removeKeybinding('toggle-workspace-overview');
   }

};
