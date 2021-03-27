const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const DisplayWrapper = WsMatrix.imports.DisplayWrapper.DisplayWrapper;
const WorkspacesDisplayOverride = WsMatrix.imports.WorkspacesDisplayOverride.WorkspacesDisplayOverride;
const WorkspacesViewOverride = WsMatrix.imports.WorkspacesViewOverride.WorkspacesViewOverride;
const ThumbnailsBoxOverride = WsMatrix.imports.ThumbnailsBoxOverride.ThumbnailsBoxOverride;

var OverviewOverride = class {
   constructor(settings, keybindings) {
      this.wm = Main.wm;
      this.settings = settings;
      this.wsManager = DisplayWrapper.getWorkspaceManager();
      this._keybindings = keybindings;
      this._thumbnailsBoxOverride = null;
      this._workspacesDisplayOverride = null;
      this._workspacesViewOverride = null;
      this._overrideActive = false;

      this._handleNumberOfWorkspacesChanged();
      this._connectSettings();
      this._handleShowOverviewGridChanged();
   }

   destroy() {
      this._disconnectSettings();
      if (this._overrideActive) {
         this._deactivateOverride();
      }
   }

   _connectSettings() {
      this.settingsHandlerRows = this.settings.connect(
         'changed::num-rows',
         this._handleNumberOfWorkspacesChanged.bind(this)
      );

      this.settingsHandlerColumns = this.settings.connect(
         'changed::num-columns',
         this._handleNumberOfWorkspacesChanged.bind(this)
      );

      this.settingsHandlerShowOverviewGrid = this.settings.connect(
         'changed::show-overview-grid',
         this._handleShowOverviewGridChanged.bind(this)
      );
   }

   _disconnectSettings() {
      this.settings.disconnect(this.settingsHandlerRows);
      this.settings.disconnect(this.settingsHandlerColumns);
      this.settings.disconnect(this.settingsHandlerShowOverviewGrid);
   }

   _handleNumberOfWorkspacesChanged() {
      this.rows = this.settings.get_int('num-rows');
      this.columns = this.settings.get_int('num-columns');

      if (this._thumbnailsBoxOverride) {
         this._thumbnailsBoxOverride.setRows(this.rows);
         this._thumbnailsBoxOverride.setColumns(this.columns);
      }
   }

   _handleShowOverviewGridChanged() {
      let showOverviewGrid = this.settings.get_boolean('show-overview-grid');

      if (showOverviewGrid && !this._overrideActive) {
         this._activateOverride();
      }

      if (!showOverviewGrid && this._overrideActive) {
         this._deactivateOverride();
      }
   }

   _activateOverride() {
      this._overrideActive = true;
      let workspacesDisplay = Main.overview._overview._controls.viewSelector._workspacesDisplay;
      this._workspacesDisplayOverride = new WorkspacesDisplayOverride(workspacesDisplay);
      let thumbnailsBox = Main.overview._overview._controls._thumbnailsBox;
      this._thumbnailsBoxOverride = new ThumbnailsBoxOverride(thumbnailsBox, this.rows, this.columns);
      this._workspacesViewOverride = new WorkspacesViewOverride(this.settings);
   }

   _deactivateOverride() {
      this._overrideActive = false;
      this._workspacesDisplayOverride.destroy();
      this._workspacesDisplayOverride = null;
      this._workspacesViewOverride.destroy();
      this._workspacesViewOverride = null;
      this._thumbnailsBoxOverride.destroy();
      this._thumbnailsBoxOverride = null;
   }
}
