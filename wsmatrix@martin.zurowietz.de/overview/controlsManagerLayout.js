const { Clutter } = imports.gi;

const Main = imports.ui.main;

const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const DASH_MAX_HEIGHT_RATIO = 0.15;

var ControlsState = {
    HIDDEN: 0,
    WINDOW_PICKER: 1,
    APP_GRID: 2,
};

var ControlsManagerLayout = class {
    constructor(settings, keybindings) {
        this._settings = settings;
        this._keybindings = keybindings;

        this.overrideProperties = [
            'allocate',
        ];
        this._overrideOriginalProperties();
    }

    destroy() {
        this._restoreOriginalProperties();
    }

    _overrideOriginalProperties() {
        this._layoutManager._overrideProperties = {};
        this.overrideProperties.forEach(function (prop) {
            this._layoutManager._overrideProperties[prop] = this._layoutManager[prop].bind(this._layoutManager);
            this._layoutManager[prop] = this[prop].bind(this._layoutManager);
        }, this);
    }

    _restoreOriginalProperties() {
        this.overrideProperties.forEach(function (prop) {
            this._layoutManager[prop] = this._layoutManager._overrideProperties[prop];
        }, this);
    }

    get _layoutManager() {
        return Main.overview._overview._controls.layout_manager;
    }

    allocate(container, box) {
        print("allocateallocateallocate")
        const childBox = new Clutter.ActorBox();

        const {spacing} = this;

        let startY = 0;
        if (Main.layoutManager.panelBox.y === Main.layoutManager.primaryMonitor.y) {
            startY = Main.layoutManager.panelBox.height;
            box.y1 += startY;
        }
        const [width, height] = box.get_size();
        let availableHeight = height;

        // Search entry
        let [searchHeight] = this._searchEntry.get_preferred_height(width);
        childBox.set_origin(0, startY);
        childBox.set_size(width, searchHeight);
        this._searchEntry.allocate(childBox);

        availableHeight -= searchHeight + spacing;

        // Dash
        const maxDashHeight = Math.round(box.get_height() * DASH_MAX_HEIGHT_RATIO);
        this._dash.setMaxSize(width, maxDashHeight);

        let [, dashHeight] = this._dash.get_preferred_height(width);
        dashHeight = Math.min(dashHeight, maxDashHeight);
        childBox.set_origin(0, startY + height - dashHeight);
        childBox.set_size(width, dashHeight);
        this._dash.allocate(childBox);

        availableHeight -= dashHeight + spacing;

        // Workspace Thumbnails
        let thumbnailsHeight = 0;

        let workspaceManager = global.workspace_manager;
        let rows = workspaceManager.layout_rows;
        let columns = workspaceManager.layout_columns;

        if (this._workspacesThumbnails.visible) {
            const {expandFraction} = this._workspacesThumbnails;
            [thumbnailsHeight] =
                this._workspacesThumbnails.get_preferred_height(width);
            thumbnailsHeight = Math.min(
                thumbnailsHeight * expandFraction,
                height * WorkspaceThumbnail.MAX_THUMBNAIL_SCALE) * rows;
            childBox.set_origin(0, startY + searchHeight + spacing);
            childBox.set_size(width, thumbnailsHeight);
            this._workspacesThumbnails.allocate(childBox);
        }

        // Workspaces
        let params = [box, startY, searchHeight, dashHeight, thumbnailsHeight];
        const transitionParams = this._stateAdjustment.getStateTransitionParams();

        // Update cached boxes
        for (const state of Object.values(ControlsState)) {
            this._cachedWorkspaceBoxes.set(
                state, this._computeWorkspacesBoxForState(state, ...params));
        }

        let workspacesBox;
        if (!transitionParams.transitioning) {
            workspacesBox = this._cachedWorkspaceBoxes.get(transitionParams.currentState);
        } else {
            const initialBox = this._cachedWorkspaceBoxes.get(transitionParams.initialState);
            const finalBox = this._cachedWorkspaceBoxes.get(transitionParams.finalState);
            workspacesBox = initialBox.interpolate(finalBox, transitionParams.progress);
        }

        this._workspacesDisplay.allocate(workspacesBox);

        // AppDisplay
        if (this._appDisplay.visible) {
            const workspaceAppGridBox =
                this._cachedWorkspaceBoxes.get(ControlsState.APP_GRID);

            params = [box, startY, searchHeight, dashHeight, workspaceAppGridBox];
            let appDisplayBox;
            if (!transitionParams.transitioning) {
                appDisplayBox =
                    this._getAppDisplayBoxForState(transitionParams.currentState, ...params);
            } else {
                const initialBox =
                    this._getAppDisplayBoxForState(transitionParams.initialState, ...params);
                const finalBox =
                    this._getAppDisplayBoxForState(transitionParams.finalState, ...params);

                appDisplayBox = initialBox.interpolate(finalBox, transitionParams.progress);
            }

            this._appDisplay.allocate(appDisplayBox);
        }

        // Search
        childBox.set_origin(0, startY + searchHeight + spacing);
        childBox.set_size(width, availableHeight);

        this._searchController.allocate(childBox);

        this._runPostAllocation();
    }
}
