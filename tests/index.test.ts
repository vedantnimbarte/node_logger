import pino from 'pino';
import express from 'express';
import request from 'supertest';
import bodyParser from 'body-parser';

import { createLogger, createMiddleware, ResponseFilterFn } from '../src/index';
import { sink, once } from './helper';

describe('xsh-node-logger', () => {
  describe('Logger', () => {
    let stream: pino.DestinationStream;
    beforeEach(() => {
      stream = sink();
    });

    describe('error', () => {
      it('can call with error and a message', async () => {
        const mockMessage = 'test msg';
        const mockError = new Error();

        const logger = createLogger({ options: {}, stream });
        logger.error(mockError, mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(50);
        expect(result.err.type).toEqual('Error');
        expect(result.err.message).toEqual('');
        expect(result.err.stack).toBeDefined();
        expect(result.msg).toEqual(mockMessage);
      });

      it('can call with error, context and message', async () => {
        const mockContext = { blurp: 'abc' };
        const mockMessage = 'test msg';
        const mockError = new Error();

        const logger = createLogger({ options: {}, stream });
        logger.error(mockError, mockContext, mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(50);
        expect(result.err.type).toEqual('Error');
        expect(result.err.message).toEqual('');
        expect(result.err.stack).toBeDefined();
        expect(result.msg).toEqual(mockMessage);
        expect(result.blurp).toEqual(mockContext.blurp);
      });

      it('redacts error message', async () => {
        const mockContext = { card_account_number: 'should be redacted' };
        const mockMessage = 'test msg';
        const mockError = new Error();

        const logger = createLogger({ options: {}, stream });
        logger.error(mockError, mockContext, mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(50);
        expect(result.err.type).toEqual('Error');
        expect(result.err.message).toEqual('');
        expect(result.err.stack).toBeDefined();
        expect(result.msg).toEqual(mockMessage);
        expect(result.card_account_number).toEqual('[Redacted]');
      });
    });

    describe('warn', () => {
      it('can call with a message', async () => {
        const mockMessage = 'test msg';

        const logger = createLogger({ options: {}, stream });
        logger.warn(mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(40);
        expect(result.msg).toEqual(mockMessage);
      });

      it('can call with context and message', async () => {
        const mockContext = { blurp: 'abc' };
        const mockMessage = 'test msg';

        const logger = createLogger({ options: {}, stream });
        logger.warn(mockContext, mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(40);
        expect(result.msg).toEqual(mockMessage);
        expect(result.blurp).toEqual(mockContext.blurp);
      });
    });

    describe('info', () => {
      it('can call with a message', async () => {
        const mockMessage = 'test msg';

        const logger = createLogger({ options: {}, stream });
        logger.info(mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(30);
        expect(result.msg).toEqual(mockMessage);
      });

      it('can call with context and message', async () => {
        const mockContext = { blurp: 'abc' };
        const mockMessage = 'test msg';

        const logger = createLogger({ options: {}, stream });
        logger.info(mockContext, mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(30);
        expect(result.msg).toEqual(mockMessage);
        expect(result.blurp).toEqual(mockContext.blurp);
      });
    });

    describe('debug', () => {
      it('can call with a message', async () => {
        const mockMessage = 'test msg';

        const logger = createLogger({ options: { level: 'debug' }, stream });
        logger.debug(mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(20);
        expect(result.msg).toEqual(mockMessage);
      });

      it('can call with context and message', async () => {
        const mockContext = { blurp: 'abc' };
        const mockMessage = 'test msg';

        const logger = createLogger({ options: { level: 'debug' }, stream });

        logger.debug(mockContext, mockMessage);
        const result = await once(stream, 'data');

        expect(result.level).toEqual(20);
        expect(result.msg).toEqual(mockMessage);
        expect(result.blurp).toEqual(mockContext.blurp);
      });
    });

    describe('child', () => {
      it('can call child', async () => {
        const mockContext = { blurp: 'abc' };
        const mockMessage = 'test msg';
        const module = 'module1';

        const logger = createLogger({ options: {}, stream });
        const childLogger = logger.child(module);

        childLogger.info(mockContext, mockMessage);
        const result1 = await once(stream, 'data');
        expect(result1.module).toEqual(module);
      });

      it('can call child with extra bindings', async () => {
        const mockContext = { blurp: 'abc' };
        const mockMessage = 'test msg';
        const module1 = 'module1';

        const logger = createLogger({ options: {}, stream });
        const childLogger = logger.child(module1, { binding1: 'test' });

        childLogger.info(mockContext, mockMessage);
        const result = await once(stream, 'data');
        expect(result.module).toEqual(module1);
        expect(result.binding1).toEqual('test');
      });

      it('can call nested child', async () => {
        const mockContext = { blurp: 'abc' };
        const mockMessage = 'test msg';
        const module1 = 'module1';
        const module2 = 'module1';

        const logger = createLogger({ options: {}, stream });
        const childLogger = logger.child(module1);
        const grandChildLogger = childLogger.child(module2);
        grandChildLogger.info(mockContext, mockMessage);
        const result2 = await once(stream, 'data');
        expect(result2.module).toEqual(`${module1}.${module2}`);
      });
    });

    it('should have mixin by default', async () => {
      const logger = createLogger({
        options: {},
        stream,
        environment: 'production',
        serviceName: 'new-service',
        version: '12345678'
      });
      logger.info('test');

      const result = await once(stream, 'data');

      expect(result.environment).toEqual('production');
      expect(result.service).toEqual('new-service');
      expect(result.version).toEqual('12345678');
    });

    it('should redact information based on paths provided', async () => {
      const logger = createLogger({ options: { redact: { paths: ['xxx'] } }, stream });

      logger.info({ xxx: 'xxx' }, '');
      const result = await once(stream, 'data');
      expect(result.xxx).toEqual('[Redacted]');
    });
  });

  describe('createLogger', () => {
    it('should be able to instantiate with default params and is able to log', () => {
      const logger = createLogger();

      const mockContext = { blurp: 'abc' };
      const mockMessage = 'test msg';
      const mockError = new Error();
      logger.debug(mockContext, mockMessage);
      logger.info(mockContext, mockMessage);
      logger.warn(mockContext, mockMessage);
      logger.error(mockError, mockContext, mockMessage);

      expect(logger).toBeInstanceOf(Object);
    });
  });

  describe('createMiddleware', () => {
    it('should be able to instantiate', () => {
      const logger = createLogger();
      const middleware = createMiddleware(logger);

      expect(middleware).toBeInstanceOf(Function);
    });

    it('should log requests and responses when used', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      app.use(createMiddleware(logger));
      app.post('/check', (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(200);

      const result = await once(stream, 'data');

      expect(result.req.headers).toBeDefined();
      expect(result.req.method).toBeDefined();
      expect(result.req.url).toBeDefined();
      expect(result.req.body).toBeDefined();

      expect(result.responseTime).toBeDefined();
      expect(result.res.headers).toBeDefined();
      expect(result.res.statusCode).toBeDefined();
    });

    it('should log response body if when response filter returns true', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      const f: ResponseFilterFn = (): boolean => {
        return true;
      };
      app.use(createMiddleware(logger, { responseFilterFn: f }));
      app.post('/check', (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(200);

      const result = await once(stream, 'data');

      expect(result.res.body).toBeDefined();
    });

    it('should log response body when status code match response filter function', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      // Only log 400
      const f: ResponseFilterFn = (res): boolean => {
        if (res.statusCode === 400) {
          return true;
        }
        return false;
      };
      app.use(createMiddleware(logger, { responseFilterFn: f }));
      app.post('/check', (req, res) => {
        res.status(400).json({ success: false });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(400);

      const result = await once(stream, 'data');

      expect(result.res.body).toBeDefined();
    });

    it('should not log response body when status code doesnt match response filter function', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      // Only log 400
      const f: ResponseFilterFn = (res): boolean => {
        if (res.statusCode === 400) {
          return true;
        }
        return false;
      };
      app.use(createMiddleware(logger, { responseFilterFn: f }));
      app.post('/check', (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(200);

      const result = await once(stream, 'data');

      expect(result.res.body).toBeUndefined();
    });

    it('should log response body when path matches response filter function', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      // Only log when the path matches
      const f: ResponseFilterFn = (res): boolean => {
        if (res.raw.locals.path === '/check') {
          return true;
        }
        return false;
      };
      app.use(createMiddleware(logger, { responseFilterFn: f }));
      app.post('/check', (req, res) => {
        res.status(400).json({ success: false });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(400);

      const result = await once(stream, 'data');

      expect(result.res.body).toBeDefined();
    });

    it('should not log response body when path doesnt match response filter function', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      // Only log when the path matches
      const f: ResponseFilterFn = (res): boolean => {
        if (res.raw.locals.path === '/check') {
          return true;
        }
        return false;
      };
      app.use(createMiddleware(logger, { responseFilterFn: f }));
      app.post('/success', (req, res) => {
        res.status(400).json({ success: false });
      });

      await request(app)
        .post('/success')
        .send({ data: 'data' })
        .expect(400);

      const result = await once(stream, 'data');

      expect(result.res.body).toBeUndefined();
    });

    it('should log response body when method and path match response filter function', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      // Only log when the path matches
      const f: ResponseFilterFn = (res): boolean => {
        if (res.raw.locals.path === '/check' && res.raw.locals.method === 'POST') {
          return true;
        }
        return false;
      };
      app.use(createMiddleware(logger, { responseFilterFn: f }));
      app.post('/check', (req, res) => {
        res.status(400).json({ success: false });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(400);

      const result = await once(stream, 'data');

      expect(result.res.body).toBeDefined();
    });

    it('should not log response body when method and path dont match response filter function', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      // Only log when the path matches
      const f: ResponseFilterFn = (res): boolean => {
        if (res.raw.locals.path === '/check' && res.raw.locals.method === 'GET') {
          return true;
        }
        return false;
      };
      app.use(createMiddleware(logger, { responseFilterFn: f }));
      app.post('/check', (req, res) => {
        res.status(400).json({ success: false });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(400);

      const result = await once(stream, 'data');

      expect(result.res.body).toBeUndefined();
    });

    it('should not healthcheck requests', async () => {
      const stream = sink();
      const logger = createLogger({ options: {}, stream });

      const app = express();
      app.use(bodyParser.json());
      app.use(createMiddleware(logger));
      app.get('/healthcheck/liveness', (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .get('/healthcheck/liveness')
        .expect(200);

      logger.info('this will be logged instead');
      const result = await once(stream, 'data');

      expect(result.req).toBeUndefined();
      expect(result.res).toBeUndefined();
      expect(result.msg).toEqual('this will be logged instead');
    });

    it('should redact sensitive information in request body based on default paths provided', async () => {
      const stream = sink();
      const logger = createLogger({ stream });

      const app = express();
      app.use(bodyParser.json());
      app.use(createMiddleware(logger));
      app.post('/check', (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/check')
        .set('x-api-key', 'sensitive-information')
        .set('x-confirmation-password', 'another sensitive information')
        .send({ data: 'data' })
        .expect(200);

      const result = await once(stream, 'data');

      expect(result.req).toBeDefined();
      expect(result.req.headers['x-api-key']).toEqual('[Redacted]');
      expect(result.req.headers['x-confirmation-password']).toEqual('[Redacted]');
      expect(result.res).toBeDefined();
    });

    it('should add context from the response', async () => {
      const stream = sink();
      const logger = createLogger({ stream });

      const app = express();
      app.use(bodyParser.json());
      app.use(
        createMiddleware(logger, {
          reqCustomProps: (_req, res) => {
            return {
              context: {
                responseStatus: res.statusCode // test "reqCustomProps" has access to the response
              }
            };
          }
        })
      );
      app.post('/check', (req, res) => {
        res.status(200).json({ success: true });
      });

      await request(app)
        .post('/check')
        .send({ data: 'data' })
        .expect(200);

      const result = await once(stream, 'data');

      expect(result.req).toBeDefined();
      expect(result.res).toBeDefined();
      expect(result.context.responseStatus).toBe(200);
    });
  });
});
