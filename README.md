Celery.js
=============
[![NPM version](https://badge.fury.io/js/celeryjs.svg)](http://badge.fury.io/js/celeryjs)

A node.js Celery client utilizing callbacks and promises.

Usage:
```javascript
var celery = require('celeryjs');

var client = new celery.createClient({
	BROKER_URL: 'amqp://celery:celery@lab-cel02',
	DEFAULT_QUEUE: 'default'
});

client.on('connect', function() {
	var task = client.createTask('native.platform');

	task.applyAsync().then(successful);
});

function successful(message) {
	console.log(message);
}
```

Returns:
```javascript
{ status: 'SUCCESS',
  traceback: null,
  result: 'linux posix',
  taskId: 'c141e770-182a-4fc8-af2e-9fd8e2692410',
  children: [] }
```

##API

###require('celeryjs')
####.createClient(conf, [callback])
Emits:
- `connect`
- `error` 
- and `end`, all mirroring the underlying amqp connection.

###Client
####.createTask(name, [options,] [callback])
#####options
- `task`
	- These are overwritten by supplying the same attributes to Task-level options
	- defaults
		- `task`: Supplied task name when created.
		- `id`: Generated uuid used internally.
		- `args`: `[]`
		- `kwargs`: `{}`
	- optional
		- `task`, `id`, `args`, `kwargs`, `retires`, 
		- `eta`, `expires`, `queue`, `taskset`, `chord`, 
		- `utc`, `callbacks`, `errbacks`, `timeouts`
- `broker`
	- amqp exchange.publish options, see [here](https://github.com/postwait/node-amqp#exchangepublishroutingkey-message-options-callback).
	- `contentType`, default: `'application/json'` **required**
	- `contentEncoding`, default: `'utf-8'`

Example:
```javascript
var options = {
	queue: 'windows'
	task: {
		args: [1,2,3],
		kwargs: {verbose: true}
	},
	broker: {
		appId: 'TestApp'
	}
}
```

####.close([callback]) *alias: end*


###Configuration
####*supplied to createClient's `conf` parameter*
- debug, default: `true`
- camelCaseResults, default: `true`
	- converts python-based response into javascript-style attributes.
- BROKER_URL, default: `'amqp://'`
- DEFAULT_EXCHANGE, default: `''`
- DEFAULT_EXCHANGE_TYPE, default: `'topic'`
- DEFAULT_QUEUE, default: `'default'`
- DEFAULT_ROUTING_KEY, default: `'default'`
- RESULT_EXCHANGE, default: `'celeryresults'`
- TASK_RESULT_DURABLE, default: `true`
- TASK_RESULT_EXPIRES, default: `30 * 60 * 1000 // 30 minutes`
- ROUTES, default: `{}`

###Task
####.applyAsync([options])
Execute the task, returns a `Promise`.

####.apply([options,] callback)
Execute the task with `callback`.

####.delayAsync([options,] ms)
Execute the task with `ms` delay, returns a `Promise`.

####.delay([options,] ms, callback)
Executes the task with `callback` using `ms` delay.

####.times([options,] n, callback)
Executes the task `n` times with `callback`.

###Result
A JSON message from amqp containing:
- `status`
- `traceback`
- `result`
- `task_id`
- `children`

##Usage
Task-level Queue
```Javascript
var task = client.createTask('native.platform', {queue: 'windows'});
```

Execute-level Queue
```Javascript
var task = client.createTask('native.platform');
task.applyAsync(task: {queue: 'windows'});
```

Both return:
```javascript
{ status: 'SUCCESS',
  traceback: null,
  result: 'windows nt 2.7',
  taskId: '40a68e93-aedc-4cc2-b15c-be2ecdec82f8',
  children: [] }
```


###Note
> Attribution to: [https://github.com/mher/node-celery](https://github.com/mher/node-celery) by Mher Movsisyan for the inspiration and design pattern.
> 
> Use the one that suits your programming flow better!

Blake VandeMerwe 2014