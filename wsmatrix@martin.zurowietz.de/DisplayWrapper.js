const Meta = imports.gi.Meta;

var DisplayWrapper = {

    getScreen: function() {
        return global.screen || global.display;
    },

    getWorkspaceManager: function() {
        return global.screen || global.workspace_manager;
    },

    getMonitorManager: function() {
        return global.screen || Meta.MonitorManager.get();
    },

    getDisplayCorner: function() {
        return Meta.ScreenCorner || Meta.DisplayCorner;
    },

};
