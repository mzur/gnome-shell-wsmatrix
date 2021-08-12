const { Clutter, GObject } = imports.gi;

const Main = imports.ui.main;
const GOverviewControls = imports.ui.overviewControls;

const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const ThumbnailsBox = Self.imports.overview.thumbnailsBox;

const ControlsManager = GObject.registerClass(
    class ControlsManager extends GOverviewControls.ControlsManager {
        _init() {
            super._init();
            this._thumbnailsBox.destroy();

            this._thumbnailsBox = new ThumbnailsBox.ThumbnailsBox(
                this._workspaceAdjustment, Main.layoutManager.primaryIndex);
            this._thumbnailsBox.connect('notify::should-show', () => {
                this._thumbnailsBox.show();
                this._thumbnailsBox.ease_property('expand-fraction',
                    this._thumbnailsBox.should_show ? 1 : 0, {
                        duration: SIDE_CONTROLS_ANIMATION_TIME,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                        onComplete: () => this._updateThumbnailsBox(),
                    });
            });
        }
    });
