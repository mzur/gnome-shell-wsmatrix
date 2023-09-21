import Gi from 'gi://Gi';

function hookVfunc(proto, symbol, func) {
    proto[Gi.hook_up_vfunc_symbol].call(proto[Gi.gobject_prototype_symbol], symbol, func);
}

function overrideProto(proto, overrides) {
    const backup = {};

    for (var symbol in overrides) {
        if (symbol.startsWith('after_')) {
            const actualSymbol = symbol.substr('after_'.length);
            const fn = proto[actualSymbol];
            const afterFn = overrides[symbol]
            proto[actualSymbol] = function() {
                const args = Array.prototype.slice.call(arguments);
                const res = fn.apply(this, args);
                afterFn.apply(this, args);
                return res;
            };
            backup[actualSymbol] = fn;
        }
        else {
            backup[symbol] = proto[symbol];
            if (symbol.startsWith('vfunc')) {
                hookVfunc(proto, symbol.substr(6), overrides[symbol]);
            }
            else {
                proto[symbol] = overrides[symbol];
            }
        }
    }
    return backup;
}
