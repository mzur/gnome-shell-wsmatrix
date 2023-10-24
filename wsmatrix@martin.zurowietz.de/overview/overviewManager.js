import ControlsManagerLayout from './controlsManagerLayout.js';
import SecondaryMonitorDisplay from './secondaryMonitorDisplay.js';
import ThumbnailsBox from './thumbnailsBox.js';
import WorkspacesView from './workspacesView.js';

export default class OverviewManager {
    constructor(settings) {
        this._settings = settings;

        this._overrides = [
            new ThumbnailsBox(),
            new WorkspacesView(),
            new ControlsManagerLayout(),
            new SecondaryMonitorDisplay(),
        ];

        this._handleShowOverviewGridChanged();
        this._connectSettings();
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

    destroy() {
        this.restore();
        this._disconnectSettings();
    }
}
