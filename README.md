node-celeryjs
=============

A node.js Celery client utilizing callbacks and promises.

Usage:
```
var celery = require('node-celeryjs');

var client = new celery.createClient({
	BROKER_URL: 'amqp://celery:celery@lab-cel02',
	DEFAULT_QUEUE: 'default'
});

client.on('connect', function() {
	client.createTask('native.platform', function(err, task) {
		task.applyAsync()
		.then(
			function(resp) {
				console.log(resp);
			}
		)
		.done()
	});
});
```

Returns:
```
{ status: 'SUCCESS',
  traceback: null,
  result: 'linux posix',
  task_id: 'c141e770-182a-4fc8-af2e-9fd8e2692410',
  children: [] }
```


One less callback:
```
client.on('connect', function() {
	var task = client.createTask('native.platform');

	task.applyAsync().then(successful);
});

function successful(message) {
	console.log(message);
}
```

Attribution to: [https://github.com/mher/node-celery](https://github.com/mher/node-celery) by Mher Movsisyan for the inspiration and design pattern. Use the one that suits your programming flow better!

*This project is nowhere near down, and thus no guarantees can be made.*

Blake VandeMerwe 2014