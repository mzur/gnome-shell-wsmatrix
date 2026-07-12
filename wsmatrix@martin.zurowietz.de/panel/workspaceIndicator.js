import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {SCROLL_TIMEOUT_TIME} from 'resource:///org/gnome/shell/ui/windowManager.js';
import WorkspaceNames from '../workspaceNames.js';

const POSITIONS = ['left', 'center', 'right'];

const IndicatorButton = GObject.registerClass(
class IndicatorButton extends PanelMenu.Button {
    _init(callbacks) {
        // menuAlignment, nameText, dontCreateMenu=true (no menu; we handle click)
        super._init(0.0, 'wsmatrix-indicator', true);
        this._callbacks = callbacks;

        this._canScroll = true;
        this._scrollTimeoutId = 0;
        this.connect('destroy', () => {
            if (this._scrollTimeoutId) {
                GLib.source_remove(this._scrollTimeoutId);
                this._scrollTimeoutId = 0;
            }
        });

        this._label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'wsmatrix-indicator-label',
        });
        this.add_child(this._label);

        this.connect('button-press-event', this._onButtonPress.bind(this));
        this.connect('scroll-event', this._onScroll.bind(this));
    }

    setText(text) {
        this._label.text = text;
    }

    _onButtonPress(actor, event) {
        if (event.get_button() === Clutter.BUTTON_PRIMARY) {
            this._callbacks.toggleOverview();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onScroll(actor, event) {
        if (!this._canScroll)
            return Clutter.EVENT_STOP;

        let direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            if (dx === 0 && dy === 0)
                return Clutter.EVENT_PROPAGATE;
            if (Math.abs(dy) >= Math.abs(dx))
                direction = dy < 0 ? Clutter.ScrollDirection.UP : Clutter.ScrollDirection.DOWN;
            else
                direction = dx < 0 ? Clutter.ScrollDirection.LEFT : Clutter.ScrollDirection.RIGHT;
        }

        let motion;
        switch (direction) {
        case Clutter.ScrollDirection.UP:
            motion = Meta.MotionDirection.UP;
            break;
        case Clutter.ScrollDirection.DOWN:
            motion = Meta.MotionDirection.DOWN;
            break;
        case Clutter.ScrollDirection.LEFT:
            motion = Meta.MotionDirection.LEFT;
            break;
        case Clutter.ScrollDirection.RIGHT:
            motion = Meta.MotionDirection.RIGHT;
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        this._callbacks.scroll(motion);

        this._canScroll = false;
        this._scrollTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SCROLL_TIMEOUT_TIME, () => {
            this._canScroll = true;
            this._scrollTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });

        return Clutter.EVENT_STOP;
    }
});

export default class WorkspaceIndicator {
    constructor(settings, callbacks) {
        this._settings = settings;
        this._callbacks = callbacks;
        this._names = new WorkspaceNames(settings);
        this._button = null;
        this._wsmSignals = [];
        this._settingsSignals = [];
        this._wmNamesSignal = null;
    }

    enable() {
        this._settingsSignals.push(this._settings.connect(
            'changed::show-panel-indicator', this._sync.bind(this)));
        this._settingsSignals.push(this._settings.connect(
            'changed::panel-indicator-position', this._replace.bind(this)));
        [
            'changed::group-names-row',
            'changed::group-names-column',
            'changed::group-axis',
            'changed::num-rows',
            'changed::num-columns',
        ].forEach(signal => this._settingsSignals.push(
            this._settings.connect(signal, this._update.bind(this))));

        this._wmNamesSignal = this._names.connectWorkspaceNamesChanged(this._update.bind(this));

        this._sync();
    }

    _sync() {
        if (this._settings.get_boolean('show-panel-indicator'))
            this._show();
        else
            this._hide();
    }

    _show() {
        if (this._button)
            return;

        this._button = new IndicatorButton(this._callbacks);

        const box = POSITIONS[this._settings.get_enum('panel-indicator-position')];
        // Sit just after Activities on the left; at the start of center/right.
        const position = box === 'left' ? 1 : 0;
        Main.panel.addToStatusArea('wsmatrix-indicator', this._button, position, box);

        const wsm = global.workspace_manager;
        this._wsmSignals.push([wsm, wsm.connect(
            'active-workspace-changed', this._update.bind(this))]);
        this._wsmSignals.push([wsm, wsm.connect(
            'notify::n-workspaces', this._update.bind(this))]);
        this._wsmSignals.push([wsm, wsm.connect(
            'workspaces-reordered', this._update.bind(this))]);

        this._update();
    }

    _hide() {
        this._wsmSignals.forEach(([obj, id]) => obj.disconnect(id));
        this._wsmSignals = [];
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }

    _replace() {
        if (!this._button)
            return;
        this._hide();
        this._show();
    }

    _update() {
        if (!this._button)
            return;
        const index = global.workspace_manager.get_active_workspace_index();
        this._button.setText(this._names.indicatorLabel(index));
    }

    disable() {
        this._settingsSignals.forEach(id => this._settings.disconnect(id));
        this._settingsSignals = [];
        if (this._wmNamesSignal) {
            this._names.disconnectWorkspaceNamesChanged(this._wmNamesSignal);
            this._wmNamesSignal = null;
        }
        this._hide();
        this._names.destroy();
        this._names = null;
    }
}
