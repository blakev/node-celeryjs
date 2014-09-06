node-celeryjs
=============

A node.js Celery client with callbacks and promises.

*This project is nowhere near down, and thus no guarantees can be made.*

Usage:
```
var celery = require('node-celeryjs');

var client = new celery.createClient({
	BROKER_URL: 'amqp://celery:celery@lab-cel02.ndlab.local/celery',
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