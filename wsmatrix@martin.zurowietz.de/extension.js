const WsMatrix = imports.misc.extensionUtils.getCurrentExtension();
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const WmOverride = WsMatrix.imports.WmOverride.WmOverride;

class WsMatrixExtension {
   constructor() {
      this.override = new WmOverride(2, 3);
   }
   destroy() {
      this.override.destroy();
   }
}

let wsMatrix;

function enable() {
   wsMatrix = new WsMatrixExtension();
}

function disable() {
   wsMatrix.destroy();
   wsMatrix = null;
}
