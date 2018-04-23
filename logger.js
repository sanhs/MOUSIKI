var stackTrace = Object.defineProperty(global, '__stack', {
    get: function () {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) { return stack; };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(global, '__line', {
    get: function () {
        return __stack[1].getLineNumber();
    }
});

Object.defineProperty(global, '__function', {
    get: function () {
        return __stack[1].getFunctionName();
    }
});


var log = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",

    FgBlack: "\x1b[30m",
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m",
    FgMagenta: "\x1b[35m",
    FgCyan: "\x1b[36m",
    FgWhite: "\x1b[37m",

    BgBlack: "\x1b[40m",
    BgRed: "\x1b[41m",
    BgGreen: "\x1b[42m",
    BgYellow: "\x1b[43m",
    BgBlue: "\x1b[44m",
    BgMagenta: "\x1b[45m",
    BgCyan: "\x1b[46m",
    BgWhite: "\x1b[47m",

    // data: '[' + __filename + ':' + __line + ':' + __function + '] ',

    logger: function (color, args) {
        if (typeof color === 'object') color = log.FgWhite;
        var str = '';
        for (var i = 0; i < args.length; i++) {
            str += args[i] + ' ';
        }
        console.log(color + str + log.Reset);
    },

    debug: function () { log.logger(log.FgCyan, arguments); },
    warn: function () { log.logger(log.FgYellow, arguments); },
    info: function () { log.logger(log.FgGreen, arguments); },
    error: function () { log.logger(log.FgRed, arguments); },
    fatal: function () { log.logger(log.BgRed, arguments); },
    reset: function () { return process.stdout.write('\033c'); },
}

// log.debug('my man', 1, 2, 3, 4, 5);
// log.warn('my man', 1, 2, 3, 4, 5);
// log.info('my man', 1, 2, 3, 4, 5);
// log.error('my man', 1, 2, 3, 4, 5);
// log.fatal('my man', 1, 2, 3, 4, 5);
// console.log('asdfasdfs');

exports.log = log