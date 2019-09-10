const Main = imports.ui.main;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const ThumbnailsBox = WorkspaceThumbnail.ThumbnailsBox;
const WorkspacesView = imports.ui.workspacesView.WorkspacesView;
const { Clutter, St, Meta } = imports.gi;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;

const MAX_HORIZONTAL_THUMBNAIL_SCALE = 0.4;

var ThumbnailsBoxOverride = class {
   constructor(thumbnailsBox, rows, columns) {
      this.rows = rows;
      this.columns = columns;
      this.thumbnailsBox = thumbnailsBox;
      this.overrideProperties = [
         '_activateThumbnailAtPoint',
         '_activeWorkspaceChanged',
         'allocate',
         'handleDragOver',
         'get_preferred_height',
         'get_preferred_width',
      ];
      this.overrideOriginalProperties();
   }

   destroy() {
      this.restoreOriginalProperties();
   }

   overrideOriginalProperties() {
      this.thumbnailsBox._overrideProperties = {};
      this.overrideProperties.forEach(function (prop) {
         this.thumbnailsBox._overrideProperties[prop] = this.thumbnailsBox[prop].bind(this.thumbnailsBox);
         this.thumbnailsBox[prop] = this[prop].bind(this.thumbnailsBox);
      }, this);

      this.thumbnailsBox.getRows = this.getRows.bind(this);
      this.thumbnailsBox.getColumns = this.getColumns.bind(this);
      this.thumbnailsBox.indicatorX = 0;
   }

   restoreOriginalProperties() {
      this.overrideProperties.forEach(function (prop) {
         this.thumbnailsBox[prop] = this.thumbnailsBox._overrideProperties[prop]
      }, this);

      delete this.thumbnailsBox._overrideProperties;
      delete this.thumbnailsBox.getRows;
      delete this.thumbnailsBox.getColumns;
   }

   setRows(rows) {
      this.rows = rows;
   }

   getRows() {
      return this.rows;
   }

   setColumns(columns) {
      this.columns = columns;
   }

   getColumns() {
      return this.columns;
   }

   // Overriding the switch to workspace method
   // triggered on clicking a workspace thumbnail in the thumbnailbox of the overview
   _activateThumbnailAtPoint(stageX, stageY, time) {
      let [r, x, y] = this.transform_stage_point(stageX, stageY);

      for (let i = 0; i < this._thumbnails.length; i++) {
         let thumbnail = this._thumbnails[i]
         let [w, h] = thumbnail.actor.get_transformed_size();

         // Add x range check to check for both vertical and horizontal position
         if (y >= thumbnail.actor.y && y <= thumbnail.actor.y + h &&
            x >= thumbnail.actor.x && x <= thumbnail.actor.x + w) {
            thumbnail.activate(time);
            break;
         }
      }
      this.queue_relayout();
   }

   // Overriding the Tweener animation to consider both vertical and horizontal changes
   // the original method only animates vertically
   _activeWorkspaceChanged() {
      let thumbnail;
      let workspaceManager = global.workspace_manager;
      let activeWorkspace = workspaceManager.get_active_workspace();
      for (let i = 0; i < this._thumbnails.length; i++) {
         if (this._thumbnails[i].metaWorkspace == activeWorkspace) {
            thumbnail = this._thumbnails[i];
            break;
         }
      }

      this._animatingIndicator = true;
      let indicatorThemeNode = this._indicator.get_theme_node();

      //todo
      let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
      this.indicatorY = this._indicator.allocation.y1 + indicatorTopFullBorder;
      Tweener.addTween(this,
         {
            indicatorY: thumbnail.actor.allocation.y1,
            indicatorX: thumbnail.actor.allocation.x1,
            time: WorkspacesView.WORKSPACE_SWITCH_TIME,
            transition: 'easeOutQuad',
            onComplete() {
               this._animatingIndicator = false;
               this._queueUpdateStates();
            },
            onCompleteScope: this
         });
   }

   // It is helpful to be able to control the height
   // however, this method is not being called for some reason
   get_preferred_height(forWidth) {
      let themeNode = this.get_theme_node();

      let spacing = themeNode.get_length('spacing');
      let totalSpacing = (this.getRows() - 1) * spacing;

      let naturalHeight = totalSpacing + this.getRows() * this._porthole.height * WorkspaceThumbnail.MAX_THUMBNAIL_SCALE;
      return themeNode.adjust_preferred_height(totalSpacing, naturalHeight);
   }

   // Overriding the preferred width of the workspaces box
   // it sets it to NUMBER_OF_COLUMNS * DEFAULT_WORKSPACE_WIDTH (maximum width is 40% of the screen)
   // original code sets the width to DEFAULT_WORKSPACE_WIDTH
   get_preferred_width(forHeight) {
      let themeNode = this.get_theme_node();
      forHeight = themeNode.adjust_for_height(forHeight);

      let spacing = themeNode.get_length('spacing');
      let totalSpacingX = (this.getColumns() - 1) * spacing;
      let totalSpacingY = (this.getRows() - 1) * spacing;

      let availY = forHeight - totalSpacingY;
      let scale = availY < 0 ? WorkspaceThumbnail.MAX_THUMBNAIL_SCALE : (availY / this.getRows()) / this._porthole.height;
      scale = Math.min(scale, WorkspaceThumbnail.MAX_THUMBNAIL_SCALE);

      let width = Math.round(totalSpacingX + this.getColumns() * this._porthole.width * scale);
      let maxWidth =
         Main.layoutManager.primaryMonitor.width *
         MAX_HORIZONTAL_THUMBNAIL_SCALE -
         themeNode.get_horizontal_padding();

      this._maxHorizontalScale = (maxWidth - totalSpacingX) / this.getColumns() / this._porthole.width;
      width = Math.min(maxWidth, width);
      return themeNode.adjust_preferred_width(width, width);
   }


   // Rearrange the positions of workspaces thumbnails in overview
   // show a grid instead of a vertical thumbnailbox
   allocate(box, flags) {
      // workaround to get the fix workspaces box size
      this._overrideProperties.allocate(box, flags);
      // this.set_allocation(box, flags);

      let rtl = (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL);

      if (this._thumbnails.length == 0) // not visible
         return;

      let workspaceManager = global.workspace_manager;
      let themeNode = this.get_theme_node();

      box = themeNode.get_content_box(box);

      let portholeWidth = this._porthole.width;
      let portholeHeight = this._porthole.height;
      let spacing = themeNode.get_length('spacing');

      // Compute the scale we'll need once everything is updated
      let totalSpacing = (this.getRows() - 1) * spacing;
      let availY = (box.y2 - box.y1) - totalSpacing;

      let newScale = (availY / this.getRows()) / portholeHeight;
      newScale = Math.min(newScale, WorkspaceThumbnail.MAX_THUMBNAIL_SCALE);

      if (this._maxHorizontalScale) {
         newScale = Math.min(this._maxHorizontalScale, newScale);
      }

      if (newScale != this._targetScale) {
         if (this._targetScale > 0) {
            // We don't do the tween immediately because we need to observe the ordering
            // in queueUpdateStates - if workspaces have been removed we need to slide them
            // out as the first thing.
            this._targetScale = this._scale = newScale;
            this._pendingScaleUpdate = true;
         } else {
            this._targetScale = this._scale = newScale;
         }

         this._queueUpdateStates();
      }

      let thumbnailHeight = portholeHeight * this._scale;
      let thumbnailWidth = Math.round(portholeWidth * this._scale);
      let thumbnailBoxWidth = thumbnailWidth * this.getColumns() + spacing * (this.getColumns() - 1);
      let roundedHScale = thumbnailWidth / portholeWidth;

      let slideOffset; // X offset when thumbnail is fully slid offscreen
      if (rtl)
         slideOffset = - (thumbnailBoxWidth + themeNode.get_padding(St.Side.LEFT));
      else
         slideOffset = thumbnailBoxWidth + themeNode.get_padding(St.Side.RIGHT);

      let indicatorY1 = this._indicatorY;
      let indicatorY2;
      let indicatorX1 = this._indicatorX;
      let indicatorX2;
      // when not animating, the workspace position overrides this._indicatorY
      let activeWorkspace = workspaceManager.get_active_workspace();
      let indicatorWorkspace = !this._animatingIndicator ? activeWorkspace : null;
      let indicatorThemeNode = this._indicator.get_theme_node();

      let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
      let indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
      let indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
      let indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

      // let y = box.y1;

      if (this._dropPlaceholderPos == -1) {
         Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._dropPlaceholder.hide();
         });
      }

      let childBox = new Clutter.ActorBox();
      let totalThumbnails = this._thumbnails.length;

      for (let i = 0; i < totalThumbnails; i++) {
         let thumbnail = this._thumbnails[i];

         // if (i > 0)
         //    y += spacing - Math.round(thumbnail.collapseFraction * spacing);
         let y = box.y1 + (spacing + thumbnailHeight) * Math.floor(i / this.getColumns());

         let x1, x2;
         let currentColumn = (totalThumbnails - i - 1) % this.getColumns();
         if (rtl) {
            x1 = box.x1 + slideOffset * thumbnail.slidePosition - ((thumbnailWidth + spacing) * currentColumn);
            x2 = x1 + thumbnailWidth;
         } else {
            x1 = box.x2 - thumbnailWidth + slideOffset * thumbnail.slidePosition - ((thumbnailWidth + spacing) * currentColumn);
            x2 = x1 + thumbnailWidth;
         }

         if (i == this._dropPlaceholderPos) {
            let [minHeight, placeholderHeight] = this._dropPlaceholder.get_preferred_height(-1);
            childBox.x1 = x1;
            childBox.x2 = x1 + thumbnailWidth;
            childBox.y1 = Math.round(y);
            childBox.y2 = Math.round(y + placeholderHeight);
            this._dropPlaceholder.allocate(childBox, flags);
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
               this._dropPlaceholder.show();
            });
            // y += placeholderHeight + spacing;
         }

         // We might end up with thumbnailHeight being something like 99.33
         // pixels. To make this work and not end up with a gap at the bottom,
         // we need some thumbnails to be 99 pixels and some 100 pixels height;
         // we compute an actual scale separately for each thumbnail.
         let y1 = Math.round(y);
         let y2 = Math.round(y + thumbnailHeight);
         let roundedVScale = (y2 - y1) / portholeHeight;

         if (thumbnail.metaWorkspace == indicatorWorkspace) {
            indicatorX1 = x1;
            indicatorX2 = x2;
            indicatorY1 = y1;
            indicatorY2 = y2;
         }

         // Allocating a scaled actor is funny - x1/y1 correspond to the origin
         // of the actor, but x2/y2 are increased by the *unscaled* size.
         childBox.x1 = x1;
         childBox.x2 = childBox.x1 + portholeWidth;
         childBox.y1 = y1;
         childBox.y2 = y1 + portholeHeight;

         thumbnail.actor.set_scale(roundedHScale, roundedVScale);
         thumbnail.actor.allocate(childBox, flags);

         // We round the collapsing portion so that we don't get thumbnails resizing
         // during an animation due to differences in rounded, but leave the uncollapsed
         // portion unrounded so that non-animating we end up with the right total
         // y += thumbnailHeight - Math.round(thumbnailHeight * thumbnail.collapseFraction);
      }

      if (rtl) {
         childBox.x1 = box.x1;
         childBox.x2 = box.x1 + thumbnailWidth;
      } else {
         childBox.x1 = box.x2 - thumbnailWidth;
         childBox.x2 = box.x2;
      }

      childBox.x1 = indicatorX1 - indicatorLeftFullBorder;
      childBox.x2 = (indicatorX2 ? indicatorX2 : (indicatorX1 + thumbnailWidth)) + indicatorRightFullBorder;
      childBox.y1 = indicatorY1 - indicatorTopFullBorder;
      childBox.y2 = (indicatorY2 ? indicatorY2 : (indicatorY1 + thumbnailHeight)) + indicatorBottomFullBorder;
      this._indicator.allocate(childBox, flags);
   }

   // Handle dragging a window into a workspace
   handleDragOver(source, actor, x, y, time) {
      if (!source.realWindow && !source.shellWorkspaceLaunch && source != Main.xdndHandler)
         return DND.DragMotionResult.CONTINUE;

      let canCreateWorkspaces = Meta.prefs_get_dynamic_workspaces();
      let spacing = this.get_theme_node().get_length('spacing');

      this._dropWorkspace = -1;
      let placeholderPos = -1;
      let targetBaseY;
      if (this._dropPlaceholderPos == 0)
         targetBaseY = this._dropPlaceholder.y;
      else
         targetBaseY = this._thumbnails[0].actor.y;
      let targetTop = targetBaseY - spacing - WorkspaceThumbnail.WORKSPACE_CUT_SIZE;

      let length = this._thumbnails.length;
      for (let i = 0; i < length; i++) {
         // Allow the reorder target to have a 10px "cut" into
         // each side of the thumbnail, to make dragging onto the
         // placeholder easier
         let thumbnail = this._thumbnails[i];

         let [w, h] = thumbnail.actor.get_transformed_size();
         let targetBottom = targetBaseY + WorkspaceThumbnail.WORKSPACE_CUT_SIZE;
         let nextTargetBaseY = targetBaseY + h + spacing;
         let nextTargetTop = nextTargetBaseY - spacing - ((i == length - 1) ? 0 : WorkspaceThumbnail.WORKSPACE_CUT_SIZE);

         // Expand the target to include the placeholder, if it exists.
         if (i == this._dropPlaceholderPos)
            targetBottom += this._dropPlaceholder.get_height();

         if (y > targetTop && y <= targetBottom && source != Main.xdndHandler && canCreateWorkspaces) {
            placeholderPos = i;
            break;
         } else if (y >= thumbnail.actor.y && y <= thumbnail.actor.y + h &&
            x >= thumbnail.actor.x && x <= thumbnail.actor.x + w) {
            // Add x range check
            this._dropWorkspace = i;
            break
         }

         targetBaseY = nextTargetBaseY;
         targetTop = nextTargetTop;
      }

      if (this._dropPlaceholderPos != placeholderPos) {
         this._dropPlaceholderPos = placeholderPos;
         this.queue_relayout();
      }

      if (this._dropWorkspace != -1)
         return this._thumbnails[this._dropWorkspace].handleDragOverInternal(source, time);
      else if (this._dropPlaceholderPos != -1)
         return source.realWindow ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.COPY_DROP;
      else
         return DND.DragMotionResult.CONTINUE;
   }
}
