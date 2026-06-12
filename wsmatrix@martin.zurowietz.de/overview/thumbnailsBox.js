import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import WorkspaceThumbnail from '../workspacePopup/workspaceThumbnail.js';
import Override from '../Override.js';
import {
    ThumbnailState,
    ThumbnailsBox as GThumbnailsBox
} from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';


const addThumbnails = function (start, count) {
    let workspaceManager = global.workspace_manager;

    for (let k = start; k < start + count; k++) {
        let metaWorkspace = workspaceManager.get_workspace_by_index(k);
        let thumbnail = new WorkspaceThumbnail(metaWorkspace, this._monitorIndex);
        thumbnail.setPorthole(
            this._porthole.x, this._porthole.y,
            this._porthole.width, this._porthole.height);
        this._thumbnails.push(thumbnail);
        this.add_child(thumbnail);

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
}

const vfunc_get_preferred_height = function (forWidth) {
    const workspaceManager = global.workspace_manager;
    const rows = workspaceManager.layout_rows;
    const columns = workspaceManager.layout_columns;

    let themeNode = this.get_theme_node();

    forWidth = themeNode.adjust_for_width(forWidth);

    let spacing = themeNode.get_length('spacing');
    let totalSpacing = (rows - 1) * spacing;

    const avail = forWidth - totalSpacing;

    let scale = (avail / columns) / this._porthole.width;
    scale = Math.min(scale, this._maxThumbnailScale);

    // Thumbnails are laid out in a grid, so the preferred height must cover ALL
    // rows. Otherwise GNOME allocates the box one row tall and the lower rows,
    // drawn outside the box, never receive clicks.
    const rowHeight = Math.round(this._porthole.height * scale);
    const height = rowHeight * rows;
    return themeNode.adjust_preferred_height(height, height);
}

const vfunc_get_preferred_width = function (_forHeight) {
    const workspaceManager = global.workspace_manager;
    const rows = workspaceManager.layout_rows;
    const columns = workspaceManager.layout_columns;

    // Note that for getPreferredHeight/Width we cheat a bit and skip propagating
    // the size request to our children because we know how big they are and know
    // that the actors aren't depending on the virtual functions being called.
    let themeNode = this.get_theme_node();

    let spacing = themeNode.get_length('spacing');
    let totalSpacing = (columns - 1) * spacing;

    const naturalWidth = this._thumbnails.reduce((accumulator, thumbnail, index) => {
        let workspaceSpacing = 0;

        if (index > 0)
            workspaceSpacing += spacing / 2;
        if (index < this._thumbnails.length - 1)
            workspaceSpacing += spacing / 2;

        const progress = 1 - thumbnail.collapse_fraction;
        const width = (this._porthole.width * this._maxThumbnailScale + workspaceSpacing) * progress;
        return accumulator + width;
    }, 0);

    return themeNode.adjust_preferred_width(totalSpacing, naturalWidth);
}

const vfunc_allocate = function(box) {
    this.set_allocation(box);

    const workspaceManager = global.workspace_manager;
    const rows = workspaceManager.layout_rows;
    const columns = workspaceManager.layout_columns;
    const activeIndex = workspaceManager.get_active_workspace_index();
    const targetRow = Math.floor(activeIndex / columns);
    const targetColumn = activeIndex % columns;

    let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;

    if (this._thumbnails.length === 0) // not visible
            return;

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
        // hScale divides by columns (availableWidth); vScale must divide by rows,
        // otherwise thumbnails are sized as if the box held a single row and the
        // grid overflows vertically (lower rows get cropped).
        const availableHeight = box.get_height() / rows;
        const vScale = availableHeight / portholeHeight;
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

    // We always request size for maxThumbnailScale, distribute
    // space evently if we use smaller thumbnails

    const extraWidth =
        (this._maxThumbnailScale * portholeWidth - thumbnailWidth) * columns;
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

    let x = box.x1;
    let y = box.y1;

    if (this._dropPlaceholderPos == -1) {
        this._dropPlaceholder.allocate_preferred_size(
            ...this._dropPlaceholder.get_position());

        const laters = global.compositor.get_laters();
        laters.add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._dropPlaceholder.hide();
        });
    }

    let childBox = new Clutter.ActorBox();

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
}

// Drag-and-drop onto lower grid rows.
//
// wsmatrix lays the workspaces out in a 2D grid, but GNOME's drop-target
// detection only tests the X coordinate (_withinWorkspace / _getPlaceholderTarget).
// In a grid every column shares the same X range across all of its rows, and
// handleDragOver stops at the first matching index, so a drop always lands on the
// top-row thumbnail. Only the top row works.
// (https://github.com/mzur/gnome-shell-wsmatrix/issues/274)
//
// Fix: remember the pointer Y in handleDragOver, then add a "is the thumbnail in
// the right row?" test to both helpers. The original X logic still picks the column.

// Upstream constant (resource:///org/gnome/shell/ui/workspaceThumbnail.js).
const WORKSPACE_CUT_SIZE = 10;

// True if the drag Y falls within this thumbnail's vertical band (its row).
const withinRow = function (index) {
    const y = this._wsmatrixDragY;
    if (y === undefined)
        return true; // no recorded drag position -> don't block
    const workspace = this._thumbnails[index];
    return y > workspace.y && y <= workspace.y + workspace.height;
};

