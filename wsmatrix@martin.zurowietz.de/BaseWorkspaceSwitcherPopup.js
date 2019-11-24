const { Clutter, GLib, GObject} = imports.gi;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup.WorkspaceSwitcherPopup;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const WM = Main.wm;

var ANIMATION_TIME = 100;

var BaseWorkspaceSwitcherPopup = GObject.registerClass(
class BaseWorkspaceSwitcherPopup extends WorkspaceSwitcherPopup {
   _init(popupTimeout, monitorIndex) {
      super._init();
      this._popupTimeout = popupTimeout;
      this._monitorIndex = monitorIndex;
      this._haveModal = false;
   }

   display(direction, activeWorkspaceIndex) {
      super.display(direction, activeWorkspaceIndex);

      if (this._timeoutId !== 0) {
         Mainloop.source_remove(this._timeoutId);
         this._timeoutId = 0;
      }

      if (this._popupTimeout > 0) {
         this._timeoutId = Mainloop.timeout_add(this._popupTimeout, this._onTimeout.bind(this));
         GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');
      } else if (!this._haveModal && this._popupTimeout == 0 && this._monitorIndex == Main.layoutManager.primaryMonitor.index){
         Main.pushModal(this);
         this._haveModal = true;
      }
   }

   vfunc_key_release_event(keyEvent) {
      let key = keyEvent.keyval;

      switch (key) {
         case Clutter.KEY_Up:
            WM.wsmatrix.overrideWorkspace._workspaceOverviewMoveUp();
            break;
         case Clutter.KEY_Down:
            WM.wsmatrix.overrideWorkspace._workspaceOverviewMoveDown();
            break;
         case Clutter.KEY_Left:
            WM.wsmatrix.overrideWorkspace._workspaceOverviewMoveLeft();
            break;
         case Clutter.KEY_Right:
            WM.wsmatrix.overrideWorkspace._workspaceOverviewMoveRight();
            break;
      }

      // keypad keys, from 1 (65457) to 9 (65465)
      if (key >= 65457 && key <= 65465) {
         // the key number from 1 to 9
         let keyNumber = key - 65457 + 1;
         WM.wsmatrix.overrideWorkspace._moveToWorkspaceIndex(this._keyNumToWorkspace(keyNumber) - 1);
      }

      // arrow keys
      if (key == Clutter.KEY_Alt_L || key == Clutter.KEY_Alt_R || key == Clutter.KEY_Ctrl_L || key == Clutter.KEY_Ctrl_R) {
         WM.wsmatrix.overrideWorkspace._hideWorkspaceSwitcherPopup();
      }

      return Clutter.EVENT_STOP;
   }

   _keyNumToWorkspace(keyNumber) {
      switch (keyNumber) {
         case 7:
            return 1;
         case 8:
            return 2;
         case 9:
            return 3;
         case 1:
            return 7;
         case 2:
            return 8;
         case 3:
            return 9;
         default:
            return keyNumber;
      }
   }

   _popModal() {
      if (this._haveModal) {
         Main.popModal(this);
         this._haveModal = false;
      }
   }

   _onTimeout() {
      if (this._timeoutId !== 0) {
         GLib.source_remove(this._timeoutId);
         this._timeoutId = 0;
      }

      let _this = this;
      this._container.ease({
          opacity: 0.0,
          duration: ANIMATION_TIME,
          mode: Clutter.AnimationMode.EASE_OUT_QUAD,
          onComplete: function() {
             if (_this._popupTimeout === 0) {
                // we pop the modal and then hide, otherwise the focus and keys will be sent to the popup
               _this._popModal();
               _this.hide();
             } else {
               _this.destroy();
             }
          } 
      });

      return GLib.SOURCE_REMOVE;
  }

  _hide() {
      if (this._popupTimeout === 0) {
         // popup timeout = 0 means hide on key mask release
         this._onTimeout();
      } else {
         this.hide();
      }
  }
});
