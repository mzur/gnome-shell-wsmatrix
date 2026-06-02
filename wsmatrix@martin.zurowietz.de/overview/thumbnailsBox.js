import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
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

    const height = Math.round(this._porthole.height * scale);
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
    const workspaceManager = global.workspace_manager;
    const rows = workspaceManager.layout_rows;
    const columns = workspaceManager.layout_columns;

    // The overview only allocates us a single row's height, so rows below the
    // first would be painted outside our allocation and receive no clicks or
    // drops. Extend our own allocation to cover all rows; the workspaces box
    // below already reserves thumbnailsHeight * rows for us, so this just fills
    // that reserved gap (no overlap).
    const allocBox = box.copy();
    allocBox.y2 = allocBox.y1 + Math.round(box.get_height() * rows);
    this.set_allocation(allocBox);

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

// Stock handleDragOver is x-only (it assumes a 1D vertical strip), so in our 2D
// grid every workspace in a column shares the same x-range and the loop always
// matches the lowest index in that column (the top row). Replace it with a 2D
// hit-test against each thumbnail's full allocation so the drop targets the
// workspace actually under the cursor. acceptDrop is unchanged: it acts on the
// _dropWorkspace we set here.
const handleDragOver = function (source, actor, x, y, time) {
    if (!source.metaWindow &&
        (!source.app || !source.app.can_open_new_window()) &&
        (source.app || !source.shellWorkspaceLaunch) &&
        source !== Main.xdndHandler)
        return DND.DragMotionResult.CONTINUE;

    this._dropWorkspace = -1;

    for (let i = 0; i < this._thumbnails.length; i++) {
        const thumbnail = this._thumbnails[i];
        if (x >= thumbnail.x && x <= thumbnail.x + thumbnail.width &&
            y >= thumbnail.y && y <= thumbnail.y + thumbnail.height) {
            this._dropWorkspace = i;
            break;
        }
    }

    if (this._dropWorkspace !== -1)
        return this._thumbnails[this._dropWorkspace].handleDragOverInternal(source, actor, time);

    return DND.DragMotionResult.CONTINUE;
}

// Stock _activateThumbnailAtPoint hit-tests x only (1D strip) and against the
// gesture's untransformed local coords, which don't line up with the grid's
// on-screen positions — so a click below the top row activates the top-row
// workspace. Hit-test the pointer against each thumbnail's transformed (stage)
// bounds instead; both are in stage space, so the grid's scale/position is
// accounted for. (The x/y args are unused for this reason.)
const _activateThumbnailAtPoint = function (x, y, time) {
    const [pointerX, pointerY] = global.get_pointer();
    const thumbnail = this._thumbnails.find(t => {
        const [tx, ty] = t.get_transformed_position();
        const [tw, th] = t.get_transformed_size();
        return pointerX >= tx && pointerX <= tx + tw &&
               pointerY >= ty && pointerY <= ty + th;
    });
    if (thumbnail)
        thumbnail.activate(time);
}

export default class ThumbnailsBox extends Override {
    enable() {
        const subject = GThumbnailsBox.prototype;
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

        this._im.overrideMethod(subject, 'handleDragOver', (original) => {
            return function () {
                return handleDragOver.call(this, ...arguments);
            };
        });

        this._im.overrideMethod(subject, '_activateThumbnailAtPoint', (original) => {
            return function () {
                return _activateThumbnailAtPoint.call(this, ...arguments);
            };
        });
    }
}
