# xsh-node-logger

A logger for node applications based on Xendit Node templates

Features:

- logs to stdout and stderr so that it's all forwarded to Splunk by default in [RFC 13 Trident](https://docs.google.com/document/d/1A8UOtMeTtRIZwdUqbTHCwegb4N1YhBj3ezER664n-Co/edit#)
- provides an express middleware for logging requests and responses
- logging of request and response

What's missing:

## Installation

```bash
npm install -S @boxbag/xsh-node-logger
```

## Usage

### Environmental variables

These environmental variables will be used to populate some default values that are logged:

- `NODE_ENV`: logged as `environment` in each log
- `SERVICE_NAME`: logged as `service_name` in each log
- `VERSION`: logged as `version` in each log

### Basic logging

```ts
import { createLogger } from '@boxbag/xsh-node-logger'; // Typescript
const { createLogger } = require('@boxbag/xsh-node-logger'); // Node
const logger = createLogger();

logger.info('this is my message');
logger.info({ info: 'more info' }, 'this is a debug message');

const err = new Error();
logger.error(err, 'saw an error');
logger.error(err, { some_context: 'additionalContext' }, 'saw an error');
```

This produces:

```bash
{"level":30,"time":1531171074631,"msg":"this is my message","pid":657,"hostname": "YCs-MacBook-Pro.local"}
{"level":30,"time":1531171074631,"msg":"this is my message","pid":657,"hostname": "YCs-MacBook-Pro.local", "info": "more info"}
{"level":50,"time":1531171082399,"msg":"saw an error","pid":657,"hostname": "YCs-MacBook-Pro.local", "err": {"type": "Error", "message": "", "stack": "Error: ..."}}
{"level":50,"time":1531171082399,"msg":"saw an error","pid":657,"hostname": "YCs-MacBook-Pro.local", "err": {"type": "Error", "message": "", "stack": "Error: ..."}, "some_context": "additionalContext"}
```

### Using middleware for request and response logging

```ts
import { createLogger, createMiddleware } from '@boxbag/xsh-node-logger'; // Typescript
const { createLogger, createMiddleware } = require('@boxbag/xsh-node-logger'); // Node

const logger = createLogger();

const app = express();

// Placed before controllers for logging requests body in express
const loggingMiddleware = createMiddleware(logger);
app.use(loggingMiddleware);
```

This produces:

```json
{
  "hostname": "YCs-MacBook-Pro.local",
  "level": 30,
  "msg": "request completed",
  "pid": 54259,
  "req": {
    "body": {
      "data": "data"
    }
  },
  "headers": {
    "accept-encoding": "gzip, deflate",
    "connection": "close",
    "content-length": "15",
    "content-type": "application/json",
    "host": "127.0.0.1:53788",
    "user-agent": "node-superagent/3.8.3"
  },
  "id": 1,
  "method": "POST",
  "remoteAddress": "::ffff:127.0.0.1",
  "remotePort": 53789,
  "url": "/check",
  "res": {
    "headers": {
      "content-length": "16",
      "content-type": "application/json; charset=utf-8",
      "etag": "W/\"10-oV4hJxRVSENxc/wX8+mA4/Pe4tA\"",
      "x-powered-by": "Express"
    },
    "statusCode": 200
  },
  "responseTime": 1,
  "time": 1587394542597
}
```

### Logger Options

You can use your own configured pino logger. See https://github.com/pinojs/pino/blob/master/docs/api.md#options for more options.

```ts
// logs at debug level and above
const logger = createLogger({
  options: {
    level: 'debug'
  }
});
```

See https://github.com/pinojs/pino/blob/master/docs/api.md#options for more information about the options that you can pass in.

#### Redacting information

```ts
import { createLogger, createMiddleware, DEFAULT_REDACTION_KEYS } from '@boxbag/xsh-node-logger';

// logs at debug level and above
const logger = createLogger({
  options: {
    level: 'debug',
    redact: {
      // DEFAULT_REDACTION_KEYS is a list of keys that are used by the default logger. You can choose to re-use them if you want.
      paths: ['req.headers["x-header-api"]', ...DEFAULT_REDACTION_KEYS]
    }
  }
});

const loggingMiddleware = createMiddleware(logger);
app.use(loggingMiddleware);
```

See https://github.com/pinojs/pino/blob/master/docs/redaction.md for more information on how to better use redaction.

### Middleware Options

```ts
# logs at debug level and above
const logger = createLogger();

const middlewareOptions = {};
const loggingMiddleware = createMiddleware(logger, middlewareOptions);
app.use(loggingMiddleware);

```

See https://github.com/pinojs/pino-http#pinohttpopts-stream for more information about the options that you can pass in.

#### Enabling Response Body Logging Capability

Response body logging is supported but take note that it costs us money e.g. Splunk log streaming charges /GB ingested data so more logs means more data ingested. As such, we encourage you to be prudent and log what you need.
To enable logging, you just need to pass a function that implements `ResponseFilterFn` interface to `middlewareOpts`.

```ts
interface ModifiedResponse extends Response {
  raw?: { locals?: any };
}
/**
 * A function interface to determine whether a response body should be logged or not
 * Return `true` if you need it to be logged. `false` otherwise.
 */
export interface ResponseFilterFn {
  (res: ModifiedResponse): boolean;
}
```

Here are a few examples on how to do so:

1. Selective logging based on status code

```ts
const logger = createLogger();

const responseFilterFn: ResponseFilterFn = (res): boolean => {
  // Only log 4xx and 5xx errors
  if (res.statusCode >= 400) {
    return true;
  }
  return false;
};

const loggingMiddleware = createMiddleware(logger, { responseFilterFn });
app.use(loggingMiddleware);
```

