// import ControlsManagerLayout from './controlsManagerLayout.js';
import SecondaryMonitorDisplay from './secondaryMonitorDisplay.js';
// import ThumbnailsBox from './thumbnailsBox.js';
import WorkspacesView from './workspacesView.js';
import {GNOMEversionCompare} from 'resource:///org/gnome/shell/misc/util.js';
import {PACKAGE_VERSION} from 'resource:///org/gnome/shell/misc/config.js';

export default class OverviewManager {
    constructor(settings) {
        this._settings = settings;
    }

    async enable() {
        this._connectSettings();
        await this._initOverrides();
        this._handleShowOverviewGridChanged();
    }

    // This can be moved to the constructor again if there is no need for the conditional
    // import any more.
    async _initOverrides() {
        this._overrides = [
            new WorkspacesView(),
            new SecondaryMonitorDisplay(),
            // new ThumbnailsBox(),
            // new ControlsManagerLayout(),
        ];

        // This only works starting in GNOME Shell 45.1 and up.
        if (GNOMEversionCompare(PACKAGE_VERSION, '45.1') >= 0) {
            const {default: ThumbnailsBox} = await import('./thumbnailsBox.js');
            this._overrides.push(new ThumbnailsBox());
            const {default: ControlsManagerLayout} = await import('./controlsManagerLayout.js');
            this._overrides.push(new ControlsManagerLayout());
        }
    }

    _connectSettings() {
        this.settingsHandlerShowOverviewGrid = this._settings.connect(
            'changed::show-overview-grid',
            this._handleShowOverviewGridChanged.bind(this)
        );
    }

    _disconnectSettings() {
        this._settings.disconnect(this.settingsHandlerShowOverviewGrid);
    }

    _handleShowOverviewGridChanged() {
        let show = this._settings.get_boolean('show-overview-grid');
        if (show) {
            this.override();
        } else {
            this.restore();
        }
    }

    override() {
        this._overrides.forEach(o => o.enable());
    }

    restore() {
        this._overrides.forEach(o => o.disable());
    }

    disable() {
        this.restore();
        this._disconnectSettings();
    }
}
