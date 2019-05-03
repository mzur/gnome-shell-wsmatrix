const { GLib, GObject} = imports.gi;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopup;
const Mainloop = imports.mainloop;

var BaseWorkspaceSwitcherPopup = GObject.registerClass(
class BaseWorkspaceSwitcherPopup extends WorkspaceSwitcherPopup {
   _init(popupTimeout, cacheSwitcher) {
      super._init();
      this._popupTimeout = popupTimeout;
      this._cacheSwitcher = cacheSwitcher;

      // Fix popup jump issue (https://github.com/mzur/gnome-shell-wsmatrix/issues/14).
      this.connect('style-changed', () => {
         if (!this._itemSpacing || this._itemSpacing != this._list._itemSpacing) {
            log("style changed to " + this._list._itemSpacing);
            // Force rerendering only if _itemSpacing value changed
            this._itemSpacing = this._list._itemSpacing;
            this._redisplay(true);
         }
      });
   }

   display(direction, activeWorkspaceIndex) {
      super.display(direction, activeWorkspaceIndex);

      Mainloop.source_remove(this._timeoutId);
      this._timeoutId = Mainloop.timeout_add(this._popupTimeout, this._onTimeout.bind(this));
      GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');
   }

   destroy(force=false) {
      if (!this._cacheSwitcher || force) {
         log("complete destroy");
         super.destroy();
      } else {
         log("simple destroy");
         this.hide();
      }
   }
 });