2. Selective logging based on request path and method

You can access request path in `res.raw.locals.path` and request method in `res.raw.locals.method`

```ts
const logger = createLogger();

const responseFilterFn: ResponseFilterFn = (res): boolean => {
  // Only log when it's a POST /transactions or PUT /transaction/id endpoint
  if (
    (res.raw.locals.path === '/transactions' && res.raw.locals.method === 'POST') ||
    (/\/transaction\/d+/.test(res.raw.locals.path) && res.raw.locals.method === 'PUT')
  ) {
    return true;
  }
  return false;
};

const loggingMiddleware = createMiddleware(logger, { responseFilterFn });
app.use(loggingMiddleware);
```

Best practices:

1. Avoid logging large response body unless necessary e.g. endpoint to send email, upload file, billing reports
2. Avoid logging list of items unless necessary e.g. list of transactions in the past 1 month

Sample log with response body

```json
{
  "hostname": "YCs-MacBook-Pro.local",
  "level": 30,
  "msg": "request completed",
  "pid": 54259,
  "req": {
    "body": {
      "data": "data"
    }
  },
  "headers": {
    "accept-encoding": "gzip, deflate",
    "connection": "close",
    "content-length": "15",
    "content-type": "application/json",
    "host": "127.0.0.1:53788",
    "user-agent": "node-superagent/3.8.3"
  },
  "id": 1,
  "method": "POST",
  "remoteAddress": "::ffff:127.0.0.1",
  "remotePort": 53789,
  "url": "/check",
  "res": {
    "headers": {
      "content-length": "16",
      "content-type": "application/json; charset=utf-8",
      "etag": "W/\"10-oV4hJxRVSENxc/wX8+mA4/Pe4tA\"",
      "x-powered-by": "Express"
    },
    "statusCode": 200,
    "body": {
      "response": "OK"
    }
  },
  "responseTime": 1,
  "time": 1587394542597
}
```

#### Add request-scope context to your log
You can add custom properties (outside of `req` and `res` props) to your log using `reqCustomProps` option
```ts
const logger = createLogger();

const loggingMiddleware = createMiddleware(logger, {
  reqCustomProps: (_req, res) => {
    return {
      context: {
        responseStatus: res.statusCode
      }
    };
  }
});
app.use(loggingMiddleware);
```
Sample log with custom props
```json
{
  "level": 30,
  "time": 1646047916855,
  "pid": 30793,
  "hostname": "ip-192-168-1-8.us-west-2.compute.internal",
  "req": {
    "id": 1,
    "method": "POST",
    "url": "/check",
    "query": {},
    "params": {},
    "headers": {
      "host": "127.0.0.1:51642",
      "accept-encoding": "gzip, deflate",
      "user-agent": "node-superagent/3.8.3",
      "content-type": "application/json",
      "content-length": "15",
      "connection": "close"
    },
    "remoteAddress": "::ffff:127.0.0.1",
    "remotePort": 51643,
    "body": {
      "data": "data"
    }
  },
  "context": {
    "responseStatus": 200
  },
  "environment": "test",
  "service": "undefined-service-name",
  "version": "undefined-version",
  "res": {
    "statusCode": 200,
    "headers": {
      "x-powered-by": "Express",
      "content-type": "application/json; charset=utf-8",
      "content-length": "16",
      "etag": "W/\"10-oV4hJxRVSENxc/wX8+mA4/Pe4tA\""
    }
  },
  "responseTime": 0,
  "msg": "request completed"
}
```
As you can see, the function has access to the response status. You can also have the access to the response local variables scoped to the request (refer [here](https://expressjs.com/en/api.html#res.locals)). This is useful when you want to add context to the request (for example the `businessId` or `userId`).
### Creating child loggers

You can create child loggers off any logger such that they contain a nested module name. For example:

```ts
const logger = createLogger();
const childLogger = logger.child('queueService');

childLogger.info('this is a message');
// This produces:
// {"level":30,"time":1531171074631,"msg":"this is my message","pid":657,"hostname": "YCs-MacBook-Pro.local", "module": "queueService"}

const grandChildLogger = childLogger.child('consume');
grandChildLogger.info('this is a message');
// This produces:
// {"level":30,"time":1531171074631,"msg":"this is my message","pid":657,"hostname": "YCs-MacBook-Pro.local", "module": "queueService.consume"}
```

You can also add additional key-value pairs such that they will be added to every log.

```ts
const logger = createLogger();
const childLogger = logger.child('queueService', { additionalBinding: 'test' });

childLogger.info('this is a message');
// This produces:
// {"level":30,"time":1531171074631,"msg":"this is my message","pid":657,"hostname": "YCs-MacBook-Pro.local", "module": "queueService", "additionalBinding": "test"}
```

## FAQ

### Rules of thumb for logging

- Use debug for eventual debugging sessions you might need, but remember to remove them after you are finished.
- Use info for regular application workflow logs.
- Use warn for expected and frequent error conditions (like user input validation).
- Use error for expected but infrequent error conditions (like network failures, database timeouts).

### Why change to pino?

It's faster! See https://github.com/pinojs/pino#low-overhead

### Why are levels indicated as numbers now?

|     | Logging Level | Logging Number |
| --- | ------------- | -------------- |
| 2   | ERROR         | 50             |
| 3   | WARN          | 40             |
| 4   | INFO          | 30             |
| 5   | DEBUG         | 20             |

Logging levels indicated as numbers can be better filtered when viewing logs. So if you want to view logs that are above INFO, you can view on Splunk with `level > 30`
