/* eslint-disable @typescript-eslint/no-explicit-any */

import { Request, Response, NextFunction } from 'express';

import pino from 'pino';
import PinoHttp, { Options } from 'pino-http';

interface LogFn {
  (context: object, msg: string): void;
  (msg: string): void;
}

interface ErrLogFn {
  (error: Error, context: object, msg: string): void;
  (error: Error, msg: string): void;
}

interface ILogger {
  error: ErrLogFn;
  warn: LogFn;
  info: LogFn;
  debug: LogFn;
  child(moduleName: string, bindings?: object): ILogger;
}

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

interface MiddlewareOpts extends Options {
  responseFilterFn?: ResponseFilterFn;
}

export const DEFAULT_REDACTION_KEYS = [
  'req.headers["x-api-key"]',
  'req.headers["x-confirmation-password"]',
  'password',
  'card_cvn',
  'card_account_number',
  'card_data',
  'cvn',
  'pin',
  'transaction_signature',
  'secure_signature',
  'TXN_SIGNATURE',
  'SECURE_SIGNATURE',
  'api_key',
  'card_exp_year',
  'card_exp_month',
  'authorization',
  'secret_api_key',
  'secretApiKey',
  'passcode',
  'req.headers["x-callback-token"]',
  'res.body.*["x-callback-token"]'
];

export class Logger implements ILogger {
  baseLogger: pino.Logger;

  constructor(baseLogger: pino.Logger) {
    this.baseLogger = baseLogger;
  }

  error(err: Error, param1: object | string, param2?: string) {
    if (typeof param1 === 'string') {
      this.baseLogger.error(
        {
          err
        },
        param1
      );
    } else if (typeof param1 === 'object') {
      this.baseLogger.error(
        {
          err,
          ...param1
        },
        param2
      );
    }
  }

  warn(param1: object | string, param2?: string) {
    if (typeof param1 === 'string') {
      this.baseLogger.warn(param1);
    } else if (typeof param1 === 'object') {
      this.baseLogger.warn(param1, param2);
    }
  }

  info(param1: object | string, param2?: string) {
    if (typeof param1 === 'string') {
      this.baseLogger.info(param1);
    } else if (typeof param1 === 'object') {
      this.baseLogger.info(param1, param2);
    }
  }

  debug(param1: object | string, param2?: string) {
    if (typeof param1 === 'string') {
      this.baseLogger.debug(param1);
    } else if (typeof param1 === 'object') {
      this.baseLogger.debug(param1, param2);
    }
  }

  child(moduleName: string, bindings?: object): Logger {
    const combinedModuleName = this.baseLogger.bindings().module
      ? `${this.baseLogger.bindings().module}.${moduleName}`
      : moduleName;
    return new Logger(this.baseLogger.child({ module: combinedModuleName, ...bindings }));
  }
}

export function createLogger({
  options,
  stream,
  environment,
  version,
  serviceName
}: {
  options?: pino.LoggerOptions;
  stream?: pino.DestinationStream;
  environment?: string;
  version?: string;
  serviceName?: string;
} = {}) {
  const ctx = {
    environment: environment || process.env.NODE_ENV || 'local',
    service: serviceName || process.env.SERVICE_NAME || 'undefined-service-name',
    version: version || process.env.VERSION || 'undefined-version'
  };

  const defaultOptions: pino.LoggerOptions = {
    mixin() {
      return { ...ctx }; // do a copy here to prevent merging other key values into ctx
    },
    redact: {
      paths: DEFAULT_REDACTION_KEYS
    }
  };

  const combinedOpts = { ...defaultOptions, ...options };
  const baseLogger = pino(combinedOpts, stream);
  return new Logger(baseLogger);
}

/**
 * A middleware to populate response body
 */
function responseBodyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const [oldWrite, oldEnd] = [res.write, res.end];
    const chunks: Buffer[] = [];

    // Redefining a default function to populate response body
    // eslint-disable-next-line func-names
    (res.write as unknown) = function(chunk: Buffer) {
      chunks.push(Buffer.from(chunk));
      (oldWrite as Function).apply(res, arguments); // eslint-disable-line prefer-rest-params
    };

    // Redefining a default function to populate response body
    // eslint-disable-next-line func-names
    res.end = function(chunk: any): void {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks).toString();
      res.locals.body = body;
      res.locals.path = req.path;
      res.locals.method = req.method;
      (oldEnd as Function).apply(res, arguments); // eslint-disable-line prefer-rest-params
    };

    if (next) {
      next();
    }
  };
}

function attachResponseBody(res: any): any {
  try {
    res.body = JSON.parse(res.raw.locals.body);
  } catch {
    // Do nothing
  }
  return res;
}

/**
 * A function to initialize pino middleware options. It will by default log all request body. To enable response body logging, please call `responseBodyMiddleware` before
 * @param logger - logger instance
 * @param opts - pinoHttp.Options
 * @param opts.responseFilterFn - a custom function that can be passed in to log response body
 */
export function createMiddleware(logger: Logger, opts?: MiddlewareOpts) {
  const defaultOpts: Options = {
    logger: logger.baseLogger,
    autoLogging: {
      ignorePaths: ['/healthcheck/liveness', '/healthcheck/readiness']
    },
    serializers: {
      req(req: any) {
        // logs all request body
        req.body = req.raw.body;
        return req;
      },
      res(res) {
        if (opts && opts.responseFilterFn && opts.responseFilterFn(res)) {
          attachResponseBody(res);
        }
        return res;
      }
    }
  };

  const combinedOpts = { ...defaultOpts, ...opts };
  const loggerMiddleware = PinoHttp(combinedOpts);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (opts && opts.responseFilterFn) {
      return responseBodyMiddleware()(req, res, loggerMiddleware.bind(loggerMiddleware, req, res, next));
    }
    return loggerMiddleware.bind(loggerMiddleware, req, res, next)();
  };
}
