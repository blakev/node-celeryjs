Celery.js
=============
[![NPM Version](http://img.shields.io/badge/npm_version-0.0.3-green.svg)](https://www.npmjs.org/package/celeryjs)
[![Downloads](http://img.shields.io/npm/dm/celeryjs.svg)](https://www.npmjs.org/package/celeryjs)
[![License GPLv2](http://img.shields.io/badge/license-GPLv2-green.svg)](https://github.com/blakev/node-celeryjs/blob/master/LICENSE)
[![Build Status](http://img.shields.io/travis/blakev/node-celeryjs.svg)](https://travis-ci.org/blakev/node-celeryjs)

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
		- 'args', 'callbacks', 'chord', 
    	- 'errbacks', 'eta', 'expires', 'id', 'kwargs', 
    	- 'queue', 'retries', 'task', 'taskset', 'timeouts', 'utc'
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

####.link(task) 
Pushes a `task alias`, or Array of task aliases, onto the Canvas stack.

If no `task` is supplied, the underlying Cavas will act as a single `task.apply()`

####.s([options])
Creates an alias of `task` to use with `.link`

A `task alias` is a shallow copy of a task where the supplied options overwrite those in the original task.

If you don't have any options to change, just call `task.s()` and it will be identical.

###.Canvas
####.chain(callback)
Calls the linked task aliases where the result of the previous function is the last parameters for the next function.

Given:
```python
@app.task(name='js.add')
def add(x, y):
    return x + y
```

```javascript
client.on('connect', function() {
	var task = client.createTask('js.add', {queue: 'js', args: [1,2]});

	task
	.link([
		task.s({args: [1]}),
		task.s({args: [5]})
	])
	.Canvas
	.chain(successful);	// 1 + 2 = 3
});						// 3 + 1 = 4
						// 4 + 5 = 9


function successful(message) {
	console.log(message);
}
```

Returns:
```javascript
{ status: 'SUCCESS',
  traceback: null,
  result: 9,
  taskId: '8925043b-462f-470b-87eb-d7384e1f299d',
  children: [] }
```

###Result
A JSON message from amqp containing:
- `status`:		SUCCESS or FAILURE, PENDING possible with promises.
- `traceback`:	Python stack-trace if there was an error.
- `result`:		Return value of the python program.
- `taskId`:		Internal task ID, and the same one in the message queue.
- `children`:	*soon* -- these are sub-tasks spawned from the original task; will be in Canvas.

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
