import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import WorkspaceThumbnail from '../workspacePopup/workspaceThumbnail.js';
// TODO: export ThumbnailState
import {
    MAX_THUMBNAIL_SCALE,
    ThumbnailState,
    ThumbnailsBox as GThumbnailsBox
} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import {overrideProto} from '../util.js'

export default class ThumbnailsBox {
    constructor() {
        this.originalThumbnailsBox = null;
        this._overrideProperties = {
            addThumbnails(start, count) {
                let workspaceManager = global.workspace_manager;

                for (let k = start; k < start + count; k++) {
                    let metaWorkspace = workspaceManager.get_workspace_by_index(k);
                    let thumbnail = new WorkspaceThumbnail(metaWorkspace, this._monitorIndex);
                    thumbnail.setPorthole(this._porthole.x, this._porthole.y,
                        this._porthole.width, this._porthole.height);
                    this._thumbnails.push(thumbnail);
                    this.add_actor(thumbnail);

                    if (this._shouldShow && start > 0 && this._spliceIndex === -1) {
                        // not the initial fill, and not splicing via DND
                        thumbnail.state = ThumbnailState.NEW;
                        thumbnail.slide_position = 1; // start slid out
                        thumbnail.collapse_fraction = 1; // start fully collapsed
                        this._haveNewThumbnails = true;
                    } else {
                        thumbnail.state = ThumbnailState.NORMAL;
                    }

                    this._stateCounts[thumbnail.state]++;
                }

                this._queueUpdateStates();

                // The thumbnails indicator actually needs to be on top of the thumbnails
                this.set_child_above_sibling(this._indicator, null);

                // Clear the splice index, we got the message
                this._spliceIndex = -1;
            },

            vfunc_get_preferred_height(forWidth) {
                let workspaceManager = global.workspace_manager;
                let rows = workspaceManager.layout_rows;
                let columns = workspaceManager.layout_columns;
                let themeNode = this.get_theme_node();

                forWidth = themeNode.adjust_for_width(forWidth);

                let spacing = themeNode.get_length('spacing');
                let totalSpacing = (rows - 1) * spacing;

                const avail = forWidth - totalSpacing;

                let scale = (avail / columns) / this._porthole.width;
                scale = Math.min(scale, MAX_THUMBNAIL_SCALE);

                const height = Math.round(this._porthole.height * scale);
                return themeNode.adjust_preferred_height(height, height);
            },

            vfunc_get_preferred_width(_forHeight) {
                let workspaceManager = global.workspace_manager;
                let rows = workspaceManager.layout_rows;
                let columns = workspaceManager.layout_columns;

                // Note that for getPreferredHeight/Width we cheat a bit and skip propagating
                // the size request to our children because we know how big they are and know
                // that the actors aren't depending on the virtual functions being called.
                let themeNode = this.get_theme_node();

                let spacing = themeNode.get_length('spacing');
                let totalSpacing = (columns - 1) * spacing;

                const naturalWidth = this._thumbnails.reduce((accumulator, thumbnail, index) => {
                    let workspaceSpacing = 0;

                    if (index > 0) {
                        workspaceSpacing += spacing / 2;
                    }
                    if (index < this._thumbnails.length - 1) {
                        workspaceSpacing += spacing / 2;
                    }

                    const progress = 1 - thumbnail.collapse_fraction;
                    const width = (this._porthole.width * MAX_THUMBNAIL_SCALE + workspaceSpacing) * progress;
                    return accumulator + width;
                }, 0);

                return themeNode.adjust_preferred_width(totalSpacing, naturalWidth);
            },

            vfunc_allocate(box) {
                this.set_allocation(box);

                let workspaceManager = global.workspace_manager;
                let rows = workspaceManager.layout_rows;
                let columns = workspaceManager.layout_columns;
                let activeIndex = workspaceManager.get_active_workspace_index();
                let targetRow = Math.floor(activeIndex / columns);
                let targetColumn = activeIndex % columns;

                let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;

                if (this._thumbnails.length == 0) {
                    // not visible
                    return;
                }

                let themeNode = this.get_theme_node();
                box = themeNode.get_content_box(box);

                const portholeWidth = this._porthole.width;
                const portholeHeight = this._porthole.height;
                const spacing = themeNode.get_length('spacing');

                // Compute the scale we'll need once everything is updated,
                // unless we are currently transitioning
                if (this._expandFraction === 1) {
                    const totalSpacing = (columns - 1) * spacing;
                    const availableWidth = (box.get_width() - totalSpacing) / columns;

                    const hScale = availableWidth / portholeWidth;
                    const vScale = box.get_height() / portholeHeight;
                    const newScale = Math.min(hScale, vScale);

                    if (newScale !== this._targetScale) {
                        if (this._targetScale > 0) {
                            // We don't ease immediately because we need to observe the
                            // ordering in queueUpdateStates - if workspaces have been
                            // removed we need to slide them out as the first thing.
                            this._targetScale = newScale;
                            this._pendingScaleUpdate = true;
                        } else {
                            this._targetScale = this._scale = newScale;
                        }

                        this._queueUpdateStates();
                    }
                }

                const ratio = portholeWidth / portholeHeight;
                const thumbnailFullHeight = Math.round(portholeHeight * this._scale);
                const thumbnailWidth = Math.round(thumbnailFullHeight * ratio);
                const thumbnailHeight = thumbnailFullHeight * this._expandFraction;
                const roundedVScale = thumbnailHeight / portholeHeight;

                // We always request size for MAX_THUMBNAIL_SCALE, distribute
                // space evently if we use smaller thumbnails

                const extraWidth =
                    (MAX_THUMBNAIL_SCALE * portholeWidth - thumbnailWidth) * columns;
                box.x1 += Math.round(extraWidth / 2);
                box.x2 -= Math.round(extraWidth / 2);
                box.y2 = box.y1 + (thumbnailHeight * rows);


                let indicatorValue = this._scrollAdjustment.value;
                let indicatorUpperWs = Math.ceil(indicatorValue);
                let indicatorLowerWs = Math.floor(indicatorValue);

                let indicatorLowerX1 = 0;
                let indicatorLowerX2 = 0;
                let indicatorUpperX1 = 0;
                let indicatorUpperX2 = 0;
                let indicatorLowerY1 = 0;
                let indicatorLowerY2 = 0;
                let indicatorUpperY1 = 0;
                let indicatorUpperY2 = 0;

                let indicatorThemeNode = this._indicator.get_theme_node();
                let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
                let indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
                let indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
                let indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

                if (this._dropPlaceholderPos == -1) {
                    this._dropPlaceholder.allocate_preferred_size(
                        ...this._dropPlaceholder.get_position());

                    const laters = global.compositor.get_laters();
                    laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
                        this._dropPlaceholder.hide();
                    });
                }

                let childBox = new Clutter.ActorBox();
                let x = box.x1;
                let y = box.y1;

                for (let i = 0; i < this._thumbnails.length; i++) {
                    const thumbnail = this._thumbnails[i];
                    if (i % columns > 0) {
                        x += spacing - Math.round(thumbnail.collapse_fraction * spacing);
                    } else {
                        x = Math.round(box.x1 + (box.get_width() - Math.round(spacing - thumbnail.collapse_fraction * spacing + thumbnailWidth) * columns) / 2);
                    }

                    const y1 = y;
                    const y2 = y1 + thumbnailHeight;

                    if (i === this._dropPlaceholderPos) {
                        const [, placeholderWidth] = this._dropPlaceholder.get_preferred_width(-1);
                        childBox.y1 = y1;
                        childBox.y2 = y2;

                        if (rtl) {
                            childBox.x2 = box.x2 - Math.round(x);
                            childBox.x1 = box.x2 - Math.round(x + placeholderWidth);
                        } else {
                            childBox.x1 = Math.round(x);
                            childBox.x2 = Math.round(x + placeholderWidth);
                        }

                        this._dropPlaceholder.allocate(childBox);

                        const laters = global.compositor.get_laters();
                        laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
                            this._dropPlaceholder.show();
                        });
                        x += placeholderWidth + spacing;
                    }

