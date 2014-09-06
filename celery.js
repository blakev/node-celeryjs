var _ = require('underscore'),
    Q = require('q'),
    uuid = require('node-uuid'),
    util = require('util'),
    events = require('events'),
    amqp = require('amqp');


var development = true;
var debug = (process.env.NODE_CELERY_DEBUG || development) ? util.debug : function(){};

var defaultTaskOptions = {
    args: [],
    kwargs: {}
}

function getMessageId() {
    return uuid.v4();
}

function formatDate(date) {
    return new Date(date).toISOString().slice(0, -1);
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

function Result(id, client) {
    var _this = this;
        _this.taskId = id;
        _this.client = client;
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
            q.bind(_this.client.conf.RESULT_EXCHANGE, '#');
            q.subscribe(function (message, headers, deliveryInfo, messageObject) {
                if (message.contentType === 'application/x-python-serialize') {
                    console.error('celery needs to be configured with json serializer');
                    process.exit(1);
                }
                
                _this.result = message

                if (message.status === 'SUCCESS') {
                    _this.promise.resolve(message);
                } else
                if (message.status === 'FAILURE') {
                    _this.promise.reject(message);
                } else {
                    _this.promise.notify(message);
                }
            })
        }
    )

    return _this.promise.promise;
}

function Task(client, name, options, callback) {
    var _this = this;
        _this.client = client;
        _this.name = name;
        _this.options = options;

    var route = _this.client.conf.ROUTES[name],
        queue = route && route.queue;

    var prepare = function(options, _this) {
        var options = options || {},
            brokerOptions = options.brokerOptions || {},
            taskOptions = options.taskOptions || {};

        var taskId = getMessageId();

        _this.client.broker.publish(
            _this.options.queue 
            || options.queue
            || _this.client.conf.DEFAULT_ROUTING_KEY,
            createMessage(
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

    var applyAsync = function(options, callback) {
        taskId = prepare(options, _this);
        return new Result(taskId, _this.client);
    }

    return {
        applyAsync: applyAsync
    }
}


function Client(conf, callback) {
    var _this = this,
        conf = conf || {};

    _this.conf = new Configuration(conf);
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
    _this.connection.backend = true;

    _this.broker.on('ready', function() {
        debug('connected to broker');
        _this.connection.broker = true;

        if(_this.connection.backend) {
            _this.connection.ready = true;
        
            if(_this.connection.broker && _this.connection.backend) {
                if(!_.isUndefined(callback)) {
                    return callback(null, _this);   
                } else {
                    _this.emit('connect');
                }
            } else {
                throw new Error('could not connect to broker / backend');
            }
        }
    });

    _this.broker.on('error', function(e) { _this.emit('error', e); })
    _this.broker.on('end', function(){ _this.emit('end'); });

    return _this;
}

util.inherits(Client, events.EventEmitter);

Client.prototype.createTask = function(name, options, callback) {
    var err = null;

    if (arguments.length < 1) err = Error('insufficient arguments for Client.createTask');
    if (arguments.length == 2) {
        if(_.isFunction(options)) {
            callback = options;
            options = {};
        } else {
            err = Error('no callback supplied for Client.createTask')
        }
    }

    var options = options || {};

    if (!err) {
        var t = new Task(this, name, options);
        
        if(callback) {
            callback(null, t, this);
        }

        return t;
    } else {
        if(_.isUndefined(callback) && err) {
            console.log(err);
        } else {
            callback(err, null);    
        }

        return null;
    }
}

Client.prototype.end =
Client.prototype.close = function(callback) {
    try {
        this.broker.disconnect();
        callback(null, true);
    } catch(err) {
        callback('error disconnecting from broker: ' + err, false);
    }
}



exports.createClient = function(config, callback) {
    if (arguments.length == 0) {
        config = {};
    } else
    if (arguments.length == 1 && _.isFunction(config)) {
        callback = config;
        config = {};
    }

    return new Client(config, callback);
}
