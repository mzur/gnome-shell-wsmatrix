import ControlsManagerLayout from './controlsManagerLayout.js';
import SecondaryMonitorDisplay from './secondaryMonitorDisplay.js';
import ThumbnailsBox from './thumbnailsBox.js';
import WorkspacesView from './workspacesView.js';

export default class OverviewManager {
    constructor(settings) {
        this._settings = settings;

        this._thumbnailsBoxOverride = new ThumbnailsBox();
        this._workspacesViewOverride = new WorkspacesView();
        this._controlsManagerLayoutOverride = new ControlsManagerLayout();
        this._secondaryMonitorDisplayOverride = new SecondaryMonitorDisplay();

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
        this._thumbnailsBoxOverride.overrideOriginalProperties();
        this._workspacesViewOverride.overrideOriginalProperties();
        this._controlsManagerLayoutOverride.overrideOriginalProperties();
        this._secondaryMonitorDisplayOverride.overrideOriginalProperties();
    }

    restore() {
        this._thumbnailsBoxOverride.restoreOriginalProperties();
        this._workspacesViewOverride.restoreOriginalProperties();
        this._controlsManagerLayoutOverride.restoreOriginalProperties();
        this._secondaryMonitorDisplayOverride.restoreOriginalProperties();
    }

    destroy() {
        this._disconnectSettings();
    }
}