                    // We might end up with thumbnailWidth being something like 99.33
                    // pixels. To make this work and not end up with a gap at the end,
                    // we need some thumbnails to be 99 pixels and some 100 pixels width;
                    // we compute an actual scale separately for each thumbnail.
                    const x1 = Math.round(x);
                    const x2 = Math.round(x + thumbnailWidth);
                    const roundedHScale = (x2 - x1) / portholeWidth;

                    // Allocating a scaled actor is funny - x1/y1 correspond to the origin
                    // of the actor, but x2/y2 are increased by the *unscaled* size.
                    if (rtl) {
                        childBox.x2 = box.x2 - x1;
                        childBox.x1 = box.x2 - (x1 + thumbnailWidth);
                    } else {
                        childBox.x1 = x1;
                        childBox.x2 = x1 + thumbnailWidth;
                    }
                    childBox.y1 = y1;
                    childBox.y2 = y1 + thumbnailHeight;

                    thumbnail.setScale(roundedHScale, roundedVScale);
                    thumbnail.allocate(childBox);

                    if (i === indicatorUpperWs) {
                        indicatorUpperX1 = childBox.x1;
                        indicatorUpperX2 = childBox.x2;
                        indicatorUpperY1 = childBox.y1;
                        indicatorUpperY2 = childBox.y2;
                    }
                    if (i === indicatorLowerWs) {
                        indicatorLowerX1 = childBox.x1;
                        indicatorLowerX2 = childBox.x2;
                        indicatorLowerY1 = childBox.y1;
                        indicatorLowerY2 = childBox.y2;
                    }

