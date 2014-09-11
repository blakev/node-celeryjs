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
  task_id: 'c141e770-182a-4fc8-af2e-9fd8e2692410',
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

####.close([callback]) *alias: end*

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
  task_id: '40a68e93-aedc-4cc2-b15c-be2ecdec82f8',
  children: [] }
```

###Result
A JSON message from amqp containing:
- `status`
- `traceback`
- `result`
- `task_id`
- `children`






===
> Attribution to: [https://github.com/mher/node-celery](https://github.com/mher/node-celery) by Mher Movsisyan for the inspiration and design pattern.
> 
> Use the one that suits your programming flow better!

Blake VandeMerwe 2014