// Reimplements upstream _withinWorkspace with an added per-row filter.
const _withinWorkspace = function (x, index, rtl) {
    if (!withinRow.call(this, index))
        return false;

    const length = this._thumbnails.length;
    const workspace = this._thumbnails[index];

    let workspaceX1 = workspace.x + WORKSPACE_CUT_SIZE;
    let workspaceX2 = workspace.x + workspace.width - WORKSPACE_CUT_SIZE;

    if (index === length - 1) {
        if (rtl)
            workspaceX1 -= WORKSPACE_CUT_SIZE;
        else
            workspaceX2 += WORKSPACE_CUT_SIZE;
    }

    return x > workspaceX1 && x <= workspaceX2;
};

// Reimplements upstream _getPlaceholderTarget with an added per-row filter:
// outside the right row, return an impossible range so it never matches.
const _getPlaceholderTarget = function (index, spacing, rtl) {
    if (!withinRow.call(this, index))
        return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

    const workspace = this._thumbnails[index];

    let targetX1;
    let targetX2;

    if (rtl) {
        const baseX = workspace.x + workspace.width;
        targetX1 = baseX - WORKSPACE_CUT_SIZE;
        targetX2 = baseX + spacing + WORKSPACE_CUT_SIZE;
    } else {
        targetX1 = workspace.x - spacing - WORKSPACE_CUT_SIZE;
        targetX2 = workspace.x + WORKSPACE_CUT_SIZE;
    }

    if (index === 0) {
        if (rtl)
            targetX2 -= spacing + WORKSPACE_CUT_SIZE;
        else
            targetX1 += spacing + WORKSPACE_CUT_SIZE;
    }

    if (index === this._dropPlaceholderPos) {
        const placeholderWidth = this._dropPlaceholder.get_width() + spacing;
        if (rtl)
            targetX2 += placeholderWidth;
        else
            targetX1 -= placeholderWidth;
    }

    return [targetX1, targetX2];
};

// Workspace selection on click. Upstream only tests X (find on the first thumbnail
// whose X range contains the click), so in a grid clicking the second row activates
// the first-row thumbnail of the same column. Add a Y test to pick the right row.
// (https://github.com/mzur/gnome-shell-wsmatrix/issues/259)
const _activateThumbnailAtPoint = function (stageX, stageY, time) {
    const [, x, y] = this.transform_stage_point(stageX, stageY);

    const thumbnail = this._thumbnails.find(
        t => x >= t.x && x <= t.x + t.width &&
             y >= t.y && y <= t.y + t.height);
    if (thumbnail)
        thumbnail.activate(time);
};

export default class ThumbnailsBox extends Override {
    enable() {
        const subject = GThumbnailsBox.prototype;

        // Raise the box height cap. GNOME allocates the box at
        // min(preferredHeight, height * maxThumbnailScale); this cap is meant for a
        // single row of thumbnails. In a grid it must be multiplied by `rows`,
        // otherwise the box is clamped to one row and the lower rows fall outside it
        // (hidden/cropped and not clickable). The getter is only read by GNOME for
        // this cap; the internal size computation uses the `_maxThumbnailScale`
        // field, so the thumbnail size is unchanged.
        this._savedMaxScaleDescriptor =
            Object.getOwnPropertyDescriptor(subject, 'maxThumbnailScale');
        Object.defineProperty(subject, 'maxThumbnailScale', {
            configurable: true,
            get() {
                return this._maxThumbnailScale * global.workspace_manager.layout_rows;
            },
        });

        // Record the pointer Y to make drop detection grid-aware.
        this._im.overrideMethod(subject, 'handleDragOver', (original) => {
            return function (source, actor, x, y, time) {
                this._wsmatrixDragY = y;
                return original.call(this, source, actor, x, y, time);
            };
        });

        this._im.overrideMethod(subject, '_withinWorkspace', (original) => {
            return function () {
                return _withinWorkspace.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, '_getPlaceholderTarget', (original) => {
            return function () {
                return _getPlaceholderTarget.call(this, ...arguments);
            };
        });

        // Grid-aware click (selection of lower-row workspaces).
        this._im.overrideMethod(subject, '_activateThumbnailAtPoint', (original) => {
            return function () {
                return _activateThumbnailAtPoint.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, 'addThumbnails', (original) => {
            return function () {
                return addThumbnails.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, 'vfunc_get_preferred_height', (original) => {
            return function () {
                return vfunc_get_preferred_height.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, 'vfunc_get_preferred_width', (original) => {
            return function () {
                return vfunc_get_preferred_width.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, 'vfunc_allocate', (original) => {
            return function () {
                return vfunc_allocate.call(this, ...arguments);
            };
        });
    }

    disable() {
        // Restore the original maxThumbnailScale getter (not managed by _im).
        if (this._savedMaxScaleDescriptor) {
            Object.defineProperty(GThumbnailsBox.prototype, 'maxThumbnailScale',
                this._savedMaxScaleDescriptor);
            this._savedMaxScaleDescriptor = null;
        }
        super.disable();
    }
}
