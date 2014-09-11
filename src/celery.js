var _ = require('underscore'),
    Q = require('q'),
    async = require('async'),
    uuid = require('node-uuid'),
    util = require('util'),
    events = require('events'),
    amqp = require('amqp');


var development = true;
var debug = (process.env.NODE_CELERY_DEBUG || development) ? util.debug : function(){};

function getMessageId() {
    return uuid.v4();
}

function formatDate(date) {
    return new Date(date).toISOString().slice(0, -1);
}

function upperFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function lowerFirst(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

function toCamelCase(attrib) {
    var parts = attrib.split('_');
    return lowerFirst(_.first(parts)) + _.map(_.rest(parts), upperFirst).join('');
}

function fixUnderscoreAttributes(message) {
    var ret = {};

    for (var item in message) {
        if (message.hasOwnProperty(item)) {
            ret[toCamelCase(item)] = message[item]
        }
    }

    return ret;
}

function createMessage(task, options, eid) {
    var fields = [
        'task', 'id', 'args', 
        'kwargs', 'retires', 'eta', 
        'expires', 'queue', 'taskset', 
        'chord', 'utc', 'callbacks', 
        'errbacks', 'timeouts'
    ];

    var message = {
        task: task,
        args: options.args || [],
        kwargs: options.kwargs || {},
        id: eid
    };

    for(var item in options) {
        if(options.hasOwnProperty(item)) {
            if(fields.indexOf(item) === -1) {
                throw "invalid task options: " + item
            }
            message[item] = options[item]
        }
    }

    if (message.eta) { 
        message.eta = formatDate(message.eta);
    }

    if (message.expires) {
        message.expires = formatDate(message.expires);
    }

    return JSON.stringify(message);
}

function Configuration(options) {
    var _this = this,
        options = options || {};

    for(var item in options) {
        if(options.hasOwnProperty(item)) {
            _this[item] = options[item]
        }
    }

    _this.debug = _this.debug || true;
    _this.camelCaseResults = _this.camelCaseResults || true;


    _this.BROKER_URL = _this.BROKER_URL || 'amqp://';
    _this.DEFAULT_EXCHANGE = _this.DEFAULT_EXCHANGE || '';
    _this.DEFAULT_EXCHANGE_TYPE = _this.DEFAULT_EXCHANGE_TYPE || 'topic';
    _this.DEFAULT_QUEUE = _this.DEFAULT_QUEUE || 'default';
    _this.DEFAULT_ROUTING_KEY = _this.DEFAULT_ROUTING_KEY || 'default';
    _this.RESULT_EXCHANGE = _this.RESULT_EXCHANGE || 'celeryresults';
    _this.TASK_RESULT_DURABLE = _this.TASK_RESULT_DURABLE || true;
    _this.TASK_RESULT_EXPIRES = _this.TASK_RESULT_EXPIRES * 1000 || 30 * 60 * 1000; // 30 minutes
    _this.ROUTES = _this.ROUTES || {};
}

function Result(id, task) {
    var _this = this;
        _this.taskId = id;
        _this.client = task.client;
        _this.result = null;

    _this.promise = Q.defer();

    _this.client.backend.queue(
        _this.taskId.replace(/-/g, ''),
        {
            arguments: {
                'x-expires': _this.client.conf.TASK_RESULT_EXPIRES
            },
            durable: _this.client.conf.TASK_RESULT_DURABLE
        },
        function(q) {
            var fixMessage = _this.client.conf.camelCaseResults ? fixUnderscoreAttributes : function(x){return x;};

            q.bind(_this.client.conf.RESULT_EXCHANGE, '#');
            q.subscribe(function (message, headers, deliveryInfo, messageObject) {
                if (message.contentType === 'application/x-python-serialize') {
                    console.error('celery needs to be configured with json serializer');
                    process.exit(1);
                }
                
                _this.result = message

                if (message.status === 'SUCCESS') {
                    _this.promise.resolve(fixMessage(message));
                } else
                if (message.status === 'FAILURE') {
                    _this.promise.reject(fixMessage(message));
                } else {
                    _this.promise.notify(fixMessage(message));
                }
            })
        }
    )

    return _this.promise.promise;
}

function Task(client, name, options) {
    var _this = this;
        _this.client = client;
        _this.name = name;
        _this.options = options;

    var route = _this.client.conf.ROUTES[name],
        queue = (route && route.queue) ? route : false;

    var prepare = function(options, _this) {
        var options = options || {},
            brokerOptions = options.broker || {},
            taskOptions = options.task || {};

        var taskId = getMessageId();

        _this.client.broker.publish(
            _this.options.queue         // Task Created options.queue
            || queue                    // Task NAME in DefaultRoutes.queue
            || options.queue            // Task Called options.queue
            || _this.client.conf.DEFAULT_ROUTING_KEY,
            createMessage(              // Default Routing Key/Queue
                _this.name,
                _.extend(
                    _this.options, 
                    taskOptions
                ),
                taskId
            ), 
            _.extend({
                'contentType': 'application/json',
                'contentEncoding': 'utf-8',
            }, brokerOptions),
            function(wasError) {
                if(wasError) {
                    debug('client.broker.publish error: ' + _this.name);
                }
            }
        );

        return taskId;
    }

    _this.link = options.link || null;
    _this.linkError = options.linkError || null;
    _this.notifier = options.notifier || null;
    _this.priority = options.priority || 6;

    _this.errorCallback = null;
    _this.linkCallback = null;


    // if (_.isArray(_this.linkError)) {
    //     _this.errorCallback = _.partial(async.series, _this.linkError, callback)
    // } else
    // if (_.isFunction(_this.linkError)) {
    //     _this.errorCallback = _this.linkError;
    // }


    // if (_.isArray(_this.link)) {
    //     _this.linkCallback = _.partial(async.series, _this.link, _this.errorCallback)
    // } else
    // if (_.isFunction(_this.link)) {
    //     _this.linkCallback = _this.link;
    // }

    var ret = {};

    ret.applyAsync = function(options) {
        if (!options) {
            options = {};
        }

        taskId = prepare(options, _this);
        return new Result(taskId, _this);
    }

    ret.apply = function(options, callback) {
        if (_.isFunction(options)) {
            callback = options;
            options = {};
        }
        ret.applyAsync(options).then(callback).fail(callback);
    }

    ret.delayAsync = function(options, ms) {
        var ms = options.ms || ms || 0;
        return ret.applyAsync(options).delay(ms);
    }

    ret.delay = function(options, ms, callback) {
        if (_.isNumber(options)) {
            callback = ms;
            ms = options;
            options = {};
        }
        ret.delayAsync(options, ms).then(callback).fail(callback);
    }

    ret.times = function(options, n, callback) {
        async.times(n, function(n, next) {
            ret.apply(options, next);
        }, callback);
    }

    return ret;
}


function Client(conf, callback) {
    var _this = this,
        conf = conf || {};

    _this.conf = new Configuration(conf);
    _this.taskList = [];

    _this.connection = {
        ready: false,
        broker: false,
        backend: false
    }

    _this.tasks = [];

    debug('connecting to broker ' + _this.conf.BROKER_URL)

    _this.broker = amqp.createConnection({
        url: _this.conf.BROKER_URL,
        heartbeat: _this.conf.heartbeat
    }, {
        defaultExchangeName: _this.conf.DEFAULT_EXCHANGE
    })

    _this.backend = _this.broker;

    _this.broker.on('ready', function() {       debug('connected to broker');
        _this.connection.broker = true;
        _this.connection.ready = true;
    
        if(!_.isUndefined(callback)) {
            return callback(null, _this);   
        } else {
            _this.emit('connect');
        }
    });

    _this.broker.on('error', function(e) { _this.emit('error', e); })
    _this.broker.on('end', function(){ _this.emit('end'); });

    return _this;
}

util.inherits(Client, events.EventEmitter);

Client.prototype.createTask = function(name, options, callback) {
                                            debug('create a new Task ' + name);
    var _this = this,
        err = null,
        tempTask = null;

    if (arguments.length < 1) 
        err = Error('insufficient arguments for Client.createTask');

    if (arguments.length == 2) {
        if(_.isFunction(options)) {
            callback = options;
            options = {};
        } 
    }

    var options = options || {};

    if (!err) {
        tempTask = new Task(this, name, options);
    } 

    if (callback) {
        callback(err, tempTask)
    }

    if (tempTask) {
        _this.taskList.push(tempTask);
        return tempTask;

    } else {
        return err;
    }
}

Client.prototype.end =
Client.prototype.close = function(callback) { debug('disconnecting Client');
    var _this = this;

    if (!callback) {
        callback = function() { };
    }

    try {
        _this.broker.disconnect();
        _this.emit('end');
        callback(null, true);
    } catch(err) {
        var errMsg = 'error disconnecting from broker: ' + err;
        _this.emit('error', errMsg);
        callback(errMsg, false);
    }
}



exports.createClient = function(config, callback) { debug('creating Client');
    if (arguments.length == 0) {
        config = {};
    } else
    if (arguments.length == 1 && _.isFunction(config)) {
        callback = config;
        config = {};
    }

    return new Client(config, callback);        
}