                    // We round the collapsing portion so that we don't get thumbnails resizing
                    // during an animation due to differences in rounded, but leave the uncollapsed
                    // portion unrounded so that non-animating we end up with the right total
                    if ((i + 1) % columns === 0) {
                        y += thumbnailHeight - Math.round(thumbnailHeight * thumbnail.collapse_fraction);
                    } else {
                        x += thumbnailWidth - Math.round(thumbnailWidth * thumbnail.collapse_fraction);
                    }
                }

                childBox.y1 = box.y1 + thumbnailHeight * targetRow;
                childBox.y2 = childBox.y1 + thumbnailHeight;

                const indicatorX1 = indicatorLowerX1 +
                    (indicatorUpperX1 - indicatorLowerX1) * (indicatorValue % 1);
                const indicatorX2 = indicatorLowerX2 +
                    (indicatorUpperX2 - indicatorLowerX2) * (indicatorValue % 1);
                const indicatorY1 = indicatorLowerY1 +
                    (indicatorUpperY1 - indicatorLowerY1) * (indicatorValue % 1);
                const indicatorY2 = indicatorLowerY2 +
                    (indicatorUpperY2 - indicatorLowerY2) * (indicatorValue % 1);

                childBox.x1 = indicatorX1 - indicatorLeftFullBorder;
                childBox.x2 = indicatorX2 + indicatorRightFullBorder;
                childBox.y1 = indicatorY1 - indicatorTopFullBorder;
                childBox.y2 = indicatorY2 + indicatorBottomFullBorder;
                this._indicator.allocate(childBox);
            },
        }
    }

    destroy() {
        this.restoreOriginalProperties();
    }

    overrideOriginalProperties() {
        this.originalThumbnailsBox = overrideProto(GThumbnailsBox.prototype, this._overrideProperties);
    }

    restoreOriginalProperties() {
        overrideProto(GThumbnailsBox.prototype, this.originalThumbnailsBox);
    }
}
