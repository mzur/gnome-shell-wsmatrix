const { GLib, GObject} = imports.gi;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopup;
const Mainloop = imports.mainloop;

var BaseWorkspaceSwitcherPopup = GObject.registerClass(
class BaseWorkspaceSwitcherPopup extends WorkspaceSwitcherPopup {
   _init(popupTimeout) {
      super._init();
      this._popupTimeout = popupTimeout;
   }

   display(direction, activeWorkspaceIndex) {
      super.display(direction, activeWorkspaceIndex);

      Mainloop.source_remove(this._timeoutId);
      this._timeoutId = Mainloop.timeout_add(this._popupTimeout, this._onTimeout.bind(this));
      GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');
   }
});
