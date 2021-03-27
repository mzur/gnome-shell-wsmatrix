const { Clutter, Meta, GObject } = imports.gi;
const workspacesView = imports.ui.workspacesView;
const WorkspacesViewBase = workspacesView.WorkspacesView;

var WorkspacesView = GObject.registerClass(
class WorkspacesView extends WorkspacesViewBase {
   _init(monitorIndex, scrollAdjustment, rows, columns) {
        super._init(monitorIndex, scrollAdjustment);
        this.rows = rows;
        this.columns = columns;
    }

   vfunc_allocate(box) {
      this.set_allocation(box);

      if (this.get_n_children() === 0)
         return;

      const { workspaceManager } = global;
      const { nWorkspaces } = workspaceManager;

      const rtl = this.text_direction === Clutter.TextDirection.RTL;

      this._workspaces.forEach((child, index) => {
         if (rtl)
            index = nWorkspaces - index - 1;

         const x = (index % this.columns) * this.width;
         // const x = vertical ? 0 : index * this.width;
         const y = Math.floor(index / this.columns) * this.height;
         // const y = vertical ? index * this.height : 0;

         child.allocate_available_size(x, y, box.get_width(), box.get_height());
      });

      this._updateScrollPosition();
   }

   _activeWorkspaceChanged(_wm, _from, _to, _direction) {
      if (this._scrolling)
         return;

      this._wsmatrixDirection = _direction;

      this._scrollToActive();
    }

    _scrollToActive() {
        const { workspaceManager } = global;
        let active = workspaceManager.get_active_workspace_index();
        const vertical = this._wsmatrixDirection === Meta.MotionDirection.DOWN || this._wsmatrixDirection === Meta.MotionDirection.UP;
        if (vertical) {
            active = Math.floor(active / this.columns);
        } else {
            active = active % this.columns;
        }

        this._animating = true;
        this._updateVisibility();

        this._scrollAdjustment.remove_transition('value');
        this._scrollAdjustment.ease(active, {
            duration: workspacesView.WORKSPACE_SWITCH_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete: () => {
                this._animating = false;
                this._updateVisibility();
            },
        });
    }

   _updateScrollPosition() {
      if (!this.has_allocation())
         return;

      const adj = this._scrollAdjustment;

      if (adj.upper == 1)
         return;


      const workspaceManager = global.workspace_manager;
      const vertical = this._wsmatrixDirection === Meta.MotionDirection.DOWN || this._wsmatrixDirection === Meta.MotionDirection.UP;
      const rtl = this.text_direction === Clutter.TextDirection.RTL;
      let progress = vertical || !rtl
         ? adj.value : adj.upper - adj.value - 1;

      for (const ws of this._workspaces) {
         if (vertical)
            ws.translation_y = -progress * this.height;
         else
            ws.translation_x = -progress * this.width;
      }
   }
});
