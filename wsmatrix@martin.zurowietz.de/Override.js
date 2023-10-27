import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class Override {
    constructor() {
        this._im = new InjectionManager();
    }

    enable () {
        //
    }

    destroy() {
        this.disable();
    }

    disable() {
        this._im.clear();
    }
}
